import { useEffect, useState, useRef } from 'react';
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
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchNotifications(1, 50);
    }
  }, []);

  // Check for message or announcement ID in URL params
  useEffect(() => {
    const messageId = searchParams.get('message');
    const announcementId = searchParams.get('announcement');

    if (notifications.length > 0) {
      if (messageId) {
        const message = notifications.find((n) => n.id === parseInt(messageId));
        if (message && message.type === 'direct_message') {
          setSelectedMessage(message);
          if (!message.is_read) {
            markNotificationAsRead(message.id);
          }
        }
      } else if (announcementId) {
        const announcement = notifications.find((n) => n.id === parseInt(announcementId));
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

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === 'all') return true;
    return notif.type === filterType;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatDetailedDate = (dateValue) => {
    try {
      return new Date(dateValue).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  const getFilterLabel = (key) => {
    switch (key) {
      case 'system':
        return 'System';
      case 'team_announcement':
        return 'Announcements';
      case 'direct_message':
        return 'Messages';
      default:
        return 'All';
    }
  };

  const filters = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'system', label: 'System', count: notifications.filter((n) => n.type === 'system').length },
    { key: 'team_announcement', label: 'Announcements', count: notifications.filter((n) => n.type === 'team_announcement').length },
    { key: 'direct_message', label: 'Messages', count: notifications.filter((n) => n.type === 'direct_message').length },
  ];

  const unreadNotifications = filteredNotifications.filter((n) => !n.is_read);
  const readNotifications = filteredNotifications.filter((n) => n.is_read);

  return (
    <>
      <div className="flex h-screen bg-[#faf6ef] overflow-hidden">
        <EmployeeSidebar
          collapsed={navCollapsed}
          onToggle={() => setNavCollapsed(!navCollapsed)}
        />

        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
            <section
              className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 mb-6 border"
              style={{
                background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)',
                borderColor: '#2f2317',
                boxShadow: '0 20px 48px rgba(26,18,9,0.28)',
              }}
            >
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full" style={{ background: 'rgba(247,149,63,0.12)' }} />
              <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full" style={{ background: 'rgba(247,149,63,0.08)' }} />

              <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(247,149,63,0.28)' }}>
                    <Bell size={22} className="text-[#fff4e8]" />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>
                      Notifications
                    </h1>
                    <div className="mt-2 text-sm" style={{ color: '#f6d5b8' }}>
                      {unreadCount > 0 ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(247,149,63,0.22)', color: '#ffe2ca' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ffe2ca]" />
                          {unreadCount} unread
                        </span>
                      ) : (
                        "You're all caught up!"
                      )}
                    </div>
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingAll}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#fff4e8', border: '1px solid rgba(255,255,255,0.24)' }}
                  >
                    {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                    Mark all read
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-3 mb-6" style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 22px rgba(26,18,9,0.08)' }}>
              <div className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterType(f.key)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all"
                    style={{
                      background: filterType === f.key ? '#1a1209' : '#f6f1e8',
                      color: filterType === f.key ? '#ffffff' : '#6b5e4e',
                      border: filterType === f.key ? '1px solid transparent' : '1px solid #eadfce',
                    }}
                  >
                    {getFilterLabel(f.key)}
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: filterType === f.key ? 'rgba(255,255,255,0.2)' : '#ffffff' }}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-4 sm:p-5" style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 24px rgba(26,18,9,0.08)' }}>
              {loading && notifications.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-5 rounded-full mb-4" style={{ background: '#f3ede4' }}>
                    <Loader2 size={34} className="animate-spin" style={{ color: '#f7953f' }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: '#1a1209' }}>Loading notifications</h3>
                  <p style={{ color: '#7c6f61' }}>Just a moment...</p>
                </div>

              ) : error ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-5 rounded-full mb-4" style={{ background: '#fff1f2' }}>
                    <Bell size={32} className="text-[#dc2626]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: '#1a1209' }}>Something went wrong</h3>
                  <p className="max-w-md mx-auto" style={{ color: '#7c6f61' }}>{error}</p>
                  <button
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold"
                    style={{ background: '#dc2626' }}
                    onClick={() => fetchNotifications(1, 50)}
                  >
                    <RefreshCw size={14} /> Try again
                  </button>
                </div>

              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-5 rounded-full mb-4" style={{ background: '#f3ede4' }}>
                    <BellOff size={32} style={{ color: '#9d907f' }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: '#1a1209' }}>
                    {filterType === 'all' ? 'No notifications yet' : `No ${filterType.replace('_', ' ')} notifications`}
                  </h3>
                  <p className="max-w-md mx-auto" style={{ color: '#7c6f61' }}>
                    {filterType === 'all'
                      ? "We'll notify you as soon as something arrives."
                      : 'Try switching to a different tab to see other notifications.'}
                  </p>
                </div>

              ) : (
                <>
                  {unreadNotifications.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold tracking-[0.14em] uppercase mb-2 px-1" style={{ color: '#b97a4f' }}>
                        New
                      </p>
                      <div className="space-y-3">
                        {unreadNotifications.map((notification) => (
                          <div key={notification.id} className="relative group">
                            <NotificationItem
                              notification={notification}
                              onClick={() => handleNotificationClick(notification)}
                              compact={false}
                            />
                            <button
                              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                              style={{ background: '#fff1f2', color: '#dc2626' }}
                              onClick={(e) => handleDelete(notification.id, e)}
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {readNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.length > 0 && (
                        <p className="text-xs font-bold tracking-[0.14em] uppercase mb-2 px-1" style={{ color: '#b97a4f' }}>
                          Earlier
                        </p>
                      )}
                      <div className="space-y-3">
                        {readNotifications.map((notification) => (
                          <div key={notification.id} className="relative group">
                            <NotificationItem
                              notification={notification}
                              onClick={() => handleNotificationClick(notification)}
                              compact={false}
                            />
                            <button
                              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                              style={{ background: '#fff1f2', color: '#dc2626' }}
                              onClick={(e) => handleDelete(notification.id, e)}
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && selectedMessage.type === 'direct_message' && (
        <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-sm p-5 flex items-center justify-center" onClick={closeMessageModal}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[24px] border bg-white flex flex-col" style={{ borderColor: '#e8e0d4', boxShadow: '0 22px 62px rgba(26,18,9,0.35)' }} onClick={(e) => e.stopPropagation()}>
            <div className="relative p-6 sm:p-7" style={{ background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)' }}>
              <button className="absolute top-5 right-5 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }} onClick={closeMessageModal}>
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Mail size={28} color="#fff" />
              </div>
              <h2 className="text-3xl font-bold mb-1" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>Direct Message</h2>
              <p className="text-sm" style={{ color: '#f6d5b8' }}>You've received a personal message</p>
            </div>

            <div className="p-6 sm:p-7 overflow-y-auto flex-1">
              <div className="space-y-4 mb-6 pb-5" style={{ borderBottom: '1px solid #efe7dc' }}>
                {selectedMessage.sender_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>From</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedMessage.sender_name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Received</p>
                    <p className="font-semibold" style={{ color: '#1a1209' }}>{formatDetailedDate(selectedMessage.created_at)}</p>
                  </div>
                </div>

                {selectedMessage.title && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <MessageCircle size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Subject</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedMessage.title}</p>
                    </div>
                  </div>
                )}

                {selectedMessage.related_course_title && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Related Course</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedMessage.related_course_title}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border p-5" style={{ background: '#faf6ef', borderColor: '#ede3d5' }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-2 inline-flex items-center gap-2" style={{ color: '#f7953f' }}>
                  <MessageCircle size={14} />
                  Message
                </div>
                <div className="whitespace-pre-wrap" style={{ color: '#3d3228', lineHeight: 1.7 }}>
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t flex gap-3" style={{ borderColor: '#efe7dc', background: '#fffdfa' }}>

              {selectedMessage.related_course_id && (
                <button
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #f7953f 0%, #E0741C 100%)' }}
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
        <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-sm p-5 flex items-center justify-center" onClick={closeAnnouncementModal}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[24px] border bg-white flex flex-col" style={{ borderColor: '#e8e0d4', boxShadow: '0 22px 62px rgba(26,18,9,0.35)' }} onClick={(e) => e.stopPropagation()}>
            <div className="relative p-6 sm:p-7" style={{ background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)' }}>
              <button className="absolute top-5 right-5 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }} onClick={closeAnnouncementModal}>
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Megaphone size={28} color="#fff" />
              </div>
              <h2 className="text-3xl font-bold mb-1" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>Team Announcement</h2>
              <p className="text-sm" style={{ color: '#f6d5b8' }}>Important update from your team</p>
            </div>

            <div className="p-6 sm:p-7 overflow-y-auto flex-1">
              <div className="space-y-4 mb-6 pb-5" style={{ borderBottom: '1px solid #efe7dc' }}>
                {selectedAnnouncement.related_course_title && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Course</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedAnnouncement.related_course_title}</p>
                    </div>
                  </div>
                )}

                {selectedAnnouncement.related_team_name && !selectedAnnouncement.related_course_title && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Team</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedAnnouncement.related_team_name}</p>
                    </div>
                  </div>
                )}

                {selectedAnnouncement.sender_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Posted By</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedAnnouncement.sender_name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Posted On</p>
                    <p className="font-semibold" style={{ color: '#1a1209' }}>{formatDetailedDate(selectedAnnouncement.created_at)}</p>
                  </div>
                </div>

                {selectedAnnouncement.title && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8', color: '#f7953f' }}>
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#9d907f' }}>Subject</p>
                      <p className="font-semibold" style={{ color: '#1a1209' }}>{selectedAnnouncement.title}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border p-5" style={{ background: '#faf6ef', borderColor: '#ede3d5' }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-2 inline-flex items-center gap-2" style={{ color: '#f7953f' }}>
                  <MessageCircle size={14} />
                  Announcement
                </div>
                <div className="whitespace-pre-wrap" style={{ color: '#3d3228', lineHeight: 1.7 }}>
                  {selectedAnnouncement.message}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t flex gap-3" style={{ borderColor: '#efe7dc', background: '#fffdfa' }}>
              <button className="flex-1 px-4 py-3 rounded-xl font-semibold border" style={{ borderColor: '#dfd5c8', color: '#6b5e4e', background: '#fff' }} onClick={closeAnnouncementModal}>
                Close
              </button>
              {(selectedAnnouncement.related_course_id || selectedAnnouncement.related_team_id) && (
                <button
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #f7953f 0%, #E0741C 100%)' }}
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