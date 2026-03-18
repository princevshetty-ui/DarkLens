import google.generativeai as genai
import json
import base64
import re
import os
import sys
import asyncio
from io import BytesIO
from PIL import Image, UnidentifiedImageError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)

MAX_IMAGE_DIMENSION = 1800
TARGET_IMAGE_BYTES = 1_500_000
MIN_JPEG_QUALITY = 55

ANALYSIS_PROMPT = """You are DarkLens, an AI forensic auditor that detects dark patterns on Indian digital platforms.

OUTPUT RULES:
- Return ONLY a JSON object
- Start with { and end with }
- No markdown, no backticks, no explanation text

DETECTION RULES:

Checkbox/Radio accuracy:
- A checkbox is pre-selected ONLY if you see a visible checkmark or filled state
- Empty radio buttons where neither is selected means the user has a free choice — flag as CAUTION at most, not VIOLATION
- If uncertain about selection state, use CAUTION not VIOLATION

What to detect:
- Pre-selected checkboxes that add cost (if visually checked) → VIOLATION severity 5
- Fees appearing only at checkout → VIOLATION severity 4
- Items auto-added to cart → VIOLATION severity 5
- Conditional discounts tied to buying add-ons → CAUTION severity 3
- Social proof/testimonials pushing paid options → CAUTION severity 2
- Urgency timers or scarcity claims → CAUTION severity 3
- Asymmetric button design (big Accept vs tiny Skip) → CAUTION severity 3
- Guilt language on decline buttons → CAUTION severity 3
- Position bias (paid option listed first) → CAUTION severity 1
- Prominent upsell banners in checkout flow → CAUTION severity 2

Classify using India's CCPA Dark Pattern Guidelines 2023:
1. False Urgency  2. Basket Sneaking  3. Confirm Shaming  4. Forced Action
5. Nagging  6. Subscription Trap  7. Interface Interference  8. Bait & Switch
9. Drip Pricing  10. Disguised Advertisement  11. Trick Question
12. Hidden Costs  13. Rogue Malware

Return this JSON structure:

{
  "platform_detected": "name or Unknown",
  "page_type": "search_results | product_page | cart | checkout | payment | other",
  "patterns_detected": [
    {
      "ccpa_category_id": 5,
      "ccpa_category_name": "Forced Action",
      "severity": "VIOLATION",
      "severity_score": 5,
      "title": "Short headline",
      "description": "2-3 sentence explanation",
      "user_impact": "Direct user impact, mention rupees if applicable",
      "evidence": {
        "element_type": "checkbox",
        "content": "exact text of element",
        "visual_prominence": "high",
        "position": "where on page"
      },
      "confidence": "high"
    }
  ],
  "hidden_costs": [
    {
      "label": "charge name",
      "amount": "₹299",
      "was_disclosed_upfront": false,
      "disclosure_quality": "hidden"
    }
  ],
  "summary": "2-3 sentence summary"
}

IMPORTANT:
- severity must be exactly: FAIR, CAUTION, or VIOLATION
- severity_score must be a number 0 to 5
- Always try to find at least subtle patterns like nudging, upsells, or position bias
- If the page is genuinely clean, return empty arrays — but look carefully first
- It is better to find real CAUTION-level patterns than to miss them"""


def extract_json(text):
    """Extract JSON from Gemini response using multiple strategies."""
    if not text or not text.strip():
        return None

    cleaned = text.strip()

    # Strategy 1: Direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Remove markdown wrappers
    md = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', cleaned)
    if md:
        try:
            return json.loads(md.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 3: Extract between first { and last }
    first = cleaned.find('{')
    last = cleaned.rfind('}')
    if first != -1 and last > first:
        try:
            return json.loads(cleaned[first:last + 1])
        except json.JSONDecodeError:
            pass

        # Strategy 4: Fix trailing commas
        attempt = cleaned[first:last + 1]
        attempt = re.sub(r',\s*}', '}', attempt)
        attempt = re.sub(r',\s*]', ']', attempt)
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            pass

    return None


def safe_int(value, default=0):
    """Safely convert any value to int."""
    if value is None:
        return default
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return default


def clean_response(data):
    """
    Validate and clean the parsed response.
    Ensures all fields exist with correct types.
    Never drops patterns — fixes them instead.
    """
    if not isinstance(data, dict):
        return fallback_response()

    result = {
        "platform_detected": str(data.get("platform_detected", "Unknown") or "Unknown"),
        "page_type": str(data.get("page_type", "unknown") or "unknown"),
        "patterns_detected": [],
        "hidden_costs": [],
        "summary": str(data.get("summary", "Analysis complete.") or "Analysis complete.")
    }

    # Process patterns — fix issues, never drop
    raw_patterns = data.get("patterns_detected")
    if raw_patterns and isinstance(raw_patterns, list):
        for p in raw_patterns:
            if not isinstance(p, dict):
                continue

            # Fix severity
            severity = str(p.get("severity", "CAUTION") or "CAUTION").upper().strip()
            if severity not in ("FAIR", "CAUTION", "VIOLATION"):
                severity = "CAUTION"

            # Fix severity_score
            severity_score = safe_int(p.get("severity_score"), 3)
            severity_score = max(0, min(5, severity_score))

            # Fix ccpa_category_id
            cat_id = safe_int(p.get("ccpa_category_id"), 0)
            if cat_id < 0 or cat_id > 13:
                cat_id = 0

            # Fix confidence
            confidence = str(p.get("confidence", "medium") or "medium").lower().strip()
            if confidence not in ("high", "medium", "low"):
                confidence = "medium"

            # Build evidence safely
            raw_ev = p.get("evidence")
            if not isinstance(raw_ev, dict):
                raw_ev = {}

            evidence = {
                "element_type": str(raw_ev.get("element_type", "unknown") or "unknown"),
                "content": str(raw_ev.get("content", "") or ""),
                "visual_prominence": str(raw_ev.get("visual_prominence", "medium") or "medium"),
                "position": str(raw_ev.get("position", "unknown") or "unknown")
            }

            pattern = {
                "ccpa_category_id": cat_id,
                "ccpa_category_name": str(p.get("ccpa_category_name", "Unknown") or "Unknown"),
                "severity": severity,
                "severity_score": severity_score,
                "title": str(p.get("title", "Detected Pattern") or "Detected Pattern"),
                "description": str(p.get("description", "") or ""),
                "user_impact": str(p.get("user_impact", "") or ""),
                "evidence": evidence,
                "confidence": confidence
            }

            result["patterns_detected"].append(pattern)

    # Process hidden costs
    raw_costs = data.get("hidden_costs")
    if raw_costs and isinstance(raw_costs, list):
        for c in raw_costs:
            if not isinstance(c, dict):
                continue

            cost = {
                "label": str(c.get("label", "Unknown charge") or "Unknown charge"),
                "amount": str(c.get("amount", "₹0") or "₹0"),
                "was_disclosed_upfront": bool(c.get("was_disclosed_upfront", False)),
                "disclosure_quality": str(c.get("disclosure_quality", "unknown") or "unknown")
            }

            result["hidden_costs"].append(cost)

    return result


def fallback_response():
    """Safe fallback that never crashes the API."""
    return {
        "platform_detected": "Unknown",
        "page_type": "unknown",
        "patterns_detected": [],
        "hidden_costs": [],
        "summary": "Analysis could not be completed. Please try again with a clearer screenshot."
    }


def preprocess_image(image_bytes: bytes, mime_type: str = "image/png"):
    """
    Resize and compress images to reduce Gemini latency/timeouts.
    Returns: (processed_bytes, processed_mime_type)
    """
    try:
        image = Image.open(BytesIO(image_bytes))
    except (UnidentifiedImageError, OSError):
        print("[DarkLens] Image preprocessing skipped: could not decode image")
        return image_bytes, mime_type

    original_size = len(image_bytes)
    width, height = image.size

    # Resize oversized screenshots while preserving aspect ratio.
    max_side = max(width, height)
    if max_side > MAX_IMAGE_DIMENSION:
        scale = MAX_IMAGE_DIMENSION / float(max_side)
        new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Flatten alpha and normalize to RGB for efficient JPEG encoding.
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.getchannel("A")
        background.paste(image.convert("RGB"), mask=alpha)
        image = background
    elif image.mode == "P":
        image = image.convert("RGB")
    elif image.mode != "RGB":
        image = image.convert("RGB")

    best = None
    for quality in (88, 80, 72, 65, MIN_JPEG_QUALITY):
        buffer = BytesIO()
        image.save(buffer, format="JPEG", optimize=True, quality=quality)
        candidate = buffer.getvalue()
        if best is None or len(candidate) < len(best):
            best = candidate
        if len(candidate) <= TARGET_IMAGE_BYTES:
            best = candidate
            break

    if best is None:
        return image_bytes, mime_type

    processed_size = len(best)
    if processed_size < original_size:
        print(
            f"[DarkLens] Image optimized: {original_size / 1024:.1f}KB -> "
            f"{processed_size / 1024:.1f}KB | size={image.size[0]}x{image.size[1]}"
        )
        return best, "image/jpeg"

    return image_bytes, mime_type


async def analyze_screenshot(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """
    Core analysis function.
    Sends image to Gemini, parses response, validates data.
    Retries once on failure. Never crashes.
    """
    processed_bytes, processed_mime_type = preprocess_image(image_bytes, mime_type)

    image_data = {
        "mime_type": processed_mime_type,
        "data": base64.b64encode(processed_bytes).decode("utf-8")
    }

    for attempt in range(2):
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)

            # First attempt: force JSON output
            # Second attempt: plain text (sometimes more reliable)
            if attempt == 0:
                config = {
                    "temperature": 0.15,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json"
                }
            else:
                config = {
                    "temperature": 0.1,
                    "max_output_tokens": 4096,
                }

            response = await model.generate_content_async(
                [ANALYSIS_PROMPT, image_data],
                generation_config=config
            )

            if not response.text:
                print(f"[DarkLens] Attempt {attempt + 1}: Empty response from Gemini")
                continue

            # Try to parse
            parsed = extract_json(response.text)

            if parsed is not None:
                cleaned = clean_response(parsed)
                print(f"[DarkLens] Success: {len(cleaned['patterns_detected'])} patterns, "
                      f"{len(cleaned['hidden_costs'])} hidden costs")
                return {"status": "success", "data": cleaned}
            else:
                print(f"[DarkLens] Attempt {attempt + 1}: JSON parse failed")
                print(f"[DarkLens] Raw response (first 300 chars): {response.text[:300]}")

        except Exception as e:
            print(f"[DarkLens] Attempt {attempt + 1} error: {str(e)}")
            if "429" in str(e) or "quota" in str(e).lower():
                await asyncio.sleep(2)
            continue

    # All attempts failed — return fallback
    print("[DarkLens] All attempts failed, returning fallback")
    return {"status": "success", "data": fallback_response()}