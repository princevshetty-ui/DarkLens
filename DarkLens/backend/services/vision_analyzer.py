import google.generativeai as genai
import json
import base64
import re
import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)

# ═══════════════════════════════════════════════════════
# THE PROMPT — Strict JSON enforcement
# ═══════════════════════════════════════════════════════

ANALYSIS_PROMPT = """You are DarkLens, an AI forensic auditor that detects dark patterns on Indian digital platforms.

CRITICAL OUTPUT RULES:
- Return ONLY a single JSON object
- Do NOT include any text before or after the JSON
- Do NOT wrap the JSON in markdown code blocks
- Do NOT say "Here is the result" or any other text
- Do NOT include backticks, triple backticks, or the word "json"
- Your entire response must start with { and end with }
- If you cannot analyze the image, still return valid JSON with empty arrays

Analyze this screenshot and identify ALL dark patterns present.

Classify each using India's CCPA Dark Pattern Guidelines 2023:
1. False Urgency — fake timers, "only X left" claims
2. Basket Sneaking — items added without consent
3. Confirm Shaming — guilt language on opt-out buttons
4. Forced Action — pre-selected paid options users must deselect
5. Nagging — persistent disruptive requests
6. Subscription Trap — easy signup, hidden/difficult cancellation
7. Interface Interference — design tricks favoring paid options
8. Bait & Switch — offer differs from what was advertised
9. Drip Pricing — fees revealed incrementally through checkout
10. Disguised Advertisement — ads styled as organic content
11. Trick Question — confusing consent wording
12. Hidden Costs — charges shown only at final payment stage
13. Rogue Malware — unauthorized downloads

Return this EXACT JSON structure:

{
  "platform_detected": "name or Unknown",
  "page_type": "search_results | product_page | cart | checkout | payment | other",
  "patterns_detected": [
    {
      "ccpa_category_id": 5,
      "ccpa_category_name": "Forced Action",
      "severity": "VIOLATION",
      "severity_score": 5,
      "title": "Short descriptive headline",
      "description": "2-3 sentence explanation of the dark pattern",
      "user_impact": "Direct impact on the user, mention rupee amounts if applicable",
      "evidence": {
        "element_type": "checkbox | button | text | price | timer | banner | link",
        "content": "exact text content of the element",
        "visual_prominence": "high | medium | low | hidden",
        "position": "where on the page"
      },
      "confidence": "high | medium | low"
    }
  ],
  "hidden_costs": [
    {
      "label": "name of charge",
      "amount": "₹299",
      "was_disclosed_upfront": false,
      "disclosure_quality": "prominent | subtle | hidden | only_at_checkout"
    }
  ],
  "summary": "2-3 sentence plain-English summary of all findings"
}

ACCURACY RULES:
- severity must be exactly one of: FAIR, CAUTION, VIOLATION
- severity_score must be an integer from 0 to 5
- Do NOT claim a checkbox is pre-selected unless you clearly see a filled/checked state
- Radio buttons where NEITHER option is selected are NOT dark patterns
- An add-on requiring the user to click "+ADD" is a legitimate upsell, NOT forced action
- Conditional discounts tied to purchasing add-ons ARE a form of nudging — flag as CAUTION
- Social proof testimonials in insurance sections ARE nudging — flag as CAUTION
- Urgency text without visible timers should be CAUTION severity 2, not VIOLATION
- If the page appears clean and transparent, return empty arrays and say so in summary
- Credibility matters more than finding problems — do NOT inflate findings
- confidence must be "high" only when evidence is unambiguous"""


# ═══════════════════════════════════════════════════════
# JSON EXTRACTION — Multiple fallback strategies
# ═══════════════════════════════════════════════════════

def extract_json_from_text(text):
    """
    Attempts to extract valid JSON from Gemini's response using 
    multiple strategies. Returns parsed dict or None.
    """
    if not text or not text.strip():
        return None

    cleaned = text.strip()

    # Strategy 1: Direct parse (ideal case)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Remove markdown code block wrappers
    # Handles: ```json\n{...}\n``` or ```{...}```
    markdown_pattern = r'```(?:json)?\s*\n?([\s\S]*?)\n?```'
    markdown_match = re.search(markdown_pattern, cleaned)
    if markdown_match:
        try:
            return json.loads(markdown_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 3: Extract between first { and last }
    first_brace = cleaned.find('{')
    last_brace = cleaned.rfind('}')
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(cleaned[first_brace:last_brace + 1])
        except json.JSONDecodeError:
            pass

    # Strategy 4: Try to fix common JSON issues
    # Remove trailing commas before } or ]
    if first_brace != -1 and last_brace > first_brace:
        attempt = cleaned[first_brace:last_brace + 1]
        attempt = re.sub(r',\s*}', '}', attempt)
        attempt = re.sub(r',\s*]', ']', attempt)
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            pass

    return None


# ═══════════════════════════════════════════════════════
# VALIDATION — Ensure response structure is correct
# ═══════════════════════════════════════════════════════

def validate_and_clean(data):
    """
    Ensures the parsed JSON has all required fields with correct types.
    Fixes common issues without crashing.
    """
    if not isinstance(data, dict):
        return get_fallback_response()

    # Ensure top-level fields exist
    result = {
        "platform_detected": data.get("platform_detected", "Unknown"),
        "page_type": data.get("page_type", "unknown"),
        "patterns_detected": [],
        "hidden_costs": [],
        "summary": data.get("summary", "Analysis complete.")
    }

    # Validate each pattern
    raw_patterns = data.get("patterns_detected", [])
    if isinstance(raw_patterns, list):
        for p in raw_patterns:
            if not isinstance(p, dict):
                continue

            # Validate severity
            severity = p.get("severity", "CAUTION")
            if severity not in ("FAIR", "CAUTION", "VIOLATION"):
                severity = "CAUTION"

            # Validate severity_score
            try:
                severity_score = int(p.get("severity_score", 3))
                severity_score = max(0, min(5, severity_score))
            except (ValueError, TypeError):
                severity_score = 3

            # Validate confidence
            confidence = p.get("confidence", "medium")
            if confidence not in ("high", "medium", "low"):
                confidence = "medium"

            # Build clean evidence
            raw_evidence = p.get("evidence", {})
            if not isinstance(raw_evidence, dict):
                raw_evidence = {}

            evidence = {
                "element_type": str(raw_evidence.get("element_type", "unknown")),
                "content": str(raw_evidence.get("content", "")),
                "visual_prominence": str(raw_evidence.get("visual_prominence", "medium")),
                "position": str(raw_evidence.get("position", "unknown"))
            }

            result["patterns_detected"].append({
                "ccpa_category_id": int(p.get("ccpa_category_id", 0)),
                "ccpa_category_name": str(p.get("ccpa_category_name", "Unknown")),
                "severity": severity,
                "severity_score": severity_score,
                "title": str(p.get("title", "Unnamed Pattern")),
                "description": str(p.get("description", "")),
                "user_impact": str(p.get("user_impact", "")),
                "evidence": evidence,
                "confidence": confidence
            })

    # Validate hidden costs
    raw_costs = data.get("hidden_costs", [])
    if isinstance(raw_costs, list):
        for c in raw_costs:
            if not isinstance(c, dict):
                continue
            result["hidden_costs"].append({
                "label": str(c.get("label", "Unknown charge")),
                "amount": str(c.get("amount", "₹0")),
                "was_disclosed_upfront": bool(c.get("was_disclosed_upfront", False)),
                "disclosure_quality": str(c.get("disclosure_quality", "unknown"))
            })

    return result


def get_fallback_response():
    """Returns a safe fallback when everything fails."""
    return {
        "platform_detected": "Unknown",
        "page_type": "unknown",
        "patterns_detected": [],
        "hidden_costs": [],
        "summary": "Analysis could not be completed. Please try again with a clearer screenshot."
    }


# ═══════════════════════════════════════════════════════
# MAIN ANALYSIS FUNCTION — With automatic retry
# ═══════════════════════════════════════════════════════

async def analyze_screenshot(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    """
    Sends screenshot to Gemini Flash for dark pattern analysis.
    
    Features:
    - Strict JSON-only prompt
    - Automatic retry on parse failure (up to 2 attempts)
    - Multiple JSON extraction strategies
    - Response validation and cleaning
    - Guaranteed valid response (never crashes)
    """
    
    image_data = {
        "mime_type": mime_type,
        "data": base64.b64encode(image_bytes).decode("utf-8")
    }

    max_retries = 2
    last_error = None

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)

            # Attempt with structured JSON output on first try
            # Fall back to plain text on retry (sometimes more reliable)
            if attempt == 0:
                generation_config = {
                    "temperature": 0.1,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json"
                }
            else:
                # Retry without forcing JSON mime type
                # Sometimes Gemini responds better in plain text mode
                generation_config = {
                    "temperature": 0.05,
                    "max_output_tokens": 4096,
                }

            response = await model.generate_content_async(
                [ANALYSIS_PROMPT, image_data],
                generation_config=generation_config
            )

            # Check if response has text
            if not response.text:
                last_error = "Empty response from Gemini"
                continue

            # Attempt to extract JSON
            parsed = extract_json_from_text(response.text)

            if parsed is not None:
                # Validate and clean the parsed data
                cleaned = validate_and_clean(parsed)
                return {"status": "success", "data": cleaned}
            else:
                last_error = f"Could not extract JSON (attempt {attempt + 1})"
                # Will retry with different config

        except Exception as e:
            last_error = str(e)

            # If it's a rate limit error, wait briefly before retry
            if "429" in str(e) or "quota" in str(e).lower():
                await asyncio.sleep(2)
            
            continue

    # All retries exhausted — return fallback (never crash)
    return {
        "status": "success",
        "data": get_fallback_response()
    }