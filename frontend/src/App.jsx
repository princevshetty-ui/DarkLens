import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";

import GlassCard from "./components/layout/GlassCard";
import UploadZone from "./components/upload/UploadZone";
import ScanningOverlay from "./components/analysis/ScanningOverlay";
import ScoreGauge from "./components/analysis/ScoreGauge";
import PatternCard from "./components/analysis/PatternCard";
import { useAnalysis } from "./hooks/useAnalysis";

export default function App() {
  const { status, result, error, analyzeImage, reset } = useAnalysis();

  const handleFile = useCallback(async (file) => {
    await analyzeImage(file);
  }, [analyzeImage]);

  return (
    <div className="min-h-screen bg-dark-900 bg-grid">
      {/* Header */}
      <header className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="rounded-xl bg-neon-blue/10 p-2 border border-neon-blue/20">
            <Shield size={22} className="text-neon-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dark<span className="text-neon-blue">Lens</span></h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">AI Dark Pattern Forensics</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Expose Hidden Manipulation
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Upload a checkout screenshot. Our AI forensic engine detects dark patterns
            and classifies them against India's CCPA 2023 guidelines.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Upload + Scanning */}
          <div className="space-y-6">
            <UploadZone onFileSelected={handleFile} isAnalyzing={status === "scanning"} />
            <ScanningOverlay isScanning={status === "scanning"} />

            {status === "error" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass-card border-red-500/30 p-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={reset} className="mt-2 text-xs text-white/50 underline">Try again</button>
              </motion.div>
            )}
          </div>

          {/* Right — Results */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {status === "complete" && result ? (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Score */}
                  <GlassCard className="p-8 flex flex-col items-center">
                    <ScoreGauge score={result.manipulation_score} grade={result.grade}
                      gradeLabel={result.grade_label} gradeColor={result.grade_color} />
                  </GlassCard>

                  {/* Summary */}
                  <GlassCard className="p-6" delay={0.2}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-white/50 uppercase tracking-wider">Platform</span>
                      <span className="text-sm text-neon-blue font-medium">{result.platform_detected}</span>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
                    {result.estimated_overcharge !== "₹0" && (
                      <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                        <p className="text-red-400 font-semibold text-lg">
                          Estimated Hidden Charges: {result.estimated_overcharge}
                        </p>
                      </div>
                    )}
                  </GlassCard>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Patterns", value: result.total_patterns_found, color: "text-neon-blue" },
                      { label: "Categories", value: result.categories_violated?.length || 0, color: "text-neon-orange" },
                      { label: "Hidden Costs", value: result.hidden_costs?.length || 0, color: "text-neon-red" },
                    ].map((s, i) => (
                      <GlassCard key={s.label} className="p-4 text-center" delay={0.3 + i * 0.1}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{s.label}</p>
                      </GlassCard>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass-card p-12 flex flex-col items-center text-center">
                  <Shield size={48} className="text-white/10 mb-4" />
                  <p className="text-white/30 text-sm">Upload a screenshot to begin forensic analysis</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pattern Cards — Full Width Below */}
        <AnimatePresence>
          {status === "complete" && result?.patterns_detected?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12">
              <h3 className="text-lg font-semibold text-white/80 mb-6 flex items-center gap-2">
                <Shield size={18} className="text-neon-blue" />
                Detected Patterns ({result.total_patterns_found})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.patterns_detected.map((p, i) => (
                  <PatternCard key={p.pattern_id} pattern={p} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/5 mt-20 py-6">
        <p className="text-center text-xs text-white/20">
          DarkLens — Built at Hack4Future 2025 | AI-Powered Dark Pattern Forensics
        </p>
      </footer>
    </div>
  );
}