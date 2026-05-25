from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Renovation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "FastAPI + Nginx Gateway"}