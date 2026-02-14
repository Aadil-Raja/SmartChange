import api from './api';

// ===== NOTIFICATION APIs =====

// Get notifications for current user
export const getNotifications = async (page = 1, limit = 10, unreadOnly = false) => {
  const response = await api.get('/employee/notifications', {
    params: { page, limit, unread_only: unreadOnly }
  });
  return response.data;
};

// Get unread count
export const getUnreadCount = async () => {
  const response = await api.get('/employee/notifications/unread-count');
  return response.data;
};

// Mark notification as read
export const markAsRead = async (notificationId) => {
  const response = await api.patch(`/employee/notifications/${notificationId}/read`);
  return response.data;
};

// Mark all notifications as read
export const markAllAsRead = async () => {
  const response = await api.patch('/employee/notifications/mark-all-read');
  return response.data;
};

// Delete notification
export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/employee/notifications/${notificationId}`);
  return response.data;
};
