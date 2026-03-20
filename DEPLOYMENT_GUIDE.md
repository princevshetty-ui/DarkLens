# DarkLens Deployment & Production Guide

This is the single source of truth for deployment.

## 1. What is already done

- Frontend API calls now use environment-safe endpoints (no hardcoded localhost required).
- Vite dev proxy is configured (`/api` -> backend at `http://localhost:8000`).
- Backend CORS is fixed for:
  - localhost development
  - GitHub Codespaces domains (`*.github.dev`, `*.app.github.dev`)
  - custom production domains via `CORS_ORIGINS` env variable
- Export endpoint logic is fixed:
  - JSON export works as JSON response with download header
  - PDF export now streams bytes correctly
- Duplicate backend route (`/api/research/contribute`) was removed.
- Frontend build config is fixed (no optional terser dependency required).

## 2. Required environment variables

Create `.env` at repo root (or set env vars in your platform):

```env
GEMINI_API_KEY=your_google_gemini_api_key
CORS_ORIGINS=https://your-frontend-domain.com
LOG_LEVEL=INFO
```

Notes:
- For local dev, `CORS_ORIGINS` is optional because localhost is already allowed.
- For production, set `CORS_ORIGINS` to your real frontend domain(s), comma-separated.

## 3. Local development run

Backend:

```bash
cd DarkLens/backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## 3.1 Codespaces-specific notes

When running in GitHub Codespaces, do not rely on `localhost` in your local machine browser.
Use forwarded Ports URLs from the VS Code Ports panel.

Recommended:
- Frontend port `5173`: set visibility to `Public` and open the `https://...-5173.app.github.dev` URL.
- Backend port `8000`: keep private/internal when frontend is using Vite proxy.

If you see:
- `Unsafe attempt to load URL ... from frame with URL chrome-error://chromewebdata/`

It usually means the page failed to load first (network/tunnel issue) and then a redirect/open happened from the browser error page.
Fix by:
1. Ensure frontend dev server is running.
2. Ensure port `5173` is forwarded and openable.
3. Hard refresh the page (Ctrl+Shift+R).
4. Reopen the forwarded URL from Ports panel instead of reusing stale tabs.

## 4. Production deployment patterns

## Option A: Single origin (recommended)

Serve frontend build and backend from same domain.

1. Build frontend:

```bash
cd frontend
npm ci
npm run build
```

2. Run backend:

```bash
cd DarkLens/backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

In this mode, frontend calls `/api/...` on same origin.

## Option B: Split frontend + backend domains

Set frontend env:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

Set backend CORS:

```env
CORS_ORIGINS=https://your-frontend-domain.com
```

## 5. Docker deployment

Build and run:

```bash
docker build -t darklens:latest .
docker run -d \
  --name darklens \
  -p 8000:8000 \
  -e GEMINI_API_KEY=your_google_gemini_api_key \
  -e CORS_ORIGINS=https://your-frontend-domain.com \
  darklens:latest
```

## 6. Verification checklist

After deployment, verify in this order:

1. `GET /api/health` returns 200
2. `POST /api/analyze/image` works
3. `POST /api/reports/export` works (JSON)
4. `POST /api/reports/export` works (PDF)
5. `POST /api/research/contribute` works
6. Frontend export button downloads file without CORS/network errors

## 7. If export still fails

Check browser console and match below:

- `ERR_CONNECTION_REFUSED`
  - Backend is not reachable. Verify host/port and deployment routing.
- `Unsafe attempt to load URL ... from frame with URL chrome-error://chromewebdata/`
  - The browser is currently on an error page frame. Reopen the forwarded app URL from Ports panel after confirming server is running.
- `No 'Access-Control-Allow-Origin' header`
  - `CORS_ORIGINS` missing/incorrect for frontend domain.
- `422 Unprocessable Entity`
  - Request body shape mismatch. Ensure `analysis_response` exists.
- `500 Report export failed`
  - Inspect backend logs for report generation details.

## 8. Final recommendation

Use **Option A (single origin)** for hackathon/demo deployments. It is simpler, avoids cross-origin complexity, and is more reliable.
