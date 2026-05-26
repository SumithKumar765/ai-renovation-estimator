from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from google import genai
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
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Securely fetch the Gemini API key
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

if not GOOGLE_API_KEY:
    raise RuntimeError("CRITICAL ERROR: GEMINI_API_KEY is not set in the .env file.")

# Initialize the Native Gemini Client for WebSocket Analysis
client = genai.Client(api_key=GOOGLE_API_KEY)

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "Propsense AI Backend"}

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
        
        image_data = base64.b64decode(base64_string.split(",")[1])
        image = Image.open(io.BytesIO(image_data))

        await websocket.send_json({"type": "log", "message": "Connecting to Gemini Vision Model..."})
        
        prompt = """
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

        await websocket.send_json({"type": "log", "message": "Executing architectural perspective mapping..."})
        
        # Async Threading to prevent server freeze & using the 2.5-flash model for 1500 free requests
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-2.5-flash',
            contents=[prompt, image]
        )
        
        response_text = response.text
        
        await websocket.send_json({"type": "log", "message": "Data received. Parsing structural areas..."})

        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        clean_text = json_match.group(0) if json_match else response_text.replace('```json', '').replace('```', '').strip()
        ai_data = json.loads(clean_text)

        if not ai_data.get("is_valid_house", False):
            await websocket.send_json({"type": "error", "message": "Invalid image detected. Please upload a clear photo of a residential building exterior."})
            return

        await websocket.send_json({
            "type": "success",
            "estimations": {
                "total_surface_area": ai_data.get("total_surface_area", 0),
                "regions": ai_data.get("regions", [])
            }
        })

    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print(f"Server Error: {e}")
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