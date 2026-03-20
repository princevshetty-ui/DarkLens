/**
 * API Configuration
 *
 * Default behavior uses relative paths (e.g. /api/...) so:
 * - In local dev, Vite proxy forwards to backend.
 * - In production, frontend and backend can share same origin.
 *
 * Optional override:
 * - Set VITE_API_BASE_URL when frontend and backend are on different domains.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function withBase(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export const API_ENDPOINTS = {
  ANALYZE: withBase("/api/analyze/image"),
  BATCH_ANALYZE: withBase("/api/batch/analyze"),
  EXPORT_REPORT: withBase("/api/reports/export"),
  RESEARCH_CONTRIBUTE: withBase("/api/research/contribute"),
  ADMIN_ANALYTICS: withBase("/api/admin/analytics"),
  HEALTH: withBase("/api/health"),
};

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds for long operations like batch analysis
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

export default API_BASE_URL;
