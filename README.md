# DarkLens — AI-Powered Dark Pattern Forensics Engine

> Analyze checkout screenshots for potential dark patterns, with visible evidence and legal references.

Built at **Hack4Future 2025** by a four-person team; the team received positive judge feedback.

## At a glance

- Accepts **1–3 checkout/UI screenshots** per submission.
- Maps findings against **13 CCPA dark-pattern categories**.
- Produces a **0–100 manipulation-intensity score** with confidence levels, visual evidence, and legal references.
- Compares multiple screenshots for patterns such as price escalation, newly introduced fees, or repeated pressure across screens.

## Pipeline

1. Upload one to three checkout screenshots.
2. Gemini 2.0 Flash Vision extracts structured visual findings.
3. The classifier maps the findings to CCPA categories and validates severity.
4. A weighted scoring engine calculates a 0–100 manipulation-intensity score.
5. The result presents findings, evidence, confidence, and legal references.

## Architecture and stack

- **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion, Recharts.
- **Backend:** Python and FastAPI.
- **Vision model:** Google Gemini 2.0 Flash.
- **Classification:** CCPA taxonomy and structured findings.
- **Scoring:** weighted manipulation-intensity scoring.

## Credibility safeguards

DarkLens is designed to favor visible evidence over assumptions. It avoids treating unselected radio buttons as selected, distinguishes legitimate upsells from unauthorized additions, and attaches evidence/confidence and legal references to findings where available.

## Team and scope

Team project: Vishesh Vandan, Adnan Ashraf, Jay Thakkar, and Koushik C. This README describes the shared system rather than implying sole authorship.

DarkLens is an informational analysis tool, not legal advice and not a substitute for human review.
