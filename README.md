

# README.md

---

## Document 1: `README.md`

Place this in the root of your `DarkLens_CAIAS/` repository.

```markdown
# 🔍 DarkLens — AI-Powered Dark Pattern Forensics Engine

> **Upload a checkout screenshot. We'll show you how you're being manipulated.**

[![Built at Hack4Future 2025](https://img.shields.io/badge/Hack4Future-2025-blue)]()
[![Domain](https://img.shields.io/badge/Domain-AI%20%26%20ML-purple)]()
[![CCPA 2023](https://img.shields.io/badge/Legal%20Basis-CCPA%202023-green)]()

---

## 🎯 Problem Statement

India became the first country to legally define dark patterns when the **Central Consumer Protection Authority (CCPA)** issued the *Prevention and Regulation of Dark Patterns Guidelines* on **November 30, 2023**, classifying **13 distinct manipulation categories**.

Despite this landmark regulation, **Indian consumers have zero tools** to detect these patterns in the apps and websites they use daily.

India's e-commerce market processes over **$80 billion annually**, with platforms embedding hidden charges, pre-selected add-ons, fake urgency timers, and misleading opt-out flows into checkout processes. Studies estimate dark patterns inflate consumer spending by **15–25% per transaction**.

The affected users — **urban, tech-savvy Indians** — are the population that interacts with these platforms daily but lacks any systematic way to identify and report manipulative UI practices.

**The gap is not awareness — it's detection.**

---

## 💡 Solution

DarkLens is a **forensic analysis engine** that:

1. **Ingests** 1–3 checkout screenshots (drag-and-drop)
2. **Analyzes** each using Google Gemini 2.0 Flash vision AI
3. **Classifies** findings against India's 13 CCPA dark pattern categories
4. **Scores** manipulation intensity using a weighted algorithm (0–100)
5. **Detects cross-screen manipulation** when multiple screenshots are uploaded
6. **Generates** actionable insights with legal references

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER INTERFACE                     │
│         React + Tailwind + Framer Motion             │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Upload   │  │ Scanning │  │    Dashboard     │   │
│  │  Zone     │  │ Overlay  │  │  (Score + Cards) │   │
│  │ (1-3 img) │  │          │  │                  │   │
│  └────┬─────┘  └──────────┘  └──────────────────┘   │
│       │                              ▲                │
└───────┼──────────────────────────────┼────────────────┘
        │                              │
        ▼                              │
┌─────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                    │
│                                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────┐ │
│  │   Vision     │   │   Pattern    │   │  Score    │ │
│  │  Analyzer    │──▶│  Classifier  │──▶│  Engine   │ │
│  │ (Gemini API) │   │ (CCPA Legal) │   │ (Weighted)│ │
│  └─────────────┘   └──────────────┘   └───────────┘ │
│         │                  │                          │
│         ▼                  ▼                          │
│  ┌─────────────┐   ┌──────────────┐                  │
│  │   Gemini    │   │    CCPA      │                  │
│  │  2.0 Flash  │   │  Taxonomy   │                  │
│  │   (API)     │   │  (13 cats)  │                  │
│  └─────────────┘   └──────────────┘                  │
└─────────────────────────────────────────────────────┘

Multi-Image Flow:
  Image 1 ──▶ Gemini ──▶ Result 1 ─┐
  Image 2 ──▶ Gemini ──▶ Result 2 ─┼──▶ Merge + Cross-Image Analysis
  Image 3 ──▶ Gemini ──▶ Result 3 ─┘
```

---

## 🔬 Technical Implementation

### Backend Pipeline (3 Stages)

| Stage | Module | What It Does |
|-------|--------|-------------|
| **1. Vision Analysis** | `vision_analyzer.py` | Sends screenshot to Gemini 2.0 Flash with a forensic-grade prompt. Returns structured JSON with detected patterns, hidden costs, and evidence. |
| **2. Pattern Classification** | `pattern_classifier.py` | Enriches raw AI detections with CCPA legal references, validates severity values, and assigns unique pattern IDs. **Deterministic logic — not AI.** |
| **3. Manipulation Scoring** | `pattern_classifier.py` | Computes weighted score (0–100) using category-specific weights. Financial harm categories (Forced Action, Drip Pricing) weighted highest. |

### Frontend Pipeline (Multi-Image)

| Feature | Implementation |
|---------|---------------|
| **Multi-Image Upload** | Accepts 1–3 screenshots. Each processed sequentially via existing API. |
| **Cross-Image Analysis** | Frontend compares results across images: detects price escalation, new hidden fees, pattern count changes. |
| **Pattern Deduplication** | Same pattern across multiple screens merged with "Multi-screen" badge. |
| **Key Insight Generation** | Context-aware insight derived from score, pattern types, and cross-image data. |
| **Conditional Actions** | Score < 20: "All clear." Score 20–55: "Review carefully." Score > 55: "Consider reporting." |

### Scoring Algorithm

```
For each detected pattern:
    contribution = severity_score × category_weight

Total raw_score = Σ contributions + (hidden_cost_count × 2)

Normalized score = (raw_score / max_theoretical) × 100 × 3.0

Grade assignment:
    0-19   → A (Clean)
    20-39  → B (Mild)
    40-59  → C (Moderate)
    60-79  → D (Severe)
    80-100 → F (Critical)
```

**Category Weights:**

| Category | Weight | Rationale |
|----------|--------|-----------|
| Forced Action | 1.0 | Direct financial harm |
| Basket Sneaking | 1.0 | Unauthorized charges |
| Bait & Switch | 1.0 | Trust violation |
| Drip Pricing | 0.9 | Hidden cost escalation |
| Hidden Costs | 0.8 | Financial deception |
| Interface Interference | 0.7 | Design manipulation |
| False Urgency | 0.6 | Pressure tactic |
| Confirm Shaming | 0.4 | Psychological nudge |
| Disguised Ad | 0.3 | Low financial impact |

---

## 🛡️ Credibility Safeguards

DarkLens prioritizes **accuracy over quantity**:

- Checkbox is flagged as "pre-selected" **only** if a visible checkmark (✓) is present in the screenshot
- Radio buttons where neither option is selected are **not** flagged as dark patterns
- Buttons requiring user to click "+ADD" are classified as legitimate upsells
- Social proof and conditional discounts are flagged as **CAUTION**, not VIOLATION
- Confidence levels (HIGH/MEDIUM/LOW) are displayed with visual bars
- Each finding includes specific visual evidence and CCPA clause reference

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Python FastAPI | REST API, request handling |
| **AI Engine** | Google Gemini 2.0 Flash | Vision analysis, structured extraction |
| **Frontend** | React 19 + Vite | SPA with component architecture |
| **Styling** | TailwindCSS + Custom CSS | Glass-morphism, animations |
| **Animation** | Framer Motion | Page transitions, staggered reveals |
| **Typography** | Inter + Sora (Google Fonts) | Premium readability |
| **Icons** | Lucide React | Consistent iconography |
| **Charts** | Recharts | Data visualization |
| **Legal Data** | CCPA Taxonomy JSON | 13 dark pattern categories |

---

## 📁 Project Structure

```
DarkLens_CAIAS/
├── backend/
│   ├── main.py                      # FastAPI server entry
│   ├── config.py                    # Environment config
│   ├── routers/
│   │   ├── analyze.py               # POST /api/analyze/image
│   │   └── health.py                # GET /api/health
│   ├── services/
│   │   ├── vision_analyzer.py       # Gemini integration + JSON parsing
│   │   └── pattern_classifier.py    # CCPA classification + scoring
│   ├── data/
│   │   └── ccpa_taxonomy.json       # 13 CCPA categories with legal refs
│   └── models/
│       └── schemas.py               # Pydantic data models
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Main dashboard component
│   │   ├── hooks/useAnalysis.js     # Multi-image analysis + cross-image
│   │   ├── components/
│   │   │   ├── upload/UploadZone.jsx
│   │   │   ├── analysis/
│   │   │   │   ├── ScanningOverlay.jsx
│   │   │   │   ├── ScoreGauge.jsx
│   │   │   │   └── PatternCard.jsx
│   │   │   └── layout/GlassCard.jsx
│   │   └── lib/mockData.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── sample_data/                     # Test screenshots
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Gemini API Key ([Get one here](https://aistudio.google.com))

### Setup

**1. Clone and install backend:**
```bash
cd backend
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" > .env
```

**2. Install frontend:**
```bash
cd frontend
npm install
```

**3. Run both servers:**
```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

**4. Open** `http://localhost:5173` and upload a screenshot.

---

## 📊 CCPA Dark Pattern Categories Detected

| # | Category | What It Means | Example |
|---|----------|--------------|---------|
| 1 | False Urgency | Fake time/scarcity pressure | "Only 2 left!" (when there are 500) |
| 2 | Basket Sneaking | Items added without consent | Auto-added warranty at checkout |
| 3 | Confirm Shaming | Guilt language on opt-out | "No, I hate saving money" |
| 4 | Forced Action | Pre-selected paid options | Insurance checkbox already ticked |
| 5 | Nagging | Persistent disruptive requests | Repeated pop-up to add insurance |
| 6 | Subscription Trap | Easy subscribe, hard cancel | One-click signup, 5-step cancel |
| 7 | Interface Interference | Design asymmetry | Big "Accept" vs tiny "Skip" |
| 8 | Bait & Switch | Offer ≠ reality | "Free cancel" → ₹500 fee |
| 9 | Drip Pricing | Fees revealed incrementally | Convenience fee only at payment |
| 10 | Disguised Ad | Ads as organic content | Sponsored result looks like organic |
| 11 | Trick Question | Confusing consent wording | Double negative opt-out |
| 12 | Hidden Costs | Charges at final stage only | Tax + fee shown only at payment |
| 13 | Rogue Malware | Unauthorized downloads | Fake download button |

---

## 🔮 Scalability & Future Roadmap

- **Browser Extension** — Real-time dark pattern detection while browsing
- **URL Crawl Mode** — Paste URL, server-side Playwright captures and analyzes
- **DOM Inspection** — Detect hidden checkboxes and fake timers in HTML source
- **Community Reporting** — Users report patterns, strengthening detection database
- **Multi-language** — Hindi, Kannada, Tamil interface support
- **PDF Reports** — Downloadable evidence reports for consumer complaints

---

## 🏛️ Legal Basis

All classifications reference the **Prevention and Regulation of Dark Patterns Guidelines** issued by India's Central Consumer Protection Authority (CCPA) on **November 30, 2023**.

DarkLens provides **informational analysis, not legal advice**.

---

## 👥 Team

Built at **Hack4Future 2025** — 24-Hour National Level Hackathon
Organized by Department of Computer Science & Applications, Christ Academy Institute for Advanced Studies

---

## 📜 SDG Alignment

- **SDG 12** — Responsible Consumption and Production
- **SDG 16** — Peace, Justice and Strong Institutions
- **SDG 9** — Industry, Innovation and Infrastructure

---

*DarkLens — Because transparency shouldn't be optional.*
```

---

---

## Document 2: Complete Judge Defense Script

Print this or keep it on a phone. Every team member should read it before presenting.

---

