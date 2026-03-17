import json
import os
import re

# Load our CCPA legal taxonomy
TAXONOMY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ccpa_taxonomy.json")
with open(TAXONOMY_PATH, "r") as f:
    CCPA_TAXONOMY = json.load(f)

# How much each category contributes to the overall score
# Financial harm categories (Forced Action, Drip Pricing, Bait & Switch) 
# are weighted highest
CATEGORY_WEIGHTS = {
    1: 0.6,   # False Urgency
    2: 1.0,   # Basket Sneaking
    3: 0.4,   # Confirm Shaming
    4: 0.7,   # Interface Interference
    5: 1.0,   # Forced Action (highest — direct financial harm)
    6: 0.9,   # Drip Pricing
    7: 0.3,   # Disguised Advertisement
    8: 0.3,   # Nagging
    9: 0.8,   # Subscription Trap
    10: 1.0,  # Bait & Switch
    11: 0.5,  # Trick Question
    12: 0.8,  # Hidden Costs
    13: 0.9   # Rogue Malware
}


def enrich_patterns(raw_patterns: list) -> list:
    """
    Takes Gemini's raw pattern detections and adds:
    - Unique pattern IDs (dp_001, dp_002, etc.)
    - Legal references from our CCPA taxonomy
    - Validated severity values
    """
    enriched = []
    for i, pattern in enumerate(raw_patterns):
        cat_id = pattern.get("ccpa_category_id", 0)
        taxonomy_entry = CCPA_TAXONOMY.get(str(cat_id), {})

        # Validate severity — must be exactly one of these three
        severity = pattern.get("severity", "CAUTION")
        if severity not in ["FAIR", "CAUTION", "VIOLATION"]:
            severity = "CAUTION"

        # Validate score range
        severity_score = pattern.get("severity_score", 3)
        severity_score = max(0, min(5, int(severity_score)))

        # Build clean evidence object
        raw_evidence = pattern.get("evidence", {})
        evidence = {
            "element_type": raw_evidence.get("element_type", "unknown"),
            "content": raw_evidence.get("content", ""),
            "visual_prominence": raw_evidence.get("visual_prominence", "medium"),
            "position": raw_evidence.get("position", "unknown")
        }

        enriched.append({
            "pattern_id": f"dp_{str(i + 1).zfill(3)}",
            "ccpa_category_id": cat_id,
            "ccpa_category_name": pattern.get("ccpa_category_name",
                                              taxonomy_entry.get("name", "Unknown")),
            "ccpa_legal_reference": taxonomy_entry.get("legal_reference", ""),
            "severity": severity,
            "severity_score": severity_score,
            "title": pattern.get("title", "Unnamed Pattern"),
            "description": pattern.get("description", ""),
            "user_impact": pattern.get("user_impact", ""),
            "evidence": evidence,
            "confidence": pattern.get("confidence", "medium")
        })

    return enriched


def compute_score(patterns: list, hidden_costs: list) -> dict:
    """
    Computes a 0-100 Manipulation Score based on:
    - Number of patterns detected
    - Severity of each pattern
    - Category weight (financial harm patterns count more)
    - Number of hidden costs
    
    Returns score + letter grade + color for the UI
    """
    if not patterns:
        return {
            "manipulation_score": 0,
            "grade": "A",
            "grade_label": "Clean — No manipulation detected",
            "grade_color": "#22c55e",
            "estimated_overcharge": "₹0",
            "categories_violated": []
        }

    # Calculate weighted score
    raw_score = 0
    for pattern in patterns:
        cat_id = pattern.get("ccpa_category_id", 0)
        severity = pattern.get("severity_score", 3)
        weight = CATEGORY_WEIGHTS.get(cat_id, 0.5)
        raw_score += severity * weight

    # Hidden costs add to the score
    raw_score += len(hidden_costs or []) * 2

    # Normalize to 0-100 scale
    max_possible = 13 * 5 * 1.0
    normalized = min(100, int((raw_score / max_possible) * 100 * 3.5))

    # Assign grade
    if normalized < 20:
        grade, label, color = "A", "Clean — Transparent interface", "#22c55e"
    elif normalized < 40:
        grade, label, color = "B", "Mild — Minor design concerns", "#84cc16"
    elif normalized < 60:
        grade, label, color = "C", "Moderate — Multiple manipulation patterns", "#eab308"
    elif normalized < 80:
        grade, label, color = "D", "Severe — Aggressive dark patterns", "#f97316"
    else:
        grade, label, color = "F", "Critical — Systematic manipulation", "#ef4444"

    # Calculate total hidden charges in rupees
    total_overcharge = 0
    for cost in (hidden_costs or []):
        amount_str = cost.get("amount", "₹0")
        digits = re.findall(r'\d+', str(amount_str))
        if digits:
            total_overcharge += int(digits[0])

    return {
        "manipulation_score": normalized,
        "grade": grade,
        "grade_label": label,
        "grade_color": color,
        "estimated_overcharge": f"₹{total_overcharge}" if total_overcharge else "₹0",
        "categories_violated": list(set(p["ccpa_category_id"] for p in patterns))
    }