const metaText = document.getElementById("metaText");
const scoreValue = document.getElementById("scoreValue");
const gradeValue = document.getElementById("gradeValue");
const patternsValue = document.getElementById("patternsValue");
const costValue = document.getElementById("costValue");
const summaryText = document.getElementById("summaryText");
const patternsList = document.getElementById("patternsList");
const costsList = document.getElementById("costsList");

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

function renderAnalysis(analysisBundle) {
  const { analysis, page, userProfile, capturedAt } = analysisBundle;

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

async function init() {
  const { lastAnalysis } = await chrome.storage.local.get(["lastAnalysis"]);

  if (!lastAnalysis?.analysis) {
    metaText.textContent = "No analysis result found. Run analysis from popup first.";
    summaryText.textContent = "Open the extension popup and click Analyze This Page.";
    return;
  }

  renderAnalysis(lastAnalysis);
}

init().catch((error) => {
  metaText.textContent = "Unable to load result data.";
  summaryText.textContent = error.message || "Unexpected error while rendering analysis.";
});
