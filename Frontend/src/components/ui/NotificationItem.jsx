import { Bell, Megaphone, Mail, Clock } from 'lucide-react';

const NotificationItem = ({ notification, onClick, compact = false }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'system':
        return <Bell size={compact ? 16 : 20} className="text-blue-600" />;
      case 'team_announcement':
        return <Megaphone size={compact ? 16 : 20} className="text-orange-600" />;
      case 'direct_message':
        return <Mail size={compact ? 16 : 20} className="text-green-600" />;
      default:
        return <Bell size={compact ? 16 : 20} className="text-gray-600" />;
    }
  };

  const getTimeAgo = () => {
    try {
      const now = new Date();
      const created = new Date(notification.created_at);
      const diffMs = now - created;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return created.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 p-3 cursor-pointer transition-all
        ${notification.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'}
        ${compact ? 'border-b border-gray-100' : 'rounded-lg border border-gray-200 shadow-sm'}
      `}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${compact ? 'mt-0.5' : 'mt-1'}`}>
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`text-sm ${notification.is_read ? 'font-medium text-gray-900' : 'font-bold text-gray-900'}`}>
            {notification.title}
          </h4>
          {!notification.is_read && (
            <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
          )}
        </div>

        <p className={`text-sm text-gray-600 mt-1 ${compact ? 'line-clamp-2' : ''}`}>
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <Clock size={12} />
          <span>{getTimeAgo()}</span>
          {notification.sender_name && (
            <>
              <span>•</span>
              <span>From: {notification.sender_name}</span>
            </>
          )}
          {notification.related_team_name && (
            <>
              <span>•</span>
              <span className="text-orange-600 font-medium">{notification.related_team_name}</span>
            </>
          )}
          {notification.related_course_title && (
            <>
              <span>•</span>
              <span className="text-blue-600 font-medium">{notification.related_course_title}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
