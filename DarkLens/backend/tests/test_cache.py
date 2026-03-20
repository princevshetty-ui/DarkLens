"""
Unit tests for cache.py
Tests image caching and retrieval functionality.
"""

import pytest
import json
import tempfile
import os
from services.cache import AnalysisCache


class TestAnalysisCache:
    """Tests for the AnalysisCache class."""
    
    @pytest.fixture
    def temp_cache(self):
        """Create a temporary cache database for testing."""
        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
            cache_path = f.name
        
        cache = AnalysisCache(cache_path)
        yield cache
        
        # Cleanup
        if os.path.exists(cache_path):
            os.unlink(cache_path)
    
    def test_hash_image(self):
        """Test image hashing function."""
        image_bytes = b"test_image_data"
        hash1 = AnalysisCache.hash_image(image_bytes)
        hash2 = AnalysisCache.hash_image(image_bytes)
        
        # Same input should produce same hash
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length
    
    def test_hash_image_different_data(self):
        """Test that different images produce different hashes."""
        hash1 = AnalysisCache.hash_image(b"image1")
        hash2 = AnalysisCache.hash_image(b"image2")
        
        assert hash1 != hash2
    
    def test_set_and_get_cache(self, temp_cache):
        """Test storing and retrieving from cache."""
        image_hash = "abc123"
        gemini_response = {
            "patterns_detected": [{"title": "Test Pattern"}],
            "hidden_costs": []
        }
        
        # Store
        result = temp_cache.set(image_hash, gemini_response)
        assert result is True
        
        # Retrieve
        cached = temp_cache.get(image_hash)
        assert cached is not None
        assert cached["patterns_detected"][0]["title"] == "Test Pattern"
    
    def test_cache_miss_returns_none(self, temp_cache):
        """Test that cache miss returns None."""
        cached = temp_cache.get("nonexistent_hash")
        assert cached is None
    
    def test_cache_hit_increments_counter(self, temp_cache):
        """Test that cache hits increment the hit counter."""
        image_hash = "test_hash"
        gemini_response = {"patterns": []}
        
        # Store
        temp_cache.set(image_hash, gemini_response)
        
        # First get
        cached1 = temp_cache.get(image_hash)
        
        # Second get
        cached2 = temp_cache.get(image_hash)
        
        # Both should succeed
        assert cached1 is not None
        assert cached2 is not None
    
    def test_get_cache_stats(self, temp_cache):
        """Test cache statistics retrieval."""
        # Initially empty
        stats = temp_cache.get_stats()
        assert stats["total_entries"] == 0
        assert stats["total_hits"] == 0
        
        # Add entry
        temp_cache.set("hash1", {"patterns": []})
        
        # Access it multiple times
        temp_cache.get("hash1")
        temp_cache.get("hash1")
        
        # Check stats
        stats = temp_cache.get_stats()
        assert stats["total_entries"] == 1
        assert stats["total_hits"] >= 2
    
    def test_cache_multiple_entries(self, temp_cache):
        """Test storing and retrieving multiple cache entries."""
        entries = {
            f"hash{i}": {"pattern_count": i}
            for i in range(5)
        }
        
        # Store all
        for hash_key, response in entries.items():
            temp_cache.set(hash_key, response)
        
        # Verify all can be retrieved
        for hash_key, expected_response in entries.items():
            cached = temp_cache.get(hash_key)
            assert cached is not None
            assert cached["pattern_count"] == expected_response["pattern_count"]
    
    def test_complex_gemini_response(self, temp_cache):
        """Test caching a complex Gemini response structure."""
        gemini_response = {
            "patterns_detected": [
                {
                    "title": "Basket Sneaking",
                    "severity": "VIOLATION",
                    "evidence": {"element_type": "checkbox"},
                }
            ],
            "hidden_costs": [{"amount": 100, "type": "insurance"}],
            "metadata": {"platform": "flipkart", "page_type": "checkout"}
        }
        
        image_hash = "complex_hash"
        
        # Store
        temp_cache.set(image_hash, gemini_response)
        
        # Retrieve
        cached = temp_cache.get(image_hash)
        assert cached is not None
        assert cached["patterns_detected"][0]["title"] == "Basket Sneaking"
        assert cached["hidden_costs"][0]["amount"] == 100
        assert cached["metadata"]["platform"] == "flipkart"


class TestCacheIntegration:
    """Integration tests for cache functionality."""
    
    def test_cache_realistic_workflow(self):
        """Test a realistic workflow with the cache."""
        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
            cache_path = f.name
        
        try:
            cache = AnalysisCache(cache_path)
            
            # Simulate multiple image analyses
            for i in range(3):
                image_bytes = f"screenshot_{i}".encode()
                image_hash = AnalysisCache.hash_image(image_bytes)
                
                # First access (miss, so "analyze")
                if cache.get(image_hash) is None:
                    response = {
                        "patterns_detected": [{"title": f"Pattern {i}"}],
                        "score": i * 10
                    }
                    cache.set(image_hash, response)
                
                # Second access (hit)
                cached = cache.get(image_hash)
                assert cached is not None
            
            # Verify stats
            stats = cache.get_stats()
            assert stats["total_entries"] == 3
            assert stats["total_hits"] >= 3  # At least 3 cache hits
        
        finally:
            if os.path.exists(cache_path):
                os.unlink(cache_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
