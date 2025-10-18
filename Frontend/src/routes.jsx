import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VerifyCode from "./pages/auth/VerifyCode";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard";
import EmployeeList from "./pages/admin/EmployeeList";
import TeamsPage from "./pages/admin/TeamsPage";
import MyTeams from "./pages/employee/MyTeams";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ---------- Employee Auth Routes ---------- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ---------- Admin Auth Route ---------- */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* ---------- Admin Protected Routes ---------- */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <AdminProtectedRoute>
              <EmployeeList />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/teams"
          element={
            <AdminProtectedRoute>
              <TeamsPage />
            </AdminProtectedRoute>
          }
        />

        {/* ---------- Employee Routes ---------- */}
        <Route path="/employee/myteams" element={<MyTeams />} />

        {/* ---------- Default Redirect ---------- */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;