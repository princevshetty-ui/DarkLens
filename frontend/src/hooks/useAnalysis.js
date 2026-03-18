import { useState, useCallback } from "react";
import axios from "axios";

// ── Helpers ──

function parseCurrency(str) {
  if (!str) return 0;
  const digits = String(str).replace(/[^0-9]/g, "");
  return parseInt(digits) || 0;
}

function getGradeFromScore(score) {
  if (score < 20) return { grade: "A", grade_label: "Clean — Transparent interface", grade_color: "#22c55e" };
  if (score < 40) return { grade: "B", grade_label: "Mild — Minor design concerns", grade_color: "#84cc16" };
  if (score < 60) return { grade: "C", grade_label: "Moderate — Multiple manipulation patterns", grade_color: "#eab308" };
  if (score < 80) return { grade: "D", grade_label: "Severe — Aggressive dark patterns", grade_color: "#f97316" };
  return { grade: "F", grade_label: "Critical — Systematic manipulation", grade_color: "#ef4444" };
}

// ── Cross-Image Analysis (runs entirely in frontend) ──

function crossImageAnalysis(results) {
  if (results.length < 2) return null;

  const findings = [];

  // 1. New hidden costs appearing in later screens
  for (let i = 1; i < results.length; i++) {
    const prevCostLabels = new Set(
      results.slice(0, i).flatMap(r => r.hidden_costs || []).map(c => c.label.toLowerCase())
    );
    const newCosts = (results[i].hidden_costs || []).filter(
      c => !prevCostLabels.has(c.label.toLowerCase())
    );

    if (newCosts.length > 0) {
      findings.push({
        type: "DRIP_PRICING_ACROSS_FLOW",
        severity: "VIOLATION",
        title: "Cross-Screen Price Escalation",
        description: `New charges appeared on Screen ${i + 1} that were not visible on earlier screens: ${newCosts.map(c => `${c.label} (${c.amount})`).join(", ")}. This is a classic drip pricing pattern spread across the checkout flow.`,
        ccpa_category: "Drip Pricing / Bait & Switch"
      });
    }
  }

  // 2. Pattern count escalation through flow
  const firstCount = results[0].total_patterns_found;
  const lastCount = results[results.length - 1].total_patterns_found;
  if (lastCount > firstCount + 1) {
    findings.push({
      type: "ESCALATING_MANIPULATION",
      severity: "CAUTION",
      title: "Increasing Manipulation Through Flow",
      description: `Dark patterns increase from ${firstCount} on Screen 1 to ${lastCount} on Screen ${results.length}. The experience becomes progressively more manipulative as you approach payment.`,
      ccpa_category: "Interface Interference"
    });
  }

  // 3. New violation categories appearing later
  const earlyCategories = new Set(results[0].categories_violated || []);
  const newCategoryIds = [];
  results.slice(1).forEach(r => {
    (r.categories_violated || []).forEach(c => {
      if (!earlyCategories.has(c) && !newCategoryIds.includes(c)) {
        newCategoryIds.push(c);
      }
    });
  });

  if (newCategoryIds.length > 0) {
    findings.push({
      type: "NEW_VIOLATION_CATEGORIES",
      severity: "CAUTION",
      title: "New Manipulation Types Introduced Later",
      description: `Later screens introduce ${newCategoryIds.length} new dark pattern categor${newCategoryIds.length > 1 ? "ies" : "y"} not present on the first screen, suggesting a deliberate escalation strategy.`,
      ccpa_category: "Multiple Categories"
    });
  }

  // 4. Manipulation score escalation
  const scores = results.map(r => r.manipulation_score);
  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  if (lastScore > firstScore + 15) {
    findings.push({
      type: "SCORE_ESCALATION",
      severity: "CAUTION",
      title: "Manipulation Intensifies Toward Payment",
      description: `Manipulation score climbs from ${firstScore}/100 on Screen 1 to ${lastScore}/100 on Screen ${scores.length}. The closer you get to paying, the more aggressive the interface becomes.`,
      ccpa_category: "Multiple"
    });
  }

  return {
    findings,
    totalIssues: findings.length,
    hasCritical: findings.some(f => f.severity === "VIOLATION"),
    individualScores: scores
  };
}

// ── Merge Multiple Analysis Results ──

function mergeResults(results) {
  if (results.length === 1) return { ...results[0], _images_analyzed: 1 };

  // Deduplicate patterns by title
  const allPatterns = [];
  const seenTitles = new Set();
  results.forEach((r, imgIdx) => {
    (r.patterns_detected || []).forEach(p => {
      if (!seenTitles.has(p.title)) {
        seenTitles.add(p.title);
        allPatterns.push({
          ...p,
          pattern_id: `dp_${String(allPatterns.length + 1).padStart(3, "0")}`,
          _source_screen: imgIdx + 1
        });
      }
    });
  });

  // Deduplicate hidden costs by label
  const allCosts = [];
  const seenCosts = new Set();
  results.forEach(r => {
    (r.hidden_costs || []).forEach(c => {
      if (!seenCosts.has(c.label.toLowerCase())) {
        seenCosts.add(c.label.toLowerCase());
        allCosts.push(c);
      }
    });
  });

  // Total overcharge
  let totalOvercharge = 0;
  allCosts.forEach(c => { totalOvercharge += parseCurrency(c.amount); });

  // Use highest manipulation score
  const maxScore = Math.max(...results.map(r => r.manipulation_score));
  const gradeInfo = getGradeFromScore(maxScore);

  // Platform detection
  const platform = results.find(r => r.platform_detected && r.platform_detected !== "Unknown")?.platform_detected || "Unknown";

  // Page type from last image (usually deepest in flow)
  const pageType = results[results.length - 1]?.page_type || "checkout";

  // Build combined summary
  const combinedSummary = results.length > 1
    ? results.map((r, i) => `Screen ${i + 1}: ${r.summary}`).join(" | ")
    : results[0].summary;

  return {
    status: "complete",
    analysis_id: `da_multi_${Date.now().toString(36)}`,
    platform_detected: platform,
    page_type: pageType,
    timestamp: new Date().toISOString(),
    patterns_detected: allPatterns,
    total_patterns_found: allPatterns.length,
    categories_violated: [...new Set(allPatterns.map(p => p.ccpa_category_id))],
    hidden_costs: allCosts,
    estimated_overcharge: totalOvercharge > 0 ? `₹${totalOvercharge}` : "₹0",
    manipulation_score: maxScore,
    ...gradeInfo,
    summary: combinedSummary,
    _images_analyzed: results.length,
    _individual_results: results
  };
}

// ── Main Hook ──

export function useAnalysis() {
  const [status, setStatus] = useState("idle");       // idle | scanning | complete | error
  const [result, setResult] = useState(null);          // merged results
  const [crossImage, setCrossImage] = useState(null);  // cross-image findings
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const analyzeImages = useCallback(async (files, onImageResponse) => {
    if (!files || files.length === 0) return;

    setStatus("scanning");
    setResult(null);
    setCrossImage(null);
    setError(null);
    setScanProgress({ current: 0, total: files.length });

    try {
      const allResults = [];

      for (let i = 0; i < files.length; i++) {
        setScanProgress({ current: i + 1, total: files.length });

        const formData = new FormData();
        formData.append("file", files[i]);

        const response = await axios.post("/api/analyze/image", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 45000,
        });

        onImageResponse?.(response.data, i);

        const payload = response.data;
        const normalized =
          payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
            ? payload.data
            : payload;

        allResults.push(normalized);
      }

      // Merge all results into one unified result
      const merged = mergeResults(allResults);
      setResult(merged);

      // Run cross-image analysis if multiple images
      if (allResults.length > 1) {
        const cross = crossImageAnalysis(allResults);
        setCrossImage(cross);
      }

      setStatus("complete");
      return merged;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Analysis failed. Please try again.";
      setError(msg);
      setStatus("error");
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setCrossImage(null);
    setError(null);
    setScanProgress({ current: 0, total: 0 });
  }, []);

  return { status, result, crossImage, error, scanProgress, analyzeImages, reset };
}