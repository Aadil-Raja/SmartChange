import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

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

const CourseCard = ({ course, progress }) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Recently added';
    return new Date(dateValue).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusMeta = () => {
    if (course.category === 'completed') {
      return { label: 'Completed', style: { background: '#e6f4f1', color: '#0d9488' }, dot: '#0d9488' };
    }
    if (course.category === 'in_progress') {
      return { label: 'In Progress', style: { background: '#fff4e8', color: '#b45309' }, dot: '#f59e0b' };
    }
    if (course.category === 'expired') {
      return { label: 'Expired', style: { background: '#fee2e2', color: '#b91c1c' }, dot: '#ef4444' };
    }
    if (course.category === 'not_enrolled') {
      return { label: 'Not Enrolled', style: { background: '#f0ede8', color: '#78716c' }, dot: '#9ca3af' };
    }
    return { label: 'Active', style: { background: '#e6f4f1', color: '#0d9488' }, dot: '#0d9488' };
  };

  const status = getStatusMeta();

  const handleNavigate = () => {
    navigate(`/employee/course/${course.id}`);
  };

  return (
    <div
      className="rounded-[20px] border border-gray-200 bg-white overflow-hidden cursor-pointer transition-all duration-200"
      style={{
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
      <div
        className="relative h-44 flex items-center justify-center overflow-hidden"
        style={{ background: '#fff0e8' }}
      >
        <div
          className="absolute -top-6 -left-6 w-24 h-24 rounded-full"
          style={{ background: 'rgba(245,130,32,0.08)' }}
        />
        <div
          className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full"
          style={{ background: 'rgba(245,130,32,0.06)' }}
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
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5">
        <div className="mb-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={status.style}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>
        </div>

        <h3
          className="text-xl font-bold leading-snug mb-2 line-clamp-2"
          style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}
        >
          {course.title}
        </h3>

        {course.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-4">{course.description}</p>
        )}

        {progress && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%`, background: '#f7953f' }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(course.created_at || course.enrolled_at)}</span>
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