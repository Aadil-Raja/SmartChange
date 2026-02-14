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
      bg-white border-r border-gray-200 shadow-sm flex flex-col h-full
    `}>
      {/* Navigation Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#F58220] to-[#E0741C] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div>
              <h2 className="font-bold text-[#333333] text-sm">K-Electric</h2>
              <p className="text-xs text-gray-600">Employee Portal</p>
            </div>
          </div>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>
      
      {/* Notification Bell - Above Navigation Items */}
      <div className="p-2 border-b border-gray-200">
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-start px-1'}`}>
          <NotificationBell collapsed={collapsed} />
        </div>
      </div>
      
      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#F58220]/10 to-[#E0741C]/10 text-[#F58220]'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-[#F58220]'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-red-600 hover:bg-red-50 hover:text-red-700"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default EmployeeSidebar;