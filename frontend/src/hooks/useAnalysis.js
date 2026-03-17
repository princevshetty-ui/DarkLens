import { useState, useCallback } from "react";
import axios from "axios";

export function useAnalysis() {
  const [status, setStatus] = useState("idle"); // idle | scanning | complete | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeImage = useCallback(async (file) => {
    setStatus("scanning");
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("/api/analyze/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });

      setResult(response.data);
      setStatus("complete");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Analysis failed");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, analyzeImage, reset };
}