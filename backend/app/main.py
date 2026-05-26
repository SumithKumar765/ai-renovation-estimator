from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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

# Securely fetch the API key
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("CRITICAL ERROR: GEMINI_API_KEY is not set in the .env file.")

# Initialize the new Google GenAI Client
client = genai.Client(api_key=GOOGLE_API_KEY)

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "Propsense AI WebSocket Backend"}

@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    try:
        # 1. Wait for the frontend to send the image
        data = await websocket.receive_json()
        base64_string = data.get("image")
        
        if not base64_string:
            await websocket.send_json({"type": "error", "message": "No image data received."})
            return

        # 2. Stream Log: Image received
        await websocket.send_json({"type": "log", "message": "Image received. Processing pixels..."})
        await asyncio.sleep(0.5) 
        
        # Decode the base64 string to a PIL Image
        image_data = base64.b64decode(base64_string.split(",")[1])
        image = Image.open(io.BytesIO(image_data))

        # 3. Stream Log: Connecting to AI
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

        # 4. Stream Log: Analyzing Structure
        await websocket.send_json({"type": "log", "message": "Executing architectural perspective mapping..."})
        
        # USE GEMINI 3.5 FLASH (The current active free-tier model)
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[prompt, image]
        )
        response_text = response.text
        
        # 5. Stream Log: Processing Results
        await websocket.send_json({"type": "log", "message": "Data received. Parsing structural areas..."})

        # Clean JSON using Regex to handle any markdown the AI might try to add
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        clean_text = json_match.group(0) if json_match else response_text.replace('```json', '').replace('```', '').strip()
        ai_data = json.loads(clean_text)

        # 6. Enforce PRD 5.1 Rejection
        if not ai_data.get("is_valid_house", False):
            await websocket.send_json({"type": "error", "message": "Invalid image detected. Please upload a clear photo of a residential building exterior."})
            return

        # 7. Send the final success payload
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