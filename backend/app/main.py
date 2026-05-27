from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from groq import Groq
import json
import os
import base64
import re
from PIL import Image
import io
from dotenv import load_dotenv
import asyncio
import traceback

# Load environment variables securely
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Propsense AI Renovation API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Keys ────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")

if not GOOGLE_API_KEY:
    raise RuntimeError("CRITICAL ERROR: GEMINI_API_KEY is not set in the .env file.")
if not GROQ_API_KEY:
    raise RuntimeError("CRITICAL ERROR: GROQ_API_KEY is not set in the .env file.")

# ── Clients ─────────────────────────────────────────────────────────────────
gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
groq_client   = Groq(api_key=GROQ_API_KEY)

# ── Shared prompt ────────────────────────────────────────────────────────────
PROMPT = """
You are an expert architectural estimator. Analyze this image.

Step 1: Validation
Does this image clearly show the exterior of a residential house/building?
If it is a dog, cow, interior room, or heavily distorted, set "is_valid_house" to false.

Step 2: Estimation
If valid, identify the following structural components:
- Main walls
- Windows
- Balconies
- Pillars/columns
- Roof edges

Use perspective estimation to estimate the total surface area in square feet for each component visible.

Respond ONLY with a raw JSON object using this exact structure, no markdown:
{
    "is_valid_house": true,
    "total_surface_area": 1500,
    "regions": [
        {"name": "Main walls", "area_sqft": 1000},
        {"name": "Windows", "area_sqft": 200},
        {"name": "Balconies", "area_sqft": 100},
        {"name": "Pillars/columns", "area_sqft": 100},
        {"name": "Roof edges", "area_sqft": 100}
    ]
}
"""

# ── Quota error detection ────────────────────────────────────────────────────
GEMINI_QUOTA_ERRORS = ("429", "quota", "rate limit", "resource exhausted", "RESOURCE_EXHAUSTED")

def _is_quota_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k.lower() in msg for k in GEMINI_QUOTA_ERRORS)

# ── Provider calls ───────────────────────────────────────────────────────────
async def _call_gemini(image: Image.Image) -> str:
    """Primary: Gemini 2.5 Flash — best spatial reasoning for this task."""
    response = await asyncio.to_thread(
        gemini_client.models.generate_content,
        model="gemini-2.5-flash",
        contents=[PROMPT, image],
    )
    return response.text

async def _call_groq(raw_base64: str) -> str:
    """Fallback: Llama 4 Maverick on Groq — kicks in on Gemini quota errors."""
    response = await asyncio.to_thread(
        groq_client.chat.completions.create,
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        temperature=0.2,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{raw_base64}"},
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    )
    return response.choices[0].message.content

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "Propsense AI Backend"}

# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        base64_string = data.get("image")

        if not base64_string:
            await websocket.send_json({"type": "error", "message": "No image data received."})
            return

        await websocket.send_json({"type": "log", "message": "Image received. Processing pixels..."})
        await asyncio.sleep(0.5)

        # Decode once — reused by both providers
        raw_base64  = base64_string.split(",")[1] if "," in base64_string else base64_string
        image_bytes = base64.b64decode(raw_base64)
        image       = Image.open(io.BytesIO(image_bytes))

        await websocket.send_json({"type": "log", "message": "Connecting to Gemini Vision Model..."})
        await websocket.send_json({"type": "log", "message": "Executing architectural perspective mapping..."})

        # ── Provider selection with automatic fallback ───────────────────────
        response_text = None
        provider_used = None

        try:
            response_text = await _call_gemini(image)
            provider_used = "Gemini 2.5 Flash"

        except Exception as gemini_exc:
            if _is_quota_error(gemini_exc):
                await websocket.send_json({
                    "type": "log",
                    "message": "Gemini quota reached. Switching to fallback model...",
                })
                try:
                    response_text = await _call_groq(raw_base64)
                    provider_used = "Llama 4 Maverick (Groq)"
                except Exception as groq_exc:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Both AI providers failed. Groq error: {str(groq_exc)}",
                    })
                    return
            else:
                raise gemini_exc
        # ────────────────────────────────────────────────────────────────────

        await websocket.send_json({
            "type": "log",
            "message": f"Data received via {provider_used}. Parsing structural areas...",
        })

        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        clean_text = json_match.group(0) if json_match else response_text.replace('```json', '').replace('```', '').strip()
        ai_data    = json.loads(clean_text)

        if not ai_data.get("is_valid_house", False):
            await websocket.send_json({
                "type": "error",
                "message": "Invalid image detected. Please upload a clear photo of a residential building exterior.",
            })
            return

        await websocket.send_json({
            "type": "success",
            "estimations": {
                "total_surface_area": ai_data.get("total_surface_area", 0),
                "regions": ai_data.get("regions", []),
            },
        })

    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print(f"Server Error: {e}")
        traceback.print_exc()
        await websocket.send_json({"type": "error", "message": f"AI Processing Failed: {str(e)}"})


@app.post("/api/visualize")
async def generate_visualization(
    image: str = Form(...),
    materials: str = Form(...)
):
    """
    Step 4: Demo Mode Visualization Endpoint
    Bypasses paid APIs to return a static high-quality render for UI demonstration.
    """
    try:
        material_mapping = json.loads(materials)
        print(f"Demo Mode received materials: {material_mapping}")

        # Simulate network/AI processing time
        await asyncio.sleep(3)

        # Beautiful demo image
        demo_image_url = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop"

        return {"status": "success", "redesigned_image": demo_image_url}

    except Exception as e:
        print(f"Visualization Error: {e}")
        return JSONResponse(status_code=500, content={"message": "Failed to generate visual."})