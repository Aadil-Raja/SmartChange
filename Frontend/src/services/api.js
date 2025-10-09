import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach token automatically
api.interceptors.request.use((config) => {
  // Get token from localStorage
  const token = localStorage.getItem("token");
  
  // Only add token if it exists and is not undefined/null
  if (token && token !== "undefined" && token !== "null") {
    // Send token in custom header (as your backend expects)
    config.headers["token"] = token;
    
    // ALSO send as query param (based on your URL showing ?token=...)
    config.params = {
      ...config.params,
      token: token
    };
  } else {
    console.warn("⚠️ No valid token found in localStorage");
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.error("❌ 401 Unauthorized - Redirecting to login");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    // Handle 422 Unprocessable Entity
    if (error.response?.status === 422) {
      console.error("❌ 422 Validation Error:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;