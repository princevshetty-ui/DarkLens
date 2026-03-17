import google.generativeai as genai
import json
import base64
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)

ANALYSIS_PROMPT = """You are DarkLens, an AI forensic auditor specialized in detecting 
dark patterns on Indian e-commerce and service platform interfaces.

Analyze this screenshot and identify ALL dark patterns present.

Classify each finding using India's CCPA Dark Pattern Guidelines 2023 categories:
1. False Urgency — fake timers, "only X left"
2. Basket Sneaking — items added without consent
3. Confirm Shaming — guilt language on opt-out
4. Forced Action — pre-selected paid options
5. Nagging — persistent disruptive requests
6. Subscription Trap — easy signup, hard cancel
7. Interface Interference — design tricks favoring one action
8. Bait & Switch — offer differs from reality
9. Drip Pricing — fees revealed incrementally
10. Disguised Advertisement — ads as content
11. Trick Question — confusing consent wording
12. Hidden Costs — charges at final stage only
13. Rogue Malware — unauthorized downloads

Return ONLY valid JSON in this exact structure:

{
  "platform_detected": "name of platform or Unknown",
  "page_type": "checkout",
  
  "patterns_detected": [
    {
      "ccpa_category_id": 5,
      "ccpa_category_name": "Forced Action",
      "severity": "VIOLATION",
      "severity_score": 5,
      "title": "Short headline",
      "description": "2-3 sentence explanation",
      "user_impact": "Direct impact on user, mention rupees if applicable",
      "evidence": {
        "element_type": "checkbox",
        "content": "exact text of the element",
        "visual_prominence": "high",
        "position": "where on the page"
      },
      "confidence": "high"
    }
  ],
  
  "hidden_costs": [
    {
      "label": "name of charge",
      "amount": "₹299",
      "was_disclosed_upfront": false,
      "disclosure_quality": "hidden"
    }
  ],
  
  "summary": "2-3 sentence summary of findings"
}

RULES:
- severity must be exactly: FAIR, CAUTION, or VIOLATION
- severity_score: 0-5 (5 is worst)
- Pre-selected cost checkboxes = VIOLATION severity 5
- Hidden fees at checkout = VIOLATION severity 4
- Urgency timers = CAUTION severity 3
- If page is clean, return empty arrays
- Return ONLY JSON. No markdown. No backticks."""


async def analyze_screenshot(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)

        image_data = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode("utf-8")
        }

        response = await model.generate_content_async(
            [ANALYSIS_PROMPT, image_data],
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 4096,
                "response_mime_type": "application/json"
            }
        )

        # Try to parse the JSON response
        try:
            result = json.loads(response.text)
            return {"status": "success", "data": result}
        except json.JSONDecodeError:
            # Sometimes Gemini wraps JSON in markdown — extract it
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                result = json.loads(text[start:end])
                return {"status": "success", "data": result}
            return {"status": "error", "error": "Could not parse AI response"}

    except Exception as e:
        return {"status": "error", "error": str(e)}