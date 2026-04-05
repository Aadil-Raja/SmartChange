import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourses } from '../../hooks/useCourses';
import CourseContentPreview from '../../components/ui/CourseContentPreview';
import MarkAsDoneButton from '../../components/ui/MarkAsDoneButton';
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  Loader2,
  HelpCircle,
  Lock,
  Clock,
  Trophy,
  AlertCircle,
  FileText,
  Video,
  Link as LinkIcon,
  MoreVertical,
  LogOut,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

const COURSE_EMOJIS = ['📚', '🎯', '💡', '🔬', '🛠️', '📊', '🌐', '🧠', '⚡', '🚀'];
const getEmoji = (id) => COURSE_EMOJIS[(id || 0) % COURSE_EMOJIS.length];

/* ─── Quiz status config ─── */
const QUIZ_STATUS = {
  can_take: {
    icon: PlayCircle,
    iconColor: '#fff',
    label: 'Available',
    pill: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    btn: { bg: '#1a1209', color: '#faf6ef', hover: '#2d1f0e', label: 'Take Quiz', icon: PlayCircle },
    cardBorder: '#d1fae5',
    cardAccent: '#f0fdf4',
  },
  locked: {
    icon: Lock,
    iconColor: '#9c8e80',
    label: 'Locked',
    pill: { bg: '#f3ede4', color: '#9c8e80', border: '#e0d8ce' },
    btn: { bg: '#f3ede4', color: '#9c8e80', hover: '#e8e0d4', label: 'Locked', icon: Lock },
    cardBorder: '#e8e0d4',
    cardAccent: '#faf6ef',
  },
  completed: {
    icon: ShieldCheck,
    iconColor: '#d97706',
    label: 'Passed',
    pill: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    btn: { bg: '#f0fdf4', color: '#15803d', hover: '#dcfce7', label: 'Passed', icon: ShieldCheck },
    cardBorder: '#fde68a',
    cardAccent: '#fffbeb',
  },
  cooldown: {
    icon: Clock,
    iconColor: '#2563eb',
    label: 'Cooldown',
    pill: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    btn: { bg: '#eff6ff', color: '#2563eb', hover: '#dbeafe', label: 'On Cooldown', icon: Clock },
    cardBorder: '#bfdbfe',
    cardAccent: '#eff6ff',
  },
  in_cooldown: {
    icon: Clock,
    iconColor: '#2563eb',
    label: 'Cooldown',
    pill: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    btn: { bg: '#eff6ff', color: '#2563eb', hover: '#dbeafe', label: 'On Cooldown', icon: Clock },
    cardBorder: '#bfdbfe',
    cardAccent: '#eff6ff',
  },
  max_attempts_reached: {
    icon: Lock,
    iconColor: '#dc2626',
    label: 'No Attempts Left',
    pill: { bg: '#fff1f0', color: '#dc2626', border: '#fca5a5' },
    btn: { bg: '#fff1f0', color: '#dc2626', hover: '#fee2e2', label: 'No Attempts Left', icon: Lock },
    cardBorder: '#fca5a5',
    cardAccent: '#fff1f0',
  },
};

const getQuizStatus = (status) => QUIZ_STATUS[status] || {
  icon: AlertCircle,
  iconColor: '#9c8e80',
  label: 'Unknown',
  pill: { bg: '#f3ede4', color: '#9c8e80', border: '#e0d8ce' },
  btn: { bg: '#f3ede4', color: '#9c8e80', hover: '#e8e0d4', label: 'Unavailable', icon: AlertCircle },
  cardBorder: '#e8e0d4',
  cardAccent: '#faf6ef',
};

const CourseContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedCourse,
    loading,
    error,
    fetchCourseDetails,
    getItemProgress,
    isItemCompleted,
    unenrollFromCourse,
    enrollInCourse,
  } = useCourses();

  const contentRefs = useRef({});
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeTab, setActiveTab] = useState('content');
  const [showMenu, setShowMenu] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const menuRef = useRef(null);
  const hasFetchedCourse = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleUnenroll = async () => {
    setShowMenu(false);
    if (!window.confirm('Are you sure you want to unenroll? This will delete all your progress and quiz attempts for this course.')) return;
    setIsUnenrolling(true);
    const result = await unenrollFromCourse(parseInt(id));
    setIsUnenrolling(false);
    if (result.success) navigate('/employee/mycourses');
  };

  const scrollToItem = (itemId) => {
    const el = contentRefs.current[itemId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveItemId(itemId);
      setTimeout(() => setActiveItemId(null), 2000);
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'document': return <FileText size={16} style={{ color: '#00ADEF' }} />;
      case 'video': return <Video size={16} style={{ color: '#f7953f' }} />;
      case 'link': return <LinkIcon size={16} style={{ color: '#78BE20' }} />;
      default: return <FileText size={16} style={{ color: '#9c8e80' }} />;
    }
  };

  useEffect(() => {
    if (id && hasFetchedCourse.current !== id) {
      hasFetchedCourse.current = id;
      fetchCourseDetails(parseInt(id));
    }
  }, [id]);

  /* ─── Loading / Error states ─── */
  if (loading && !selectedCourse) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf6ef' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#f7953f' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf6ef' }}>
        <div className="rounded-2xl border px-8 py-10 text-center" style={{ background: '#fff5f5', borderColor: '#fecaca', maxWidth: 400 }}>
          <p className="text-lg font-semibold" style={{ color: '#991b1b' }}>{error}</p>
          <button
            onClick={() => navigate('/employee/mycourses')}
            className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white"
            style={{ background: '#dc2626' }}
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  if (!selectedCourse) return null;

  const isCorrectCourse = selectedCourse.id === parseInt(id);
  const showLoadingOverlay = loading || !isCorrectCourse;
  const isEnrolled = selectedCourse.is_enrolled !== false;
  const isCourseCompleted = selectedCourse.enrollment_status === 'completed';

  return (
    <div className="min-h-screen" style={{ background: '#faf6ef' }}>
      {showLoadingOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(250,246,239,0.92)' }}>
          <div className="text-center">
            <Loader2 size={44} className="animate-spin mx-auto mb-4" style={{ color: '#f7953f' }} />
            <p style={{ color: '#6b5e4e', fontWeight: 600 }}>Loading course…</p>
          </div>
        </div>
      )}

      {/* ── Sticky top nav ── */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #e8e0d4' }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm">
            <button
              onClick={() => navigate('/employee/mycourses')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium transition-all"
              style={{ borderColor: '#e0d8ce', color: '#6b5e4e', background: 'white' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f7953f'; e.currentTarget.style.color = '#f7953f'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d8ce'; e.currentTarget.style.color = '#6b5e4e'; }}
            >
              <ArrowLeft size={13} /> Courses
            </button>
            <ChevronRight size={14} style={{ color: '#c4b8a8' }} />
            <span className="font-semibold truncate max-w-xs" style={{ color: '#1a1209' }}>{selectedCourse.title}</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedCourse.department && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#fff0e8', color: '#E0741C', border: '1px solid #fcd9b8' }}>
                {selectedCourse.department}
              </span>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: '#f3ede4', color: '#6b5e4e' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2c8'; e.currentTarget.style.color = '#f7953f'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f3ede4'; e.currentTarget.style.color = '#6b5e4e'; }}
              >
                <MoreVertical size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-white py-1 z-20" style={{ borderColor: '#e8e0d4', boxShadow: '0 16px 28px rgba(26,18,9,0.14)' }}>
                  {isEnrolled ? (
                  <button
                    onClick={handleUnenroll}
                    disabled={isUnenrolling}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                    style={{ color: '#dc2626' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut size={16} />
                    {isUnenrolling ? 'Unenrolling…' : 'Unenroll from Course'}
                  </button>
                  ) : (
                  <button
                    onClick={async () => { setShowMenu(false); await enrollInCourse(parseInt(id)); fetchCourseDetails(parseInt(id)); }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                    style={{ color: '#f7953f' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut size={16} />
                    Enroll in Course
                  </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Course Hero Card ── */}
        <div className="bg-white rounded-[24px] overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 24px rgba(26,18,9,0.08)' }}>
          <div className="relative h-52 flex items-center justify-center overflow-hidden" style={{ background: '#1a1209' }}>
            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full border-2 opacity-10" style={{ borderColor: '#faf6ef' }} />
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border-2 opacity-10" style={{ borderColor: '#faf6ef' }} />
            <div className="absolute top-8 right-24 w-20 h-20 rounded-full border opacity-10" style={{ borderColor: '#f7953f' }} />
            {selectedCourse.thumbnail_url
              ? <img src={selectedCourse.thumbnail_url} alt={selectedCourse.title} className="w-full h-full object-cover absolute inset-0" />
              : <span className="text-7xl select-none z-10">{getEmoji(selectedCourse.id)}</span>}
          </div>
          <div className="px-8 py-6">
            <h1 className="text-3xl font-extrabold mb-3 leading-tight" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>
              {selectedCourse.title}
            </h1>
            {selectedCourse.description && (
              <p className="text-sm mb-4" style={{ color: '#6b5e4e' }}>{selectedCourse.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <StatChip icon={<FileText size={14} />} value={selectedCourse.items?.length || 0} label="Content Items" tint="orange" />
              <StatChip icon={<HelpCircle size={14} />} value={selectedCourse.quizzes?.length || 0} label="Quizzes" tint="teal" />
              <StatChip icon={<CheckCircle size={14} />} value={selectedCourse.items ? selectedCourse.items.filter(i => isItemCompleted(i.id)).length : 0} label="Completed" tint="neutral" />
            </div>
          </div>
        </div>

        {/* ── Course Completed Banner ── */}
        {isCourseCompleted && (
          <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
            <span style={{ fontSize: 24 }}>🎓</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>Course completed</p>
              <p className="text-xs" style={{ color: '#16a34a' }}>You've finished all content and quizzes. Great work!</p>
            </div>
          </div>
        )}

        {/* ── Enroll Banner (shown when not enrolled) ── */}
        {!isEnrolled && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border" style={{ background: '#fff7ed', borderColor: '#fcd9b8' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 22 }}>👀</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#92400e' }}>You're previewing this course</p>
                <p className="text-xs" style={{ color: '#b45309' }}>Enroll to track progress, mark items complete, and take quizzes.</p>
              </div>
            </div>
            <button
              onClick={async () => { await enrollInCourse(parseInt(id)); fetchCourseDetails(parseInt(id)); }}
              className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold text-white transition-all"
              style={{ background: '#f7953f' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e0741c'}
              onMouseLeave={e => e.currentTarget.style.background = '#f7953f'}
            >
              Enroll Now
            </button>
          </div>
        )}

        {/* ── Content + Quizzes ── */}
        <SectionCard
          title="Course Journey"
          subtitle="Complete content items to unlock and pass quizzes"
          actions={
            <div className="flex rounded-full p-1 gap-1" style={{ background: '#e8e0d4' }}>
              {[
                { key: 'content', label: `Content (${selectedCourse.items?.length || 0})` },
                { key: 'quizzes', label: `Quizzes (${selectedCourse.quizzes?.length || 0})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                  style={activeTab === tab.key
                    ? { background: '#705536', color: '#faf6ef' }
                    : { color: '#6b5e4e', background: 'transparent' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        >
          {/* ── Content Tab ── */}
          {activeTab === 'content' ? (
            selectedCourse.items?.length > 0 ? (
              <div className="space-y-3">
                {selectedCourse.items.map((item, index) => {
                  const itemProgress = getItemProgress(selectedCourse.id, item.id);
                  const isCompleted = isItemCompleted(item.id);
                  const progressPercent = itemProgress?.progress || 0;

                  return (
                    <div
                      key={item.id}
                      ref={el => (contentRefs.current[item.id] = el)}
                      className="rounded-2xl border overflow-hidden transition-all"
                      style={{
                        borderColor: activeItemId === item.id ? '#f7953f' : '#e8e0d4',
                        boxShadow: activeItemId === item.id ? '0 0 0 3px rgba(247,149,63,0.15)' : '0 1px 4px rgba(26,18,9,0.05)',
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#faf6ef', borderBottom: '1px solid #ede8e0' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#fff0e8', color: '#E0741C' }}>
                          {index + 1}
                        </span>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5f0ea' }}>
                          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover rounded-xl" /> : getContentIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: '#1a1209' }}>{item.title}</p>
                          {item.description && <p className="text-xs truncate" style={{ color: '#9c8e80' }}>{item.description}</p>}
                        </div>
                        <TypeBadge type={item.type} />
                        {isCompleted && <CheckCircle size={16} style={{ color: '#78BE20', flexShrink: 0 }} />}
                      </div>
                      <div className="p-3">
                        <div className="mb-3">
                          <CourseContentPreview item={item} />
                        </div>
                        {item.type === 'video' && progressPercent > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: '#9c8e80' }}>Progress</span>
                              <span className="text-xs font-semibold" style={{ color: '#f7953f' }}>{Math.round(progressPercent)}%</span>
                            </div>
                            <div className="w-full rounded-full h-1.5" style={{ background: '#ede8e0' }}>
                              <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%`, background: '#f7953f' }} />
                            </div>
                          </div>
                        )}
                        {itemProgress?.last_viewed_at && (
                          <p className="text-xs mb-3" style={{ color: '#9c8e80' }}>
                            Last viewed: {new Date(itemProgress.last_viewed_at).toLocaleDateString()}
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                          <MarkAsDoneButton itemId={item.id} itemType={item.type} isCompleted={isCompleted} progress={progressPercent} disabled={!isEnrolled} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<FileText size={40} style={{ color: '#f7953f' }} />} title="No content yet" sub="No content items available in this course." />
            )

          ) : (
            /* ── Quizzes Tab ── */
            selectedCourse.quizzes?.length > 0 ? (
              <div className="space-y-3">
                {selectedCourse.quizzes.map((quiz, index) => {
                  const s = getQuizStatus(quiz.status);
                  const StatusIcon = s.icon;
                  const BtnIcon = s.btn.icon;
                  const canTake = quiz.status === 'can_take';
                  const isDisabled = !canTake;
                  const missingPrereqIds = quiz.missing_prerequisites || [];
                  const missingPrereqItems = missingPrereqIds
                    .map((prereqId) => selectedCourse.items?.find((item) => item.id === prereqId))
                    .filter(Boolean);
                  const unresolvedPrereqIds = missingPrereqIds.filter(
                    (prereqId) => !missingPrereqItems.some((item) => item.id === prereqId)
                  );

                  return (
                    <div
                      key={quiz.id}
                      className="rounded-2xl border overflow-hidden transition-all"
                      style={{
                        borderColor: s.cardBorder,
                        background: '#fff',
                        boxShadow: canTake ? '0 2px 12px rgba(26,18,9,0.08)' : '0 1px 4px rgba(26,18,9,0.04)',
                      }}
                    >
                      {/* Card header accent strip */}
                      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${s.cardBorder}`, background: s.cardAccent }}>
                        {/* Index */}
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: s.pill.bg, color: s.pill.color, border: `1px solid ${s.pill.border}` }}>
                          {index + 1}
                        </span>

                        {/* Quiz icon circle */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: s.pill.bg, border: `1.5px solid ${s.pill.border}` }}>
                          <StatusIcon size={15} style={{ color: s.pill.color }} />
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold" style={{ color: '#1a1209' }}>{quiz.title}</p>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: s.pill.bg, color: s.pill.color, border: `1px solid ${s.pill.border}` }}>
                              {s.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs" style={{ color: '#9c8e80' }}>
                              Attempts: <span className="font-semibold" style={{ color: '#6b5e4e' }}>{quiz.attempts_remaining}/3</span>
                            </span>
                            {quiz.best_score !== null && quiz.best_score !== undefined && (
                              <span className="text-xs" style={{ color: '#9c8e80' }}>
                                Best: <span className="font-semibold" style={{ color: '#d97706' }}>{quiz.best_score}%</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                        {/* Left: prerequisite / cooldown info */}
                        <div className="flex-1 min-w-0">
                          {quiz.status === 'locked' && missingPrereqIds.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <Lock size={13} style={{ color: '#9c8e80', marginTop: 2, flexShrink: 0 }} />
                                <p className="text-xs" style={{ color: '#9c6a3a' }}>
                                  Complete {missingPrereqIds.length} prerequisite{missingPrereqIds.length !== 1 ? 's' : ''} to unlock this quiz
                                </p>
                              </div>

                              {(missingPrereqItems.length > 0 || unresolvedPrereqIds.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 ml-5">
                                  {missingPrereqItems.map((item) => (
                                    <span
                                      key={item.id}
                                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ background: '#fff5ea', color: '#9c6a3a', border: '1px solid #fcd9b8' }}
                                    >
                                      {(item.type || 'content').charAt(0).toUpperCase() + (item.type || 'content').slice(1)}: {item.title}
                                    </span>
                                  ))}
                                  {unresolvedPrereqIds.map((prereqId) => (
                                    <span
                                      key={prereqId}
                                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ background: '#f3ede4', color: '#9c8e80', border: '1px solid #e0d8ce' }}
                                    >
                                      Content #{prereqId}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {(quiz.status === 'cooldown' || quiz.status === 'in_cooldown') && quiz.next_attempt_at && (
                            <div className="flex items-start gap-2">
                              <Clock size={13} style={{ color: '#2563eb', marginTop: 2, flexShrink: 0 }} />
                              <p className="text-xs" style={{ color: '#2563eb' }}>
                                Next attempt available: <span className="font-semibold">{new Date(quiz.next_attempt_at).toLocaleString()}</span>
                              </p>
                            </div>
                          )}
                          {quiz.status === 'completed' && (
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={13} style={{ color: '#15803d' }} />
                              <p className="text-xs font-medium" style={{ color: '#15803d' }}>Quiz passed</p>
                            </div>
                          )}
                          {quiz.status === 'can_take' && (
                            <div className="flex items-center gap-2">
                              <CheckCircle size={13} style={{ color: '#15803d' }} />
                              <p className="text-xs font-medium" style={{ color: '#15803d' }}>
                                {(quiz.prerequisite_content_ids?.length || 0) === 0
                                  ? "No prerequisites — ready to attempt"
                                  : "All prerequisites met — you're ready to attempt"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: CTA button — hidden for passed quizzes */}
                        {quiz.status !== 'completed' && (
                          <button
                            disabled={isDisabled || !isEnrolled}
                            onClick={() => { if (canTake && isEnrolled) navigate(`/employee/quiz/${quiz.id}`); }}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0"
                            style={{
                              background: (!isEnrolled || isDisabled) ? '#f3ede4' : s.btn.bg,
                              color: (!isEnrolled || isDisabled) ? '#b0a090' : s.btn.color,
                              cursor: (!isEnrolled || isDisabled) ? 'not-allowed' : 'pointer',
                              border: (canTake && isEnrolled) ? 'none' : `1px solid ${s.cardBorder}`,
                              opacity: (!isEnrolled || isDisabled) ? 0.7 : 1,
                              minWidth: 100,
                              justifyContent: 'center',
                            }}
                            title={!isEnrolled ? "Enroll to take quizzes" : undefined}
                            onMouseEnter={e => { if (isEnrolled && !isDisabled) e.currentTarget.style.opacity = '0.88'; }}
                            onMouseLeave={e => { if (isEnrolled && !isDisabled) e.currentTarget.style.opacity = '1'; }}
                          >
                            <BtnIcon size={13} />
                            {!isEnrolled ? "Enroll First" : s.btn.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<HelpCircle size={40} style={{ color: '#78BE20' }} />} title="No quizzes yet" sub="Quizzes will appear here once assigned." />
            )
          )}
        </SectionCard>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */

const StatChip = ({ icon, value, label, tint }) => {
  const styles = {
    teal: { background: '#e6f4f1', color: '#0d9488' },
    orange: { background: '#fff0e8', color: '#E0741C' },
    neutral: { background: '#f3ede4', color: '#78716c' },
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={styles[tint] || styles.neutral}>
      {icon}
      <span className="font-bold">{value}</span>
      <span className="font-normal opacity-75">{label}</span>
    </div>
  );
};

const SectionCard = ({ title, subtitle, actions, children }) => (
  <div className="bg-white rounded-[20px] overflow-hidden border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(26,18,9,0.06)' }}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4" style={{ background: '#faf6ef', borderBottom: '1px solid #ede8e0' }}>
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#1a1209' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#9c8e80' }}>{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const TypeBadge = ({ type }) => {
  const map = {
    document: { label: 'Document', style: { background: '#fff0e8', color: '#E0741C', border: '1px solid #fcd9b8' } },
    video: { label: 'Video', style: { background: '#fef9e7', color: '#b45309', border: '1px solid #fde68a' } },
    link: { label: 'Link', style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' } },
  };
  const c = map[type] || { label: type, style: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' } };
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 capitalize" style={c.style}>{c.label}</span>
  );
};

const EmptyState = ({ icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: '#f3ede4' }}>{icon}</div>
    <h3 className="text-lg font-bold mb-1" style={{ color: '#1a1209' }}>{title}</h3>
    <p className="text-sm max-w-xs" style={{ color: '#9c8e80' }}>{sub}</p>
  </div>
);

export default CourseContent;