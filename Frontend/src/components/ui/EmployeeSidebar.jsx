// src/components/ui/EmployeeSidebar.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, Users, MessageSquare, User, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import NotificationBell from "./NotificationBell";

const EmployeeSidebar = ({ collapsed = true, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: GraduationCap, label: 'My Courses', path: '/employee/mycourses' },
    { icon: Users, label: 'My Teams', path: '/employee/myteams' },
    { icon: MessageSquare, label: 'Chatbot', path: '/employee/chatbot' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  return (
    <div className={`
      ${collapsed ? 'w-16' : 'w-60'} 
      transition-all duration-300 ease-in-out
      bg-white border-r border-gray-100 flex flex-col h-full
    `}
    style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-gray-100 ${collapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#f7953f] to-[#E0741C] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm leading-tight">K-Electric</h2>
              <p className="text-[11px] text-gray-400 leading-tight">Employee Portal</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-gradient-to-br from-[#f7953f] to-[#E0741C] rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">K</span>
          </div>
        )}
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:bg-orange-50 hover:text-[#f7953f] rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {onToggle && collapsed && (
        <div className="flex justify-center py-2 border-b border-gray-100">
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:bg-orange-50 hover:text-[#f7953f] rounded-lg transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Notification Bell */}
      <div className={`px-2 pt-3 pb-2 border-b border-gray-100`}>
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* Divider label */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-[10px] font-700 uppercase tracking-widest text-gray-400">Menu</span>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-[#f7953f]/12 to-[#f7953f]/6 text-[#f7953f] font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
              title={collapsed ? item.label : undefined}
              style={isActive ? { boxShadow: 'inset 3px 0 0 #f7953f' } : {}}
            >
              <item.icon
                size={18}
                className="flex-shrink-0"
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {!collapsed && (
                <span className="text-sm">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f7953f]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-3 border-t border-gray-100 pt-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-gray-400 hover:bg-red-50 hover:text-red-500"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default EmployeeSidebar;