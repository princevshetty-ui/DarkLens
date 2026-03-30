const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEBUGGER_VERSION = "1.3";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capturePageWithDebugger(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, DEBUGGER_VERSION);

  try {
    await chrome.debugger.sendCommand(target, "Page.enable");
    await delay(150);

    const result = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true,
    });

    if (!result?.data) {
      throw new Error("No screenshot data returned from debugger API.");
    }

    return `data:image/png;base64,${result.data}`;
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function capturePageFallback(windowId) {
  return chrome.tabs.captureVisibleTab(windowId, { format: "png" });
}

async function captureCurrentPage(tab) {
  try {
    return await capturePageWithDebugger(tab.id);
  } catch {
    return capturePageFallback(tab.windowId);
  }
}

async function sendAnalysisRequest(dataUrl, apiBaseUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const formData = new FormData();
  formData.append("file", blob, "page_capture.png");

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/analyze/image`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `Failed to fetch. Check API URL (${apiBaseUrl}), backend server status, and extension permissions. If you changed manifest permissions, reload the extension.`
    );
  }

  if (!response.ok) {
    let detail = `Backend error (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload?.detail || detail;
    } catch {
      // Ignore JSON parse errors and use generic detail.
    }
    throw new Error(detail);
  }

  return response.json();
}

async function checkBackend(apiBaseUrl) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/health`, { method: "GET" });
  } catch {
    throw new Error(
      `Cannot reach backend at ${apiBaseUrl}. Make sure server is running and reload extension after permission changes.`
    );
  }

  if (!response.ok) {
    throw new Error(`Backend health check failed with status ${response.status}.`);
  }
}

async function runPageAnalysis() {
  const [{ userProfile, apiBaseUrl }, activeTab] = await Promise.all([
    chrome.storage.local.get(["userProfile", "apiBaseUrl"]),
    getActiveTab(),
  ]);

  if (!userProfile) {
    throw new Error("Please sign in from the extension popup first.");
  }

  if (!activeTab?.id) {
    throw new Error("No active tab found.");
  }

  if (!activeTab.url || !/^https?:/i.test(activeTab.url)) {
    throw new Error("Open a regular website tab before analyzing.");
  }

  const baseUrl = (apiBaseUrl || DEFAULT_API_BASE).trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Invalid API URL. Use http:// or https:// (example: http://127.0.0.1:8000).");
  }

  await checkBackend(baseUrl);

  const dataUrl = await captureCurrentPage(activeTab);
  const analysis = await sendAnalysisRequest(dataUrl, baseUrl);

  await chrome.storage.local.set({
    lastAnalysis: {
      analysis,
      page: {
        title: activeTab.title || "Untitled Page",
        url: activeTab.url,
      },
      userProfile,
      capturedAt: new Date().toISOString(),
    },
  });

  await chrome.tabs.create({ url: chrome.runtime.getURL("results.html") });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "START_ANALYSIS") {
    return false;
  }

  runPageAnalysis()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unknown error" }));

  return true;
});
