import { useEffect, useState,useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from '../../components/ui/NotificationItem';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import { Bell, Loader2, Trash2, CheckCheck, BellOff, RefreshCw, X, Mail, User, Calendar, MessageCircle, Megaphone, Users, ArrowRight, GraduationCap } from 'lucide-react';

const Notifications = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [filterType, setFilterType] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if(!hasFetched.current){
      hasFetched.current=true;
      fetchNotifications(1, 50);
    }
  }, []);

  // Check for message or announcement ID in URL params
  useEffect(() => {
    const messageId = searchParams.get('message');
    const announcementId = searchParams.get('announcement');
    
    if (notifications.length > 0) {
      if (messageId) {
        const message = notifications.find(n => n.id === parseInt(messageId));
        if (message && message.type === 'direct_message') {
          setSelectedMessage(message);
          if (!message.is_read) {
            markNotificationAsRead(message.id);
          }
        }
      } else if (announcementId) {
        const announcement = notifications.find(n => n.id === parseInt(announcementId));
        if (announcement && announcement.type === 'team_announcement') {
          setSelectedAnnouncement(announcement);
          if (!announcement.is_read) {
            markNotificationAsRead(announcement.id);
          }
        }
      }
    }
  }, [searchParams, notifications]);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await markNotificationAsRead(notification.id);
    
    // For direct messages, open message modal
    if (notification.type === 'direct_message') {
      setSelectedMessage(notification);
      setSearchParams({ message: notification.id });
    } 
    // For announcements, open announcement modal
    else if (notification.type === 'team_announcement') {
      setSelectedAnnouncement(notification);
      setSearchParams({ announcement: notification.id });
    } 
    // For other types, navigate directly
    else if (notification.related_course_id) {
      navigate(`/employee/course/${notification.related_course_id}`);
    } else if (notification.related_team_id) {
      navigate(`/employee/team/${notification.related_team_id}/announcements`);
    }
  };

  const closeMessageModal = () => {
    setSelectedMessage(null);
    setSearchParams({});
  };

  const closeAnnouncementModal = () => {
    setSelectedAnnouncement(null);
    setSearchParams({});
  };

  const navigateFromAnnouncement = () => {
    if (selectedAnnouncement) {
      // Check if it's related to a course first
      if (selectedAnnouncement.related_course_id) {
        navigate(`/employee/course/${selectedAnnouncement.related_course_id}`);
      } 
      // Otherwise check if it's related to a team
      else if (selectedAnnouncement.related_team_id) {
        navigate(`/employee/team/${selectedAnnouncement.related_team_id}/announcements`);
      }
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

  const filteredNotifications = notifications.filter(notif => {
    if (filterType === 'all') return true;
    return notif.type === filterType;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filters = [
    { key: 'all',              label: 'All',          count: notifications.length },
    { key: 'system',           label: 'System',       count: notifications.filter(n => n.type === 'system').length },
    { key: 'team_announcement',label: 'Announcements',count: notifications.filter(n => n.type === 'team_announcement').length },
    { key: 'direct_message',   label: 'Messages',     count: notifications.filter(n => n.type === 'direct_message').length },
  ];

  return (
    <>
      <style>{`
        @keyframes np-fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes np-spin {
          to { transform: rotate(360deg); }
        }

        .np-page    { display:flex; height:100vh; background:#f8f7f5; overflow:hidden; }
        .np-content { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#fde0c0 transparent; }
        .np-content::-webkit-scrollbar       { width:4px; }
        .np-content::-webkit-scrollbar-thumb { background:#fde0c0; border-radius:4px; }

        /* Hero header */
        .np-hero {
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          padding: 28px 32px 24px;
          position: sticky; top: 0; z-index: 10;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .np-hero-inner { max-width: 860px; margin: 0 auto; }
        .np-hero-row   { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .np-hero-left  { display:flex; align-items:center; gap:14px; }
        .np-hero-icon  {
          width:44px; height:44px; border-radius:13px;
          background: linear-gradient(135deg, #F58220 0%, #E0741C 100%);
          display:flex; align-items:center; justify-content:center;
          box-shadow: 0 4px 12px rgba(245,130,32,0.2);
        }
        .np-hero-title { font-size:22px; font-weight:800; color:#1f2937; letter-spacing:-.3px; }
        .np-hero-sub   { font-size:13px; color:#6b7280; margin-top:3px; }

        /* Unread pill in hero */
        .np-hero-pill {
          display:inline-flex; align-items:center; gap:5px;
          padding:4px 12px; border-radius:999px;
          background: linear-gradient(135deg, #F58220 0%, #E0741C 100%);
          color:#fff; font-size:12px; font-weight:700;
          box-shadow: 0 2px 8px rgba(245,130,32,0.25);
        }
        .np-hero-dot { width:6px; height:6px; border-radius:50%; background:#fff; }

        /* Mark all btn */
        .np-mark-btn {
          display:flex; align-items:center; gap:6px;
          padding:8px 16px; border-radius:10px;
          border:1.5px solid #e5e7eb;
          background:#fff; color:#374151;
          font-size:13px; font-weight:600; cursor:pointer;
          font-family:inherit; white-space:nowrap;
          transition:all 0.15s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .np-mark-btn:hover:not(:disabled) { 
          background:#F58220; 
          color:#fff;
          border-color:#F58220;
          box-shadow: 0 4px 12px rgba(245,130,32,0.25);
        }
        .np-mark-btn:disabled { opacity:.5; cursor:not-allowed; }
        .np-spin { animation:np-spin .9s linear infinite; }

        /* Filter bar */
        .np-filters {
          background:#fff;
          border-bottom: 1px solid #f0ebe4;
          padding: 0 32px;
          position: sticky; top: 0; z-index: 9;
        }
        /* Note: the hero is sticky too so filters sit right below hero 
           and together they scroll away — adjust top values if you want 
           filters to stay fixed independently */
        .np-filters-inner {
          max-width:860px; margin:0 auto;
          display:flex; align-items:center; gap:2px;
          overflow-x:auto;
          scrollbar-width:none;
        }
        .np-filters-inner::-webkit-scrollbar { display:none; }
        .np-ftab {
          display:flex; align-items:center; gap:6px;
          padding:13px 14px; border:none; background:transparent;
          font-size:13px; font-weight:500; color:#9ca3af;
          cursor:pointer; white-space:nowrap; border-bottom:2.5px solid transparent;
          margin-bottom:-1px; transition:color 0.15s, border-color 0.15s;
          font-family:inherit;
        }
        .np-ftab:hover { color:#E0741C; }
        .np-ftab.active { color:#E0741C; border-bottom-color:#F58220; font-weight:700; }
        .np-fcount {
          display:inline-flex; align-items:center; justify-content:center;
          min-width:20px; height:20px; padding:0 5px; border-radius:999px;
          font-size:10px; font-weight:700;
          background:#f3f4f6; color:#6b7280;
        }
        .np-ftab.active .np-fcount { background:#fff0e6; color:#E0741C; }

        /* Body */
        .np-body { padding:24px 32px 40px; }
        .np-body-inner { max-width:860px; margin:0 auto; }

        /* Notification card wrapper */
        .np-card-wrap {
          position:relative;
          animation:np-fadeUp .2s ease both;
        }
        .np-card-wrap:nth-child(2)  { animation-delay:.03s; }
        .np-card-wrap:nth-child(3)  { animation-delay:.06s; }
        .np-card-wrap:nth-child(4)  { animation-delay:.09s; }
        .np-card-wrap:nth-child(5)  { animation-delay:.12s; }
        .np-card-wrap:nth-child(6)  { animation-delay:.15s; }

        /* Notification card itself gets a subtle lift */
        .np-card-wrap > *:first-child {
          border-radius:14px !important;
          border:1px solid #f0ebe4 !important;
          box-shadow:0 1px 3px rgba(0,0,0,.04) !important;
          transition:box-shadow 0.15s, transform 0.15s !important;
        }
        .np-card-wrap:hover > *:first-child {
          box-shadow:0 4px 16px rgba(245,130,32,.10) !important;
          transform:translateY(-1px);
        }

        /* Delete btn */
        .np-del {
          position:absolute; top:10px; right:10px;
          width:32px; height:32px; border-radius:9px; border:none;
          background:transparent; cursor:pointer; color:#d1d5db;
          display:flex; align-items:center; justify-content:center;
          opacity:0; transition:opacity 0.15s, background 0.15s, color 0.15s;
        }
        .np-card-wrap:hover .np-del { opacity:1; }
        .np-del:hover { background:#fef2f2; color:#ef4444; }

        /* Section divider */
        .np-section-label {
          font-size:11px; font-weight:700; color:#c2855a;
          letter-spacing:.08em; text-transform:uppercase;
          padding:18px 4px 8px;
        }
        .np-section-label:first-child { padding-top:0; }

        /* Empty / error states */
        .np-state {
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:72px 24px; gap:12px; text-align:center;
        }
        .np-state-icon {
          width:72px; height:72px; border-radius:22px; background:#fff7ed;
          display:flex; align-items:center; justify-content:center;
          color:#fbbf24; margin-bottom:4px;
          box-shadow:0 2px 12px rgba(245,130,32,.12);
        }
        .np-state-icon.err { background:#fef2f2; color:#fca5a5; }
        .np-state-title { font-size:17px; font-weight:700; color:#1f2937; }
        .np-state-sub   { font-size:14px; color:#9ca3af; line-height:1.6; max-width:260px; }

        .np-retry-btn {
          display:flex; align-items:center; gap:7px;
          padding:10px 20px; border-radius:11px; border:none;
          background:#F58220; color:#fff;
          font-size:14px; font-weight:600; cursor:pointer;
          font-family:inherit; margin-top:4px;
          transition:background 0.15s, box-shadow 0.15s;
        }
        .np-retry-btn:hover { background:#E0741C; box-shadow:0 4px 12px rgba(245,130,32,.35); }

        /* List gap */
        .np-list { display:flex; flex-direction:column; gap:8px; }

        /* Message Modal Styles */
        .msg-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: msg-fadeIn 0.2s ease;
          padding: 20px;
        }
        @keyframes msg-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .msg-modal {
          background: #fff;
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: msg-slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
        }
        @keyframes msg-slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .msg-header {
          background: linear-gradient(135deg, #F58220 0%, #E0741C 100%);
          padding: 24px 28px;
          position: relative;
          overflow: hidden;
        }
        .msg-header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          border-radius: 50%;
        }
        .msg-header-content {
          position: relative;
          z-index: 1;
        }
        .msg-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 2;
        }
        .msg-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }

        .msg-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .msg-title {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .msg-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .msg-body {
          padding: 32px 28px;
          overflow-y: auto;
          flex: 1;
        }
        .msg-body::-webkit-scrollbar { width: 6px; }
        .msg-body::-webkit-scrollbar-thumb { background: #fde0c0; border-radius: 4px; }

        .msg-meta {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 28px;
          padding-bottom: 24px;
          border-bottom: 2px solid #f9fafb;
        }
        .msg-meta-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .msg-meta-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #F58220;
          flex-shrink: 0;
        }
        .msg-meta-content {
          flex: 1;
        }
        .msg-meta-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #9ca3af;
          margin-bottom: 2px;
        }
        .msg-meta-value {
          font-size: 15px;
          font-weight: 600;
          color: #1f2937;
        }

        .msg-content {
          background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
          border: 2px solid #f3f4f6;
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .msg-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #F58220 0%, #E0741C 100%);
        }
        .msg-content-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #F58220;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .msg-content-text {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .msg-footer {
          padding: 20px 28px;
          background: #fafafa;
          border-top: 1px solid #f0f0f0;
          display: flex;
          gap: 12px;
        }
        .msg-btn {
          flex: 1;
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .msg-btn-primary {
          background: linear-gradient(135deg, #F58220 0%, #E0741C 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(245, 130, 32, 0.3);
        }
        .msg-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 130, 32, 0.4);
        }
        .msg-btn-secondary {
          background: #fff;
          color: #6b7280;
          border: 2px solid #e5e7eb;
        }
        .msg-btn-secondary:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }
      `}</style>

      <div className="np-page">
        <EmployeeSidebar
          collapsed={navCollapsed}
          onToggle={() => setNavCollapsed(!navCollapsed)}
        />

        <div className="np-content">
          {/* Hero Header */}
          <div className="np-hero">
            <div className="np-hero-inner">
              <div className="np-hero-row">
                <div className="np-hero-left">
                  <div className="np-hero-icon">
                    <Bell size={22} color="#fff" />
                  </div>
                  <div>
                    <div className="np-hero-title">Notifications</div>
                    <div className="np-hero-sub">
                      {unreadCount > 0 ? (
                        <span className="np-hero-pill">
                          <span className="np-hero-dot" />
                          {unreadCount} unread
                        </span>
                      ) : "You're all caught up!"}
                    </div>
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingAll}
                    className="np-mark-btn"
                  >
                    {markingAll
                      ? <Loader2 size={14} className="np-spin" />
                      : <CheckCheck size={14} />}
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="np-filters">
            <div className="np-filters-inner">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`np-ftab${filterType === f.key ? ' active' : ''}`}
                >
                  {f.label}
                  <span className="np-fcount">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="np-body">
            <div className="np-body-inner">
              {loading && notifications.length === 0 ? (
                <div className="np-state">
                  <div className="np-state-icon">
                    <Loader2 size={32} className="np-spin" style={{ color: '#F58220' }} />
                  </div>
                  <div className="np-state-title">Loading notifications</div>
                  <div className="np-state-sub">Just a moment…</div>
                </div>

              ) : error ? (
                <div className="np-state">
                  <div className="np-state-icon err">
                    <Bell size={32} />
                  </div>
                  <div className="np-state-title">Something went wrong</div>
                  <div className="np-state-sub">{error}</div>
                  <button className="np-retry-btn" onClick={() => fetchNotifications(1, 50)}>
                    <RefreshCw size={14} /> Try again
                  </button>
                </div>

              ) : filteredNotifications.length === 0 ? (
                <div className="np-state">
                  <div className="np-state-icon">
                    <BellOff size={32} />
                  </div>
                  <div className="np-state-title">
                    {filterType === 'all' ? 'No notifications yet' : `No ${filterType.replace('_', ' ')} notifications`}
                  </div>
                  <div className="np-state-sub">
                    {filterType === 'all'
                      ? "We'll notify you as soon as something arrives."
                      : 'Try switching to a different tab to see other notifications.'}
                  </div>
                </div>

              ) : (
                <>
                  {/* Unread section */}
                  {filteredNotifications.some(n => !n.is_read) && (
                    <>
                      <div className="np-section-label">New</div>
                      <div className="np-list" style={{ marginBottom: 24 }}>
                        {filteredNotifications.filter(n => !n.is_read).map((notification) => (
                          <div key={notification.id} className="np-card-wrap">
                            <NotificationItem
                              notification={notification}
                              onClick={() => handleNotificationClick(notification)}
                              compact={false}
                            />
                            <button
                              className="np-del"
                              onClick={(e) => handleDelete(notification.id, e)}
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Read section */}
                  {filteredNotifications.some(n => n.is_read) && (
                    <>
                      {filteredNotifications.some(n => !n.is_read) && (
                        <div className="np-section-label">Earlier</div>
                      )}
                      <div className="np-list">
                        {filteredNotifications.filter(n => n.is_read).map((notification) => (
                          <div key={notification.id} className="np-card-wrap">
                            <NotificationItem
                              notification={notification}
                              onClick={() => handleNotificationClick(notification)}
                              compact={false}
                            />
                            <button
                              className="np-del"
                              onClick={(e) => handleDelete(notification.id, e)}
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && selectedMessage.type === 'direct_message' && (
        <div className="msg-overlay" onClick={closeMessageModal}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="msg-header">
              <button className="msg-close" onClick={closeMessageModal}>
                <X size={20} />
              </button>
              <div className="msg-header-content">
                <div className="msg-icon-wrap">
                  <Mail size={28} color="#fff" />
                </div>
                <h2 className="msg-title">Direct Message</h2>
                <p className="msg-subtitle">You've received a personal message</p>
              </div>
            </div>

            {/* Body */}
            <div className="msg-body">
              {/* Meta Information */}
              <div className="msg-meta">
                {selectedMessage.sender_name && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <User size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">From</div>
                      <div className="msg-meta-value">{selectedMessage.sender_name}</div>
                    </div>
                  </div>
                )}

                <div className="msg-meta-item">
                  <div className="msg-meta-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="msg-meta-content">
                    <div className="msg-meta-label">Received</div>
                    <div className="msg-meta-value">
                      {new Date(selectedMessage.created_at).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                {selectedMessage.title && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <MessageCircle size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Subject</div>
                      <div className="msg-meta-value">{selectedMessage.title}</div>
                    </div>
                  </div>
                )}

                {selectedMessage.related_course_title && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <GraduationCap size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Related Course</div>
                      <div className="msg-meta-value">{selectedMessage.related_course_title}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="msg-content">
                <div className="msg-content-label">
                  <MessageCircle size={14} />
                  Message
                </div>
                <div className="msg-content-text">
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="msg-footer">
              <button className="msg-btn msg-btn-secondary" onClick={closeMessageModal}>
                Close
              </button>
              {selectedMessage.related_course_id && (
                <button 
                  className="msg-btn msg-btn-primary"
                  onClick={() => {
                    closeMessageModal();
                    navigate(`/employee/course/${selectedMessage.related_course_id}`);
                  }}
                >
                  <ArrowRight size={16} />
                  Go to Course
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && selectedAnnouncement.type === 'team_announcement' && (
        <div className="msg-overlay" onClick={closeAnnouncementModal}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="msg-header">
              <button className="msg-close" onClick={closeAnnouncementModal}>
                <X size={20} />
              </button>
              <div className="msg-header-content">
                <div className="msg-icon-wrap">
                  <Megaphone size={28} color="#fff" />
                </div>
                <h2 className="msg-title">Team Announcement</h2>
                <p className="msg-subtitle">Important update from your team</p>
              </div>
            </div>

            {/* Body */}
            <div className="msg-body">
              {/* Meta Information */}
              <div className="msg-meta">
                {selectedAnnouncement.related_course_title && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <Users size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Course</div>
                      <div className="msg-meta-value">{selectedAnnouncement.related_course_title}</div>
                    </div>
                  </div>
                )}

                {selectedAnnouncement.related_team_name && !selectedAnnouncement.related_course_title && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <Users size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Team</div>
                      <div className="msg-meta-value">{selectedAnnouncement.related_team_name}</div>
                    </div>
                  </div>
                )}

                {selectedAnnouncement.sender_name && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <User size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Posted By</div>
                      <div className="msg-meta-value">{selectedAnnouncement.sender_name}</div>
                    </div>
                  </div>
                )}

                <div className="msg-meta-item">
                  <div className="msg-meta-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="msg-meta-content">
                    <div className="msg-meta-label">Posted On</div>
                    <div className="msg-meta-value">
                      {new Date(selectedAnnouncement.created_at).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                {selectedAnnouncement.title && (
                  <div className="msg-meta-item">
                    <div className="msg-meta-icon">
                      <Megaphone size={18} />
                    </div>
                    <div className="msg-meta-content">
                      <div className="msg-meta-label">Subject</div>
                      <div className="msg-meta-value">{selectedAnnouncement.title}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Announcement Content */}
              <div className="msg-content">
                <div className="msg-content-label">
                  <MessageCircle size={14} />
                  Announcement
                </div>
                <div className="msg-content-text">
                  {selectedAnnouncement.message}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="msg-footer">
              <button className="msg-btn msg-btn-secondary" onClick={closeAnnouncementModal}>
                Close
              </button>
              {(selectedAnnouncement.related_course_id || selectedAnnouncement.related_team_id) && (
                <button 
                  className="msg-btn msg-btn-primary"
                  onClick={navigateFromAnnouncement}
                >
                  <ArrowRight size={16} />
                  {selectedAnnouncement.related_course_id 
                    ? 'Go to Course' 
                    : 'Go to Team Page'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notifications;