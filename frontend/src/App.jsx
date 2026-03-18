import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Shield, AlertTriangle, DollarSign, Eye, TrendingDown,
  MapPin, CheckCircle, ChevronRight, RotateCcw, ShieldAlert,
  Target, Users, Zap, FileWarning, Layers, ArrowRight
} from "lucide-react";

import GlassCard from "./components/layout/GlassCard";
import UploadZone from "./components/upload/UploadZone";
import ScanningOverlay from "./components/analysis/ScanningOverlay";
import ScoreGauge from "./components/analysis/ScoreGauge";
import PatternCard from "./components/analysis/PatternCard";
import { useAnalysis } from "./hooks/useAnalysis";

// ── Derived Data Helpers ──

function getRiskLevel(score) {
  if (score < 25) return { label: "Low", color: "text-neon-green", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (score < 50) return { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" };
  if (score < 75) return { label: "High", color: "text-neon-orange", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  return { label: "Critical", color: "text-neon-red", bg: "bg-red-500/10", border: "border-red-500/30" };
}

function getTrustScore(score) {
  return Math.max(0, 100 - score);
}

function deriveUserImpacts(patterns) {
  const impacts = [];
  const cats = patterns.map(p => p.ccpa_category_id);
  if (cats.includes(5) || cats.includes(2)) impacts.push({ icon: DollarSign, text: "May increase your final cost without clear consent", severity: "high" });
  if (cats.includes(4) || cats.includes(7)) impacts.push({ icon: Eye, text: "Visual design steers you toward paid options", severity: "medium" });
  if (cats.includes(1)) impacts.push({ icon: Zap, text: "Artificial urgency may pressure hasty decisions", severity: "medium" });
  if (cats.includes(6) || cats.includes(12)) impacts.push({ icon: TrendingDown, text: "Hidden fees reduce price transparency", severity: "high" });
  if (cats.includes(3)) impacts.push({ icon: Users, text: "Guilt-based language manipulates your choices", severity: "medium" });
  if (impacts.length === 0 && patterns.length > 0) impacts.push({ icon: AlertTriangle, text: "Interface design may subtly influence your decisions", severity: "low" });
  return impacts;
}

function getJourneyInsight(pageType, count) {
  const map = {
    checkout: `These pattern(s) appear during checkout — a high-pressure moment where users spend 40% less time reading compared to browsing.`,
    cart: `Patterns detected at the cart stage, where users have already invested time in selection and are less likely to abandon.`,
    payment: `Dark patterns at the payment stage are most impactful — users are one click from completing the transaction.`,
    product_page: `Patterns on product pages influence initial decisions before entering the purchase funnel.`,
    search_results: `Manipulation at the search stage affects which options users even consider.`,
  };
  return map[pageType] || `These pattern(s) appear at a point in the user journey where attention is divided — exactly where dark patterns are most effective.`;
}

// ── FIXED: Conditional Suggested Actions ──

function getSuggestedActions(score, patterns, hiddenCosts) {
  // NO ISSUES → clean message
  if (score < 20 || patterns.length === 0) {
    return {
      type: "clean",
      message: "No major manipulation detected. This interface appears transparent and respects user choice.",
      actions: []
    };
  }

  // MEDIUM RISK
  if (score < 55) {
    const actions = [];
    const cats = patterns.map(p => p.ccpa_category_id);
    if (cats.includes(1)) actions.push({ icon: Zap, text: "Take your time — urgency indicators may be artificial", priority: "medium" });
    if (cats.includes(4)) actions.push({ icon: Eye, text: "Look for smaller 'Skip' or 'No thanks' options — they may be intentionally subtle", priority: "medium" });
    if (hiddenCosts && hiddenCosts.length > 0) actions.push({ icon: DollarSign, text: "Compare the final total with the initially advertised price", priority: "medium" });
    if (actions.length === 0) actions.push({ icon: AlertTriangle, text: "Review all options carefully before proceeding", priority: "medium" });
    return {
      type: "caution",
      message: "Some elements may subtly influence your decision. Review the checkout carefully.",
      actions
    };
  }

  // HIGH RISK
  const actions = [];
  const cats = patterns.map(p => p.ccpa_category_id);
  if (hiddenCosts && hiddenCosts.length > 0) actions.push({ icon: DollarSign, text: "Review the final price breakdown — compare it against the initially shown price", priority: "high" });
  if (cats.includes(5) || cats.includes(2)) actions.push({ icon: CheckCircle, text: "Check all pre-selected add-ons and checkboxes before confirming payment", priority: "high" });
  if (cats.includes(1)) actions.push({ icon: Zap, text: "Ignore countdown timers — most are artificial and the price is usually available later", priority: "medium" });
  if (cats.includes(4)) actions.push({ icon: Eye, text: "Look for the smaller 'Skip' or 'No thanks' option", priority: "medium" });
  actions.push({ icon: Shield, text: "Screenshot the checkout flow as evidence — you can file a complaint at consumerhelpline.gov.in", priority: "low" });
  return {
    type: "danger",
    message: "Significant manipulation detected. Review carefully before proceeding and consider reporting.",
    actions
  };
}

function getPatternDistribution(patterns) {
  const dist = {};
  patterns.forEach(p => {
    const name = p.ccpa_category_name;
    if (!dist[name]) dist[name] = { count: 0, severity: p.severity, id: p.ccpa_category_id };
    dist[name].count++;
    if (p.severity === "VIOLATION") dist[name].severity = "VIOLATION";
    else if (p.severity === "CAUTION" && dist[name].severity === "FAIR") dist[name].severity = "CAUTION";
  });
  return Object.entries(dist).map(([name, data]) => ({ name, ...data }));
}


// ── Main App ──

export default function App() {
  const { status, result, crossImage, error, scanProgress, analyzeImages, reset } = useAnalysis();

  const handleAnalyze = useCallback((files) => {
    analyzeImages(files);
  }, [analyzeImages]);

  // Derived data
  const riskLevel = result ? getRiskLevel(result.manipulation_score) : null;
  const trustScore = result ? getTrustScore(result.manipulation_score) : null;
  const userImpacts = result ? deriveUserImpacts(result.patterns_detected || []) : [];
  const journeyInsight = result ? getJourneyInsight(result.page_type, result.total_patterns_found) : "";
  const suggestedActions = result ? getSuggestedActions(result.manipulation_score, result.patterns_detected || [], result.hidden_costs || []) : null;
  const patternDist = result ? getPatternDistribution(result.patterns_detected || []) : [];
  const imagesAnalyzed = result?._images_analyzed || 1;

  return (
    <div className="min-h-screen bg-dark-900 bg-grid">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-neon-blue/10 p-2 border border-neon-blue/20">
              <Shield size={22} className="text-neon-blue" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Dark<span className="text-neon-blue">Lens</span></h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">AI Dark Pattern Forensics</p>
            </div>
          </div>
          {status === "complete" && (
            <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 
                         hover:bg-white/10 transition-all text-sm text-white/70 hover:text-white">
              <RotateCcw size={14} /> New Analysis
            </motion.button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* ═══════ UPLOAD STATE ═══════ */}
        {(status === "idle" || status === "scanning" || status === "error") && (
          <>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Expose Hidden Manipulation
              </h2>
              <p className="text-base text-white/50 max-w-2xl mx-auto">
                Upload 1-3 checkout screenshots. Our AI forensic engine detects dark patterns, 
                classifies them against India's CCPA 2023 guidelines, and identifies cross-screen manipulation.
              </p>
            </motion.div>

            <div className="max-w-xl mx-auto space-y-6">
              <UploadZone
                onAnalyze={handleAnalyze}
                isAnalyzing={status === "scanning"}
                scanProgress={scanProgress}
              />

              <ScanningOverlay isScanning={status === "scanning"} />

              {status === "error" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card border-red-500/30 p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                  <button onClick={reset} className="mt-2 text-xs text-white/50 underline hover:text-white/80">Try again</button>
                </motion.div>
              )}

              {status === "idle" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Shield, label: "13 CCPA Categories", desc: "India's legal framework" },
                    { icon: Target, label: "AI Vision Forensics", desc: "Gemini-powered analysis" },
                    { icon: Layers, label: "Multi-Screen Analysis", desc: "Cross-flow detection" },
                  ].map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }} className="glass-card p-4 text-center">
                      <f.icon size={18} className="text-neon-blue mx-auto mb-2" />
                      <p className="text-[11px] font-semibold text-white/70">{f.label}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{f.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </>
        )}

        {/* ═══════ RESULTS DASHBOARD ═══════ */}
        <AnimatePresence>
          {status === "complete" && result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* Multi-image badge */}
              {imagesAnalyzed > 1 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neon-purple/10 border border-neon-purple/20">
                    <Layers size={14} className="text-neon-purple" />
                    <span className="text-xs font-medium text-neon-purple">
                      {imagesAnalyzed}-Screen Flow Analysis
                    </span>
                  </div>
                </motion.div>
              )}

              {/* ── TOP SUMMARY BAR ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Patterns Detected", value: result.total_patterns_found, icon: ShieldAlert,
                    color: result.total_patterns_found > 0 ? "text-neon-red" : "text-neon-green",
                    bg: result.total_patterns_found > 0 ? "bg-red-500/10" : "bg-green-500/10" },
                  { label: "Risk Level", value: riskLevel.label, icon: AlertTriangle,
                    color: riskLevel.color, bg: riskLevel.bg },
                  { label: "Hidden Charges", value: result.estimated_overcharge !== "₹0" ? result.estimated_overcharge : "None",
                    icon: DollarSign,
                    color: result.estimated_overcharge !== "₹0" ? "text-neon-orange" : "text-neon-green",
                    bg: result.estimated_overcharge !== "₹0" ? "bg-orange-500/10" : "bg-green-500/10" },
                  { label: "Trust Score", value: `${trustScore}/100`, icon: Shield,
                    color: trustScore > 70 ? "text-neon-green" : trustScore > 40 ? "text-yellow-400" : "text-neon-red",
                    bg: trustScore > 70 ? "bg-green-500/10" : trustScore > 40 ? "bg-yellow-500/10" : "bg-red-500/10" },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}>
                    <GlassCard className="p-5 hover:bg-white/[0.07] transition-colors">
                      <div className={`rounded-lg p-2 w-fit ${stat.bg} mb-3`}>
                        <stat.icon size={16} className={stat.color} />
                      </div>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{stat.label}</p>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>

              {/* ── SCORE + SUMMARY ROW ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
                  <GlassCard className="p-8 flex flex-col items-center justify-center h-full">
                    <ScoreGauge score={result.manipulation_score} grade={result.grade}
                      gradeLabel={result.grade_label} gradeColor={result.grade_color} />
                  </GlassCard>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }} className="lg:col-span-2 space-y-4">

                  {/* Summary Card */}
                  <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">Analysis Summary</h3>
                      <span className="text-sm text-neon-blue font-semibold px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                        {result.platform_detected}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
                    {result.estimated_overcharge && result.estimated_overcharge !== "₹0" && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                        className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
                        <DollarSign size={20} className="text-red-400 shrink-0" />
                        <div>
                          <p className="text-red-400 font-bold text-lg">{result.estimated_overcharge}</p>
                          <p className="text-red-400/60 text-xs">in hidden or undisclosed charges detected</p>
                        </div>
                      </motion.div>
                    )}
                  </GlassCard>

                  {/* Pattern Distribution */}
                  {patternDist.length > 0 && (
                    <GlassCard className="p-6">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-4">Manipulation Breakdown</h3>
                      <div className="space-y-3">
                        {patternDist.map((item, i) => (
                          <motion.div key={item.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${item.severity === "VIOLATION" ? "bg-red-400" : item.severity === "CAUTION" ? "bg-yellow-400" : "bg-green-400"}`} />
                              <span className="text-sm text-white/70">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, item.count * 33)}%` }}
                                  transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                                  className={`h-full rounded-full ${item.severity === "VIOLATION" ? "bg-red-400" : item.severity === "CAUTION" ? "bg-yellow-400" : "bg-green-400"}`} />
                              </div>
                              <span className={`text-xs font-bold min-w-[16px] text-right ${item.severity === "VIOLATION" ? "text-red-400" : item.severity === "CAUTION" ? "text-yellow-400" : "text-green-400"}`}>
                                {item.count}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </motion.div>
              </div>

              {/* ── CROSS-IMAGE INSIGHTS (only if multi-image) ── */}
              {crossImage && crossImage.findings.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <GlassCard className={`p-6 ${crossImage.hasCritical ? "glow-red border-red-500/20" : "glow-orange border-yellow-500/20"}`}>
                    <div className="flex items-center gap-2 mb-5">
                      <FileWarning size={18} className={crossImage.hasCritical ? "text-red-400" : "text-yellow-400"} />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
                        Cross-Screen Manipulation Findings
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {crossImage.findings.map((finding, idx) => (
                        <div
                          key={`${finding.type}-${idx}`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-sm font-semibold text-white/85">{finding.title}</p>
                            <span className={`text-[10px] px-2 py-1 rounded-full border ${finding.severity === "VIOLATION" ? "text-red-300 border-red-500/30 bg-red-500/10" : "text-yellow-300 border-yellow-500/30 bg-yellow-500/10"}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <p className="text-sm text-white/60">{finding.description}</p>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* ── USER IMPACT + JOURNEY ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={16} className="text-neon-blue" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">What This Means For You</h3>
                  </div>

                  {userImpacts.length > 0 ? (
                    <div className="space-y-3">
                      {userImpacts.map((impact, i) => (
                        <div key={`${impact.text}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start gap-3">
                          <impact.icon size={15} className={impact.severity === "high" ? "text-red-400 mt-0.5" : impact.severity === "medium" ? "text-yellow-400 mt-0.5" : "text-neon-blue mt-0.5"} />
                          <p className="text-sm text-white/70 leading-relaxed">{impact.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/50">No direct risk signals were detected for this flow.</p>
                  )}
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin size={16} className="text-neon-blue" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">Journey Insight</h3>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{journeyInsight}</p>
                </GlassCard>
              </div>

              {/* ── SUGGESTED ACTIONS ── */}
              {suggestedActions && (
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">Suggested Actions</h3>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${suggestedActions.type === "danger" ? "text-red-300 border-red-500/30 bg-red-500/10" : suggestedActions.type === "caution" ? "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" : "text-green-300 border-green-500/30 bg-green-500/10"}`}>
                      {suggestedActions.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mb-4">{suggestedActions.message}</p>

                  {suggestedActions.actions.length > 0 && (
                    <div className="space-y-2.5">
                      {suggestedActions.actions.map((action, i) => (
                        <div key={`${action.text}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-start gap-3">
                          <action.icon size={14} className={action.priority === "high" ? "text-red-400 mt-0.5" : action.priority === "medium" ? "text-yellow-400 mt-0.5" : "text-neon-blue mt-0.5"} />
                          <p className="text-sm text-white/75">{action.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {/* ── DETECTED PATTERNS ── */}
              {result.patterns_detected?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white/85 flex items-center gap-2">
                      <Shield size={18} className="text-neon-blue" />
                      Detected Pattern Evidence
                    </h3>
                    <span className="text-xs text-white/45 flex items-center gap-1">
                      View all findings
                      <ChevronRight size={13} />
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {result.patterns_detected.map((pattern, i) => (
                      <PatternCard key={pattern.pattern_id || `${pattern.title}-${i}`} pattern={pattern} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── CATEGORY TAGS ── */}
              {result.categories_violated?.length > 0 && (
                <GlassCard className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">CCPA Categories Triggered</h3>
                    <ArrowRight size={14} className="text-white/35" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.categories_violated.map((catId) => (
                      <span key={catId} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                        Category {catId}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/5 mt-10 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-white/35">DarkLens AI Forensics · Built for transparent digital experiences</p>
        </div>
      </footer>
    </div>
  );
}
                      