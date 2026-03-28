import { Bell, Megaphone, Mail, Clock } from 'lucide-react';

const NotificationItem = ({ notification, onClick, compact = false }) => {
  const getMeta = () => {
    switch (notification.type) {
      case 'system':
        return {
          icon: <Bell size={compact ? 16 : 20} className="text-[#0a7cb8]" />,
          bg: '#ecf6fd',
          label: 'System',
          labelStyle: { background: '#e8f4fd', color: '#0369a1' },
        };
      case 'team_announcement':
        return {
          icon: <Megaphone size={compact ? 16 : 20} className="text-[#e0741c]" />,
          bg: '#fff3e8',
          label: 'Announcement',
          labelStyle: { background: '#fff0e8', color: '#b45309' },
        };
      case 'direct_message':
        return {
          icon: <Mail size={compact ? 16 : 20} className="text-[#3f8e1b]" />,
          bg: '#edf8ea',
          label: 'Message',
          labelStyle: { background: '#e8f5e3', color: '#3f8e1b' },
        };
      default:
        return {
          icon: <Bell size={compact ? 16 : 20} className="text-[#6b5e4e]" />,
          bg: '#f3ede4',
          label: 'Notification',
          labelStyle: { background: '#f3ede4', color: '#6b5e4e' },
        };
    }
  };

  const meta = getMeta();

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
        flex items-start gap-3 p-4 cursor-pointer transition-all
        ${compact ? 'border-b' : 'rounded-2xl border'}
      `}
      style={{
        background: notification.is_read ? '#ffffff' : '#fffaf3',
        borderColor: compact ? '#ede3d5' : '#e8e0d4',
        boxShadow: compact ? 'none' : '0 4px 12px rgba(26,18,9,0.05)',
      }}
    >
      <div
        className={`flex-shrink-0 rounded-xl flex items-center justify-center ${compact ? 'w-8 h-8 mt-0.5' : 'w-10 h-10 mt-0.5'}`}
        style={{ background: meta.bg }}
      >
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-sm ${notification.is_read ? 'font-medium' : 'font-bold'}`}
            style={{ color: '#1a1209' }}
          >
            {notification.title}
          </h4>
          {!notification.is_read && (
            <div className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ background: '#f7953f' }}></div>
          )}
        </div>

        <p className={`text-sm mt-1 ${compact ? 'line-clamp-2' : ''}`} style={{ color: '#6b5e4e' }}>
          {notification.message}
        </p>

        <div className="mt-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold" style={meta.labelStyle}>
            {meta.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs" style={{ color: '#8f8172' }}>
          <Clock size={12} className="text-[#9b8c7b]" />
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
              <span className="font-medium" style={{ color: '#b45309' }}>{notification.related_team_name}</span>
            </>
          )}
          {notification.related_course_title && (
            <>
              <span>•</span>
              <span className="font-medium" style={{ color: '#0369a1' }}>{notification.related_course_title}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
