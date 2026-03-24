// src/components/ui/AdminSidebar.jsx
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Settings, ChevronLeft, ChevronRight, LogOut, ClipboardList } from "lucide-react";

const AdminSidebar = ({ collapsed = true, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home,          label: "Dashboard",  path: "/admin" },
    { icon: Users,         label: "Employees",  path: "/admin/employees" },
    { icon: Users,         label: "Teams",      path: "/admin/teams" },
    { icon: Settings,      label: "Training",   path: "/admin/training" },
    { icon: ClipboardList, label: "Quizzes",    path: "/admin/quiz" },
  ];

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("adminToken");
      navigate("/admin/login");
    }
  };

  return (
    <div
      className={`${collapsed ? "w-16" : "w-60"} transition-all duration-300 ease-in-out flex flex-col h-full relative`}
      style={{
        background: "#2b1e13",
        borderRight: "1px solid rgba(245,130,32,0.25)",
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        className={`flex items-center ${collapsed ? "justify-center p-3" : "justify-between px-4 py-4"}`}
        style={{ borderBottom: "1px solid rgba(245,130,32,0.18)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(245,130,32,0.12)",
                  border: "1.5px solid rgba(245,130,32,0.4)",
                }}
              >
                <span style={{ color: "#f7953f", fontWeight: 700, fontSize: 14 }}>K</span>
              </div>
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ background: "#f7953f" }}
              />
            </div>
            <div>
              <h2 style={{ color: "#faf6ef", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" }}>
                K-Electric
              </h2>
              <p style={{ color: "rgba(250,246,239,0.45)", fontSize: 10, marginTop: 1, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Admin Portal
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="relative">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(245,130,32,0.12)",
                border: "1.5px solid rgba(245,130,32,0.4)",
              }}
            >
              <span style={{ color: "#f7953f", fontWeight: 700, fontSize: 14 }}>K</span>
            </div>
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: "#f7953f" }}
            />
          </div>
        )}

        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "rgba(250,246,239,0.35)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,130,32,0.12)"; e.currentTarget.style.color = "#f7953f"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.35)"; }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {onToggle && collapsed && (
        <div className="flex justify-center py-2" style={{ borderBottom: "1px solid rgba(245,130,32,0.18)" }}>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "rgba(250,246,239,0.35)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,130,32,0.12)"; e.currentTarget.style.color = "#f7953f"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.35)"; }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, color: "rgba(250,246,239,0.25)" }}>
            Menu
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
              style={
                isActive
                  ? {
                      background: "rgba(245,130,32,0.13)",
                      color: "#f7953f",
                      fontWeight: 600,
                      fontSize: 13,
                      boxShadow: "inset 3px 0 0 #f7953f",
                    }
                  : {
                      color: "rgba(250,246,239,0.5)",
                      fontSize: 13,
                    }
              }
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(245,130,32,0.07)";
                  e.currentTarget.style.color = "rgba(250,246,239,0.88)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(250,246,239,0.5)";
                }
              }}
            >
              <item.icon size={17} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#f7953f" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 pt-2" style={{ borderTop: "1px solid rgba(245,130,32,0.15)" }}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
          style={{ color: "rgba(250,246,239,0.3)", fontSize: 13 }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.3)"; }}
        >
          <LogOut size={17} className="flex-shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;