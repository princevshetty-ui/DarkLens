# DarkLens Browser Extension (MV3)

This extension lets a signed-in user analyze the current webpage in one click:

1. User signs in from extension popup (local profile in extension storage).
2. User clicks **Analyze This Page**.
3. Extension captures a full-page screenshot (DevTools protocol; falls back to visible tab if needed).
4. Screenshot is sent to `POST /api/analyze/image` on your DarkLens backend.
5. A new tab opens with the result report.

## Files

- `manifest.json`: Extension metadata and permissions
- `popup.html` + `popup.js`: Sign-in and analyze controls
- `background.js`: Capture + backend request + result storage + open report tab
- `results.html` + `results.js`: Result UI
- `styles.css`: Shared extension styles

## Permissions Used

- `activeTab`: Access current tab
- `tabs`: Read active tab info and open result tab
- `storage`: Save login profile, API URL, latest analysis
- `debugger`: Full-page screenshot capture via Chrome DevTools Protocol
- Host permissions for backend:
  - `http://127.0.0.1:8000/*`
  - `http://localhost:8000/*`

## Local Run

1. Start backend:
   - `cd DarkLens/backend`
   - `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
2. In Chrome, open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select folder: `browser-extension`
6. Open any e-commerce page
7. Click extension icon, sign in, confirm backend URL, click **Analyze This Page**

## Notes

- Full-page screenshot uses debugger API and may fall back to visible tab on restricted pages.
- Analysis works only on regular `http/https` pages.
- If backend is remote, set API URL in popup to your hosted endpoint.
