import { API_CONFIG } from "./api";

/**
 * Handles API fetch with retry logic and timeout
 */
export async function fetchWithRetry(
  url,
  options = {},
  retries = API_CONFIG.RETRY_ATTEMPTS,
  delay = API_CONFIG.RETRY_DELAY
) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Handle non-OK responses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: `HTTP ${response.status}` };
        }

        const error = new Error(errorData.detail || "API request failed");
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  } catch (error) {
    // Network errors, timeout, or other fetch errors
    if (error.name === "AbortError") {
      throw new Error(
        `Request timeout (${API_CONFIG.TIMEOUT}ms). Backend server may be unavailable or slow.`
      );
    }

    if (error instanceof TypeError) {
      // Network connectivity error
      if (error.message.includes("Failed to fetch")) {
        throw new Error(
          "Cannot connect to backend server. Is the backend running? Check if port 8000 is accessible."
        );
      }
      throw new Error(error.message || "Network error"); 
    }

    // If it has a status, it was an API error (already thrown above)
    if (error.status) {
      throw error;
    }

    // Retry logic for network errors (but not for status errors)
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }

    throw error;
  }
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(error) {
  // Already a user-friendly message
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  // API error with details
  if (error?.data?.detail) {
    return error.data.detail;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if backend is reachable
 */
export async function checkBackendHealth(healthUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
