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
    videos,
    externalLinks,
    loading, 
    error, 
    fetchCourseDetails,
    fetchVideos,
    fetchExternalLinks,
    getVideoById,
    getExternalLinkById,
    completedItems,
    courseItemsProgress,
    getItemProgress,
    isItemCompleted
  } = useCourses();

  useEffect(() => {
    if (id) {
      fetchCourseDetails(parseInt(id));
      // Also fetch videos and external links for content resolution
      fetchVideos();
      fetchExternalLinks();
    }
  }, [id]);

  
  // Loading State
  if (loading && !selectedCourse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6">
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
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6">
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

  // Function to enhance course items with actual URLs
  const enhanceItemWithUrl = (item) => {
    let enhancedItem = { ...item };
    
    console.log('CourseContent: Enhancing item:', item);
    console.log('CourseContent: Available videos:', videos.length);
    console.log('CourseContent: Available links:', externalLinks.length);
    
    switch (item.type) {
      case 'video':
        if (item.video_id) {
          const video = getVideoById(item.video_id);
          console.log('CourseContent: Found video for ID', item.video_id, ':', video);
          if (video) {
            enhancedItem.url = video.secure_url || video.cloudinary_url;
            enhancedItem.thumbnail_url = video.thumbnail_url;
            enhancedItem.duration_sec = video.duration_sec;
          }
        }
        break;
      case 'link':
        if (item.external_link_id) {
          const link = getExternalLinkById(item.external_link_id);
          console.log('CourseContent: Found link for ID', item.external_link_id, ':', link);
          if (link) {
            enhancedItem.url = link.url;
          }
        }
        break;
      case 'document':
        // Document URLs should already be available from the course API
        // No additional enhancement needed
        break;
      default:
        break;
    }
    
    console.log('CourseContent: Enhanced item:', enhancedItem);
    return enhancedItem;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <button
          onClick={() => navigate('/employee/mycourses')}
          className="mb-6 flex items-center gap-2 text-gray-600 transition-colors hover:text-[#FDB913] font-medium"
        >
          <ArrowLeft size={20} />
          <span>Back to Courses</span>
        </button>

        {/* Course Info */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm p-6 shadow-lg">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">
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
            selectedCourse.items.map((item, index) => {
              const enhancedItem = enhanceItemWithUrl(item);
              const itemProgress = getItemProgress(selectedCourse.id, item.id);
              const isCompleted = isItemCompleted(item.id);
              const progressPercent = itemProgress?.progress || 0;
              
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm p-6 shadow-lg">
                  {/* Item Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                        {isCompleted && (
                          <CheckCircle size={20} className="text-green-600" />
                        )}
                      </div>
                      {item.description && (
                        <p className="ml-11 text-sm text-gray-600">{item.description}</p>
                      )}
                      
                      {/* Progress Bar for Videos */}
                      {item.type === 'video' && progressPercent > 0 && (
                        <div className="ml-11 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-[#FDB913] to-[#F58220] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 font-medium">
                              {Math.round(progressPercent)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium uppercase text-gray-700">
                        {item.type}
                      </span>
                      {itemProgress?.last_viewed_at && (
                        <span className="text-xs text-gray-500">
                          Last viewed: {new Date(itemProgress.last_viewed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div className="mb-4">
                    <CourseContentPreview item={enhancedItem} />
                  </div>

                  {/* Mark as Done Button */}
                  <MarkAsDoneButton 
                    itemId={item.id} 
                    itemType={item.type}
                    isCompleted={isCompleted}
                    progress={progressPercent}
                  />
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm p-12 text-center shadow-lg">
              <p className="text-gray-600 font-medium">No modules available for this course</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseContent;