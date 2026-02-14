import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationBell = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      fetchNotifications(1, 10, false);
    }
  }, [showDropdown]);

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.related_course_id) {
      // Course-related notification
      setShowDropdown(false);
      navigate(`/employee/course/${notification.related_course_id}`);
    } else if (notification.related_team_id) {
      // Team announcement notification
      setShowDropdown(false);
      navigate(`/employee/team/${notification.related_team_id}/announcements`);
    }
    // Otherwise just mark as read (already done above)
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    await markAllNotificationsAsRead();
    setMarkingAll(false);
  };

  const handleViewAll = () => {
    setShowDropdown(false);
    navigate('/employee/notifications');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleBellClick}
        className={`relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${
          collapsed ? 'w-full flex justify-center' : 'w-full flex items-center gap-3'
        }`}
        title={collapsed ? 'Notifications' : undefined}
      >
        <Bell size={18} className="flex-shrink-0" />
        {!collapsed && <span className="font-medium text-sm">Notifications</span>}
        {unreadCount > 0 && (
          <span className={`absolute flex items-center justify-center text-xs font-bold text-white bg-red-600 rounded-full ${
            collapsed ? 'top-0 right-0 w-5 h-5' : 'w-5 h-5 ml-auto'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-0'} top-0 mt-0 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell size={48} className="text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">No notifications yet</p>
                <p className="text-sm text-gray-500 mt-1">We'll notify you when something arrives</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    compact={true}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={handleViewAll}
                className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
