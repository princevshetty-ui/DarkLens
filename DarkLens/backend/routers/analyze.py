from fastapi import APIRouter, UploadFile, File, HTTPException
from services.vision_analyzer import analyze_screenshot
from services.pattern_classifier import enrich_patterns, compute_score
from datetime import datetime
import uuid

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    THE CORE ENDPOINT
    Upload screenshot → AI analysis → CCPA classification → Score → Report
    """
    
    # --- Validation ---
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # --- Stage 1: Send to Gemini ---
    vision_result = await analyze_screenshot(image_bytes, file.content_type)

    if vision_result["status"] == "error":
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {vision_result.get('error', 'Unknown')}"
        )

    raw_data = vision_result["data"]

    # --- Stage 2: Enrich with CCPA taxonomy ---
    raw_patterns = raw_data.get("patterns_detected", [])
    enriched_patterns = enrich_patterns(raw_patterns)

    # --- Stage 3: Compute manipulation score ---
    hidden_costs = raw_data.get("hidden_costs", [])
    score_data = compute_score(enriched_patterns, hidden_costs)

    # --- Stage 4: Build response ---
    return {
        "status": "complete",
        "analysis_id": f"da_{uuid.uuid4().hex[:12]}",
        "platform_detected": raw_data.get("platform_detected", "Unknown"),
        "page_type": raw_data.get("page_type", "unknown"),
        "timestamp": datetime.now().isoformat(),
        "patterns_detected": enriched_patterns,
        "total_patterns_found": len(enriched_patterns),
        "categories_violated": score_data["categories_violated"],
        "hidden_costs": hidden_costs,
        "estimated_overcharge": score_data["estimated_overcharge"],
        "manipulation_score": score_data["manipulation_score"],
        "grade": score_data["grade"],
        "grade_label": score_data["grade_label"],
        "grade_color": score_data["grade_color"],
        "summary": raw_data.get("summary", "Analysis complete.")
    }