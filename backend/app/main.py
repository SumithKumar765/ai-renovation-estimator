from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random

app = FastAPI(title="Propsense AI Renovation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulated AI Vision Validation (PRD 5.1)
async def verify_exterior_image(filename: str, file_bytes: bytes) -> bool:
    """
    In production, this is where you pass file_bytes to the Google Gemini Vision API 
    with the prompt: "Does this image clearly show the exterior of a residential house? Reply YES or NO."
    """
    await asyncio.sleep(1.0) # Simulating API latency
    
    # For prototype testing: If you name a test file "dog.jpg" or "cow.png", it will fail validation.
    # Otherwise, it passes as a valid house exterior.
    test_name = filename.lower()
    if "cow" in test_name or "dog" in test_name or "selfie" in test_name:
        return False
    
    return True

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "FastAPI Backend"}

@app.post("/api/analyze")
async def analyze_exterior(file: UploadFile = File(...)):
    
    file_bytes = await file.read()
    
    # 1. PRD 5.1: Validate Input Quality
    is_valid_house = await verify_exterior_image(file.filename, file_bytes)
    
    if not is_valid_house:
        # Reject the image and throw an error back to the React frontend
        raise HTTPException(
            status_code=400, 
            detail="Invalid image detected. Please upload a clear photo of a residential building exterior."
        )
    
    # 2. PRD 5.2 & 5.5: Process Valid Images
    await asyncio.sleep(1.5) 
    
    return {
        "status": "success",
        "filename": file.filename,
        "estimations": {
            "total_surface_area": random.randint(1500, 2000),
            "regions": [
                {"name": "Main walls", "area_sqft": random.randint(800, 1200)},
                {"name": "Windows", "area_sqft": random.randint(150, 300)},
                {"name": "Balconies", "area_sqft": random.randint(80, 150)},
                {"name": "Pillars/columns", "area_sqft": random.randint(40, 100)},
                {"name": "Roof edges", "area_sqft": random.randint(50, 120)}
            ]
        }
    }