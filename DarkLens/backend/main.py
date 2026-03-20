from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import analyze, health
from config import GEMINI_API_KEY, UVICORN_TIMEOUT_KEEP_ALIVE
import logging
import os

logger = logging.getLogger(__name__)

app = FastAPI(
    title="DarkLens API",
    description="AI-Powered Dark Pattern Forensics Engine for Indian E-commerce",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Allow frontend to talk to backend
# NOTE: wildcard hostnames like "https://*.github.dev" are not valid in allow_origins.
# Use allow_origin_regex for Codespaces / github.dev based hosts.
cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
if cors_origins_env.strip():
    cors_origins.extend([origin.strip() for origin in cors_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https://.*(app\.)?github\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)


@app.get("/")
async def root():
    # In single-service deployments (Render/Docker), serve the frontend at root.
    if frontend_dist:
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

    # Fallback for API-only mode.
    return {
        "service": "DarkLens API",
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/api/health",
        "version": "1.0.0"
    }


@app.get("/api")
async def api_root():
    return {
        "service": "DarkLens API",
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/api/health",
        "version": "1.0.0"
    }


# ── Static File Serving (Production) ──
# In production, the frontend is built and placed in /frontend/dist
# This serves the SPA (Single Page Application) properly
# Support both repository layouts:
# 1) /workspaces/DarkLens/frontend/dist
# 2) /workspaces/DarkLens/DarkLens/frontend/dist
frontend_candidates = [
    Path(__file__).resolve().parents[2] / "frontend" / "dist",
    Path(__file__).resolve().parents[1] / "frontend" / "dist",
]
frontend_dist = next((p for p in frontend_candidates if p.exists()), None)

if frontend_dist:
    # Mount static files (CSS, JS, images)
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    
    # Serve index.html for all unknown routes (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the SPA frontend or static assets."""
        # If it's an API route, it will be handled above
        if full_path.startswith("api/"):
            return JSONResponse({"error": "Not found"}, status_code=404)
        
        # Try to serve a static file first
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Otherwise, serve index.html (SPA routing)
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return JSONResponse({"error": "Frontend not found. Build the frontend with 'npm run build'"}, status_code=404)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with structured JSON response."""
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": "Validation Error",
            "details": exc.errors(),
            "message": "Request validation failed. Check the docs at /docs for correct request format."
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors with structured JSON response."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later.",
            "request_path": str(request.url.path)
        }
    )


@app.on_event("startup")
async def startup_check():
    if not GEMINI_API_KEY:
        logger.warning("⚠️  WARNING: GEMINI_API_KEY not set in backend/.env")
    else:
        logger.info("✅ Gemini API key loaded")
    logger.info("🔍 DarkLens API v1.0.0 running — docs at http://localhost:8000/docs")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        timeout_keep_alive=UVICORN_TIMEOUT_KEEP_ALIVE,
    )