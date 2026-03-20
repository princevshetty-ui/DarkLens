# DarkLens: Complete API Reference

## Base URL
```
http://localhost:8000  (Development)
https://api.darklens.io (Production)
```

---

## 📊 Analysis Endpoints

### Single Image Analysis (Original - Unchanged)
```
POST /api/analyze/image
Content-Type: multipart/form-data

Parameters:
  - image: <binary file>

Response (200):
{
  "patterns": [
    {
      "id": "dp_001",
      "name": "Basket Sneaking",
      "description": "Hidden charges appear at checkout",
      "category_id": "BASKET_SNEAKING",
      "severity": 0.9,
      "evidence": {
        "description": "Unexpected additional items added",
        "location": "Checkout summary",
        "recommendation": "Remove unauthorized items"
      }
    }
  ],
  "hidden_costs": [
    {
      "amount": "₹49",
      "description": "Handling charge",
      "disclosure_quality": "poor"
    }
  ],
  "score": 78,
  "grade": "C",
  "platform": "Amazon",
  "page_type": "confirms_page"
}
```

---

### 📦 Batch URL Analysis (NEW)
```
POST /api/batch/analyze
Content-Type: application/json

Request:
{
  "urls": [
    "https://flipkart.com/checkouts",
    "https://amazon.in/gp/checkout",
    "https://myntra.com/checkout"
  ]
}

Response (202):  // Returns immediately
{
  "batch_id": "batch_abc123xyz",
  "status": "processing",
  "results": [
    {
      "url": "https://flipkart.com/checkouts",
      "status": "analyzing",
      "patterns": [],
      "score": null,
      "platform": "Flipkart"
    },
    ...
  ],
  "cross_site_patterns": [
    {
      "pattern_id": "dp_001",
      "pattern_name": "False Urgency",
      "found_on": 2,
      "platforms": ["Flipkart", "Amazon"],
      "prevalence_score": 0.67
    }
  ]
}

Note: Batch analysis happens asynchronously
- Check status via GET /api/batch/{batch_id}
- Max 5 URLs per batch
- Allowlisted platforms: flipkart.com, amazon.in, myntra.com, paytm.com
```

---

## 💾 Report & Data Endpoints

### Export Analysis Report (NEW)
```
POST /api/reports/export
Content-Type: application/json

Request:
{
  "analysis_result": {
    "patterns": [...],
    "hidden_costs": [...],
    "score": 78,
    "grade": "C",
    "platform": "Amazon",
    "page_type": "checkout"
  },
  "format": "pdf"  // or "json"
}

Response (200):
Content-Type: application/pdf (or application/json)
<Binary PDF file or JSON object>

Includes:
- Pattern details with CCPA references
- Manipulation score explanation
- Evidence screenshots (PDF only)
- Download link for sharing
```

### Contribute to Research Corpus (NEW)
```
POST /api/research/contribute
Content-Type: application/json

Request:
{
  "patterns": [
    {
      "id": "dp_001",
      "name": "Basket Sneaking",
      "severity": 0.9,
      "evidence": {...}
    }
  ],
  "platform": "Flipkart",
  "url": "https://flipkart.com/...",
  "user_consent": true  // Must be true
}

Response (201):
{
  "status": "contribution_received",
  "message": "Thank you for contributing to dark pattern research",
  "contribution_id": "contrib_xyz789"
}

Note: Contributed data is anonymized
- No personal info stored (IP address anonymized)
- Public access to aggregated patterns via /api/research/patterns
```

---

## 📈 Analytics & Monitoring Endpoints

### Admin Analytics Dashboard (NEW)
```
GET /api/admin/analytics

Response (200):
{
  "cache_stats": {
    "total_entries": 342,
    "total_size_mb": 45.2,
    "hits": 1045,
    "misses": 487,
    "hit_rate_percent": 68.2
  },
  "api_statistics": {
    "total_requests": 1532,
    "images_analyzed": 487,
    "average_analysis_time_ms": 2340,
    "gemini_api_calls": 487,
    "gemini_cost_estimate_usd": 2.50
  },
  "cost_optimization": {
    "calls_saved_via_cache": 1045,
    "estimated_savings_usd": 5.23,
    "cost_reduction_percent": 68.2
  },
  "research_corpus": {
    "total_contributions": 156,
    "unique_patterns_found": 47,
    "platforms_scanned": 28,
    "last_contribution": "2026-03-20T10:30:45Z"
  }
}
```

---

## 🏥 Health Check Endpoint (Existing)

### Server Status
```
GET /api/health

Response (200):
{
  "status": "healthy",
  "timestamp": "2026-03-20T10:30:45Z"
}
```

---

## Error Responses

### Standard Error Format
```
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid image format. Supported: JPEG, PNG",
  "details": {
    "field": "image",
    "reason": "Unsupported MIME type: GIF"
  },
  "request_id": "req_abc123xyz"
}
```

### Common Error Codes
| Status | Code | Meaning |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Invalid input format |
| 400 | URL_INVALID | Invalid URL provided |
| 401 | API_KEY_REQUIRED | Missing/invalid API key |
| 403 | QUOTA_EXCEEDED | Rate limit exceeded |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_SERVER_ERROR | Server error (will retry) |
| 502 | GEMINI_API_ERROR | Google Gemini API unavailable |
| 503 | RATE_LIMITED | Too many requests, please retry later |

---

## Authentication (Future)

```
All endpoints will eventually require:
Authorization: Bearer <api_token>

Obtain token via:
POST /api/auth/register
{
  "email": "user@example.com",
  "name": "Your Name"
}
```

---

## Rate Limits (Future)

| Tier | Requests/Hour | Images/Month | Batch Size |
|------|---------------|--------------|-----------|
| Free | 60 | 100 | 5 URLs |
| Pro | 1000 | 5000 | 50 URLs |
| Enterprise | Unlimited | Unlimited | 500 URLs |

---

## Code Examples

### Python (requests)
```python
import requests

# Single image analysis
with open("screenshot.jpg", "rb") as f:
    files = {"image": f}
    response = requests.post(
        "http://localhost:8000/api/analyze/image",
        files=files
    )
    print(response.json())

# Batch analysis
response = requests.post(
    "http://localhost:8000/api/batch/analyze",
    json={
        "urls": [
            "https://flipkart.com/checkout",
            "https://amazon.in/checkout"
        ]
    }
)
print(response.json())

# Export report
response = requests.post(
    "http://localhost:8000/api/reports/export",
    json={
        "analysis_result": {...},
        "format": "pdf"
    }
)
with open("report.pdf", "wb") as f:
    f.write(response.content)
```

### JavaScript (fetch)
```javascript
// Single image analysis
const formData = new FormData();
formData.append("image", imageFile);

const response = await fetch("/api/analyze/image", {
  method: "POST",
  body: formData
});
const data = await response.json();
console.log(data.patterns);

// Batch analysis
const batchResponse = await fetch("/api/batch/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    urls: [
      "https://flipkart.com/checkout",
      "https://amazon.in/checkout"
    ]
  })
});
const batchData = await batchResponse.json();
console.log(batchData.cross_site_patterns);
```

### cURL
```bash
# Single image
curl -X POST http://localhost:8000/api/analyze/image \
  -F "image=@screenshot.jpg"

# Batch analysis
curl -X POST http://localhost:8000/api/batch/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://flipkart.com/checkout",
      "https://amazon.in/checkout"
    ]
  }'

# Admin analytics
curl http://localhost:8000/api/admin/analytics

# Interactive docs
open http://localhost:8000/docs
```

---

## Environment Variables

```bash
# Required
GOOGLE_API_KEY=your_api_key_here

# Optional
LOG_LEVEL=INFO              # DEBUG, INFO, WARNING, ERROR
CORS_ORIGINS=localhost:5173,localhost:3000
DATABASE_URL=sqlite:///data/cache.sqlite
```

---

**For complete API testing, visit http://localhost:8000/docs** 🎯
