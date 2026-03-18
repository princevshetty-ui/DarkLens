import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image, X, Plus, Zap } from "lucide-react";

export default function UploadZone({ onAnalyze, isAnalyzing, scanProgress }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    const remaining = 3 - files.length;
    const newFiles = acceptedFiles.slice(0, remaining);

    if (newFiles.length === 0) return;

    setFiles(prev => [...prev, ...newFiles]);
    setPreviews(prev => [
      ...prev,
      ...newFiles.map(f => URL.createObjectURL(f))
    ]);
  }, [files.length]);

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index]);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    previews.forEach(p => URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
  };

  const handleAnalyze = () => {
    if (files.length > 0 && onAnalyze) {
      onAnalyze(files);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 5 * 1024 * 1024,
    multiple: true,
    disabled: isAnalyzing || files.length >= 3,
  });

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`glass-card cursor-pointer transition-all duration-300 ${
          isDragActive ? "border-neon-blue/60 bg-neon-blue/10 scale-[1.01]" : "hover:border-white/25"
        } ${isAnalyzing || files.length >= 3 ? "pointer-events-none opacity-50" : ""}`}
      >
        <input {...getInputProps()} />

        {files.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center p-12 gap-4"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-2xl bg-neon-blue/10 p-5 border border-neon-blue/20"
            >
              {isDragActive ? (
                <Image size={36} className="text-neon-blue" />
              ) : (
                <Upload size={36} className="text-white/50" />
              )}
            </motion.div>
            <div className="text-center">
              <p className="text-base font-medium text-white/80">
                {isDragActive ? "Drop screenshots here" : "Upload checkout screenshots"}
              </p>
              <p className="text-sm text-white/40 mt-1">
                Up to 3 images • PNG, JPG, WEBP • Max 5MB each
              </p>
              <p className="text-xs text-neon-blue/60 mt-2">
                Upload multiple screens to detect cross-flow manipulation
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">
                {files.length}/3 Screenshots
              </span>
              {!isAnalyzing && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearAll(); }}
                  className="text-xs text-white/30 hover:text-red-400 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-3 gap-3">
              {previews.map((preview, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-white/10"
                >
                  {/* Scanning overlay */}
                  {isAnalyzing && scanProgress.current >= index + 1 && (
                    <div className="absolute inset-0 z-10">
                      <div className="scan-line" />
                      <div className="absolute inset-0 bg-neon-blue/10" />
                    </div>
                  )}

                  <img
                    src={preview}
                    alt={`Screen ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Screen label */}
                  <div className="absolute bottom-1 left-1 bg-dark-900/80 rounded px-1.5 py-0.5">
                    <span className="text-[9px] text-white/60 font-medium">
                      Screen {index + 1}
                    </span>
                  </div>

                  {/* Remove button */}
                  {!isAnalyzing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      className="absolute top-1.5 right-1.5 rounded-full bg-dark-900/80 p-1 
                                 opacity-0 group-hover:opacity-100 hover:bg-red-500/50 transition-all"
                    >
                      <X size={12} />
                    </button>
                  )}

                  {/* Processing indicator */}
                  {isAnalyzing && (
                    <div className="absolute top-1.5 right-1.5">
                      {scanProgress.current > index + 1 ? (
                        <div className="w-5 h-5 rounded-full bg-green-500/80 flex items-center justify-center">
                          <span className="text-[10px]">✓</span>
                        </div>
                      ) : scanProgress.current === index + 1 ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 rounded-full border-2 border-neon-blue border-t-transparent"
                        />
                      ) : null}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Add more slot */}
              {files.length < 3 && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="aspect-[4/3] rounded-xl border border-dashed border-white/15 
                             flex items-center justify-center hover:border-neon-blue/40 
                             hover:bg-neon-blue/5 transition-all"
                >
                  <Plus size={20} className="text-white/25" />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <AnimatePresence>
        {files.length > 0 && !isAnalyzing && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={handleAnalyze}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple 
                       font-semibold text-sm text-white flex items-center justify-center gap-2
                       hover:shadow-lg hover:shadow-neon-blue/25 transition-all active:scale-[0.98]"
          >
            <Zap size={16} />
            Analyze {files.length} Screenshot{files.length > 1 ? "s" : ""}
            {files.length > 1 && (
              <span className="text-xs opacity-70 ml-1">
                (includes cross-flow detection)
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scanning Progress */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-4 glow-blue"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neon-blue font-medium">
                Analyzing Screen {scanProgress.current} of {scanProgress.total}...
              </span>
              <span className="text-xs text-white/30">
                {Math.round((scanProgress.current / scanProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}