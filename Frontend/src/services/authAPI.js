import api from "./api"; // your axios instance with baseURL & interceptors

export const signup = async (email, password,name) => {
  return api.post("/auth/signup", { email, password,name });
};

export const requestCode = async (email) => {
  return api.post("/auth/request-code", { email });
};

export const verifyCode = async (email, code) => {
  return api.post("/auth/verify-code", { email, code });
};

export const loginWithPassword = async (email, password) => {
  const res = await api.post("/auth/login/password", { email, password });
  return res.data;
};

// ----- REQUEST LOGIN CODE -----
export const requestLoginCode = async (email) => {
  const res = await api.post("/auth/login/request-code", { email });
  return res.data;
};

// ----- VERIFY LOGIN CODE -----
export const verifyLoginCode = async (email, code) => {
  const res = await api.post("/auth/login/verify-code", { email, code });
  return res.data;
};

// Password Reset Request
export const requestPasswordReset = async (email) => {
  const res = await api.post("/auth/password-reset/request", { email });
  return res.data;
};

// Password Reset Confirm
export const confirmPasswordReset = async (token, newPassword) => {
  const res = await api.post("/auth/password-reset/confirm", { 
    token, 
    new_password: newPassword 
  });
  return res.data;
};

export const firebaseLogin = async (idToken) => {
  const res = await api.post("/auth/firebase", { id_token: idToken });
  return res.data; // Should return the response directly
};