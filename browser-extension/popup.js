const DEFAULT_API_BASE = "http://127.0.0.1:8000";

const authGate = document.getElementById("authGate");
const analyzePanel = document.getElementById("analyzePanel");
const statusText = document.getElementById("statusText");
const userPill = document.getElementById("userPill");

const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const loginBtn = document.getElementById("loginBtn");

const apiBaseInput = document.getElementById("apiBaseInput");
const saveApiBtn = document.getElementById("saveApiBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("status-error", Boolean(isError));
}

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.textContent = isLoading ? "Analyzing..." : "Analyze This Page";
}

function renderAuth(profile) {
  if (!profile) {
    authGate.classList.remove("hidden");
    analyzePanel.classList.add("hidden");
    return;
  }

  authGate.classList.add("hidden");
  analyzePanel.classList.remove("hidden");
  userPill.textContent = `Signed in as ${profile.name}`;
}

async function loadState() {
  const { userProfile, apiBaseUrl } = await chrome.storage.local.get(["userProfile", "apiBaseUrl"]);
  apiBaseInput.value = apiBaseUrl || DEFAULT_API_BASE;
  renderAuth(userProfile || null);
}

loginBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name || !email) {
    setStatus("Name and email are required.", true);
    return;
  }

  const profile = {
    name,
    email,
    loginAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({ userProfile: profile });
  renderAuth(profile);
  setStatus("Signed in successfully.");
});

saveApiBtn.addEventListener("click", async () => {
  const apiBaseUrl = apiBaseInput.value.trim() || DEFAULT_API_BASE;
  if (!/^https?:\/\//i.test(apiBaseUrl)) {
    setStatus("API URL must start with http:// or https://", true);
    return;
  }

  await chrome.storage.local.set({ apiBaseUrl });
  setStatus("API URL saved.");
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["userProfile"]);
  renderAuth(null);
  setStatus("Logged out.");
});

analyzeBtn.addEventListener("click", async () => {
  setLoading(true);
  setStatus("Capturing and analyzing current page...");

  try {
    const response = await chrome.runtime.sendMessage({ type: "START_ANALYSIS" });

    if (!response?.ok) {
      throw new Error(response?.error || "Analysis failed.");
    }

    setStatus("Analysis complete. Opening results tab...");
    window.close();
  } catch (error) {
    setStatus(error.message || "Failed to analyze page.", true);
  } finally {
    setLoading(false);
  }
});

loadState().catch(() => {
  setStatus("Failed to initialize extension state.", true);
});
