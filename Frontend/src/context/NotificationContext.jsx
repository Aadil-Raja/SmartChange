import { createContext, useState, useEffect, useRef } from 'react';
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

  // Auto-refresh unread count every 30 seconds
  useEffect(() => {
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
  }, []);

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
