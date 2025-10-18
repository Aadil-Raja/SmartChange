// src/context/AdminAuthContext.jsx
import { createContext, useState, useEffect } from "react";
import { adminLogin } from "../services/adminApi";

export const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("adminToken"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Restore admin session on page reload
  useEffect(() => {
    if (token) {
      setAdmin({ authenticated: true });
    }
  }, [token]);

  // ✅ Admin login (email + password only)
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminLogin(email, password);

      if (res?.success) {
        const accessToken =
          res?.data?.access_token || res?.token || res?.access_token;

        if (!accessToken) {
          throw new Error("Token not found in response");
        }
        console.log("Admin login successful, token:", accessToken);
        localStorage.setItem("adminToken", accessToken);
        setToken(accessToken);
        setAdmin({
          email,
          authenticated: true,
        });
        console.log("Admin state set:", { email, authenticated: true });
        return { success: true };
      } else {
        throw new Error(res.message || "Login failed");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ✅ Logout (clear session)
  const logout = () => {
    localStorage.removeItem("adminToken");
    setAdmin(null);
    setToken(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!admin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};
