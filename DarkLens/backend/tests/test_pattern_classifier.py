"""
Unit tests for pattern_classifier.py
Tests pattern enrichment, scoring, and aggregation functions.
"""

import pytest
from services.pattern_classifier import (
    enrich_patterns,
    compute_score,
    aggregate_batch_findings,
    format_for_export,
    format_for_corpus,
)


class TestPatternEnrichment:
    """Tests for the enrich_patterns function."""
    
    def test_enrich_single_pattern(self):
        """Test enriching a single dark pattern."""
        raw_patterns = [
            {
                "title": "Basket Sneaking",
                "description": "Item added without consent",
                "severity": "VIOLATION",
                "severity_score": 5,
                "ccpa_category_id": 2,
                "ccpa_category_name": "Basket Sneaking",
                "evidence": {"element_type": "checkbox", "content": "Accept extra item"},
                "confidence": "high",
                "user_impact": "Hidden cost charged to user"
            }
        ]
        
        enriched = enrich_patterns(raw_patterns)
        
        assert len(enriched) == 1
        assert enriched[0]["pattern_id"] == "dp_001"
        assert enriched[0]["ccpa_category_id"] == 2
        assert enriched[0]["severity"] == "VIOLATION"
        assert enriched[0]["severity_score"] == 5
    
    def test_enrich_empty_patterns(self):
        """Test enriching empty pattern list."""
        enriched = enrich_patterns([])
        assert enriched == []
    
    def test_enrich_invalid_severity_defaults_to_caution(self):
        """Test that invalid severity defaults to CAUTION."""
        raw_patterns = [
            {
                "title": "Test Pattern",
                "severity": "INVALID_SEVERITY",
                "ccpa_category_id": 1,
                "evidence": {}
            }
        ]
        
        enriched = enrich_patterns(raw_patterns)
        assert enriched[0]["severity"] == "CAUTION"
    
    def test_enrich_clamps_severity_score(self):
        """Test that severity score is clamped to 0-5."""
        raw_patterns = [
            {
                "title": "Test Pattern",
                "severity_score": 10,  # Too high
                "ccpa_category_id": 1,
                "evidence": {}
            }
        ]
        
        enriched = enrich_patterns(raw_patterns)
        assert enriched[0]["severity_score"] == 5  # Should be clamped
    
    def test_enrich_multiple_patterns_sequence_ids(self):
        """Test that multiple patterns get sequential IDs."""
        raw_patterns = [
            {"title": f"Pattern {i}", "ccpa_category_id": 1, "evidence": {}}
            for i in range(3)
        ]
        
        enriched = enrich_patterns(raw_patterns)
        ids = [p["pattern_id"] for p in enriched]
        assert ids == ["dp_001", "dp_002", "dp_003"]


class TestScoreComputation:
    """Tests for the compute_score function."""
    
    def test_no_patterns_clean_score(self):
        """Test that no patterns = clean score (A grade)."""
        score_data = compute_score([], [])
        
        assert score_data["manipulation_score"] == 0
        assert score_data["grade"] == "A"
        assert "Clean" in score_data["grade_label"]
    
    def test_single_pattern_scoring(self):
        """Test scoring with a single pattern."""
        patterns = [
            {
                "title": "False Urgency",
                "ccpa_category_id": 1,
                "severity_score": 3,
            }
        ]
        
        score_data = compute_score(patterns, [])
        assert score_data["manipulation_score"] > 0
        assert score_data["grade"] in ["A", "B", "C", "D", "F"]
    
    def test_hidden_costs_increase_score(self):
        """Test that hidden costs contribute to the score."""
        patterns = [
            {
                "title": "Hidden Cost",
                "ccpa_category_id": 12,
                "severity_score": 2,
            }
        ]
        hidden_costs = [
            {"amount": "₹100", "description": "Insurance"}
        ]
        
        score_with_costs = compute_score(patterns, hidden_costs)
        score_without_costs = compute_score(patterns, [])
        
        assert score_with_costs["manipulation_score"] > score_without_costs["manipulation_score"]
    
    def test_score_normalized_to_0_100(self):
        """Test that score is always 0-100."""
        for severity in range(1, 6):
            patterns = [
                {
                    "title": "Test",
                    "ccpa_category_id": 1,
                    "severity_score": severity,
                }
            ]
            score_data = compute_score(patterns, [])
            assert 0 <= score_data["manipulation_score"] <= 100
    
    def test_grade_assignment_correct(self):
        """Test that grades are assigned correctly based on normalized score."""
        # Test A grade (< 20)
        patterns = [{"title": "Test", "ccpa_category_id": 1, "severity_score": 2}]
        score_data = compute_score(patterns, [])
        assert score_data["grade"] == "A"
        
        # Test B grade (20-40)
        patterns = [
            {"title": "Test", "ccpa_category_id": i % 13 + 1, "severity_score": 3}
            for i in range(2)
        ]
        score_data = compute_score(patterns, [])
        assert score_data["grade"] == "B"
        
        # Test C grade (40-60)
        patterns = [
            {"title": "Test", "ccpa_category_id": i % 13 + 1, "severity_score": 5}
            for i in range(3)
        ]
        score_data = compute_score(patterns, [])
        assert score_data["grade"] == "C"
        
        # Test F grade (80+)
        patterns = [
            {"title": "Test", "ccpa_category_id": i % 13 + 1, "severity_score": 5}
            for i in range(5)
        ]
        score_data = compute_score(patterns, [])
        assert score_data["grade"] == "F"


class TestBatchAggregation:
    """Tests for the aggregate_batch_findings function."""
    
    def test_aggregate_empty_results(self):
        """Test aggregating empty results."""
        aggregate = aggregate_batch_findings([])
        
        assert aggregate["status"] == "error"
        assert aggregate["total_urls"] == 0
    
    def test_aggregate_single_analysis(self):
        """Test aggregating a single analysis."""
        results = [
            {
                "status": "complete",
                "analysis_id": "da_001",
                "patterns_detected": [
                    {
                        "title": "Basket Sneaking",
                        "ccpa_category_id": 2,
                        "severity": "VIOLATION"
                    }
                ]
            }
        ]
        
        aggregate = aggregate_batch_findings(results)
        assert aggregate["status"] == "success"
        assert aggregate["total_urls_analyzed"] == 1
        assert aggregate["patterns_found_count"] == 1
    
    def test_cross_site_pattern_detection(self):
        """Test detection of cross-site patterns."""
        results = [
            {
                "status": "complete",
                "analysis_id": "da_001",
                "patterns_detected": [
                    {"title": "False Urgency", "ccpa_category_id": 1, "severity": "CAUTION"}
                ]
            },
            {
                "status": "complete",
                "analysis_id": "da_002",
                "patterns_detected": [
                    {"title": "False Urgency", "ccpa_category_id": 1, "severity": "CAUTION"}
                ]
            }
        ]
        
        aggregate = aggregate_batch_findings(results)
        cross_site = aggregate["cross_site_patterns"]
        
        assert len(cross_site) > 0
        assert cross_site[0]["pattern_title"] == "False Urgency"
        assert "2/" in cross_site[0]["prevalence"]  # Found on 2 URLs


class TestDataFormatting:
    """Tests for the format_for_export and format_for_corpus functions."""
    
    def test_format_for_export(self):
        """Test formatting analysis for export."""
        analysis = {
            "analysis_id": "da_001",
            "timestamp": "2024-01-01T00:00:00",
            "platform_detected": "flipkart.com",
            "manipulation_score": 50,
            "patterns_detected": [],
            "hidden_costs": []
        }
        
        formatted = format_for_export(analysis)
        assert formatted["analysis_id"] == "da_001"
        assert formatted["manipulation_score"] == 50
        assert "timestamp" in formatted
    
    def test_format_for_corpus_requires_consent(self):
        """Test that corpus formatting respects consent."""
        analysis = {"patterns_detected": []}
        
        # Without consent
        corpus_entry = format_for_corpus(analysis, user_consent=False)
        assert corpus_entry == {}
        
        # With consent
        analysis["analysis_id"] = "da_001"
        corpus_entry = format_for_corpus(analysis, user_consent=True)
        assert corpus_entry["analysis_id"] == "da_001"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
