// import { createContext, useState, useContext } from "react";
// import { loginUser, signupUser } from "../services/authAPI";

// const AuthContext = createContext();

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(localStorage.getItem("token") || null);

//   const login = async (credentials) => {
//     const { data } = await loginUser(credentials);
//     setUser(data.user);
//     setToken(data.token);
//     localStorage.setItem("token", data.token);
//   };

//   const signup = async (formData) => {
//     const { data } = await signupUser(formData);
//     setUser(data.user);
//     setToken(data.token);
//     localStorage.setItem("token", data.token);
//   };

//   const logout = () => {
//     setUser(null);
//     setToken(null);
//     localStorage.removeItem("token");
//   };

//   return (
//     <AuthContext.Provider value={{ user, token, login, signup, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);
