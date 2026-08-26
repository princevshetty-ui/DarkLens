# 🔍 DarkLens — AI-Powered Dark Pattern Forensics Engine

> **Upload a checkout screenshot. We'll show you how you're being manipulated.**

[![Built at Hack4Future 2025](https://img.shields.io/badge/Hack4Future-2025-blue)]()
[![Domain](https://img.shields.io/badge/Domain-AI%20%26%20ML-purple)]()
[![CCPA 2023](https://img.shields.io/badge/Legal%20Basis-CCPA%202023-green)]()

---

## 🎯 Problem Statement

India became the first country to legally define dark patterns when the **Central Consumer Protection Authority (CCPA)** issued the *Prevention and Regulation of Dark Patterns Guidelines* on **November 30, 2023**, classifying **13 distinct manipulation categories**.

Despite this landmark regulation, Indian consumers have zero tools to detect these patterns in the apps and websites they use daily.

## 💡 Solution

DarkLens is a **forensic analysis engine** that:

1. Ingests 1–3 checkout screenshots.
2. Analyzes each using Google Gemini 2.0 Flash vision AI.
3. Classifies findings against India's 13 CCPA dark pattern categories.
4. Scores manipulation intensity using a weighted algorithm (0–100).
5. Detects cross-screen manipulation when multiple screenshots are uploaded.
6. Generates actionable insights with legal references.

## 🏗️ System Architecture

```text
User Interface
React + Tailwind + Framer Motion
        │
        ▼
FastAPI Backend
        │
        ├── Gemini Vision Analyzer
        ├── CCPA Pattern Classifier
        └── Manipulation Scoring Engine
        │
        ▼
Google Gemini 2.0 Flash + CCPA Taxonomy
```

## 🔬 Technical Implementation

### Backend Pipeline

| Stage | Module | What It Does |
|-------|--------|--------------|
| Vision Analysis | `vision_analyzer.py` | Sends screenshots to Gemini and extracts structured findings. |
| Pattern Classification | `pattern_classifier.py` | Maps findings to CCPA categories and validates severity. |
| Manipulation Scoring | `pattern_classifier.py` | Calculates a weighted score from 0–100. |

### Multi-Image Analysis

The application accepts up to three screenshots and compares their results to identify changes such as price escalation, newly introduced fees, and repeated patterns across screens.

## 🛡️ Credibility Safeguards

DarkLens is designed to prioritize evidence over assumptions:

- Pre-selected options are flagged only when a visible selection is present.
- Unselected radio-button choices are not automatically treated as dark patterns.
- Legitimate upsells are distinguished from unauthorized additions.
- Findings include confidence levels and visual evidence.
- Legal references are attached to detected categories.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| AI Engine | Google Gemini 2.0 Flash |
| Frontend | React 19, Vite |
| Styling | Tailwind CSS, Custom CSS |
| Animation | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| Legal Data | CCPA taxonomy JSON |

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Gemini API key

### Backend

```bash
cd backend
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" > .env
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and upload a checkout screenshot.

## 👥 Team

Built at **Hack4Future 2025**, a 24-hour national-level hackathon.

**Team Members:**

- Vishesh Vandan @princevshetty-ui(https://github.com/princevshetty-ui)
- Adnan Ashraf @adnan-ashraf055(https://github.com/adnan-ashraf055)
- Jay Thakkar @thakkar2005(https://github.com/@thakkar2005)
- Koushik C

## 📜 SDG Alignment

- **SDG 12** — Responsible Consumption and Production
- **SDG 16** — Peace, Justice and Strong Institutions
- **SDG 9** — Industry, Innovation and Infrastructure

## 🏛️ Legal Basis

DarkLens references India's **Prevention and Regulation of Dark Patterns Guidelines**, issued by the Central Consumer Protection Authority (CCPA).

> DarkLens provides informational analysis, not legal advice.

---

*DarkLens — Because transparency shouldn't be optional.*
