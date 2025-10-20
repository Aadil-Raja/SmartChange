import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach correct token automatically
api.interceptors.request.use(
  (config) => {
    // Detect which side we're calling (admin or employee)
    const isAdminRequest = config.url.startsWith("/admin");

    // Choose token accordingly
    const token = isAdminRequest
      ? localStorage.getItem("adminToken")
      : localStorage.getItem("token"); // employee token

    if (token && token !== "undefined" && token !== "null") {
      config.headers["token"] = token;

      // Optional: only send query param if your backend requires it
      config.params = {
        ...config.params,
        token,
      };
    } else {
      console.warn(
        `⚠️ No valid ${isAdminRequest ? "admin" : "employee"} token found`
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("❌ 401 Unauthorized - Redirecting to correct login");

      const currentPath = window.location.pathname;

      // Redirect admin → /admin/login, employee → /login
      if (currentPath.startsWith("/admin")) {
        localStorage.removeItem("adminToken");
        window.location.href = "/admin/login";
      } else {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }

    if (error.response?.status === 422) {
      console.error("❌ 422 Validation Error:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;
