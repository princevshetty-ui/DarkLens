import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image, X } from "lucide-react";

export default function UploadZone({ onFileSelected, isAnalyzing }) {
  const [preview, setPreview] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: isAnalyzing,
  });

  return (
    <div
      {...getRootProps()}
      className={`glass-card cursor-pointer transition-all duration-300 ${
        isDragActive ? "border-neon-blue/60 bg-neon-blue/10 scale-[1.02]" : "hover:border-white/25"
      } ${isAnalyzing ? "pointer-events-none opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative p-4">
            {isAnalyzing && (
              <div className="absolute inset-0 z-10 rounded-2xl overflow-hidden">
                <div className="scan-line" />
                <div className="absolute inset-0 bg-neon-blue/5" />
              </div>
            )}
            <img src={preview} alt="Screenshot" className="w-full rounded-xl object-contain max-h-[400px]" />
            {!isAnalyzing && (
              <button onClick={(e) => { e.stopPropagation(); setPreview(null); }}
                className="absolute top-6 right-6 rounded-full bg-dark-800/80 p-2 hover:bg-red-500/30 transition">
                <X size={16} />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center p-16 gap-4">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
              className="rounded-2xl bg-neon-blue/10 p-5 border border-neon-blue/20">
              {isDragActive ? <Image size={40} className="text-neon-blue" /> : <Upload size={40} className="text-white/60" />}
            </motion.div>
            <div className="text-center">
              <p className="text-lg font-medium text-white/80">
                {isDragActive ? "Drop your screenshot here" : "Upload a checkout screenshot"}
              </p>
              <p className="text-sm text-white/40 mt-1">PNG, JPG, or WEBP — max 5MB</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}