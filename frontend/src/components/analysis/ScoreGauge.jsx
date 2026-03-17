import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function ScoreGauge({ score, grade, gradeLabel, gradeColor }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    let current = 0;
    const timer = setInterval(() => {
      current += score / 75;
      if (current >= score) { setDisplayScore(score); clearInterval(timer); }
      else setDisplayScore(Math.floor(current));
    }, 20);
    return () => clearInterval(timer);
  }, [score]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }} className="flex flex-col items-center">
      <div className="relative w-[220px] h-[220px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          <motion.circle cx="100" cy="100" r={radius} fill="none" stroke={gradeColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 8px ${gradeColor}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold" style={{ color: gradeColor }}>{displayScore}</span>
          <span className="text-xs text-white/40 uppercase tracking-widest mt-1">Manipulation Score</span>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
        className="mt-4 text-center">
        <div className="inline-flex rounded-full px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: `${gradeColor}20`, color: gradeColor, border: `1px solid ${gradeColor}40` }}>
          Grade: {grade}
        </div>
        <p className="text-sm text-white/50 mt-2 max-w-[250px]">{gradeLabel}</p>
      </motion.div>
    </motion.div>
  );
}