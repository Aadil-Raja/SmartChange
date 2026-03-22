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
        background: "#1a1209",
        // 2px orange right border acts as the bottom-edge accent connecting to page
        borderRight: "2px solid #F58220",
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        className={`flex items-center ${collapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
        style={{ borderBottom: "1px solid rgba(245,130,32,0.2)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            {/* Logo mark with orange dot accent */}
            <div className="relative">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,130,32,0.15)", border: "1.5px solid rgba(245,130,32,0.4)" }}
              >
                <span className="text-white font-bold text-sm">K</span>
              </div>
              {/* Orange dot accent */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ background: "#F58220" }}
              />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight" style={{ color: "#faf6ef" }}>K-Electric</h2>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(250,246,239,0.45)" }}>Admin Portal</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="relative">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,130,32,0.15)", border: "1.5px solid rgba(245,130,32,0.4)" }}
            >
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: "#F58220" }}
            />
          </div>
        )}

        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "rgba(250,246,239,0.4)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,130,32,0.15)"; e.currentTarget.style.color = "#F58220"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.4)"; }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {onToggle && collapsed && (
        <div className="flex justify-center py-2" style={{ borderBottom: "1px solid rgba(245,130,32,0.2)" }}>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "rgba(250,246,239,0.4)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,130,32,0.15)"; e.currentTarget.style.color = "#F58220"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.4)"; }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(250,246,239,0.3)" }}>
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 relative"
              style={
                isActive
                  ? {
                      background: "rgba(245,130,32,0.14)",
                      color: "#F58220",
                      fontWeight: 600,
                      // Orange left border accent
                      boxShadow: "inset 3px 0 0 #F58220",
                    }
                  : { color: "rgba(250,246,239,0.55)" }
              }
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(245,130,32,0.08)";
                  e.currentTarget.style.color = "rgba(250,246,239,0.9)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(250,246,239,0.55)";
                }
              }}
            >
              <item.icon size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span className="text-sm">{item.label}</span>}
              {/* Active orange dot */}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#F58220" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: "1px solid rgba(245,130,32,0.15)" }}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
          style={{ color: "rgba(250,246,239,0.35)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.35)"; }}
        >
          <LogOut size={18} className="flex-shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>

      {/* 2px orange bottom edge — visually connects sidebar to page content */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#F58220" }} />
    </div>
  );
};

export default AdminSidebar;
