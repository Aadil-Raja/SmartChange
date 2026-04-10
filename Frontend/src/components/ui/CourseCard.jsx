import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, MoreVertical, Star, UserPlus, UserMinus } from 'lucide-react';

const COURSE_EMOJIS = ['BOOK', 'TARGET', 'IDEA', 'SCIENCE', 'TOOLS', 'CHART', 'GLOBE', 'BRAIN', 'BOLT', 'ROCKET'];
const getEmoji = (id) => {
  const map = {
    BOOK: '📚',
    TARGET: '🎯',
    IDEA: '💡',
    SCIENCE: '🔬',
    TOOLS: '🛠️',
    CHART: '📊',
    GLOBE: '🌐',
    BRAIN: '🧠',
    BOLT: '⚡',
    ROCKET: '🚀',
  };
  const key = COURSE_EMOJIS[(id || 0) % COURSE_EMOJIS.length];
  return map[key] || '📚';
};

const CourseCard = ({
  course,
  progress,
  variant,
  showActions = false,
  onToggleStar,
  onEnroll,
  onUnenroll,
}) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }

    return undefined;
  }, [menuOpen]);

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Recently added';
    return new Date(dateValue).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusMeta = () => {
    const category = variant || course.category;

    if (category === 'completed') {
      return { label: 'Completed', style: { background: '#e6f4f1', color: '#0d9488' }, dot: '#0d9488' };
    }
    if (category === 'in_progress') {
      return { label: 'In Progress', style: { background: '#fff4e8', color: '#b45309' }, dot: '#f59e0b' };
    }
    if (category === 'expired') {
      return { label: 'Expired', style: { background: '#fee2e2', color: '#b91c1c' }, dot: '#ef4444' };
    }
    if (category === 'starred') {
      return { label: 'Starred', style: { background: '#fff8e8', color: '#b45309' }, dot: '#f59e0b' };
    }
    if (category === 'not_enrolled') {
      return { label: 'Not Enrolled', style: { background: '#f0ede8', color: '#78716c' }, dot: '#9ca3af' };
    }
    return { label: 'Active', style: { background: '#e6f4f1', color: '#0d9488' }, dot: '#0d9488' };
  };

  const status = getStatusMeta();
  const isStarred = Boolean(course.is_starred);
  const isEnrolled = course.is_enrolled !== undefined
    ? Boolean(course.is_enrolled)
    : course.category !== 'not_enrolled';

  const handleNavigate = () => {
    navigate(`/employee/course/${course.id}`);
  };

  const handleStarAction = async (e) => {
    e.stopPropagation();
    if (!onToggleStar || actionLoading) return;

    setActionLoading(true);
    try {
      await onToggleStar(course.id);
      setMenuOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnrollAction = async (e) => {
    e.stopPropagation();
    if (actionLoading) return;

    if (isEnrolled && !onUnenroll) return;
    if (!isEnrolled && !onEnroll) return;

    setActionLoading(true);
    try {
      if (isEnrolled) {
        if (!window.confirm('Are you sure you want to unenroll? This will delete your progress and quiz attempts for this course.')) {
          return;
        }
        await onUnenroll(course.id);
      } else {
        await onEnroll(course.id);
      }
      setMenuOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="rounded-[24px] border overflow-hidden cursor-pointer transition-all duration-200 bg-white"
      style={{
        borderColor: '#e8e0d4',
        boxShadow: hovered
          ? '0 12px 32px rgba(26,18,9,0.13)'
          : '0 2px 8px rgba(26,18,9,0.06)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleNavigate}
    >
      {/* Cover Area */}
      <div className="relative h-44 flex items-center justify-center overflow-hidden" style={{ background: '#fff1e4' }}>
        <div
          className="absolute -top-6 -left-6 w-24 h-24 rounded-full"
          style={{ background: 'rgba(245,130,32,0.12)' }}
        />
        <div
          className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full"
          style={{ background: 'rgba(245,130,32,0.08)' }}
        />

        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl select-none z-10">{getEmoji(course.id)}</span>
        )}

        {showActions && onToggleStar && (
          <button
            className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10"
            style={{
              background: isStarred ? '#f59e0b' : 'rgba(255,255,255,0.95)',
              color: isStarred ? '#ffffff' : '#9c8e80',
              boxShadow: '0 4px 12px rgba(26,18,9,0.18)',
            }}
            onClick={handleStarAction}
            onMouseEnter={(e) => {
              if (!isStarred) {
                e.currentTarget.style.background = '#fff7e6';
                e.currentTarget.style.color = '#f59e0b';
              }
            }}
            onMouseLeave={(e) => {
              if (!isStarred) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                e.currentTarget.style.color = '#9c8e80';
              }
            }}
            disabled={actionLoading}
            title={isStarred ? 'Unstar course' : 'Star course'}
            aria-label={isStarred ? 'Unstar course' : 'Star course'}
          >
            <Star size={16} className={isStarred ? 'fill-current' : ''} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={status.style}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>

          {showActions && (onToggleStar || onEnroll || onUnenroll) && (
            <div className="relative" ref={menuRef}>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                style={{ background: '#f3ede4', color: '#6b5e4e' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2c8';
                  e.currentTarget.style.color = '#f7953f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3ede4';
                  e.currentTarget.style.color = '#6b5e4e';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                title="Course actions"
                aria-label="Course actions"
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-44 rounded-xl border bg-white py-1 z-20"
                  style={{ borderColor: '#e8e0d4', boxShadow: '0 16px 28px rgba(26,18,9,0.14)' }}
                  onClick={(e) => e.stopPropagation()}
                >
       

                  {(onEnroll || onUnenroll) && (
                    <button
                      disabled={actionLoading}
                      onClick={handleEnrollAction}
                      className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                      style={{ color: isEnrolled ? '#dc2626' : '#15803d' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isEnrolled ? '#fff5f5' : '#f0fdf4'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {actionLoading ? (
                        <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      ) : isEnrolled ? <UserMinus size={15} /> : <UserPlus size={15} />}
                      {actionLoading ? (isEnrolled ? 'Unenrolling…' : 'Enrolling…') : isEnrolled ? 'Unenroll from Course' : 'Enroll in Course'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <h3
          className="text-xl font-bold leading-snug mb-2 line-clamp-2"
          style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}
        >
          {course.title}
        </h3>

        {course.description && <p className="text-sm line-clamp-2 mb-4" style={{ color: '#7c6f61' }}>{course.description}</p>}

        {progress && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs" style={{ color: '#847768' }}>
              <span>Completion</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#efe5d7' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%`, background: 'linear-gradient(90deg, #f2b44d 0%, #f7953f 55%, #e0741c 100%)' }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: '#9b8c7b' }}>{formatDate(course.created_at || course.enrolled_at)}</span>
            {(variant || course.category) === 'in_progress' && course.deadline_at && (
              <span className="text-xs font-medium" style={{ color: course.days_remaining <= 7 ? '#dc2626' : course.days_remaining <= 15 ? '#b45309' : '#6b7280' }}>
                Due {formatDate(course.deadline_at)}
                {course.days_remaining != null && ` · ${course.days_remaining}d left`}
              </span>
            )}
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: arrowHovered ? '#f7953f' : '#1a1209',
            }}
            onMouseEnter={() => setArrowHovered(true)}
            onMouseLeave={() => setArrowHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate();
            }}
            title="View course"
          >
            <ArrowUpRight size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;