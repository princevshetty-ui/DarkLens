from fastapi import APIRouter, UploadFile, File, HTTPException
from services.vision_analyzer import analyze_screenshot
from services.pattern_classifier import enrich_patterns, compute_score
from datetime import datetime
import uuid

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Core endpoint: Upload screenshot → AI analysis → Classification → Score
    
    Pipeline:
    Stage 1: Validate input
    Stage 2: Send to Gemini (vision_analyzer)
    Stage 3: Enrich with CCPA taxonomy (pattern_classifier)
    Stage 4: Compute manipulation score (pattern_classifier)
    Stage 5: Build and return response
    """

    # ── Stage 1: Validate ──
    print(f"\n{'='*50}")
    print(f"[DarkLens API] New analysis request")
    print(f"[DarkLens API] File: {file.filename}, Type: {file.content_type}")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (PNG, JPG, WEBP)")

    image_bytes = await file.read()
    file_size = len(image_bytes)
    print(f"[DarkLens API] File size: {file_size} bytes ({file_size / 1024:.1f} KB)")

    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # ── Stage 2: Gemini Analysis ──
    print(f"[DarkLens API] Stage 2: Sending to Gemini...")

    vision_result = await analyze_screenshot(image_bytes, file.content_type)

    if vision_result["status"] == "error":
        error_msg = vision_result.get("error", "Unknown error")
        print(f"[DarkLens API] Stage 2 FAILED: {error_msg}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {error_msg}")

    raw_data = vision_result["data"]

    print(f"[DarkLens API] Stage 2 complete:")
    print(f"  Platform: {raw_data.get('platform_detected', 'Unknown')}")
    print(f"  Page type: {raw_data.get('page_type', 'unknown')}")
    print(f"  Raw patterns count: {len(raw_data.get('patterns_detected', []))}")
    print(f"  Raw hidden costs count: {len(raw_data.get('hidden_costs', []))}")

    # ── Stage 3: Enrich patterns ──
    print(f"[DarkLens API] Stage 3: Enriching patterns...")

    raw_patterns = raw_data.get("patterns_detected", [])
    if raw_patterns is None:
        raw_patterns = []

    enriched_patterns = enrich_patterns(raw_patterns)

    print(f"[DarkLens API] Stage 3 complete: {len(enriched_patterns)} enriched patterns")

    # Log each pattern for debugging
    for p in enriched_patterns:
        print(f"  → {p['title']} | severity={p['severity']} | "
              f"score={p['severity_score']} | cat={p['ccpa_category_id']}")

    # ── Stage 4: Compute score ──
    print(f"[DarkLens API] Stage 4: Computing manipulation score...")

    hidden_costs = raw_data.get("hidden_costs", [])
    if hidden_costs is None:
        hidden_costs = []

    score_data = compute_score(enriched_patterns, hidden_costs)

    print(f"[DarkLens API] Stage 4 complete:")
    print(f"  Manipulation score: {score_data['manipulation_score']}")
    print(f"  Grade: {score_data['grade']}")
    print(f"  Overcharge: {score_data['estimated_overcharge']}")
    print(f"  Categories violated: {score_data['categories_violated']}")

    # ── Stage 5: Build response ──
    analysis_id = f"da_{uuid.uuid4().hex[:12]}"

    response = {
        "status": "complete",
        "analysis_id": analysis_id,
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

        "summary": raw_data.get("summary", "Analysis complete."),
    }

    print(f"[DarkLens API] ✅ Analysis complete: {analysis_id}")
    print(f"  Score: {response['manipulation_score']}/100 ({response['grade']})")
    print(f"  Patterns: {response['total_patterns_found']}")
    print(f"{'='*50}\n")

    return response