import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, CheckCircle, Star } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import Card from './Card';
import Button from './Button';

const CourseCard = ({ course, progress }) => {
  const navigate = useNavigate();
  const { toggleCourseStar } = useCourses();
  const [isStarring, setIsStarring] = useState(false);
  const isCompleted = progress?.percentage === 100;

  const handleStarToggle = async (e) => {
    e.stopPropagation(); // Prevent card click
    setIsStarring(true);
    await toggleCourseStar(course.id);
    setIsStarring(false);
  };

  return (
    <Card 
     onClick={() => navigate(`/employee/course/${course.id}`)}
      padding="none" 
      shadow="md" 
      hover={true}
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
        <div className="absolute right-3 top-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#78BE20] px-3 py-1 text-xs font-semibold text-white shadow-md">
              <CheckCircle size={14} />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#00ADEF] px-3 py-1 text-xs font-semibold text-white shadow-md">
              <Clock size={14} />
              In Progress
            </span>
          )}
        </div>

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

        {/* Progress Bar */}
        {progress && (
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

        {/* View Course Button */}
        {/* <Button
          onClick={() => navigate(`/employee/course/${course.id}`)}
          variant="primary"
          size="md"
          fullWidth={true}
        >
          View Course
        </Button> */}
      </div>
    </Card>
  );
};

export default CourseCard;