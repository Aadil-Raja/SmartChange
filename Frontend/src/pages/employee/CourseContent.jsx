import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourses } from '../../hooks/useCourses';
import CourseContentPreview from '../../components/ui/CourseContentPreview';
import MarkAsDoneButton from '../../components/ui/MarkAsDoneButton';
import Card from '../../components/ui/Card';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';

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
      <div className="min-h-screen bg-gray-50 p-6">
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <Card variant="error" padding="lg" className="text-center">
            <p className="text-lg font-semibold text-red-800">{error}</p>
            <button
              onClick={() => navigate('/employee/mycourses')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Back to Courses
            </button>
          </Card>
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
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/employee/mycourses')}
              className="flex items-center gap-2 text-gray-600 hover:text-[#F58220] transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Courses</span>
            </button>
            <div className="flex items-center gap-3">
              {selectedCourse.department && (
                <span className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-sm font-medium text-[#F58220]">
                  {selectedCourse.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Course Hero Section */}
      <div className="relative border-b border-gray-200 overflow-hidden">
        {/* Background Image with Overlay */}
        {selectedCourse.thumbnail_url ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${selectedCourse.thumbnail_url})` }}
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white" />
        )}
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className={`text-4xl font-bold mb-4 ${selectedCourse.thumbnail_url ? 'text-white drop-shadow-lg' : 'text-[#333333]'}`}>
              {selectedCourse.title}
            </h1>
            {selectedCourse.description && (
              <p className={`text-lg mb-8 leading-relaxed ${selectedCourse.thumbnail_url ? 'text-white/90 drop-shadow-md' : 'text-gray-600'}`}>
                {selectedCourse.description}
              </p>
            )}
            <div className="flex items-center justify-center gap-6">
              {selectedCourse.items && (
                <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg px-5 py-3 shadow-lg">
                  <span className="text-2xl font-bold text-[#00ADEF]">
                    {selectedCourse.items.length}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    Modules
                  </span>
                </div>
              )}
              {selectedCourse.items && (
                <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg px-5 py-3 shadow-lg">
                  <span className="text-2xl font-bold text-[#78BE20]">
                    {
                      selectedCourse.items.filter((_, idx) =>
                        isItemCompleted(selectedCourse.items[idx].id)
                      ).length
                    }
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    Completed
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Course Curriculum */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-bold text-lg text-[#333333]">Course Content</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCourse.items?.length || 0} modules
                </p>
              </div>
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {selectedCourse.items && selectedCourse.items.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {selectedCourse.items.map((item, index) => {
                      const isCompleted = isItemCompleted(item.id);
                      const itemProgress = getItemProgress(selectedCourse.id, item.id);
                      const progressPercent = itemProgress?.progress || 0;

                      return (
                        <div
                          key={item.id}
                          className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {isCompleted ? (
                                <div className="h-6 w-6 rounded-full bg-[#78BE20] flex items-center justify-center">
                                  <CheckCircle size={16} className="text-white" />
                                </div>
                              ) : (
                                <div className="h-6 w-6 rounded-full border-2 border-[#F58220] flex items-center justify-center text-xs font-semibold text-[#F58220]">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#333333] line-clamp-2">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 uppercase">{item.type}</span>
                                {progressPercent > 0 && progressPercent < 100 && (
                                  <span className="text-xs text-[#F58220] font-medium">
                                    {Math.round(progressPercent)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No modules available</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Main Content - Modules Grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-6">
              {selectedCourse.items && selectedCourse.items.length > 0 ? (
                selectedCourse.items.map((item, index) => {
                  const enhancedItem = enhanceItemWithUrl(item);
                  const itemProgress = getItemProgress(selectedCourse.id, item.id);
                  const isCompleted = isItemCompleted(item.id);
                  const progressPercent = itemProgress?.progress || 0;

                  return (
                    <Card key={item.id} className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                      {/* Card Header with Status */}
                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F58220] text-sm font-bold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="text-base font-bold text-[#333333]">{item.title}</h3>
                              <span className="text-xs text-gray-500 uppercase">{item.type}</span>
                            </div>
                          </div>
                          {isCompleted && (
                            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                              <CheckCircle size={14} className="text-[#78BE20]" />
                              <span className="text-xs font-medium text-[#78BE20]">Done</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4">
                        {/* Description */}
                        {item.description && (
                          <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                        )}

                        {/* Content Preview */}
                        <div className="mb-4">
                          <CourseContentPreview item={enhancedItem} />
                        </div>

                        {/* Progress Bar for Videos */}
                        {item.type === 'video' && progressPercent > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600">Progress</span>
                              <span className="text-xs font-semibold text-[#F58220]">
                                {Math.round(progressPercent)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#F58220] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Last Viewed */}
                        {itemProgress?.last_viewed_at && (
                          <p className="text-xs text-gray-500 mb-4">
                            Last viewed: {new Date(itemProgress.last_viewed_at).toLocaleDateString()}
                          </p>
                        )}

                        {/* Mark as Done Button */}
                        <Button
                          itemId={item.id}
                          itemType={item.type}
                          isCompleted={isCompleted}
                          progress={progressPercent}
                        >
                          Mark As Done </Button>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card className="text-center border border-gray-200 p-12">
                  <p className="text-gray-600">No modules available for this course</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseContent;