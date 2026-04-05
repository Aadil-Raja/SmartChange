import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Loader2, BellOff, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationBell = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Compute fixed position every time dropdown opens or collapsed changes
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 380;
      const viewportPadding = 12;
      const gap = 10;
      const maxHeight = Math.min(560, window.innerHeight - viewportPadding * 2);

      let left = rect.right + gap;
      if (left + dropdownWidth + viewportPadding > window.innerWidth) {
        left = Math.max(viewportPadding, rect.left - dropdownWidth - gap);
      }

      const top = Math.min(
        Math.max(viewportPadding, rect.top),
        Math.max(viewportPadding, window.innerHeight - maxHeight - viewportPadding)
      );

      setDropdownStyle({
        position: 'fixed',
        top,
        left,
        maxHeight,
        zIndex: 9999,
      });
    }
  }, [showDropdown, collapsed]);

  useEffect(() => {
    if (showDropdown) fetchNotifications(1, 10, false);
  }, [showDropdown]);

  const handleBellClick = () => setShowDropdown((prev) => !prev);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await markNotificationAsRead(notification.id);
    
    // For direct messages and announcements, navigate to notifications page with ID
    if (notification.type === 'direct_message') {
      setShowDropdown(false);
      navigate(`/employee/notifications?message=${notification.id}`);
    } else if (notification.type === 'team_announcement') {
      setShowDropdown(false);
      navigate(`/employee/notifications?announcement=${notification.id}`);
    } else if (notification.related_course_id) {
      setShowDropdown(false);
      navigate(`/employee/course/${notification.related_course_id}`);
    } else if (notification.related_team_id) {
      setShowDropdown(false);
      navigate(`/employee/team/${notification.related_team_id}/announcements`);
    } else {
      // For other types, just navigate to notifications page
      setShowDropdown(false);
      navigate('/employee/notifications');
    }
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
    <>
      <style>{`
        @keyframes nb-ring {
          0%,100%{ transform:rotate(0); }
          15%    { transform:rotate(14deg); }
          30%    { transform:rotate(-11deg); }
          45%    { transform:rotate(8deg); }
          60%    { transform:rotate(-5deg); }
          75%    { transform:rotate(3deg); }
        }
        @keyframes nb-in {
          from { opacity:0; transform:translateX(-6px) scale(0.97); }
          to   { opacity:1; transform:translateX(0)   scale(1);    }
        }
        @keyframes nb-pop {
          0%  { transform:scale(0.5); opacity:0; }
          70% { transform:scale(1.25); }
          100%{ transform:scale(1);   opacity:1; }
        }
        @keyframes nb-spin {
          to { transform:rotate(360deg); }
        }

        .nb-btn {
          position:relative; display:flex; align-items:center;
          width:100%; padding:9px 12px; border:none; border-radius:12px;
          background:transparent; cursor:pointer; gap:10px;
          font-size:14px; font-weight:600; color:#7c6f61;
          transition:background 0.15s, color 0.15s; font-family:inherit; text-align:left;
        }
        .nb-btn.c { justify-content:center; padding:9px; }
        .nb-btn:hover, .nb-btn.on {
          background:#f6f1e8;
          color:#1a1209;
          box-shadow: inset 0 0 0 1px #eadfce;
        }
        .nb-btn:hover .nb-bi      { animation:nb-ring 0.65s ease; }

        .nb-badge {
          display:flex; align-items:center; justify-content:center;
          min-width:18px; height:18px; padding:0 4px; border-radius:999px;
          font-size:10px; font-weight:800; color:#fff;
          background:#dc2626; border:2px solid #fff8ef;
          box-shadow:0 2px 5px rgba(239,68,68,.4);
          animation:nb-pop .3s cubic-bezier(.34,1.56,.64,1);
        }
        .nb-ba  { position:absolute; top:3px; right:3px; }
        .nb-bi2 { margin-left:auto; }

        .nb-drop {
          width:380px; background:#fffdf8; border-radius:22px;
          border:1px solid #e8e0d4;
          box-shadow:0 18px 42px rgba(26,18,9,.22);
          display:flex; flex-direction:column; overflow:hidden;
          animation:nb-in .2s cubic-bezier(.22,1,.36,1);
        }

        .nb-hd {
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 18px 14px;
          background:linear-gradient(135deg,#1a1209 0%, #2a1d11 55%, #3a2817 100%);
          flex-shrink:0;
        }
        .nb-hl { display:flex; align-items:center; gap:10px; }
        .nb-hi {
          width:32px; height:32px; border-radius:9px;
          background:rgba(247,149,63,.22);
          display:flex; align-items:center; justify-content:center;
        }
        .nb-ht  { font-size:16px; font-weight:700; color:#fff9ef; letter-spacing:-.2px; }
        .nb-hs  { font-size:11px; color:#f6d5b8; margin-top:1px; }
        .nb-pill{
          display:inline-flex; align-items:center; gap:4px;
          padding:2px 7px; border-radius:999px;
          background:rgba(247,149,63,.22); color:#ffe2ca;
          font-size:11px; font-weight:600;
        }
        .nb-dot { width:5px; height:5px; border-radius:50%; background:#ffe2ca; }

        .nb-mb {
          display:flex; align-items:center; gap:5px;
          padding:6px 11px; border-radius:8px;
          border:1.5px solid rgba(255,255,255,.26);
          background:rgba(255,255,255,.12); color:#fff4e8;
          font-size:12px; font-weight:600;
          cursor:pointer; font-family:inherit; white-space:nowrap;
          transition:background 0.15s;
        }
        .nb-mb:hover:not(:disabled){ background:rgba(255,255,255,.2); }
        .nb-mb:disabled{ opacity:.5; cursor:not-allowed; }

        .nb-list{
          flex:1; overflow-y:auto;
          scrollbar-width:thin; scrollbar-color:#eadfce transparent;
        }
        .nb-list::-webkit-scrollbar{ width:3px; }
        .nb-list::-webkit-scrollbar-thumb{ background:#eadfce; border-radius:4px; }

        .nb-sl{
          padding:10px 16px 3px;
          font-size:10px; font-weight:700;
          color:#b97a4f; letter-spacing:.09em; text-transform:uppercase;
        }
        .nb-iw  { padding:6px 10px; }
        .nb-div { height:1px; background:#efe7dc; margin:0 14px; }

        .nb-empty{
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:44px 24px; gap:10px; text-align:center;
        }
        .nb-ei{
          width:60px; height:60px; border-radius:18px; background:#f3ede4;
          display:flex; align-items:center; justify-content:center; color:#9d907f;
        }
        .nb-et{ font-size:15px; font-weight:700; color:#1a1209; }
        .nb-es{ font-size:13px; color:#7c6f61; line-height:1.5; max-width:210px; }

        .nb-ld{
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:44px 24px; gap:10px;
        }
        .nb-sp{ animation:nb-spin .9s linear infinite; color:#f7953f; }
        .nb-lt{ font-size:13px; color:#7c6f61; }

        .nb-ft{
          padding:11px 12px; border-top:1px solid #efe7dc;
          background:#fffdfa; flex-shrink:0;
        }
        .nb-vb{
          display:flex; align-items:center; justify-content:center; gap:5px;
          width:100%; padding:10px 16px; border-radius:12px;
          border:1.5px solid #eadfce; background:#fff;
          color:#6b5e4e; font-size:13px; font-weight:700;
          cursor:pointer; font-family:inherit;
          transition:background 0.15s, box-shadow 0.15s;
        }
        .nb-vb:hover{ background:#f6f1e8; box-shadow:0 2px 8px rgba(26,18,9,.08); }
      `}</style>

      {/* Anchor element — just holds the button */}
      <div ref={buttonRef} style={{ width: '100%' }}>
        <button
          onClick={handleBellClick}
          className={`nb-btn${collapsed ? ' c' : ''}${showDropdown ? ' on' : ''}`}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell size={18} className="nb-bi" style={{ flexShrink: 0 }} />
          {!collapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <span className={`nb-badge ${collapsed ? 'nb-ba' : 'nb-bi2'}`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown — fixed-positioned so it escapes sidebar overflow/clip */}
      {showDropdown && (
        <div ref={dropdownRef} className="nb-drop" style={dropdownStyle}>
          {/* Header */}
          <div className="nb-hd">
            <div className="nb-hl">
              <div className="nb-hi"><Bell size={15} color="#fff" /></div>
              <div>
                <div className="nb-ht">Notifications</div>
                <div className="nb-hs">
                  {unreadCount > 0 ? (
                    <span className="nb-pill">
                      <span className="nb-dot" />
                      {unreadCount} unread
                    </span>
                  ) : "You're all caught up"}
                </div>
              </div>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} disabled={markingAll} className="nb-mb">
                {markingAll
                  ? <Loader2 size={12} className="nb-sp" />
                  : <CheckCheck size={12} />}
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="nb-list">
            {loading && notifications.length === 0 ? (
              <div className="nb-ld">
                <Loader2 size={26} className="nb-sp" />
                <span className="nb-lt">Loading…</span>
              </div>
            ) : notifications.length === 0  || !notifications.some((n) => !n.is_read) ? (
              <div className="nb-empty">
                <div className="nb-ei"><BellOff size={26} /></div>
                <div className="nb-et">Nothing here yet</div>
                <div className="nb-es">We'll notify you when something important comes in.</div>
              </div>
            ) : (
              <>
                {notifications.some((n) => !n.is_read) && (
                  <div className="nb-sl">New</div>
                )}
                {notifications.map((notification, index)  => (!notification.is_read) && (
                  <div key={notification.id}>
                    <div className="nb-iw">
                      <NotificationItem
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                        compact={true}
                      />
                    </div>
                    {index < notifications.length - 1 && <div className="nb-div" />}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="nb-ft">
              <button onClick={handleViewAll} className="nb-vb">
                View all notifications <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default NotificationBell;