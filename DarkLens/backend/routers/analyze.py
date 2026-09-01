from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from services.vision_analyzer import analyze_screenshot
from services.pattern_classifier import enrich_patterns, compute_score, format_for_export, format_for_corpus, aggregate_batch_findings
from services.crawler import batch_crawl_and_screenshot, LoginWallDetected
from services.cache import get_cache
from datetime import datetime
import uuid
import json
import os
import asyncio
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

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


@router.post("/reports/export")
async def export_report(analysis_data: dict):
    """
    Export analysis results as JSON or PDF.
    
    Input: Full analysis response from /analyze/image
    Output: JSON file with formatted patterns and metadata
    
    Usage:
    POST /api/reports/export
    {
        "analysis_response": { ... full analysis from /analyze/image ... },
        "format": "json"  # or "pdf"
    }
    """
    try:
        analysis_response = analysis_data.get("analysis_response", {})
        export_format = analysis_data.get("format", "json").lower()
        
        if not analysis_response or not analysis_response.get("analysis_id"):
            raise HTTPException(status_code=400, detail="Invalid analysis data provided")
        
        # Format for export
        formatted_data = format_for_export(analysis_response)
        
        if export_format == "json":
            # Return JSON with download headers
            analysis_id = analysis_response.get("analysis_id", "report")
            return JSONResponse(
                content=formatted_data,
                headers={
                    "Content-Disposition": f'attachment; filename="{analysis_id}_report.json"'
                }
            )
        
        elif export_format == "pdf":
            # Generate PDF and stream bytes directly
            pdf_bytes = generate_pdf_report(formatted_data)
            analysis_id = analysis_response.get("analysis_id", "report")

            return StreamingResponse(
                BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{analysis_id}_report.pdf"'
                },
            )
        
        else:
            raise HTTPException(status_code=400, detail="Format must be 'json' or 'pdf'")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DarkLens API] Report export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Report export failed: {str(e)}")


@router.post("/research/contribute")
async def contribute_to_corpus(contribution_data: dict):
    """
    Contribute anonymized pattern findings to the research corpus.
    
    Input: Full analysis response + user consent flag
    Output: Success confirmation
    
    Usage:
    POST /api/research/contribute
    {
        "analysis_response": { ... full analysis from /analyze/image ... },
        "consent": true
    }
    
    The contribution is appended to data/pattern_corpus.jsonl (one JSON per line)
    """
    try:
        analysis_response = contribution_data.get("analysis_response", {})
        consent = contribution_data.get("consent", False)
        
        if not analysis_response or not analysis_response.get("analysis_id"):
            raise HTTPException(status_code=400, detail="Invalid analysis data provided")
        
        if not consent:
            raise HTTPException(status_code=400, detail="User must consent to data contribution")
        
        # Format for corpus (anonymized)
        formatted_entry = format_for_corpus(analysis_response, user_consent=True)
        
        # Append to JSONL file (create if doesn't exist)
        corpus_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "pattern_corpus.jsonl"
        )
        
        os.makedirs(os.path.dirname(corpus_path), exist_ok=True)
        
        # Append as newline-delimited JSON
        with open(corpus_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(formatted_entry) + "\n")
        
        print(f"[DarkLens API] ✅ Pattern contributed to corpus: {analysis_response.get('analysis_id')}")
        
        return {
            "status": "success",
            "message": "Thank you! Your pattern findings have been contributed to the Dark Pattern research database.",
            "analysis_id": analysis_response.get("analysis_id"),
            "patterns_contributed": formatted_entry.get("pattern_count", 0),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DarkLens API] Corpus contribution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Contribution failed: {str(e)}")


@router.post("/analyze/url")
async def analyze_url_endpoint(url_data: dict):
    """
    Analyze a live URL by auto-crawling and screenshotting it.

    Pipeline:
    Stage 1: Validate URL (allowlist check)
    Stage 2: Crawl with Playwright → screenshot
    Stage 3: Send screenshot to Gemini (vision_analyzer)
    Stage 4: Enrich patterns with CCPA taxonomy
    Stage 5: Compute manipulation score
    Stage 6: Return response

    Input:
    { "url": "https://flipkart.com/..." }
    """
    url = str(url_data.get("url", "") or "").strip()

    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    from services.crawler import crawl_and_screenshot, is_url_allowed, ALLOWED_DOMAINS

    if not is_url_allowed(url):
        raise HTTPException(
            status_code=400,
            detail=f"Only these platforms are supported: {', '.join(sorted(ALLOWED_DOMAINS))}",
        )

    print(f"\n{'='*50}")
    print(f"[DarkLens API] URL analysis request: {url}")

    # ── Stage 2: Crawl ──
    try:
        image_bytes = await crawl_and_screenshot(url)
    except LoginWallDetected as e:
        print(f"[DarkLens API] Login wall detected for {url}: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail={
                "error_type": "login_wall",
                "message": (
                    "This page requires you to be logged in. "
                    "DarkLens can only analyze public pages that don't need authentication."
                ),
                "hint": (
                    "Try a product listing page or search results URL, e.g. "
                    "https://www.flipkart.com/search?q=laptop or "
                    "https://www.amazon.in/s?k=headphones"
                ),
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[DarkLens API] Crawl failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to crawl URL: {str(e)}")

    if not image_bytes:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot from URL")

    print(f"[DarkLens API] Screenshot captured ({len(image_bytes) / 1024:.1f} KB), analyzing...")

    # ── Stage 3: Gemini Analysis ──
    vision_result = await analyze_screenshot(image_bytes, "image/jpeg")
    if vision_result["status"] == "error":
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {vision_result.get('error')}")

    raw_data = vision_result["data"]

    # ── Stage 4: Enrich patterns ──
    raw_patterns = raw_data.get("patterns_detected", []) or []
    enriched_patterns = enrich_patterns(raw_patterns)

    # ── Stage 5: Compute score ──
    hidden_costs = raw_data.get("hidden_costs", []) or []
    score_data = compute_score(enriched_patterns, hidden_costs)

    analysis_id = f"da_{uuid.uuid4().hex[:12]}"

    response = {
        "status": "complete",
        "analysis_id": analysis_id,
        "source_url": url,
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

    print(f"[DarkLens API] ✅ URL Analysis complete: {analysis_id}")
    print(f"  Score: {response['manipulation_score']}/100 ({response['grade']})")
    print(f"{'='*50}\n")

    return response


@router.get("/leaderboard")
async def get_leaderboard():
    """
    Get community-powered platform manipulation leaderboard.

    Reads from the contributed research corpus (pattern_corpus.jsonl) and
    aggregates average manipulation scores per platform.

    Returns:
    {
        "status": "success",
        "total_platforms": N,
        "total_analyses": N,
        "leaderboard": [
            { "platform": "Flipkart", "avg_manipulation_score": 72.5, "grade": "D", ... },
            ...
        ]
    }
    """
    corpus_path = os.path.join(os.path.dirname(__file__), "..", "data", "pattern_corpus.jsonl")

    platform_stats: dict = {}

    try:
        if os.path.exists(corpus_path):
            with open(corpus_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        platform = entry.get("platform_detected", "Unknown")
                        if not platform or platform in ("Unknown", "unknown", ""):
                            continue
                        score = float(entry.get("manipulation_score", 0))
                        patterns = int(entry.get("pattern_count", 0))
                        categories = entry.get("categories_violated", [])

                        if platform not in platform_stats:
                            platform_stats[platform] = {
                                "scores": [],
                                "patterns": [],
                                "categories": set(),
                            }

                        platform_stats[platform]["scores"].append(score)
                        platform_stats[platform]["patterns"].append(patterns)
                        platform_stats[platform]["categories"].update(
                            c for c in categories if isinstance(c, (int, float))
                        )
                    except Exception:
                        continue
    except Exception as e:
        print(f"[Leaderboard] Error reading corpus: {e}")

    def _grade(s: float) -> str:
        if s < 20:
            return "A"
        if s < 40:
            return "B"
        if s < 60:
            return "C"
        if s < 80:
            return "D"
        return "F"

    leaderboard = []
    for platform, stats in platform_stats.items():
        n = len(stats["scores"])
        if n == 0:
            continue
        avg_score = sum(stats["scores"]) / n
        avg_patterns = sum(stats["patterns"]) / len(stats["patterns"])
        leaderboard.append({
            "platform": platform,
            "avg_manipulation_score": round(avg_score, 1),
            "avg_patterns": round(avg_patterns, 1),
            "total_analyses": n,
            "grade": _grade(avg_score),
            "categories_count": len(stats["categories"]),
        })

    leaderboard.sort(key=lambda x: x["avg_manipulation_score"], reverse=True)

    return {
        "status": "success",
        "total_platforms": len(leaderboard),
        "total_analyses": sum(p["total_analyses"] for p in leaderboard),
        "leaderboard": leaderboard[:10],
        "generated_at": datetime.now().isoformat(),
    }


@router.post("/batch/analyze")
async def analyze_batch_urls(batch_data: dict):
    """
    Analyze multiple URLs in batch mode.
    
    Pipeline:
    1. Validate URLs (allowlist: flipkart.com, amazon.in, myntra.com, paytm.com)
    2. Crawl each URL using Playwright
    3. Run vision analysis on each screenshot
    4. Aggregate findings (cross-site patterns, prevalence)
    5. Return per-URL + aggregate results
    
    Input:
    {
        "urls": ["https://flipkart.com/...", ...],
        "max_urls": 5  # Max URLs per batch (free tier)
    }
    
    Output:
    {
        "status": "complete",
        "batch_id": "ba_...",
        "results": [
            { "url": "...", "status": "complete", "analysis": { ... } },
            { "url": "...", "status": "error", "error": "..." }
        ],
        "aggregate": { cross-site patterns, category distribution, avg score }
    }
    """
    try:
        urls = batch_data.get("urls", [])
        max_urls = batch_data.get("max_urls", 5)
        
        # Validate input
        if not urls or not isinstance(urls, list):
            raise HTTPException(status_code=400, detail="Invalid URLs provided")
        
        if len(urls) > max_urls:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {max_urls} URLs per batch (received {len(urls)})"
            )
        
        if len(urls) == 0:
            raise HTTPException(status_code=400, detail="At least 1 URL required")
        
        print(f"\n{'='*50}")
        print(f"[DarkLens API] Batch analysis starting: {len(urls)} URLs")
        
        batch_id = f"ba_{uuid.uuid4().hex[:12]}"
        
        # ── Stage 1: Crawl all URLs ──
        print(f"[DarkLens API] Stage 1: Crawling {len(urls)} URLs...")
        try:
            crawl_results = await batch_crawl_and_screenshot(urls, max_concurrent=2)
        except Exception as e:
            print(f"[DarkLens API] Crawl failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Crawling failed: {str(e)}")
        
        # ── Stage 2: Analyze each screenshot ──
        print(f"[DarkLens API] Stage 2: Analyzing {len(crawl_results)} screenshots...")
        
        analysis_results = []
        successful_analyses = []
        
        for url, crawl_data in crawl_results.items():
            if crawl_data["status"] != "success":
                print(f"[DarkLens API] Crawl failed for {url}: {crawl_data['error']}")
                analysis_results.append({
                    "url": url,
                    "status": "error",
                    "error": crawl_data["error"],
                    "analysis": None,
                })
                continue
            
            try:
                # Analyze screenshot
                image_bytes = crawl_data["image_bytes"]
                vision_result = await analyze_screenshot(image_bytes, "image/jpeg")
                
                if vision_result["status"] == "error":
                    raise Exception(vision_result.get("error", "Unknown AI error"))
                
                raw_data = vision_result["data"]
                
                # Enrich patterns
                raw_patterns = raw_data.get("patterns_detected", []) or []
                enriched_patterns = enrich_patterns(raw_patterns)
                
                # Compute score
                hidden_costs = raw_data.get("hidden_costs", []) or []
                score_data = compute_score(enriched_patterns, hidden_costs)
                
                # Build per-URL response
                analysis_id = f"da_{uuid.uuid4().hex[:12]}"
                per_url_analysis = {
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
                
                analysis_results.append({
                    "url": url,
                    "status": "complete",
                    "error": None,
                    "analysis": per_url_analysis,
                })
                successful_analyses.append(per_url_analysis)
                
                print(f"[DarkLens API] ✅ {url}: {per_url_analysis['manipulation_score']}/100")
            
            except Exception as e:
                print(f"[DarkLens API] Analysis failed for {url}: {str(e)}")
                analysis_results.append({
                    "url": url,
                    "status": "error",
                    "error": str(e),
                    "analysis": None,
                })
        
        # ── Stage 3: Aggregate findings ──
        print(f"[DarkLens API] Stage 3: Aggregating {len(successful_analyses)} analyses...")
        aggregate = aggregate_batch_findings(successful_analyses)
        
        response = {
            "status": "complete",
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "total_urls": len(urls),
            "successful_analyses": len(successful_analyses),
            "failed_analyses": len(urls) - len(successful_analyses),
            "results": analysis_results,
            "aggregate": aggregate,
        }
        
        print(f"[DarkLens API] ✅ Batch complete:")
        print(f"  Successful: {len(successful_analyses)}/{len(urls)}")
        print(f"  Cross-site patterns: {len(aggregate.get('cross_site_patterns', []))}")
        print(f"  Avg score: {aggregate.get('avg_manipulation_score', 0)}/100")
        print(f"{'='*50}\n")
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DarkLens API] Batch analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


@router.get("/admin/analytics")
async def get_analytics():
    """
    Get system analytics and cache statistics.
    Shows Gemini API efficiency via caching.
    
    Useful for demos with investors:
    - Total analyses run
    - Cache performance (hit rate, API calls saved)
    - Estimated cost reduction via caching
    - Database size
    """
    try:
        cache = get_cache()
        cache_stats = cache.get_stats()
        
        # Estimate API savings
        # Assuming each cached hit = $0.000075 per image (approximate Gemini 2.0 Flash cost)
        # Each analysis makes 1 Gemini call
        api_cost_per_call = 0.000075
        total_calls_without_cache = cache_stats.get("total_hits", 0) + cache_stats.get("total_entries", 0)
        api_calls_saved = cache_stats.get("total_hits", 0)
        cost_saved = api_calls_saved * api_cost_per_call
        
        analytics = {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "cache": {
                "total_cached_analyses": cache_stats.get("total_entries", 0),
                "total_cache_hits": cache_stats.get("total_hits", 0),
                "hit_rate_percent": round(
                    (cache_stats.get("total_hits", 0) / total_calls_without_cache * 100)
                    if total_calls_without_cache > 0 else 0,
                    2
                ),
                "cache_size_mb": cache_stats.get("cache_size_mb", 0),
                "avg_reuse_per_image": cache_stats.get("avg_hits_per_entry", 0),
                "expired_entries": cache_stats.get("expired_entries", 0),
            },
            "api_efficiency": {
                "total_gemini_calls_without_cache": total_calls_without_cache,
                "gemini_calls_made": cache_stats.get("total_entries", 0),
                "api_calls_saved_via_caching": api_calls_saved,
                "efficiency_gain_percent": round(
                    (api_calls_saved / total_calls_without_cache * 100)
                    if total_calls_without_cache > 0 else 0,
                    2
                ),
                "estimated_cost_saved_usd": round(cost_saved, 4),
            },
            "corpus": {
                "pattern_corpus_path": os.path.join(
                    os.path.dirname(__file__), "..", "data", "pattern_corpus.jsonl"
                ),
                "patterns_in_corpus": count_lines_in_file(
                    os.path.join(os.path.dirname(__file__), "..", "data", "pattern_corpus.jsonl")
                ),
            },
            "message": f"DarkLens is running efficiently! {api_calls_saved} Gemini calls saved via caching (saving ~${cost_saved:.2f}).",
        }
        
        return analytics
    
    except Exception as e:
        print(f"[DarkLens API] Analytics query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")


def count_lines_in_file(file_path: str) -> int:
    """Count lines in a file (for corpus entry count)."""
    if not os.path.exists(file_path):
        return 0
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return sum(1 for _ in f)
    except:
        return 0


def generate_pdf_report(analysis_data: dict) -> bytes:
    """
    Generate a professional PDF report from analysis data.
    """
    pdf_buffer = BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor("#475569"),
        spaceAfter=8,
        fontName='Helvetica-Bold'
    )
    
    # Title
    elements.append(Paragraph("🔍 DarkLens Report", title_style))
    elements.append(Spacer(1, 0.2 * inch))
    
    # Metadata section
    metadata = analysis_data
    elements.append(Paragraph("Analysis Summary", heading_style))
    
    summary_data = [
        ["Analysis ID", metadata.get("analysis_id", "N/A")],
        ["Platform", metadata.get("platform_detected", "Unknown")],
        ["Page Type", metadata.get("page_type", "unknown")],
        ["Timestamp", metadata.get("timestamp", "N/A")],
        ["Manipulation Score", f"{metadata.get('manipulation_score', 0)}/100"],
        ["Grade", f"{metadata.get('grade', 'N/A')} - {metadata.get('grade_label', '')}"],
        ["Patterns Detected", str(metadata.get("total_patterns_found", 0))],
        ["Estimated Overcharge", str(metadata.get("estimated_overcharge", "₹0"))],
    ]
    
    summary_table = Table(summary_data, colWidths=[2 * inch, 4 * inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#e2e8f0")),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.3 * inch))
    
    # Patterns section
    if metadata.get("patterns_detected"):
        elements.append(Paragraph("Detected Patterns", heading_style))
        
        for i, pattern in enumerate(metadata.get("patterns_detected", []), 1):
            pattern_title = f"{i}. {pattern.get('title', 'Unknown Pattern')}"
            elements.append(Paragraph(pattern_title, styles['Heading3']))
            
            pattern_details = [
                ["Category", pattern.get("ccpa_category_name", "Unknown")],
                ["Severity", f"{pattern.get('severity', 'Unknown')} ({pattern.get('severity_score', 0)}/5)"],
                ["Confidence", pattern.get("confidence", "Unknown").upper()],
                ["Description", pattern.get("description", "N/A")],
                ["User Impact", pattern.get("user_impact", "N/A")],
            ]
            
            details_table = Table(pattern_details, colWidths=[1.5 * inch, 4.5 * inch])
            details_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(details_table)
            elements.append(Spacer(1, 0.15 * inch))
        
        elements.append(PageBreak())
    
    # Hidden costs section
    if metadata.get("hidden_costs"):
        elements.append(Paragraph("Hidden Costs Detected", heading_style))
        
        costs_data = [["Amount", "Description"]]
        for cost in metadata.get("hidden_costs", []):
            costs_data.append([
                str(cost.get("amount", "N/A")),
                str(cost.get("description", "N/A"))
            ])
        
        costs_table = Table(costs_data, colWidths=[2 * inch, 4 * inch])
        costs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#fca5a5")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        elements.append(costs_table)
    
    # Footer
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph(
        "This report was generated by DarkLens, an AI-powered dark pattern detector. "
        "For more information, visit the DarkLens research project.",
        styles['Normal']
    ))
    
    # Build PDF
    doc.build(elements)
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()