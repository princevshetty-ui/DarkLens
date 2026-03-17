import { motion } from "framer-motion";

export default function GlassCard({ children, className = "", glow = null, delay = 0 }) {
  const glowClass = glow === "blue" ? "glow-blue" : glow === "red" ? "glow-red" : glow === "orange" ? "glow-orange" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={`glass-card ${glowClass} ${className}`}
    >
      {children}
    </motion.div>
  );
}