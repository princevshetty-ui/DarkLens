import { motion, AnimatePresence } from "framer-motion";
import { MOCK_SCANNING_STEPS } from "../../lib/mockData";
import { Shield, CheckCircle, Loader } from "lucide-react";
import { useState, useEffect } from "react";

export default function ScanningOverlay({ isScanning }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    if (!isScanning) { setCurrentStep(0); setCompletedSteps([]); return; }

    let stepIndex = 0;
    const advance = () => {
      if (stepIndex < MOCK_SCANNING_STEPS.length) {
        setCurrentStep(stepIndex);
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, stepIndex]);
          stepIndex++;
          advance();
        }, MOCK_SCANNING_STEPS[stepIndex].duration);
      }
    };
    advance();
  }, [isScanning]);

  return (
    <AnimatePresence>
      {isScanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="glass-card p-8 glow-blue">
          <div className="flex items-center gap-3 mb-8">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Shield size={24} className="text-neon-blue" />
            </motion.div>
            <h3 className="text-lg font-semibold text-neon-blue">Forensic Analysis in Progress</h3>
          </div>
          <div className="space-y-4">
            {MOCK_SCANNING_STEPS.map((step, index) => {
              const done = completedSteps.includes(index);
              const active = currentStep === index && !done;
              return (
                <motion.div key={step.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }} className="flex items-center gap-4">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {done ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
                        <CheckCircle size={20} className="text-neon-green" />
                      </motion.div>
                    ) : active ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <Loader size={20} className="text-neon-blue" />
                      </motion.div>
                    ) : <div className="w-2 h-2 rounded-full bg-white/20" />}
                  </div>
                  <span className={`text-sm ${done ? "text-white/80" : active ? "text-neon-blue font-medium" : "text-white/30"}`}>
                    {step.label}
                  </span>
                  {active && (
                    <div className="flex-1 h-1 bg-white/10 rounded-full ml-2 overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full"
                        initial={{ width: "0%" }} animate={{ width: "100%" }}
                        transition={{ duration: step.duration / 1000 }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}