import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourses } from '../../hooks/useCourses';
import CourseContentPreview from '../../components/ui/CourseContentPreview';
import MarkAsDoneButton from '../../components/ui/MarkAsDoneButton';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';


const CourseContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    selectedCourse, 
    loading, 
    error, 
    fetchCourseDetails, 
    completedItems 
  } = useCourses();

  useEffect(() => {
    if (id) {
      fetchCourseDetails(parseInt(id));
    }
  }, [id]);

  
  // Loading State
  if (loading && !selectedCourse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={48} className="animate-spin text-[#F58220]" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg bg-red-100 p-6 text-center">
            <p className="text-lg font-semibold text-red-800">{error}</p>
            <button
              onClick={() => navigate('/employee/mycourses')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedCourse) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <button
          onClick={() => navigate('/employee/mycourses')}
          className="mb-6 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={20} />
          <span>Back to Courses</span>
        </button>

        {/* Course Info */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold text-[#333333]">
            {selectedCourse.title}
          </h1>
          {selectedCourse.description && (
            <p className="mb-4 text-gray-600">{selectedCourse.description}</p>
          )}
          
          {selectedCourse.department && (
            <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
              {selectedCourse.department}
            </span>
          )}

        </div>

        {/* Course Items/Modules */}
        <div className="space-y-6">
          {selectedCourse.items && selectedCourse.items.length > 0 ? (
            selectedCourse.items.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                {/* Item Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <h3 className="text-xl font-bold text-[#333333]">{item.title}</h3>
                      {completedItems.has(item.id) && (
                        <CheckCircle size={20} className="text-green-600" />
                      )}
                    </div>
                    {item.description && (
                      <p className="ml-11 text-sm text-gray-600">{item.description}</p>
                    )}
                  </div>
                  <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium uppercase text-gray-700">
                    {item.type}
                  </span>
                </div>

                {/* Content Preview */}
                <div className="mb-4">
                  <CourseContentPreview item={item} />
                </div>

                {/* Mark as Done Button */}
                
                <MarkAsDoneButton itemId={item.id} itemType={item.type} />
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-gray-600">No modules available for this course</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseContent;