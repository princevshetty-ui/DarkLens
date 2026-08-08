const metaText = document.getElementById("metaText");
const scoreValue = document.getElementById("scoreValue");
const gradeValue = document.getElementById("gradeValue");
const patternsValue = document.getElementById("patternsValue");
const costValue = document.getElementById("costValue");
const summaryText = document.getElementById("summaryText");
const patternsList = document.getElementById("patternsList");
const costsList = document.getElementById("costsList");
const emptyState = document.getElementById("emptyState");
const reportContent = document.getElementById("reportContent");
const shareBtn = document.getElementById("shareBtn");
const openSetupBtn = document.getElementById("openSetupBtn");
const emptyOpenSetupBtn = document.getElementById("emptyOpenSetupBtn");

let currentAnalysisBundle = null;

function buildListItem(title, detail, severity) {
  const item = document.createElement("article");
  item.className = "list-item";

  if (severity) {
    item.dataset.severity = severity;
  }

  const h3 = document.createElement("h3");
  h3.textContent = title;

  const p = document.createElement("p");
  p.textContent = detail;

  item.append(h3, p);
  return item;
}

function severityLabel(severity) {
  if (!severity) return "Unknown";
  return String(severity).toLowerCase();
}

function shortPatternTitle(title) {
  const cleanTitle = String(title || "Pattern").trim();
  return cleanTitle.length > 42 ? `${cleanTitle.slice(0, 39)}...` : cleanTitle;
}

function setView(hasAnalysis) {
  emptyState.hidden = hasAnalysis;
  reportContent.hidden = !hasAnalysis;
  shareBtn.disabled = !hasAnalysis;
}

function openSetupPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = nextLine;
    }
  });

  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function scoreColor(score) {
  if (score > 60) return "#ef4444";
  if (score > 30) return "#facc15";
  return "#22c55e";
}

function topPatternTitles(patterns) {
  return [...(patterns || [])]
    .sort((left, right) => (right.severity_score || 0) - (left.severity_score || 0))
    .slice(0, 3)
    .map((pattern) => shortPatternTitle(pattern.title));
}

function createShareCardCanvas(analysis) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  const width = canvas.width;
  const height = canvas.height;
  const margin = 64;
  const cardX = margin;
  const cardY = 170;
  const cardW = width - margin * 2;
  const cardH = height - 250;
  const score = Number.isFinite(analysis?.manipulation_score) ? analysis.manipulation_score : 0;
  const grade = analysis?.grade || "-";
  const platform = analysis?.platform_detected || "Unknown platform";
  const topPatterns = topPatternTitles(analysis?.patterns_detected || []);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#020617");
  bg.addColorStop(0.55, "#0f172a");
  bg.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 64px Segoe UI, sans-serif";
  ctx.fillText("DarkLens", margin, 92);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 28px Segoe UI, sans-serif";
  ctx.fillText("Shareable scan summary", margin, 132);

  ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 24px Segoe UI, sans-serif";
  ctx.fillText("Platform", cardX + 42, cardY + 66);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 42px Segoe UI, sans-serif";
  wrapText(ctx, platform, cardX + 42, cardY + 120, cardW - 380, 48);

  ctx.fillStyle = "rgba(34, 211, 238, 0.16)";
  roundedRect(ctx, cardX + cardW - 290, cardY + 38, 210, 74, 22);
  ctx.fill();
  ctx.fillStyle = "#22d3ee";
  ctx.font = "600 20px Segoe UI, sans-serif";
  ctx.fillText("Manipulation", cardX + cardW - 260, cardY + 70);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "800 54px Segoe UI, sans-serif";
  ctx.fillText(String(score), cardX + cardW - 260, cardY + 145);
  ctx.fillStyle = scoreColor(score);
  ctx.font = "700 24px Segoe UI, sans-serif";
  ctx.fillText(`Grade ${grade}`, cardX + cardW - 180, cardY + 142);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 24px Segoe UI, sans-serif";
  ctx.fillText("Top patterns", cardX + 42, cardY + 252);

  const baseY = cardY + 318;
  if (topPatterns.length === 0) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 30px Segoe UI, sans-serif";
    ctx.fillText("No major manipulation detected.", cardX + 42, baseY);
  } else {
    topPatterns.forEach((title, index) => {
      const rowY = baseY + index * 126;
      ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
      roundedRect(ctx, cardX + 36, rowY - 34, cardW - 72, 94, 24);
      ctx.fill();

      ctx.fillStyle = "#22d3ee";
      ctx.font = "700 26px Segoe UI, sans-serif";
      ctx.fillText(`0${index + 1}`, cardX + 60, rowY + 6);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 30px Segoe UI, sans-serif";
      wrapText(ctx, title, cardX + 118, rowY + 10, cardW - 170, 34);
    });
  }

  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.font = "500 22px Segoe UI, sans-serif";
  ctx.fillText(`Generated by DarkLens • ${new Date().toLocaleDateString()}`, cardX + 42, cardY + cardH - 40);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function exportShareCard() {
  if (!currentAnalysisBundle?.analysis) {
    return;
  }

  const canvas = createShareCardCanvas(currentAnalysisBundle.analysis);
  const reportId = currentAnalysisBundle.analysis.analysis_id || "darklens";
  downloadCanvas(canvas, `darklens-share-${reportId}.png`);
}

function renderAnalysis(analysisBundle) {
  currentAnalysisBundle = analysisBundle;
  const { analysis, page, userProfile, capturedAt } = analysisBundle;
  setView(true);

  metaText.textContent = `${page?.title || "Unknown page"} | ${new Date(capturedAt).toLocaleString()} | ${userProfile?.name || "User"}`;

  scoreValue.textContent = `${analysis.manipulation_score ?? "-"}/100`;
  gradeValue.textContent = `${analysis.grade || "-"} | ${analysis.grade_label || "No grade label"}`;
  patternsValue.textContent = String(analysis.total_patterns_found ?? 0);
  costValue.textContent = analysis.estimated_overcharge || "₹0";
  summaryText.textContent = analysis.summary || "No summary returned by API.";

  const patterns = analysis.patterns_detected || [];
  patternsList.innerHTML = "";
  if (patterns.length === 0) {
    patternsList.append(buildListItem("No major patterns", "No manipulative patterns were detected."));
  } else {
    patterns.forEach((pattern) => {
      patternsList.append(
        buildListItem(
          `${pattern.title} (${severityLabel(pattern.severity)})`,
          pattern.evidence || "No detailed evidence provided.",
          severityLabel(pattern.severity)
        )
      );
    });
  }

  const costs = analysis.hidden_costs || [];
  costsList.innerHTML = "";
  if (costs.length === 0) {
    costsList.append(buildListItem("No hidden costs", "No hidden charges were detected."));
  } else {
    costs.forEach((cost) => {
      costsList.append(
        buildListItem(
          `${cost.label || "Unknown charge"}: ${cost.amount || "N/A"}`,
          cost.context || "No context provided by the API."
        )
      );
    });
  }
}

async function loadCurrentAnalysis() {
  const { lastAnalysis } = await chrome.storage.local.get(["lastAnalysis"]);

  if (!lastAnalysis?.analysis) {
    currentAnalysisBundle = null;
    setView(false);
    metaText.textContent = "No scan yet";
    summaryText.textContent = "Visit a checkout page to get started, or open Sign In / Settings to run a manual scan.";
    return;
  }

  renderAnalysis(lastAnalysis);
}

async function init() {
  await loadCurrentAnalysis();
}

shareBtn.addEventListener("click", () => {
  try {
    exportShareCard();
  } catch (error) {
    summaryText.textContent = error.message || "Unable to generate share card.";
  }
});

openSetupBtn.addEventListener("click", openSetupPage);
emptyOpenSetupBtn.addEventListener("click", openSetupPage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.lastAnalysis) {
    loadCurrentAnalysis().catch((error) => {
      summaryText.textContent = error.message || "Unexpected error while refreshing analysis.";
    });
  }
});

init().catch((error) => {
  metaText.textContent = "Unable to load result data.";
  summaryText.textContent = error.message || "Unexpected error while rendering analysis.";
});
