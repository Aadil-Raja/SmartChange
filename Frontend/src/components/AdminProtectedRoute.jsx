import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuthContext";

const AdminProtectedRoute = ({ children }) => {
  const { token } = useContext(AdminAuthContext);

  if (!token) {
    console.log("No admin token found, redirecting to admin login.");
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
