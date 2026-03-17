import { motion } from "framer-motion";
import GlassCard from "../layout/GlassCard";
import { AlertTriangle, ShieldAlert, ShieldCheck, Info } from "lucide-react";

const config = {
  VIOLATION: { badge: "badge-violation", Icon: ShieldAlert, glow: "red", border: "border-l-red-500", iconBg: "bg-red-500/15", iconColor: "text-red-400" },
  CAUTION: { badge: "badge-caution", Icon: AlertTriangle, glow: "orange", border: "border-l-yellow-500", iconBg: "bg-yellow-500/15", iconColor: "text-yellow-400" },
  FAIR: { badge: "badge-fair", Icon: ShieldCheck, glow: null, border: "border-l-green-500", iconBg: "bg-green-500/15", iconColor: "text-green-400" },
};

export default function PatternCard({ pattern, index }) {
  const c = config[pattern.severity] || config.CAUTION;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <GlassCard className={`border-l-4 ${c.border} p-6`} glow={c.glow}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${c.iconBg}`}>
              <c.Icon size={20} className={c.iconColor} />
            </div>
            <div>
              <h4 className="font-semibold text-white/90">{pattern.title}</h4>
              <p className="text-xs text-white/40 mt-0.5">
                CCPA Category {pattern.ccpa_category_id}: {pattern.ccpa_category_name}
              </p>
            </div>
          </div>
          <span className={c.badge}>{pattern.severity}</span>
        </div>

        <p className="text-sm text-white/60 leading-relaxed mb-4">{pattern.description}</p>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-neon-blue mt-0.5 shrink-0" />
            <p className="text-sm text-neon-blue/90 font-medium">{pattern.user_impact}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <code className="text-xs bg-white/5 px-2 py-1 rounded text-white/50 font-mono max-w-[280px] truncate">
            {pattern.evidence?.content}
          </code>
          <span className={`text-[10px] uppercase tracking-wider ${
            pattern.confidence === "high" ? "text-green-400" : "text-yellow-400"
          }`}>
            {pattern.confidence} confidence
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}