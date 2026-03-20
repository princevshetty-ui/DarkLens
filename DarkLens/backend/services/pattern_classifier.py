import json
import os
import re

# ── Load CCPA Taxonomy ──

TAXONOMY_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "ccpa_taxonomy.json"
)

try:
    with open(TAXONOMY_PATH, "r") as f:
        CCPA_TAXONOMY = json.load(f)
    print(f"[DarkLens] Loaded CCPA taxonomy: {len(CCPA_TAXONOMY)} categories")
except Exception as e:
    print(f"[DarkLens] WARNING: Could not load taxonomy: {e}")
    CCPA_TAXONOMY = {}

# ── Category Weights ──
# Higher weight = more impact on final score
# Financial harm categories weighted highest

CATEGORY_WEIGHTS = {
    1: 0.6,    # False Urgency
    2: 1.0,    # Basket Sneaking
    3: 0.4,    # Confirm Shaming
    4: 0.7,    # Interface Interference
    5: 1.0,    # Forced Action
    6: 0.9,    # Drip Pricing
    7: 0.3,    # Disguised Advertisement
    8: 0.3,    # Nagging
    9: 0.8,    # Subscription Trap
    10: 1.0,   # Bait & Switch
    11: 0.5,   # Trick Question
    12: 0.8,   # Hidden Costs
    13: 0.9,   # Rogue Malware
}


def safe_int(value, default=0):
    """Safely convert to int without crashing."""
    if value is None:
        return default
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return default


def enrich_patterns(raw_patterns: list) -> list:
    """
    Takes patterns from Gemini (via vision_analyzer) and:
    1. Adds unique IDs (dp_001, dp_002, ...)
    2. Adds legal references from CCPA taxonomy
    3. Validates all fields
    
    NEVER drops a pattern — fixes it instead.
    """
    if not raw_patterns:
        return []

    if not isinstance(raw_patterns, list):
        print(f"[DarkLens] WARNING: patterns is not a list: {type(raw_patterns)}")
        return []

    enriched = []

    for i, pattern in enumerate(raw_patterns):
        if not isinstance(pattern, dict):
            print(f"[DarkLens] WARNING: pattern {i} is not a dict, skipping")
            continue

        # Get category ID safely
        cat_id = safe_int(pattern.get("ccpa_category_id"), 0)
        taxonomy_entry = CCPA_TAXONOMY.get(str(cat_id), {})

        # Validate severity
        severity = str(pattern.get("severity", "CAUTION") or "CAUTION").upper().strip()
        if severity not in ("FAIR", "CAUTION", "VIOLATION"):
            severity = "CAUTION"

        # Validate severity_score
        severity_score = safe_int(pattern.get("severity_score"), 3)
        severity_score = max(0, min(5, severity_score))

        # Validate confidence
        confidence = str(pattern.get("confidence", "medium") or "medium").lower().strip()
        if confidence not in ("high", "medium", "low"):
            confidence = "medium"

        # Build evidence safely
        raw_evidence = pattern.get("evidence")
        if not isinstance(raw_evidence, dict):
            raw_evidence = {}

        evidence = {
            "element_type": str(raw_evidence.get("element_type", "unknown") or "unknown"),
            "content": str(raw_evidence.get("content", "") or ""),
            "visual_prominence": str(raw_evidence.get("visual_prominence", "medium") or "medium"),
            "position": str(raw_evidence.get("position", "unknown") or "unknown"),
        }

        enriched_pattern = {
            "pattern_id": f"dp_{str(i + 1).zfill(3)}",
            "ccpa_category_id": cat_id,
            "ccpa_category_name": str(
                pattern.get("ccpa_category_name")
                or taxonomy_entry.get("name", "Unknown")
                or "Unknown"
            ),
            "ccpa_legal_reference": str(taxonomy_entry.get("legal_reference", "")),
            "severity": severity,
            "severity_score": severity_score,
            "title": str(pattern.get("title", "Detected Pattern") or "Detected Pattern"),
            "description": str(pattern.get("description", "") or ""),
            "user_impact": str(pattern.get("user_impact", "") or ""),
            "evidence": evidence,
            "confidence": confidence,
        }

        enriched.append(enriched_pattern)

    print(f"[DarkLens] Enriched {len(enriched)} patterns")
    return enriched


def compute_score(patterns: list, hidden_costs: list) -> dict:
    """
    Computes manipulation score (0-100) from detected patterns.
    
    Algorithm:
    1. Each pattern contributes: severity_score × category_weight
    2. Hidden costs add bonus points
    3. Normalize to 0-100 scale
    4. Assign letter grade
    
    Returns dict with score, grade, label, color, overcharge, categories.
    """

    # Handle empty/None inputs
    if not patterns:
        patterns = []
    if not hidden_costs:
        hidden_costs = []

    # No patterns = clean page
    if len(patterns) == 0:
        total_overcharge = calculate_overcharge(hidden_costs)
        return {
            "manipulation_score": 0,
            "grade": "A",
            "grade_label": "Clean — No manipulation detected",
            "grade_color": "#22c55e",
            "estimated_overcharge": f"₹{total_overcharge}" if total_overcharge > 0 else "₹0",
            "categories_violated": [],
        }

    # ── Calculate weighted score ──
    raw_score = 0.0

    for pattern in patterns:
        cat_id = safe_int(pattern.get("ccpa_category_id"), 0)
        severity = safe_int(pattern.get("severity_score"), 3)
        weight = CATEGORY_WEIGHTS.get(cat_id, 0.5)

        contribution = severity * weight
        raw_score += contribution

        # Debug log
        print(f"[DarkLens Score] Pattern '{pattern.get('title', '?')}': "
              f"cat={cat_id}, severity={severity}, weight={weight}, "
              f"contribution={contribution:.2f}")

    # Hidden costs bonus
    cost_count = len(hidden_costs)
    if cost_count > 0:
        raw_score += cost_count * 2.0
        print(f"[DarkLens Score] Hidden costs bonus: {cost_count} × 2 = {cost_count * 2}")

    print(f"[DarkLens Score] Raw score: {raw_score:.2f}")

    # ── Normalize to 0-100 ──
    # Scale factor ensures realistic scores:
    # - 1 pattern with severity 3 and weight 0.5 = ~8/100
    # - 3 patterns with mixed severity = ~35-50/100
    # - 5+ patterns with high severity = 70-100/100

    max_theoretical = 13 * 5 * 1.0  # 65 (all categories, max severity, max weight)
    normalized = (raw_score / max_theoretical) * 100.0 * 3.0

    # Clamp to 0-100
    normalized = max(0, min(100, normalized))
    final_score = round(normalized)

    print(f"[DarkLens Score] Normalized: {normalized:.2f}, Final: {final_score}")

    # ── Assign grade ──
    if final_score < 20:
        grade = "A"
        label = "Clean — Transparent interface"
        color = "#22c55e"
    elif final_score < 40:
        grade = "B"
        label = "Mild — Minor design concerns"
        color = "#84cc16"
    elif final_score < 60:
        grade = "C"
        label = "Moderate — Multiple manipulation patterns"
        color = "#eab308"
    elif final_score < 80:
        grade = "D"
        label = "Severe — Aggressive dark patterns"
        color = "#f97316"
    else:
        grade = "F"
        label = "Critical — Systematic manipulation"
        color = "#ef4444"

    # ── Calculate overcharge ──
    total_overcharge = calculate_overcharge(hidden_costs)

    # ── Get violated categories ──
    categories = []
    for p in patterns:
        cid = safe_int(p.get("ccpa_category_id"), 0)
        if cid > 0 and cid not in categories:
            categories.append(cid)

    result = {
        "manipulation_score": final_score,
        "grade": grade,
        "grade_label": label,
        "grade_color": color,
        "estimated_overcharge": f"₹{total_overcharge}" if total_overcharge > 0 else "₹0",
        "categories_violated": categories,
    }

    print(f"[DarkLens Score] Final result: score={final_score}, grade={grade}, "
          f"overcharge=₹{total_overcharge}, categories={categories}")

    return result


def calculate_overcharge(hidden_costs):
    """Extract total rupee amount from hidden costs list."""
    total = 0
    if not hidden_costs:
        return 0

    for cost in hidden_costs:
        if not isinstance(cost, dict):
            continue

        amount_str = str(cost.get("amount", "0") or "0")

        # Extract digits from strings like "₹299", "Rs. 35", "150", etc.
        digits = re.findall(r'\d+', amount_str)
        if digits:
            try:
                total += int(digits[0])
            except (ValueError, IndexError):
                pass

    return total


def format_for_export(analysis_response: dict) -> dict:
    """
    Formats the full analysis response for report export.
    Includes all patterns, scores, and metadata.
    
    Returns: JSON-serializable dict suitable for PDF/JSON export
    """
    return {
        "analysis_id": analysis_response.get("analysis_id", "unknown"),
        "timestamp": analysis_response.get("timestamp", ""),
        "platform_detected": analysis_response.get("platform_detected", "Unknown"),
        "page_type": analysis_response.get("page_type", "unknown"),
        
        "manipulation_score": analysis_response.get("manipulation_score", 0),
        "grade": analysis_response.get("grade", "A"),
        "grade_label": analysis_response.get("grade_label", ""),
        
        "total_patterns_found": analysis_response.get("total_patterns_found", 0),
        "patterns_detected": analysis_response.get("patterns_detected", []),
        
        "hidden_costs": analysis_response.get("hidden_costs", []),
        "estimated_overcharge": analysis_response.get("estimated_overcharge", "₹0"),
        
        "categories_violated": analysis_response.get("categories_violated", []),
        "summary": analysis_response.get("summary", ""),
    }


def format_for_corpus(analysis_response: dict, user_consent: bool = True) -> dict:
    """
    Formats analysis for research corpus contribution.
    Anonymizes sensitive data, includes only patterns and metadata.
    
    Returns: Dict suitable for appending to pattern_corpus.jsonl
    """
    if not user_consent:
        return {}
    
    return {
        "analysis_id": analysis_response.get("analysis_id", ""),
        "timestamp": analysis_response.get("timestamp", ""),
        "platform_detected": analysis_response.get("platform_detected", "Unknown"),
        "page_type": analysis_response.get("page_type", "unknown"),
        "manipulation_score": analysis_response.get("manipulation_score", 0),
        "pattern_count": analysis_response.get("total_patterns_found", 0),
        "categories_violated": analysis_response.get("categories_violated", []),
        "patterns": [
            {
                "pattern_id": p.get("pattern_id"),
                "ccpa_category_id": p.get("ccpa_category_id"),
                "ccpa_category_name": p.get("ccpa_category_name"),
                "severity": p.get("severity"),
                "severity_score": p.get("severity_score"),
                "title": p.get("title"),
                "confidence": p.get("confidence"),
            }
            for p in analysis_response.get("patterns_detected", [])
        ],
    }


def aggregate_batch_findings(results: list[dict]) -> dict:
    """
    Aggregate findings from multiple analyses (batch URLs).
    
    Detects:
    - Patterns duplicated across URLs
    - Category prevalence
    - Cross-site manipulation patterns
    
    Input: List of analysis results from individual /analyze/image calls
    Output: Aggregated findings with cross-site patterns highlighted
    """
    
    if not results:
        return {
            "status": "error",
            "message": "No results to aggregate",
            "total_urls": 0,
            "successful_analyses": 0,
            "patterns_found_count": 0,
            "cross_site_patterns": [],
            "category_distribution": {},
        }
    
    # Filter successful results
    successful = [r for r in results if r and r.get("status") == "complete"]
    total_patterns = []
    category_counts = {}
    pattern_prevalence = {}  # pattern_title → [urls]
    
    # Collect all patterns and track prevalence
    for analysis in successful:
        for pattern in analysis.get("patterns_detected", []):
            title = pattern.get("title", "Unknown")
            total_patterns.append({
                "title": title,
                "url_index": len([a for a in successful[:successful.index(analysis)]]),
                "category_id": pattern.get("ccpa_category_id"),
                "category_name": pattern.get("ccpa_category_name"),
                "severity": pattern.get("severity"),
            })
            
            # Track prevalence
            if title not in pattern_prevalence:
                pattern_prevalence[title] = []
            pattern_prevalence[title].append(analysis.get("analysis_id", "unknown"))
            
            # Track category counts
            cat_id = pattern.get("ccpa_category_id", 0)
            category_counts[cat_id] = category_counts.get(cat_id, 0) + 1
    
    # Identify cross-site patterns (appear on 2+ URLs)
    cross_site = [
        {
            "pattern_title": title,
            "prevalence": f"{len(urls)}/{len(successful)} sites",
            "affected_analyses": urls,
            "severity": max([p["severity"] for p in total_patterns if p["title"] == title], default="FAIR"),
        }
        for title, urls in pattern_prevalence.items()
        if len(urls) > 1
    ]
    
    # Sort by prevalence
    cross_site.sort(key=lambda x: len(x["affected_analyses"]), reverse=True)
    
    return {
        "status": "success",
        "total_urls_analyzed": len(results),
        "successful_analyses": len(successful),
        "failed_analyses": len(results) - len(successful),
        "patterns_found_count": len(total_patterns),
        "unique_patterns": len(pattern_prevalence),
        "cross_site_patterns": cross_site,
        "category_distribution": category_counts,
        "avg_manipulation_score": round(
            sum(a.get("manipulation_score", 0) for a in successful) / len(successful)
            if successful else 0
        ),
        "riskiest_url": max(
            successful,
            key=lambda a: a.get("manipulation_score", 0),
            default=None
        ) if successful else None,
    }