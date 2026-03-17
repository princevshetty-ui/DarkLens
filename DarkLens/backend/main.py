from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, health
from config import GEMINI_API_KEY

app = FastAPI(
    title="DarkLens API",
    description="AI-Powered Dark Pattern Forensics Engine",
    version="1.0.0"
)

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://*.github.dev",
        "https://*.app.github.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)


@app.get("/")
async def root():
    return {
        "service": "DarkLens API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }


@app.on_event("startup")
async def startup_check():
    if not GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY not set in backend/.env")
    else:
        print(f"✅ Gemini API key loaded")
    print("🔍 DarkLens API running — docs at http://localhost:8000/docs")