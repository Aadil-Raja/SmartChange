import axios from "axios";

const chatbotApi = axios.create({
  baseURL: import.meta.env.VITE_CHATBOT_API_URL || "http://127.0.0.1:8001",
  headers: { "Content-Type": "application/json" },
});

chatbotApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token && token !== "undefined" && token !== "null") {
      // ✅ Attach token both as header and query param
      config.headers["token"] = token;
      config.params = { ...(config.params || {}), token };
    } else {
      console.warn("⚠️ No valid token found for chatbot request.");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

chatbotApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ Chatbot API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default chatbotApi;
