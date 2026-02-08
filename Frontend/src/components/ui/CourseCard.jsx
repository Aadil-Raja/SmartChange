import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, CheckCircle, Star, XCircle, PlayCircle, MoreVertical, LogOut } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import Card from './Card';
import Button from './Button';

const CourseCard = ({ course, progress }) => {
  const navigate = useNavigate();
  const { toggleCourseStar, enrollInCourse, unenrollFromCourse } = useCourses();
  const [isStarring, setIsStarring] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  
  const isCompleted = course.category === 'completed';
  const isExpired = course.category === 'expired';
  const isNotEnrolled = course.category === 'not_enrolled';
  const isInProgress = course.category === 'in_progress';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleStarToggle = async (e) => {
    e.stopPropagation(); // Prevent card click
    setIsStarring(true);
    await toggleCourseStar(course.id);
    setIsStarring(false);
  };

  const handleEnroll = async (e) => {
    e.stopPropagation(); // Prevent card click
    setIsEnrolling(true);
    const result = await enrollInCourse(course.id);
    setIsEnrolling(false);
    
    if (result.success) {
      // Navigate to course after enrollment
      navigate(`/employee/course/${course.id}`);
    }
  };

  const handleUnenroll = async (e) => {
    e.stopPropagation(); // Prevent card click
    setShowMenu(false);
    
    // Confirm before unenrolling
    if (!window.confirm('Are you sure you want to unenroll? This will delete all your progress and quiz attempts for this course.')) {
      return;
    }
    
    setIsUnenrolling(true);
    const result = await unenrollFromCourse(course.id);
    setIsUnenrolling(false);
    
    if (result.success) {
      // Course list will be automatically refreshed by the context
    }
  };

  const handleCardClick = () => {
    if (isNotEnrolled) {
      // Don't navigate if not enrolled, let them click the enroll button
      return;
    }
    navigate(`/employee/course/${course.id}`);
  };

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#78BE20] px-3 py-1 text-xs font-semibold text-white shadow-md">
          <CheckCircle size={14} />
          Completed
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
          <XCircle size={14} />
          Expired
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#00ADEF] px-3 py-1 text-xs font-semibold text-white shadow-md">
          <Clock size={14} />
          In Progress
        </span>
      );
    }
    return null;
  };

  const getActionButton = () => {
    if (isNotEnrolled) {
      return (
        <Button
          onClick={handleEnroll}
          variant="primary"
          size="md"
          fullWidth={true}
          disabled={isEnrolling}
        >
          {isEnrolling ? 'Enrolling...' : (
            <>
              <PlayCircle size={16} className="mr-1" />
              Start Course
            </>
          )}
        </Button>
      );
    }
    if (isExpired) {
      return (
        <Button
          onClick={(e) => e.stopPropagation()}
          variant="secondary"
          size="md"
          fullWidth={true}
          disabled={true}
        >
          Deadline Expired
        </Button>
      );
    }
    if (isCompleted) {
      return (
        <Button
          onClick={(e) => e.stopPropagation()}
          variant="secondary"
          size="md"
          fullWidth={true}
        >
          <CheckCircle size={16} className="mr-1" />
          View Certificate
        </Button>
      );
    }
    // In progress - show continue button
    return (
      <Button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/employee/course/${course.id}`);
        }}
        variant="primary"
        size="md"
        fullWidth={true}
      >
        {progress?.percentage > 0 ? 'Continue Learning' : 'Start Learning'}
      </Button>
    );
  };

  return (
    <Card 
      onClick={handleCardClick}
      padding="none" 
      shadow="md" 
      hover={!isNotEnrolled}
      className="group overflow-hidden"
    >
      {/* Thumbnail or Placeholder */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#FDB913] to-[#F58220]">
        {course.thumbnail_url ? (
          <img 
            src={course.thumbnail_url} 
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen size={64} className="text-white opacity-50" />
          </div>
        )}
        
        {/* Status Badge */}
        {getStatusBadge() && (
          <div className="absolute right-3 top-3">
            {getStatusBadge()}
          </div>
        )}

        {/* Star Button */}
        <div className="absolute left-3 top-3">
          <button
            onClick={handleStarToggle}
            disabled={isStarring}
            className={`p-2 rounded-full shadow-md transition-all duration-200 ${
              course.is_starred
                ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                : 'bg-white/90 text-gray-600 hover:bg-white hover:text-yellow-500'
            } ${isStarring ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
            title={course.is_starred ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star 
              size={16} 
              className={course.is_starred ? 'fill-current' : ''} 
            />
          </button>
        </div>

        {/* Menu Button (for enrolled courses only) */}
        {!isNotEnrolled && (
          <div className="absolute left-3 bottom-3" ref={menuRef}>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-2 rounded-full bg-white/90 text-gray-600 hover:bg-white hover:text-gray-800 shadow-md transition-all duration-200 hover:scale-110"
                title="More options"
              >
                <MoreVertical size={16} />
              </button>
              
              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={handleUnenroll}
                    disabled={isUnenrolling}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut size={14} />
                    {isUnenrolling ? 'Unenrolling...' : 'Unenroll from Course'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="mb-2 text-xl font-bold text-[#333333]">{course.title}</h3>
        
        {course.description && (
          <p className="mb-4 line-clamp-2 text-sm text-gray-600">
            {course.description}
          </p>
        )}

        {course.department && (
          <div className="mb-4">
            <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {course.department}
            </span>
          </div>
        )}

        {/* Deadline Warning */}
        {course.deadline_at && course.category === 'in_progress' && (
          <div className={`mb-4 rounded-md px-3 py-2 text-xs ${
            course.days_remaining !== null && course.days_remaining <= 7 && course.days_remaining > 0
              ? 'bg-red-50 border border-red-200 text-red-800'
              : course.days_remaining !== null && course.days_remaining <= 14 && course.days_remaining > 7
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <Clock size={12} className="inline mr-1" />
            {course.days_remaining !== null && course.days_remaining >= 0 ? (
              <>
                {course.days_remaining === 0 ? 'Due today' : 
                 course.days_remaining === 1 ? '1 day remaining' :
                 `${course.days_remaining} days remaining`}
              </>
            ) : (
              <>Deadline: {new Date(course.deadline_at).toLocaleDateString()}</>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {progress && !isNotEnrolled && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Progress</span>
              <span className="text-gray-600">
                {progress.completed}/{progress.total} modules • {progress.percentage}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[#FDB913] to-[#F58220] transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        {getActionButton()}
      </div>
    </Card>
  );
};

export default CourseCard;