"""
Pydantic models for DarkLens API responses.
These auto-generate OpenAPI documentation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PatternEvidence(BaseModel):
    """Evidence of a detected dark pattern."""
    element_type: str = Field(..., description="HTML element type (button, text, checkbox, etc.)")
    content: str = Field(..., description="Text/content of the evidence element")
    visual_prominence: str = Field(..., description="How prominent this element is (high/medium/low)")
    position: str = Field(..., description="Position on page (top/middle/bottom/sidebar)")


class Pattern(BaseModel):
    """A detected dark pattern."""
    pattern_id: str = Field(..., description="Unique pattern ID (dp_001, dp_002)")
    ccpa_category_id: int = Field(..., description="CCPA category ID (1-13)")
    ccpa_category_name: str = Field(..., description="CCPA category name")
    ccpa_legal_reference: str = Field(..., description="Legal reference from CCPA guidelines")
    severity: str = Field(..., description="Severity level (FAIR, CAUTION, VIOLATION)")
    severity_score: int = Field(..., description="Severity score (0-5)")
    title: str = Field(..., description="Pattern title")
    description: str = Field(..., description="Detailed description")
    user_impact: str = Field(..., description="How this affects the user")
    evidence: PatternEvidence = Field(..., description="Evidence of this pattern")
    confidence: str = Field(..., description="Confidence level (high/medium/low)")


class HiddenCost(BaseModel):
    """A detected hidden cost."""
    amount: str = Field(..., description="Cost amount")
    description: str = Field(..., description="What this cost is for")
    disclosure_quality: str = Field(..., description="How clearly this cost was disclosed")


class AnalysisResponse(BaseModel):
    """Response from /api/analyze/image endpoint."""
    status: str = Field(..., description="Analysis status (complete/error)")
    analysis_id: str = Field(..., description="Unique analysis ID")
    platform_detected: str = Field(..., description="E-commerce platform detected")
    page_type: str = Field(..., description="Page type (checkout/cart/payment)")
    timestamp: str = Field(..., description="ISO timestamp of analysis")
    
    patterns_detected: List[Pattern] = Field(..., description="Detected dark patterns")
    total_patterns_found: int = Field(..., description="Total number of patterns")
    categories_violated: List[int] = Field(..., description="CCPA category IDs violated")
    
    hidden_costs: List[HiddenCost] = Field(..., description="Hidden/undisclosed costs")
    estimated_overcharge: str = Field(..., description="Estimated price overcharge")
    
    manipulation_score: int = Field(..., description="Manipulation score (0-100)")
    grade: str = Field(..., description="Grade (A-F)")
    grade_label: str = Field(..., description="Grade description")
    grade_color: str = Field(..., description="Hex color for grade")
    
    summary: str = Field(..., description="AI summary of findings")


class BatchAnalysisRequest(BaseModel):
    """Request to /api/batch/analyze endpoint."""
    urls: List[str] = Field(..., description="List of URLs to analyze")
    max_urls: int = Field(5, description="Maximum URLs to analyze (free tier: 5)")


class CrossSitePattern(BaseModel):
    """A pattern found across multiple URLs."""
    pattern_title: str = Field(..., description="Pattern title")
    prevalence: str = Field(..., description="How many sites have this pattern")
    affected_analyses: List[str] = Field(..., description="Analysis IDs with this pattern")
    severity: str = Field(..., description="Severity level")


class BatchAggregateFindings(BaseModel):
    """Aggregated findings from batch analysis."""
    status: str = Field(..., description="Aggregation status")
    total_urls_analyzed: int = Field(..., description="Total URLs analyzed")
    successful_analyses: int = Field(..., description="Successful analyses")
    failed_analyses: int = Field(..., description="Failed analyses")
    patterns_found_count: int = Field(..., description="Total patterns across all URLs")
    unique_patterns: int = Field(..., description="Unique pattern types")
    cross_site_patterns: List[CrossSitePattern] = Field(..., description="Patterns found on multiple URLs")
    category_distribution: dict = Field(..., description="Pattern category prevalence")
    avg_manipulation_score: int = Field(..., description="Average score across URLs")
    riskiest_url: Optional[dict] = Field(None, description="URL with highest score")


class BatchAnalysisResult(BaseModel):
    """Result from batch analysis for a single URL."""
    url: str = Field(..., description="Analyzed URL")
    status: str = Field(..., description="Analysis status (complete/error)")
    error: Optional[str] = Field(None, description="Error message if status=error")
    analysis: Optional[AnalysisResponse] = Field(None, description="Full analysis if status=complete")


class BatchAnalysisResponse(BaseModel):
    """Response from /api/batch/analyze endpoint."""
    status: str = Field(..., description="Batch status")
    batch_id: str = Field(..., description="Unique batch ID")
    timestamp: str = Field(..., description="Batch timestamp")
    total_urls: int = Field(..., description="Total URLs submitted")
    successful_analyses: int = Field(..., description="Successful analyses")
    failed_analyses: int = Field(..., description="Failed analyses")
    results: List[BatchAnalysisResult] = Field(..., description="Per-URL results")
    aggregate: BatchAggregateFindings = Field(..., description="Aggregated findings")


class ReportExportRequest(BaseModel):
    """Request to /api/reports/export endpoint."""
    analysis_response: AnalysisResponse = Field(..., description="Analysis to export")
    format: str = Field("json", description="Export format (json or pdf)")


class CorpusContributionRequest(BaseModel):
    """Request to /api/research/contribute endpoint."""
    analysis_response: AnalysisResponse = Field(..., description="Analysis to contribute")
    consent: bool = Field(..., description="User consent to contribute anonymized data")


class ContributionResponse(BaseModel):
    """Response from contribution endpoint."""
    status: str = Field(..., description="Contribution status")
    message: str = Field(..., description="Success message")
    analysis_id: str = Field(..., description="Contributed analysis ID")
    patterns_contributed: int = Field(..., description="Number of patterns contributed")


class AnalyticsResponse(BaseModel):
    """Response from /api/admin/analytics endpoint."""
    status: str = Field(..., description="Analytics status")
    timestamp: str = Field(..., description="Analytics timestamp")
    cache: dict = Field(..., description="Cache statistics")
    api_efficiency: dict = Field(..., description="API efficiency metrics")
    corpus: dict = Field(..., description="Research corpus statistics")
    message: str = Field(..., description="Summary message")


class HealthResponse(BaseModel):
    """Response from health check endpoint."""
    status: str = Field(..., description="Service status (healthy/degraded/unhealthy)")
    uptime_seconds: int = Field(..., description="Service uptime in seconds")
    version: str = Field(..., description="API version")
    checks: dict = Field(..., description="Component health checks")
