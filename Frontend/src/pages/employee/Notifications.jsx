import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from '../../components/ui/NotificationItem';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import { Bell, Loader2, Trash2, CheckCheck } from 'lucide-react';
import Button from '../../components/ui/Button';

const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    error,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    removeNotification
  } = useNotifications();

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, system, team_announcement, direct_message
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications(1, 50); // Fetch more notifications for the full page
  }, []);

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on type
    if (notification.related_course_id) {
      navigate(`/employee/course/${notification.related_course_id}`);
    } else if (notification.related_team_id) {
      navigate(`/employee/team/${notification.related_team_id}/announcements`);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    await markAllNotificationsAsRead();
    setMarkingAll(false);
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this notification?')) {
      await removeNotification(notificationId);
    }
  };

  // Filter notifications by type
  const filteredNotifications = notifications.filter(notif => {
    if (filterType === 'all') return true;
    return notif.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <EmployeeSidebar 
        collapsed={navCollapsed} 
        onToggle={() => setNavCollapsed(!navCollapsed)} 
      />
      
      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-[#333333]">Notifications</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Filter Tabs and Actions */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === 'all'
                      ? 'bg-[#F58220] text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilterType('system')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === 'system'
                      ? 'bg-[#F58220] text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                  }`}
                >
                  System ({notifications.filter(n => n.type === 'system').length})
                </button>
                <button
                  onClick={() => setFilterType('team_announcement')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === 'team_announcement'
                      ? 'bg-[#F58220] text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                  }`}
                >
                  Announcements ({notifications.filter(n => n.type === 'team_announcement').length})
                </button>
                <button
                  onClick={() => setFilterType('direct_message')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === 'direct_message'
                      ? 'bg-[#F58220] text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                  }`}
                >
                  Messages ({notifications.filter(n => n.type === 'direct_message').length})
                </button>
              </div>

              {/* Mark All as Read Button */}
              {unreadCount > 0 && (
                <Button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  variant="secondary"
                  size="sm"
                >
                  {markingAll ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <CheckCheck size={14} className="mr-2" />
                      Mark All Read
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Notifications List */}
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 size={48} className="animate-spin text-[#F58220] mx-auto mb-4" />
                  <p className="text-gray-600">Loading notifications...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="inline-flex p-4 bg-red-50 rounded-full mb-4">
                  <Bell size={48} className="text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Notifications</h3>
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => fetchNotifications(1, 50)} variant="primary">
                  Try Again
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
                  <Bell size={48} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {filterType === 'all' ? 'No Notifications' : `No ${filterType.replace('_', ' ')} notifications`}
                </h3>
                <p className="text-gray-600">
                  {filterType === 'all' 
                    ? "You're all caught up! We'll notify you when something arrives."
                    : 'Try selecting a different filter to see other notifications.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div key={notification.id} className="relative group">
                    <NotificationItem
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                      compact={false}
                    />
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
