# DarkLens Project Documentation

## 1. One-paragraph overview

DarkLens is an AI-powered forensic analysis tool designed to detect dark patterns in e-commerce interfaces, especially checkout flows. It helps users understand whether a website or app is using manipulative design tactics such as hidden fees, forced add-ons, urgency pressure, guilt-based buttons, or visual bias. The project combines a FastAPI backend, a React frontend, a browser extension, and Google Gemini vision analysis to process screenshots and return a structured report with a manipulation score, legal references based on India’s CCPA dark pattern guidelines, and exportable insights.

---

## 2. What this project does

DarkLens aims to make online manipulation visible and understandable.

### Core purpose
- Detect dark patterns in screenshots of websites or apps
- Score how manipulative the experience is
- Explain the reason for each warning in plain language
- Link findings to the CCPA legal framework
- Help users make more informed decisions or report abusive interface practices

### Main use cases
- Consumer awareness: understand whether a checkout flow is manipulative
- UX auditing: review product flows for deceptive design patterns
- Compliance review: check if a platform is violating consumer-protection norms
- Research and demo tool: gather evidence and compare patterns across sites
- Investor or public-interest demonstration: show how manipulation works in real flows

---

## 3. Problem statement

The project addresses a very real gap in consumer protection:
- Many digital services use subtle psychological pressure tactics
- These tactics often appear in checkout, payment, or subscription flows
- Most users do not notice them until after they have already made a decision
- There is limited public tooling for detecting and explaining them in a structured way

DarkLens tries to solve this by turning screenshots into a structured forensic report.

---

## 4. Product summary

### In simple terms
A user uploads one or more screenshots of a checkout or shopping flow. The system analyzes the images using AI, identifies potential manipulation patterns, scores the experience, and returns a report.

### What the user sees
- Upload area for 1 to 3 screenshots
- A live scanning experience
- A manipulation score from 0 to 100
- Pattern cards with explanations and evidence
- Suggested actions and impact summary
- Optional export as JSON or PDF

---

## 5. Key features

### 5.1 Screenshot-based analysis
- Accepts image uploads through the web app
- Can analyze one screenshot or multiple screenshots in sequence
- Supports common image formats such as PNG, JPG, and WEBP

### 5.2 AI-powered detection
- Uses Google Gemini 2.0 Flash via vision analysis
- Extracts possible dark patterns from screenshots
- Looks for visual cues like pre-selected checkboxes, hidden fees, urgency timers, and biased UI layouts

### 5.3 Legal categorization
- Maps findings to the CCPA dark pattern taxonomy
- Uses category IDs and legal references
- Supports explainability by tying UI behavior to known consumer-protection categories

### 5.4 Scoring engine
- Calculates a manipulation score for each analysis
- Assigns a grade such as A, B, C, D, or F
- Gives more weight to high-impact manipulative tactics

### 5.5 Multi-image flow analysis
- Uploading multiple screenshots lets the app compare steps in a flow
- Detects whether manipulation gets worse later in the journey
- Can highlight cross-screen escalation such as new charges appearing later in checkout

### 5.6 Export and research features
- Export analysis as JSON or PDF
- Contribute anonymized findings to a research corpus
- Basic analytics and caching statistics are available

### 5.7 Browser extension support
- Extension can capture a page and send it to the backend for analysis
- Useful for one-click inspection of live websites

---

## 6. Main modules and responsibilities

### Backend
The backend is implemented in FastAPI and lives in the DarkLens/backend folder.

#### Main entry point
- [DarkLens/backend/main.py](DarkLens/backend/main.py)
- Sets up the FastAPI application
- Configures CORS
- Serves the frontend in production mode when built assets are available
- Exposes health and analysis routes

#### Analysis router
- [DarkLens/backend/routers/analyze.py](DarkLens/backend/routers/analyze.py)
- Handles the core image analysis endpoint
- Handles report export
- Handles research corpus contribution
- Handles batch URL analysis
- Handles admin analytics

#### Health router
- [DarkLens/backend/routers/health.py](DarkLens/backend/routers/health.py)
- Provides a simple health check endpoint

#### Vision analyzer
- [DarkLens/backend/services/vision_analyzer.py](DarkLens/backend/services/vision_analyzer.py)
- Sends screenshots to Gemini
- Parses JSON responses safely
- Validates and cleans data
- Uses image preprocessing to reduce size and improve reliability
- Implements caching for repeated images

#### Pattern classifier
- [DarkLens/backend/services/pattern_classifier.py](DarkLens/backend/services/pattern_classifier.py)
- Enriches raw AI results with legal category metadata
- Adds IDs and references
- Computes the manipulation score
- Formats data for export and corpus contribution
- Aggregates batch results across multiple URLs

#### Cache service
- [DarkLens/backend/services/cache.py](DarkLens/backend/services/cache.py)
- Stores analysis results in SQLite
- Reduces duplicate Gemini calls and API cost

### Frontend
The frontend is a Vite + React application under the frontend folder.

#### Main app
- [frontend/src/App.jsx](frontend/src/App.jsx)
- Orchestrates the main experience
- Displays the scanning workflow, score, cards, insights, and actions
- Renders the results UI

#### Analysis hook
- [frontend/src/hooks/useAnalysis.js](frontend/src/hooks/useAnalysis.js)
- Handles analysis requests to the backend
- Merges multi-image results
- Runs cross-image analysis logic

#### Components
- [frontend/src/components/upload/UploadZone.jsx](frontend/src/components/upload/UploadZone.jsx): file upload UI
- [frontend/src/components/analysis/ScanningOverlay.jsx](frontend/src/components/analysis/ScanningOverlay.jsx): scanning progress UI
- [frontend/src/components/analysis/ScoreGauge.jsx](frontend/src/components/analysis/ScoreGauge.jsx): score display
- [frontend/src/components/analysis/PatternCard.jsx](frontend/src/components/analysis/PatternCard.jsx): individual pattern display
- [frontend/src/components/layout/GlassCard.jsx](frontend/src/components/layout/GlassCard.jsx): reusable card layout

### Browser extension
- [browser-extension/README.md](browser-extension/README.md)
- Lets users analyze a live webpage with one click
- Captures a screenshot and sends it to the backend
- Opens a results tab for review

---

## 7. How the workflow works

### Step 1: User uploads screenshots
The user uploads one to three screenshots through the web app or browser extension.

### Step 2: Backend sends images to Gemini
The backend preprocesses the screenshot and sends it to Gemini for visual analysis.

### Step 3: Vision model extracts likely dark patterns
The model looks for signs such as:
- pre-selected paid add-ons
- hidden or late-disclosed fees
- urgency language
- guilt-based button wording
- interface asymmetry or misdirection
- suspicious upsells or forced behavior

### Step 4: Pattern classification
The raw output is enriched with CCPA legal categories and a more consistent structure.

### Step 5: Score computation
The system computes a manipulation score based on pattern severity and category weight.

### Step 6: Final response to the client
The frontend displays the patterns, score, grade, evidence, and recommended actions.

---

## 8. API reference

### Base URL
- Local development: http://localhost:8000
- Production: depends on deployment host

### Main endpoints

#### Health check
- Method: GET
- Path: /api/health
- Purpose: confirms the API is live

Example response:
```json
{
  "status": "ok",
  "service": "DarkLens API",
  "version": "1.0.0"
}
```

#### Analyze a single image
- Method: POST
- Path: /api/analyze/image
- Input: multipart/form-data with an image file
- Output: structured analysis response with patterns, score, grade, and summary

Example response summary:
```json
{
  "status": "complete",
  "analysis_id": "da_123",
  "platform_detected": "Amazon",
  "page_type": "checkout",
  "patterns_detected": [],
  "manipulation_score": 72,
  "grade": "D",
  "summary": "Several manipulative tactics were detected."
}
```

#### Export report
- Method: POST
- Path: /api/reports/export
- Input: analysis response and format (json or pdf)
- Purpose: generate and download a report

#### Contribute findings to research corpus
- Method: POST
- Path: /api/research/contribute
- Purpose: store anonymized pattern contributions
- Requires user consent

#### Batch URL analysis
- Method: POST
- Path: /api/batch/analyze
- Input: list of URLs
- Purpose: crawl and analyze multiple sites in one request
- Intended for comparative research or demos

#### Admin analytics
- Method: GET
- Path: /api/admin/analytics
- Purpose: view cache and API efficiency stats

---

## 9. Data model concepts

The key analysis object usually contains:
- analysis_id: unique identifier
- platform_detected: detected platform name
- page_type: category such as checkout, cart, product page, or payment
- patterns_detected: list of detected manipulation patterns
- hidden_costs: list of costs that may have been hidden or late-disclosed
- manipulation_score: score from 0 to 100
- grade: A to F rating
- summary: natural language explanation

Each pattern typically contains:
- title
- description
- severity
- severity_score
- legal category ID and name
- evidence text and location
- confidence level

---

## 10. Architecture summary

### Frontend
- React + Vite + Tailwind
- Handles upload and results presentation
- Communicates with the API using Axios

### Backend
- FastAPI with modular routers and services
- Uses Gemini vision models for analysis
- Uses CCPA taxonomy data for classification
- Stores cache in SQLite

### AI layer
- Google Gemini 2.0 Flash
- Processes screenshots as image prompts
- Returns structured JSON with patterns and context

### Extension layer
- Chrome/Chromium extension for live-page inspection
- Sends a captured screenshot to the backend

---

## 11. Pros

### Strengths
- Strong demo value: visually compelling and easy to understand
- Good fit for consumer-protection storytelling
- Multi-screen analysis adds depth
- Legal grounding through CCPA categories improves credibility
- Export/reporting features make it usable in presentations and advocacy contexts
- Built-in caching reduces repeated API cost and improves efficiency
- Browser extension adds real-world workflow convenience

### Why it stands out
- It turns abstract dark-pattern concepts into concrete evidence
- It combines AI, UX design, and legal categories in one flow
- It is suitable for hackathons, research showcases, and public-interest demos

---

## 12. Limitations and risks

### 12.1 AI accuracy limitations
- The system depends on Gemini’s image interpretation
- It may miss subtle patterns or over-flag benign UI elements
- Results can vary across screenshot quality and layout differences

### 12.2 Not fully deterministic
- Some logic is heuristic rather than purely rule-based
- The scoring system is helpful but should not be treated as a legal verdict

### 12.3 Limited platform support in batch mode
- The batch crawler is restricted to a small allowlist of platforms in the current implementation
- This is acceptable for demos, but not a general-purpose web crawler yet

### 12.4 Limited production hardening
- Authentication is not fully implemented for public use
- The research corpus and cache use local files/SQLite rather than a full database system
- Some parts are more prototype-like than enterprise-grade

### 12.5 Dependency on external API
- The tool depends on a valid Gemini API key
- If the API is rate-limited or unavailable, analysis quality or availability may suffer

### 12.6 Image constraints
- Files larger than 5MB are rejected
- Very low-quality screenshots may lead to poor analysis

---

## 13. Technical pros and cons

### Pros
- Clear separation of concerns between frontend, API, AI processing, and scoring
- The architecture is modular and understandable
- Caching reduces cost and improves repeat-analysis behavior
- The API is easy to extend for new endpoints or reports

### Cons
- Some code paths are more experimental than production-ready
- Error handling is basic in several places
- The system is not yet a polished product for mass public deployment
- The browser extension is useful but still lightweight

---

## 14. Suggested improvements for future versions

### Product improvements
- Add user authentication and saved reports
- Add a better onboarding experience for non-technical users
- Improve explanation quality with plain-language summaries
- Provide a confidence score for each finding and a “why this matters” section

### Technical improvements
- Add more robust validation and fallback logic
- Move from SQLite to a more scalable backend storage model
- Add retries and cost controls for Gemini usage
- Improve batch analysis and web crawling reliability
- Add support for more e-commerce platforms and richer screenshot support

### Research improvements
- Build a larger labeled dataset of dark patterns
- Add human review for ambiguous cases
- Expand legal mapping beyond the current CCPA taxonomy

---

## 15. Why this is valuable to explain to Claude

If you want Claude to make this project more approachable, the best framing is:
- This is not just a “screenshot analyzer”
- It is a consumer-protection and UX-audit tool that makes hidden manipulation visible
- It combines AI, design, law, and user experience in one product
- Its value is in turning confusing interface behavior into understandable evidence

A good high-level explanation would be:
> DarkLens helps people detect manipulative design in online checkout flows by analyzing screenshots, classifying patterns against consumer-protection rules, and producing a score with explanations and exportable evidence.

---

## 16. Short project elevator pitch

DarkLens is a consumer-protection AI tool that scans e-commerce screenshots to reveal hidden manipulative tactics, scores how risky the experience is, and helps users understand and report dark patterns.

---

## 17. Recommended summary for external audiences

DarkLens makes online manipulation easier to see. It analyzes images of checkout and purchase pages, detects patterns such as hidden fees, forced add-ons, urgency pressure, and guilt-based UI choices, and then produces a report that is understandable to both everyday users and policy-minded audiences.
