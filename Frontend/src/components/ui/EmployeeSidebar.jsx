// src/components/ui/EmployeeSidebar.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, Users, MessageSquare, User, ChevronLeft, ChevronRight, LogOut, Trophy } from "lucide-react";
import NotificationBell from "./NotificationBell";
import LogoutConfirmModal from "./LogoutConfirmModal";

const EmployeeSidebar = ({ collapsed = true, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navItems = [
    { icon: GraduationCap, label: 'My Courses', path: '/employee/mycourses' },
    { icon: Users, label: 'My Teams', path: '/employee/myteams' },
    { icon: MessageSquare, label: 'Chatbot', path: '/employee/chatbot' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    setShowLogoutModal(false);
    navigate('/login');
  };

  return (
    <div
      className={`${collapsed ? "w-16" : "w-60"} transition-all duration-300 ease-in-out flex flex-col h-full relative`}
      style={{
        background: "#2b1e13",
        borderRight: "1px solid rgba(245,130,32,0.25)",
      }}
    >
      {/* Header */}
      <div className={`flex items-center ${collapsed ? "justify-center p-3" : "justify-between px-4 py-4"}`}
        style={{ borderBottom: "1px solid rgba(245,130,32,0.18)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(245,130,32,0.12)",
                border: "1.5px solid rgba(245,130,32,0.4)",
              }}
            >
              <span style={{ color: "#f7953f", fontWeight: 700, fontSize: 14 }}>K</span>
            </div>
            <div>
              <h2 style={{ color: "#faf6ef", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" }}>
                K-Electric
              </h2>
              <p style={{ color: "rgba(250,246,239,0.45)", fontSize: 10, marginTop: 1, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Employee Portal
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(245,130,32,0.12)",
              border: "1.5px solid rgba(245,130,32,0.4)",
            }}
          >
            <span style={{ color: "#f7953f", fontWeight: 700, fontSize: 14 }}>K</span>
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

      {/* Notification Bell */}
      <div className="px-2 pt-2 pb-2" style={{ borderBottom: "1px solid rgba(245,130,32,0.15)" }}>
        <NotificationBell collapsed={collapsed} />
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Logout employee?"
        message="You will be signed out of the employee portal and returned to the login screen."
        confirmLabel="Logout"
      />

      {/* Divider label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, color: "rgba(250,246,239,0.25)" }}>
            Menu
          </span>
        </div>
      )}

      {/* Navigation Items */}
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

export default EmployeeSidebar;