import { useCallback, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Shield, AlertTriangle, DollarSign, Eye, TrendingDown,
  MapPin, CheckCircle, ChevronRight, RotateCcw, ShieldAlert,
  Target, Users, Zap, FileWarning, Layers, ArrowRight, Lightbulb,
  Download, Share2, Check, X, AlertCircle
} from "lucide-react";

import GlassCard from "./components/layout/GlassCard";
import UploadZone from "./components/upload/UploadZone";
import ScanningOverlay from "./components/analysis/ScanningOverlay";
import ScoreGauge from "./components/analysis/ScoreGauge";
import { useAnalysis } from "./hooks/useAnalysis";
import { API_ENDPOINTS } from "./config/api";
import { fetchWithRetry, formatErrorMessage } from "./config/apiClient";

// ── Typing Effect ──
function TypingText({ text, speed = 18, delay = 0, className = "" }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed(""); setDone(false); setStarted(false);
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [text, delay]);

  useEffect(() => {
    if (!started || !text) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [started, text, speed]);

  return <span className={className}>{displayed}{!done && started && <span className="typing-cursor" />}</span>;
}

// ── Animated Background ──
function PremiumBackground() {
  return (
    <div className="bg-premium">
      <div className="bg-gradient-blob-1" />
      <div className="bg-gradient-blob-2" />
      <div className="bg-gradient-blob-3" />
      <div className="glow-orb-1" />
      <div className="glow-orb-2" />
      <div className="glow-orb-3" />
    </div>
  );
}

// ── Section Wrapper with staggered reveal ──
function RevealSection({ children, delay = 0, className = "" }) {
  return (
    <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}>
      {children}
    </motion.div>
  );
}

// ── Confidence Bar Component ──
function ConfidenceBar({ level }) {
  const config = {
    high: { width: "100%", color: "bg-green-400", text: "text-green-400", label: "HIGH" },
    medium: { width: "60%", color: "bg-yellow-400", text: "text-yellow-400", label: "MEDIUM" },
    low: { width: "30%", color: "bg-white/30", text: "text-white/30", label: "LOW" },
  };
  const c = config[level] || config.medium;
  return (
    <div className="flex items-center gap-2">
      <div className="confidence-bar w-16">
        <div className={`confidence-bar-fill ${c.color}`} style={{ width: c.width }} />
      </div>
      <span className={`text-[9px] uppercase tracking-wider font-semibold ${c.text}`}>{c.label}</span>
    </div>
  );
}

// ── Pattern Deduplication ──
function deduplicatePatterns(patterns) {
  const seen = {};
  const deduped = [];

  patterns.forEach(p => {
    const key = p.title.toLowerCase().trim();
    if (seen[key]) {
      // Mark existing as multi-screen
      seen[key]._multi_screen = true;
      const existingScreens = seen[key]._source_screens || [seen[key]._source_screen || 1];
      if (p._source_screen && !existingScreens.includes(p._source_screen)) {
        existingScreens.push(p._source_screen);
      }
      seen[key]._source_screens = existingScreens;
      // Keep higher severity
      if (p.severity === "VIOLATION" && seen[key].severity !== "VIOLATION") {
        seen[key].severity = "VIOLATION";
        seen[key].severity_score = Math.max(seen[key].severity_score, p.severity_score);
      }
    } else {
      const entry = { ...p };
      entry._multi_screen = false;
      entry._source_screens = p._source_screen ? [p._source_screen] : [];
      seen[key] = entry;
      deduped.push(entry);
    }
  });

  return deduped;
}

// ── Key Insight Generator ──
function generateKeyInsight(result, crossImage, isLowConfidence = false) {
  if (!result) return null;

  if (isLowConfidence) {
    return {
      icon: FileWarning,
      color: "text-yellow-400",
      bg: "bg-yellow-500/5",
      border: "border-yellow-500/15",
      text: "Analysis confidence is low for this run. Upload clearer screenshots to get a more reliable manipulation score and findings."
    };
  }

  const score = result.manipulation_score;
  const patterns = result.patterns_detected || [];
  const costs = result.hidden_costs || [];
  const multi = (result._images_analyzed || 1) > 1;

  // Clean page
  if (score < 15 || patterns.length === 0) {
    return {
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/5",
      border: "border-green-500/15",
      text: "This interface appears transparent. No significant manipulation techniques were detected in the analyzed screen(s)."
    };
  }

  // Cross-screen escalation
  if (crossImage && crossImage.findings.length > 0 && crossImage.individualScores) {
    const scores = crossImage.individualScores;
    if (scores.length > 1 && scores[scores.length - 1] > scores[0] + 10) {
      return {
        icon: TrendingDown,
        color: "text-red-400",
        bg: "bg-red-500/5",
        border: "border-red-500/15",
        text: `Manipulation intensifies through the checkout flow — rising from ${scores[0]}/100 on Screen 1 to ${scores[scores.length - 1]}/100 on Screen ${scores.length}. The strongest pressure is applied at the point of payment.`
      };
    }
  }

  // Hidden costs detected
  if (costs.length > 0) {
    const totalCost = costs.reduce((sum, c) => {
      const normalized = String(c.amount ?? "")
        .replace(/[^0-9.,-]/g, "")
        .replace(/,/g, "");
      const amount = Number.parseFloat(normalized);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    if (totalCost > 0) {
      return {
        icon: DollarSign,
        color: "text-orange-400",
        bg: "bg-orange-500/5",
        border: "border-orange-500/15",
        text: `₹${totalCost.toFixed(2)} in charges are not transparently disclosed during the initial browsing experience. These fees become visible only as you approach payment.`
      };
    }
  }

  // Forced action patterns
  const hasForced = patterns.some(p => p.ccpa_category_id === 5 && p.severity === "VIOLATION");
  if (hasForced) {
    return {
      icon: ShieldAlert,
      color: "text-red-400",
      bg: "bg-red-500/5",
      border: "border-red-500/15",
      text: "Pre-selected paid options detected — the interface adds charges that require active removal rather than active consent."
    };
  }

  // Nudging patterns
  const hasNudging = patterns.some(p => [3, 4, 7].includes(p.ccpa_category_id));
  if (hasNudging) {
    return {
      icon: Eye,
      color: "text-yellow-400",
      bg: "bg-yellow-500/5",
      border: "border-yellow-500/15",
      text: "The interface uses visual hierarchy and social proof to steer decisions toward paid options, though explicit forced selection was not detected."
    };
  }

  // Generic medium risk
  return {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-500/5",
    border: "border-yellow-500/15",
    text: `${patterns.length} manipulation pattern${patterns.length > 1 ? "s" : ""} detected. While not all are severe, they collectively reduce transparency in the user experience.`
  };
}

// ── Standard Helpers ──

function getRiskLevel(score) {
  if (score < 25) return { label: "Low", color: "text-neon-green", bg: "bg-green-500/10" };
  if (score < 50) return { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10" };
  if (score < 75) return { label: "High", color: "text-neon-orange", bg: "bg-orange-500/10" };
  return { label: "Critical", color: "text-neon-red", bg: "bg-red-500/10" };
}

function getTrustScore(s) { return Math.max(0, 100 - s); }

function deriveUserImpacts(patterns) {
  const impacts = [];
  const cats = patterns.map(p => p.ccpa_category_id);
  if (cats.includes(5) || cats.includes(2)) impacts.push({ icon: DollarSign, text: "May increase your final cost without clear consent", severity: "high" });
  if (cats.includes(4) || cats.includes(7)) impacts.push({ icon: Eye, text: "Visual design steers you toward paid options", severity: "medium" });
  if (cats.includes(1)) impacts.push({ icon: Zap, text: "Artificial urgency may pressure hasty decisions", severity: "medium" });
  if (cats.includes(6) || cats.includes(12)) impacts.push({ icon: TrendingDown, text: "Hidden fees reduce price transparency", severity: "high" });
  if (cats.includes(3)) impacts.push({ icon: Users, text: "Guilt-based language manipulates your choices", severity: "medium" });
  if (impacts.length === 0 && patterns.length > 0) impacts.push({ icon: AlertTriangle, text: "Interface design may subtly influence decisions", severity: "low" });
  return impacts;
}

function getJourneyInsight(pt) {
  const m = {
    checkout: "These patterns appear during checkout — users spend 40% less time reading here compared to browsing.",
    cart: "Patterns at the cart stage exploit the user's sunk cost of having already invested time in selection.",
    payment: "Manipulation at payment is most impactful — users are one click from completing the transaction.",
    product_page: "Patterns here influence initial decisions before entering the purchase funnel.",
    search_results: "Manipulation at search affects which options users even consider.",
  };
  return m[pt] || "These patterns appear where attention is divided — exactly where dark patterns are most effective.";
}

function getSuggestedActions(score, patterns, costs) {
  if (score < 20 || patterns.length === 0) {
    return { type: "clean", message: "No major manipulation detected. This interface appears transparent and respects user choice.", actions: [] };
  }
  if (score < 55) {
    const a = [];
    const c = patterns.map(p => p.ccpa_category_id);
    if (c.includes(1)) a.push({ icon: Zap, text: "Take your time — urgency indicators may be artificial", priority: "medium" });
    if (c.includes(4)) a.push({ icon: Eye, text: "Look for smaller 'Skip' or 'No thanks' options", priority: "medium" });
    if (costs?.length > 0) a.push({ icon: DollarSign, text: "Compare the final total with the initially advertised price", priority: "medium" });
    if (a.length === 0) a.push({ icon: AlertTriangle, text: "Review all options carefully before proceeding", priority: "medium" });
    return { type: "caution", message: "Some elements may subtly influence your decision. Review carefully.", actions: a };
  }
  const a = [];
  const c = patterns.map(p => p.ccpa_category_id);
  if (costs?.length > 0) a.push({ icon: DollarSign, text: "Review final price breakdown against initially shown price", priority: "high" });
  if (c.includes(5) || c.includes(2)) a.push({ icon: CheckCircle, text: "Check all pre-selected add-ons before confirming payment", priority: "high" });
  if (c.includes(1)) a.push({ icon: Zap, text: "Ignore countdown timers — most are artificial", priority: "medium" });
  if (c.includes(4)) a.push({ icon: Eye, text: "Look for the smaller 'Skip' or 'No thanks' option", priority: "medium" });
  a.push({ icon: Shield, text: "Screenshot as evidence — file complaints at consumerhelpline.gov.in", priority: "low" });
  return { type: "danger", message: "Significant manipulation detected. Review carefully and consider reporting.", actions: a };
}

function getPatternDistribution(patterns) {
  const d = {};
  patterns.forEach(p => {
    const n = p.ccpa_category_name;
    if (!d[n]) d[n] = { count: 0, severity: p.severity };
    d[n].count++;
    if (p.severity === "VIOLATION") d[n].severity = "VIOLATION";
    else if (p.severity === "CAUTION" && d[n].severity === "FAIR") d[n].severity = "CAUTION";
  });
  return Object.entries(d).map(([name, data]) => ({ name, ...data }));
}

// ── Enhanced Pattern Card (with confidence bar + multi-screen tag) ──
function EnhancedPatternCard({ pattern, index }) {
  const configs = {
    VIOLATION: { badge: "badge-violation", border: "border-l-red-500", iconBg: "bg-red-500/15", iconColor: "text-red-400", glow: "glow-red" },
    CAUTION: { badge: "badge-caution", border: "border-l-yellow-500", iconBg: "bg-yellow-500/15", iconColor: "text-yellow-400", glow: "glow-orange" },
    FAIR: { badge: "badge-fair", border: "border-l-green-500", iconBg: "bg-green-500/15", iconColor: "text-green-400", glow: "" },
  };
  const c = configs[pattern.severity] || configs.CAUTION;
  const Icon = pattern.severity === "VIOLATION" ? ShieldAlert : pattern.severity === "CAUTION" ? AlertTriangle : CheckCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.8 + index * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.01, y: -2 }}
    >
      <div className={`glass-card border-l-4 ${c.border} p-6 ${c.glow}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${c.iconBg}`}>
              <Icon size={18} className={c.iconColor} />
            </div>
            <div>
              <h4 className="font-heading font-semibold text-white/90 text-sm">{pattern.title}</h4>
              <p className="text-[10px] text-white/35 mt-0.5">
                CCPA Category {pattern.ccpa_category_id}: {pattern.ccpa_category_name}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={c.badge}>{pattern.severity}</span>
            {pattern._multi_screen && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/20">
                Multi-screen
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-white/55 leading-relaxed mb-4">{pattern.description}</p>

        {/* User Impact */}
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5 mb-4">
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-neon-blue mt-0.5 shrink-0" />
            <p className="text-sm text-neon-blue/80 font-medium leading-relaxed">{pattern.user_impact}</p>
          </div>
        </div>

        <div className="section-divider" />

        {/* Evidence + Confidence */}
        <div className="flex items-center justify-between mt-3">
          <code className="text-[11px] bg-white/[0.03] px-2 py-1 rounded text-white/40 font-mono max-w-[250px] truncate">
            {pattern.evidence?.content}
          </code>
          <ConfidenceBar level={pattern.confidence} />
        </div>
      </div>
    </motion.div>
  );
}


// ═════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════

export default function App() {
  const { status, result, crossImage, error, scanProgress, analyzeImages, reset } = useAnalysis();
  const [toast, setToast] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showResearchConsent, setShowResearchConsent] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const analysisResult = result || null;
  const fallbackSummaryMessage = "Analysis could not be completed. Please try again with a clearer screenshot.";
  const overallScore = Number(analysisResult?.overall_score ?? analysisResult?.manipulation_score ?? 0);
  const patternsCount = Array.isArray(analysisResult?.patterns_detected)
    ? analysisResult.patterns_detected.length
    : Number(analysisResult?.total_patterns_found ?? 0);
  const isLowConfidenceSummary = analysisResult?.summary === fallbackSummaryMessage;
  const hasNoFindings = status === "complete" && !!analysisResult && patternsCount === 0;
  const useLowConfidenceFallback = hasNoFindings && isLowConfidenceSummary;
  const effectiveScore = useLowConfidenceFallback ? 27 : overallScore;
  const displayGrade = useLowConfidenceFallback ? "B" : analysisResult?.grade;
  const displayGradeLabel = useLowConfidenceFallback
    ? "Low-confidence analysis. Retry with clearer screenshots for a more reliable score."
    : analysisResult?.grade_label;
  const displayGradeColor = useLowConfidenceFallback ? "#84cc16" : analysisResult?.grade_color;
  const safeSummary =
    status === "error"
      ? (error || fallbackSummaryMessage)
      : analysisResult?.summary === fallbackSummaryMessage
        ? "Analysis completed with low confidence. Please retry with clearer screenshots for better accuracy."
        : (analysisResult?.summary || "Analysis complete.");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleUpload = useCallback(async (files) => {
    try {
      await analyzeImages(files);
      setToast({ type: "success", message: "Analysis Complete ✅" });
    } catch {
      // Error state is already managed inside the analysis hook.
    }
  }, [analyzeImages]);

  const handleExportReport = useCallback(async (format = "json") => {
    if (!analysisResult) return;
    
    setIsExporting(true);
    try {
      const response = await fetchWithRetry(API_ENDPOINTS.EXPORT_REPORT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_response: analysisResult,
          format: format,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const contentType = response.headers.get("content-type");
      const filename = response.headers
        .get("content-disposition")
        ?.split("filename=")[1]?.replaceAll('"', "") || `report.${format}`;

      if (format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setToast({ type: "success", message: `Report exported as ${format.toUpperCase()} ✅` });
      setShowExportModal(false);
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      setToast({ type: "error", message: `Export failed: ${errorMsg}` });
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [analysisResult]);

  const handleContributeToCorpus = useCallback(async () => {
    if (!analysisResult || !researchConsent) return;

    setIsExporting(true);
    try {
      const response = await fetchWithRetry(API_ENDPOINTS.RESEARCH_CONTRIBUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_response: analysisResult,
          consent: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Contribution failed");
      }

      const data = await response.json();
      setToast({ type: "success", message: data.message || "Thank you for contributing to our research! ✅" });
      setShowResearchConsent(false);
      setResearchConsent(false);
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      setToast({ type: "error", message: `Contribution failed: ${errorMsg}` });
      console.error("Contribution error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [analysisResult, researchConsent]);

  // Derived
  const riskLevel = analysisResult ? getRiskLevel(effectiveScore) : null;
  const trustScore = analysisResult ? getTrustScore(effectiveScore) : null;
  const userImpacts = analysisResult ? deriveUserImpacts(analysisResult.patterns_detected || []) : [];
  const journeyInsight = analysisResult ? getJourneyInsight(analysisResult.page_type) : "";
  const suggestedActions = analysisResult
    ? useLowConfidenceFallback
      ? {
          type: "caution",
          message: "Low-confidence result detected. The current score is a conservative fallback estimate.",
          actions: [
            {
              icon: FileWarning,
              text: "Retry with clearer screenshots focused on pricing, add-ons, and the final payment step.",
              priority: "medium",
            },
          ],
        }
      : hasNoFindings
      ? {
          type: "pending",
          message: "Pending or Unclear Analysis. The AI response did not include conclusive findings.",
          actions: [],
        }
      : getSuggestedActions(effectiveScore, analysisResult.patterns_detected || [], analysisResult.hidden_costs || [])
    : null;
  const patternDist = analysisResult ? getPatternDistribution(analysisResult.patterns_detected || []) : [];
  const imagesAnalyzed = analysisResult?._images_analyzed || 1;

  // Deduplicated patterns
  const dedupedPatterns = analysisResult ? deduplicatePatterns(analysisResult.patterns_detected || []) : [];

  // Key Insight
  const keyInsight = generateKeyInsight(
    analysisResult ? { ...analysisResult, manipulation_score: effectiveScore } : null,
    crossImage,
    useLowConfidenceFallback,
  );

  return (
    <div className="min-h-screen bg-grid relative">
      <PremiumBackground />

      <div className="relative z-10">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed top-5 right-5 z-[100]"
            >
              <div className="rounded-xl border border-green-400/25 bg-dark-900/90 px-4 py-3 shadow-xl backdrop-blur-md">
                <p className="text-sm font-medium text-green-300">{toast.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="border-b border-white/5 bg-dark-900/60 backdrop-blur-2xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
              <div className="rounded-xl bg-neon-blue/10 p-2.5 border border-neon-blue/20 icon-bounce">
                <Shield size={22} className="text-neon-blue" />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold tracking-tight">Dark<span className="text-neon-blue">Lens</span></h1>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/20 font-medium">AI Dark Pattern Forensics</p>
              </div>
            </motion.div>
            {status === "complete" && (
              <div className="flex items-center gap-2">
                <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowResearchConsent(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 
                             hover:bg-neon-purple/15 hover:border-neon-purple/30 transition-all text-sm text-white/50 hover:text-neon-purple">
                  <Share2 size={14} /> Contribute
                </motion.button>
                <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 
                             hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white/50 hover:text-white">
                  <Download size={14} /> Export
                </motion.button>
                <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 
                             hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white/50 hover:text-white">
                  <RotateCcw size={14} /> New Analysis
                </motion.button>
              </div>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-10">

          {/* ═══ UPLOAD STATE ═══ */}
          {(status === "idle" || status === "scanning" || status === "error") && (
            <>
              <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }} className="text-center mb-12">
                <motion.h2 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="text-4xl md:text-5xl font-heading font-bold mb-4 bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">
                  Expose Hidden Manipulation
                </motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="text-base text-white/35 max-w-2xl mx-auto leading-relaxed">
                  Upload 1–3 checkout screenshots. Our AI forensic engine detects dark patterns,
                  classifies them against India's CCPA 2023 guidelines, and identifies cross-screen manipulation.
                </motion.p>
              </motion.div>

              <div className="max-w-xl mx-auto space-y-6">
                <UploadZone onAnalyze={handleUpload} isAnalyzing={status === "scanning"} scanProgress={scanProgress} />
                <ScanningOverlay isScanning={status === "scanning"} />

                {status === "error" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card border-red-500/20 p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={reset} className="mt-2 text-xs text-white/40 underline hover:text-white/70 transition">Try again</button>
                  </motion.div>
                )}

                {status === "idle" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="grid grid-cols-3 gap-3">
                    {[
                      { icon: Shield, label: "13 CCPA Categories", desc: "India's legal framework" },
                      { icon: Target, label: "AI Vision Forensics", desc: "Gemini-powered analysis" },
                      { icon: Layers, label: "Multi-Screen", desc: "Cross-flow detection" },
                    ].map((f, i) => (
                      <motion.div key={f.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.12 }} whileHover={{ scale: 1.03, y: -2 }}
                        className="glass-card p-4 text-center cursor-default">
                        <f.icon size={18} className="text-neon-blue mx-auto mb-2 icon-bounce" />
                        <p className="text-[11px] font-semibold text-white/55">{f.label}</p>
                        <p className="text-[10px] text-white/20 mt-0.5">{f.desc}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </>
          )}

          {/* ═══ RESULTS DASHBOARD ═══ */}
          <AnimatePresence>
            {status === "complete" && analysisResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

                {/* Multi-image badge */}
                {imagesAnalyzed > 1 && (
                  <RevealSection delay={0}>
                    <div className="flex justify-center">
                      <motion.div whileHover={{ scale: 1.05 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-neon-purple/10 border border-neon-purple/20">
                        <Layers size={14} className="text-neon-purple" />
                        <span className="text-xs font-medium text-neon-purple">{imagesAnalyzed}-Screen Flow Analysis</span>
                      </motion.div>
                    </div>
                  </RevealSection>
                )}

                {/* ── KEY INSIGHT ── */}
                {keyInsight && (
                  <RevealSection delay={0.05}>
                    <GlassCard className={`p-5 ${keyInsight.border} border ${keyInsight.bg}`}>
                      <div className="flex items-start gap-3">
                        <div className={`rounded-lg p-2 shrink-0 ${keyInsight.bg}`}>
                          <keyInsight.icon size={18} className={keyInsight.color} />
                        </div>
                        <div>
                          <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5">Key Insight</h3>
                          <p className={`text-sm leading-relaxed ${keyInsight.color}`}>
                            <TypingText text={keyInsight.text} speed={12} delay={200} />
                          </p>
                        </div>
                      </div>
                    </GlassCard>
                  </RevealSection>
                )}

                {/* ── SUMMARY BAR ── */}
                <RevealSection delay={0.12}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Patterns Detected", value: dedupedPatterns.length, icon: ShieldAlert,
                        color: dedupedPatterns.length > 0 ? "text-neon-red" : "text-neon-green",
                        bg: dedupedPatterns.length > 0 ? "bg-red-500/10" : "bg-green-500/10" },
                      { label: "Risk Level", value: riskLevel.label, icon: AlertTriangle, color: riskLevel.color, bg: riskLevel.bg },
                      { label: "Hidden Charges", value: analysisResult.estimated_overcharge !== "₹0" ? analysisResult.estimated_overcharge : "None",
                        icon: DollarSign,
                        color: analysisResult.estimated_overcharge !== "₹0" ? "text-neon-orange" : "text-neon-green",
                        bg: analysisResult.estimated_overcharge !== "₹0" ? "bg-orange-500/10" : "bg-green-500/10" },
                      { label: "Trust Score", value: `${trustScore}/100`, icon: Shield,
                        color: trustScore > 70 ? "text-neon-green" : trustScore > 40 ? "text-yellow-400" : "text-neon-red",
                        bg: trustScore > 70 ? "bg-green-500/10" : trustScore > 40 ? "bg-yellow-500/10" : "bg-red-500/10" },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.07 }} whileHover={{ scale: 1.02, y: -2 }}>
                        <GlassCard className="p-5">
                          <div className={`rounded-lg p-2 w-fit ${stat.bg} mb-3`}>
                            <stat.icon size={16} className={stat.color} />
                          </div>
                          <p className={`text-2xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
                          <p className="text-[10px] uppercase tracking-wider text-white/25 mt-1">{stat.label}</p>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>
                </RevealSection>

                {/* ── SCORE + SUMMARY ── */}
                <RevealSection delay={0.25}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.6 }}>
                      <GlassCard className="p-8 flex flex-col items-center justify-center h-full">
                        <ScoreGauge
                          score={effectiveScore}
                          grade={displayGrade}
                          gradeLabel={displayGradeLabel}
                          gradeColor={displayGradeColor}
                        />
                      </GlassCard>
                    </motion.div>

                    <div className="lg:col-span-2 space-y-5">
                      <RevealSection delay={0.35}>
                        <GlassCard className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35">Analysis Summary</h3>
                            <span className="text-sm text-neon-blue font-semibold px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                              {analysisResult.platform_detected}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed min-h-[2.5em]">
                            <TypingText text={safeSummary} speed={15} delay={800} />
                          </p>
                          {analysisResult.estimated_overcharge && analysisResult.estimated_overcharge !== "₹0" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
                              className="mt-4 rounded-xl bg-red-500/8 border border-red-500/15 p-4 flex items-center gap-3">
                              <DollarSign size={20} className="text-red-400 shrink-0" />
                              <div>
                                <p className="text-red-400 font-heading font-bold text-lg">{analysisResult.estimated_overcharge}</p>
                                <p className="text-red-400/40 text-xs">in hidden or undisclosed charges</p>
                              </div>
                            </motion.div>
                          )}
                        </GlassCard>
                      </RevealSection>

                      {patternDist.length > 0 && (
                        <RevealSection delay={0.45}>
                          <GlassCard className="p-6">
                            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35 mb-4">Manipulation Breakdown</h3>
                            <div className="space-y-3">
                              {patternDist.map((item, i) => (
                                <motion.div key={item.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.5 + i * 0.07 }} className="flex items-center justify-between group">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full transition-transform group-hover:scale-150 ${
                                      item.severity === "VIOLATION" ? "bg-red-400" : item.severity === "CAUTION" ? "bg-yellow-400" : "bg-green-400"
                                    }`} />
                                    <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, item.count * 33)}%` }}
                                        transition={{ delay: 0.7 + i * 0.07, duration: 0.6 }}
                                        className={`h-full rounded-full ${item.severity === "VIOLATION" ? "bg-red-400" : item.severity === "CAUTION" ? "bg-yellow-400" : "bg-green-400"}`} />
                                    </div>
                                    <span className={`text-xs font-bold min-w-[16px] text-right ${
                                      item.severity === "VIOLATION" ? "text-red-400" : item.severity === "CAUTION" ? "text-yellow-400" : "text-green-400"
                                    }`}>{item.count}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </GlassCard>
                        </RevealSection>
                      )}
                    </div>
                  </div>
                </RevealSection>

                {/* ── CROSS-IMAGE ── */}
                {crossImage && crossImage.findings.length > 0 && (
                  <RevealSection delay={0.5}>
                    <GlassCard className={`p-6 ${crossImage.hasCritical ? "glow-red border-red-500/15" : "glow-orange border-yellow-500/15"}`}>
                      <div className="flex items-center gap-2 mb-5">
                        <Layers size={16} className={crossImage.hasCritical ? "text-red-400" : "text-yellow-400"} />
                        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35">Cross-Screen Analysis</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          crossImage.hasCritical ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                        }`}>{crossImage.totalIssues} issue{crossImage.totalIssues > 1 ? "s" : ""}</span>
                      </div>
                      <div className="space-y-4">
                        {crossImage.findings.map((f, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + i * 0.1 }} whileHover={{ scale: 1.005 }}
                            className={`rounded-xl p-4 border ${f.severity === "VIOLATION" ? "bg-red-500/5 border-red-500/15" : "bg-yellow-500/5 border-yellow-500/15"}`}>
                            <div className="flex items-start gap-3">
                              <div className={`rounded-lg p-2 shrink-0 mt-0.5 ${f.severity === "VIOLATION" ? "bg-red-500/15" : "bg-yellow-500/15"}`}>
                                <ArrowRight size={14} className={f.severity === "VIOLATION" ? "text-red-400" : "text-yellow-400"} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-heading text-sm font-semibold text-white/90">{f.title}</h4>
                                  <span className={f.severity === "VIOLATION" ? "badge-violation" : "badge-caution"}>{f.severity}</span>
                                </div>
                                <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {crossImage.individualScores && (
                        <div className="mt-5 pt-4 border-t border-white/5">
                          <p className="text-[10px] uppercase tracking-wider text-white/20 mb-3">Score by Screen</p>
                          <div className="flex items-end gap-3">
                            {crossImage.individualScores.map((score, i) => (
                              <div key={i} className="flex-1 text-center">
                                <div className="relative h-16 bg-white/[0.03] rounded-lg overflow-hidden mb-1">
                                  <motion.div initial={{ height: 0 }} animate={{ height: `${score}%` }}
                                    transition={{ delay: 0.8 + i * 0.15, duration: 0.6 }}
                                    className={`absolute bottom-0 w-full rounded-lg ${
                                      score < 30 ? "bg-green-500/40" : score < 60 ? "bg-yellow-500/40" : "bg-red-500/40"
                                    }`} />
                                </div>
                                <p className="text-xs font-bold text-white/50">{score}</p>
                                <p className="text-[9px] text-white/20">Screen {i + 1}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  </RevealSection>
                )}

                {/* ── IMPACT + JOURNEY ── */}
                <RevealSection delay={0.55}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {userImpacts.length > 0 && (
                      <GlassCard className="p-6 h-full">
                        <div className="flex items-center gap-2 mb-5">
                          <Users size={16} className="text-neon-purple icon-bounce" />
                          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35">How This Affects You</h3>
                        </div>
                        <div className="space-y-3">
                          {userImpacts.map((imp, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + i * 0.08 }} whileHover={{ scale: 1.01 }}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                                imp.severity === "high" ? "bg-red-500/5 border-red-500/12 hover:bg-red-500/8" :
                                imp.severity === "medium" ? "bg-yellow-500/5 border-yellow-500/12 hover:bg-yellow-500/8" :
                                "bg-white/[0.02] border-white/8 hover:bg-white/[0.04]"
                              }`}>
                              <imp.icon size={16} className={`mt-0.5 shrink-0 ${
                                imp.severity === "high" ? "text-red-400" : imp.severity === "medium" ? "text-yellow-400" : "text-white/35"
                              }`} />
                              <p className="text-sm text-white/55 leading-relaxed">{imp.text}</p>
                            </motion.div>
                          ))}
                        </div>
                      </GlassCard>
                    )}

                    <GlassCard className="p-6 h-full">
                      <div className="flex items-center gap-2 mb-5">
                        <MapPin size={16} className="text-neon-blue icon-bounce" />
                        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35">Where This Occurs</h3>
                      </div>
                      <div className="flex items-center gap-1 mb-4">
                        {["Browse", "Select", "Cart", "Checkout", "Payment"].map((stage, i) => {
                          const active = (
                            (analysisResult.page_type === "search_results" && i === 0) || (analysisResult.page_type === "product_page" && i === 1) ||
                            (analysisResult.page_type === "cart" && i === 2) || (analysisResult.page_type === "checkout" && i === 3) ||
                            (analysisResult.page_type === "payment" && i === 4)
                          );
                          return (
                            <div key={stage} className="flex items-center gap-1 flex-1">
                              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                                transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
                                className={`h-1.5 rounded-full flex-1 origin-left ${active ? "bg-neon-blue" : "bg-white/8"}`} />
                              {i < 4 && <ChevronRight size={10} className="text-white/10 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mb-4">
                        {["Browse", "Select", "Cart", "Checkout", "Pay"].map(s => (
                          <span key={s} className="text-[9px] text-white/15 uppercase">{s}</span>
                        ))}
                      </div>
                      <div className="rounded-xl bg-neon-blue/5 border border-neon-blue/8 p-4">
                        <p className="text-sm text-white/45 leading-relaxed">{journeyInsight}</p>
                      </div>
                    </GlassCard>
                  </div>
                </RevealSection>

                {/* ── SUGGESTED ACTIONS ── */}
                {suggestedActions && (
                  <RevealSection delay={0.65}>
                    <GlassCard className={`p-6 ${
                      suggestedActions.type === "clean" ? "border-green-500/12 glow-green" :
                      suggestedActions.type === "pending" ? "border-slate-400/20" :
                      suggestedActions.type === "caution" ? "border-yellow-500/12" : "border-red-500/12"
                    }`}>
                      <div className="flex items-center gap-2 mb-4">
                        {suggestedActions.type === "clean" ? <CheckCircle size={16} className="text-neon-green" /> :
                         suggestedActions.type === "pending" ? <FileWarning size={16} className="text-slate-300" /> :
                         suggestedActions.type === "caution" ? <AlertTriangle size={16} className="text-yellow-400" /> :
                         <ShieldAlert size={16} className="text-red-400" />}
                        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/35">
                          {suggestedActions.type === "clean" || suggestedActions.type === "pending" ? "Assessment" : "Recommended Actions"}
                        </h3>
                      </div>

                      <div className={`rounded-xl p-4 mb-4 border ${
                        suggestedActions.type === "clean" ? "bg-green-500/5 border-green-500/10" :
                        suggestedActions.type === "pending" ? "bg-slate-400/10 border-slate-400/20" :
                        suggestedActions.type === "caution" ? "bg-yellow-500/5 border-yellow-500/10" :
                        "bg-red-500/5 border-red-500/10"
                      }`}>
                        <p className={`text-sm font-medium ${
                          suggestedActions.type === "clean" ? "text-green-400" :
                          suggestedActions.type === "pending" ? "text-slate-200" :
                          suggestedActions.type === "caution" ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {suggestedActions.type === "clean" ? "✅" : suggestedActions.type === "pending" ? "⏳" : suggestedActions.type === "caution" ? "⚠️" : "🚨"}{" "}
                          {suggestedActions.message}
                        </p>
                      </div>

                      {suggestedActions.actions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {suggestedActions.actions.map((a, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 + i * 0.06 }} whileHover={{ scale: 1.01 }}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                                a.priority === "high" ? "bg-green-500/5 border-green-500/10 hover:bg-green-500/8" :
                                "bg-white/[0.02] border-white/8 hover:bg-white/[0.04]"
                              }`}>
                              <div className={`rounded-lg p-1.5 shrink-0 ${a.priority === "high" ? "bg-green-500/15" : "bg-white/8"}`}>
                                <a.icon size={13} className={a.priority === "high" ? "text-green-400" : "text-white/35"} />
                              </div>
                              <p className="text-sm text-white/55 leading-relaxed">{a.text}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </RevealSection>
                )}

                {/* ── PATTERN CARDS (deduplicated, with confidence bars) ── */}
                {dedupedPatterns.length > 0 && (
                  <RevealSection delay={0.75}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-heading text-lg font-semibold text-white/75 flex items-center gap-2">
                        <Shield size={18} className="text-neon-blue" />
                        Detailed Findings ({dedupedPatterns.length})
                      </h3>
                      <span className="text-xs text-white/15 uppercase tracking-wider">CCPA 2023</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dedupedPatterns.map((p, i) => (
                        <EnhancedPatternCard key={p.pattern_id} pattern={p} index={i} />
                      ))}
                    </div>
                  </RevealSection>
                )}

                {/* ── LEGAL + TRUST LINE ── */}
                <RevealSection delay={0.9}>
                  <GlassCard className="p-5">
                    <div className="flex items-start gap-3">
                      <Shield size={14} className="text-white/10 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-white/20 leading-relaxed">
                          <span className="text-white/35 font-semibold">Analysis based on CCPA 2023 Dark Pattern Guidelines (India). </span>
                          Classifications reference the Prevention and Regulation of Dark Patterns Guidelines
                          issued by India's Central Consumer Protection Authority on November 30, 2023.
                          This tool provides informational analysis, not legal advice.
                          {imagesAnalyzed > 1 && " Cross-screen analysis identifies patterns spanning multiple checkout stages."}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </RevealSection>

              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-white/5 mt-20 py-6 relative z-10">
          <p className="text-center text-xs text-white/12">
            DarkLens — Built at Hack4Future 2025 | AI-Powered Dark Pattern Forensics Engine
          </p>
        </footer>

        {/* ═══ EXPORT MODAL ═══ */}
        <AnimatePresence>
          {showExportModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40" onClick={() => setShowExportModal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}
                className="bg-dark-900/80 border border-white/10 rounded-2xl p-8 max-w-sm w-full">
                <h3 className="text-xl font-heading font-bold text-white mb-1">Export Report</h3>
                <p className="text-sm text-white/40 mb-6">Choose your preferred format</p>

                <div className="space-y-3 mb-6">
                  <button onClick={() => handleExportReport("json")} disabled={isExporting}
                    className="w-full flex items-center gap-3 p-4 border border-white/10 rounded-xl hover:bg-white/5 transition disabled:opacity-50">
                    <Download size={16} className="text-neon-blue" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">JSON Format</p>
                      <p className="text-xs text-white/40">Structured data for analysis</p>
                    </div>
                  </button>
                  <button onClick={() => handleExportReport("pdf")} disabled={isExporting}
                    className="w-full flex items-center gap-3 p-4 border border-white/10 rounded-xl hover:bg-white/5 transition disabled:opacity-50">
                    <Download size={16} className="text-neon-purple" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">PDF Report</p>
                      <p className="text-xs text-white/40">Professional printable report</p>
                    </div>
                  </button>
                </div>

                <button onClick={() => setShowExportModal(false)}
                  className="w-full py-2 px-4 border border-white/10 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ RESEARCH CONSENT MODAL ═══ */}
        <AnimatePresence>
          {showResearchConsent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40" onClick={() => setShowResearchConsent(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}
                className="bg-dark-900/80 border border-white/10 rounded-2xl p-8 max-w-md w-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20 shrink-0">
                    <Share2 size={18} className="text-neon-purple" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-bold text-white">Contribute to Research</h3>
                    <p className="text-xs text-white/40">Help improve dark pattern detection</p>
                  </div>
                </div>

                <p className="text-sm text-white/60 mb-6 leading-relaxed">
                  Your anonymized pattern findings will be contributed to the DarkLens research database. This helps us understand dark pattern trends and improves detection for all users. No personal data is collected.
                </p>

                <div className="flex items-start gap-2 p-4 bg-white/5 rounded-lg border border-white/10 mb-6">
                  <input type="checkbox" id="consent" checked={researchConsent} onChange={(e) => setResearchConsent(e.target.checked)}
                    className="mt-1 accent-neon-purple" />
                  <label htmlFor="consent" className="text-sm text-white/50">
                    I consent to share my anonymized pattern findings with the DarkLens research database
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowResearchConsent(false)}
                    className="flex-1 py-2 px-4 border border-white/10 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
                    Cancel
                  </button>
                  <button onClick={handleContributeToCorpus} disabled={!researchConsent || isExporting}
                    className="flex-1 py-2 px-4 bg-neon-purple/20 border border-neon-purple/40 rounded-lg text-sm text-neon-purple hover:bg-neon-purple/30 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <span>Contributing...</span> : <>
                      <Check size={14} /> Contribute
                    </>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ TOAST NOTIFICATION ═══ */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border ${
                toast.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
              {toast.type === "success" ? <Check size={14} /> : <X size={14} />}
              <span className="text-sm">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}