import { createContext, useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { AdminAuthContext } from './AdminAuthContext';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../services/notificationApi';

export const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);
  const { token: employeeToken } = useContext(AuthContext);
  const { token: adminToken } = useContext(AdminAuthContext);
  
  // Only poll when employee is logged in AND admin is NOT logged in
  const shouldPoll = !!employeeToken && !adminToken;

  // Fetch notifications
  const fetchNotifications = async (page = 1, limit = 10, unreadOnly = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getNotifications(page, limit, unreadOnly);
      if (response.success) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unread_count);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.message || 'Failed to fetch notifications');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch notifications';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    try {
      const response = await getUnreadCount();
      if (response.success) {
        setUnreadCount(response.data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      const response = await markAsRead(notificationId);
      if (response.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
        // Decrease unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
        return { success: true };
      }
      return response;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to mark as read';
      return { success: false, message: errorMsg };
    }
  };

  // Mark all as read
  const markAllNotificationsAsRead = async () => {
    try {
      const response = await markAllAsRead();
      if (response.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);
        return { success: true, data: response.data };
      }
      return response;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to mark all as read';
      return { success: false, message: errorMsg };
    }
  };

  // Delete notification
  const removeNotification = async (notificationId) => {
    try {
      const response = await deleteNotification(notificationId);
      if (response.success) {
        // Remove from local state
        const deletedNotif = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        
        // Update unread count if deleted notification was unread
        if (deletedNotif && !deletedNotif.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        return { success: true };
      }
      return response;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete notification';
      return { success: false, message: errorMsg };
    }
  };

  // Auto-refresh unread count every 30 seconds (only when employee is logged in and admin is not)
  useEffect(() => {
    // Only run polling when employee is logged in and admin is NOT logged in
    if (!shouldPoll) {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Set up interval
    refreshIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30 seconds

    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [shouldPoll]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        fetchUnreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        removeNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
