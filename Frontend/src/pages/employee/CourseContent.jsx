import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourses } from '../../hooks/useCourses';
import CourseContentPreview from '../../components/ui/CourseContentPreview';
import MarkAsDoneButton from '../../components/ui/MarkAsDoneButton';
import Card from '../../components/ui/Card';
import { 
  ArrowLeft, 
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
  LogOut
} from 'lucide-react';
import Button from '../../components/ui/Button';

const CourseContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedCourse,
    loading,
    error,
    fetchCourseDetails,
    completedItems,
    courseItemsProgress,
    getItemProgress,
    isItemCompleted,
    unenrollFromCourse
  } = useCourses();

  // Create refs for each content item and quiz
  const contentRefs = useRef({});
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeTab, setActiveTab] = useState('content'); // 'content' or 'quizzes'
  const [showMenu, setShowMenu] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const menuRef = useRef(null);

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

  // Handle unenroll
  const handleUnenroll = async () => {
    setShowMenu(false);
    
    if (!window.confirm('Are you sure you want to unenroll? This will delete all your progress and quiz attempts for this course.')) {
      return;
    }
    
    setIsUnenrolling(true);
    const result = await unenrollFromCourse(parseInt(id));
    setIsUnenrolling(false);
    
    if (result.success) {
      navigate('/employee/mycourses');
    }
  };

  // Function to scroll to a specific item
  const scrollToItem = (itemId) => {
    const element = contentRefs.current[itemId];
    if (element) {
      const yOffset = -100; // Offset for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveItemId(itemId);
      
      // Reset active state after animation
      setTimeout(() => setActiveItemId(null), 2000);
    }
  };

  // Helper function to get content type icon
  const getContentIcon = (type) => {
    switch (type) {
      case "document":
        return <FileText size={16} className="text-[#00ADEF]" />;
      case "video":
        return <Video size={16} className="text-[#F58220]" />;
      case "link":
        return <LinkIcon size={16} className="text-[#78BE20]" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  // Helper function to get quiz status info
  const getQuizStatusInfo = (quiz) => {
    switch (quiz.status) {
      case 'can_take':
        return {
          icon: <HelpCircle size={16} className="text-[#78BE20]" />,
          text: 'Available',
          color: 'text-[#78BE20]',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'locked':
        return {
          icon: <Lock size={16} className="text-gray-500" />,
          text: 'Locked',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
      case 'completed':
        return {
          icon: <Trophy size={16} className="text-yellow-600" />,
          text: 'Completed',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'cooldown':
        return {
          icon: <Clock size={16} className="text-blue-600" />,
          text: 'Cooldown',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      default:
        return {
          icon: <AlertCircle size={16} className="text-gray-500" />,
          text: 'Unknown',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  useEffect(() => {
    if (id) {
      fetchCourseDetails(parseInt(id));
    }
  }, [id]);

  // Refresh course data when returning from quiz (to update quiz status)
  useEffect(() => {
    const handleFocus = () => {
      if (id && selectedCourse) {
        // Refresh course details when window regains focus (user returns from quiz)
        fetchCourseDetails(parseInt(id));
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id, selectedCourse, fetchCourseDetails]);


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
              
              {/* Menu Button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                  title="More options"
                >
                  <MoreVertical size={20} />
                </button>
                
                {/* Dropdown Menu */}
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={handleUnenroll}
                      disabled={isUnenrolling}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <LogOut size={16} />
                      {isUnenrolling ? 'Unenrolling...' : 'Unenroll from Course'}
                    </button>
                  </div>
                )}
              </div>
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
                    Content Items
                  </span>
                </div>
              )}
              {selectedCourse.quizzes && (
                <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg px-5 py-3 shadow-lg">
                  <span className="text-2xl font-bold text-[#78BE20]">
                    {selectedCourse.quizzes.length}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    Quizzes
                  </span>
                </div>
              )}
              {selectedCourse.items && (
                <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg px-5 py-3 shadow-lg">
                  <span className="text-2xl font-bold text-[#F58220]">
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
                <h2 className="font-bold text-lg text-[#333333]">Course Overview</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCourse.items?.length || 0} content items • {selectedCourse.quizzes?.length || 0} quizzes
                </p>
              </div>
              
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'content'
                        ? 'text-[#F58220] border-b-2 border-[#F58220] bg-orange-50'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Content ({selectedCourse.items?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('quizzes')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'quizzes'
                        ? 'text-[#F58220] border-b-2 border-[#F58220] bg-orange-50'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Quizzes ({selectedCourse.quizzes?.length || 0})
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                {activeTab === 'content' ? (
                  // Content Items Tab
                  selectedCourse.items && selectedCourse.items.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {selectedCourse.items.map((item, index) => {
                        const isCompleted = isItemCompleted(item.id);
                        const itemProgress = getItemProgress(selectedCourse.id, item.id);
                        const progressPercent = itemProgress?.progress || 0;

                        return (
                          <div
                            key={item.id}
                            onClick={() => scrollToItem(item.id)}
                            className={`p-4 transition-all cursor-pointer group border-l-4 ${
                              activeItemId === item.id 
                                ? 'bg-gradient-to-r from-[#F58220]/20 to-transparent border-[#F58220]' 
                                : 'border-transparent hover:bg-gradient-to-r hover:from-[#F58220]/10 hover:to-transparent hover:border-[#F58220]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Thumbnail */}
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
                                  {item.thumbnail_url ? (
                                    <img
                                      src={item.thumbnail_url}
                                      alt={item.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {getContentIcon(item.type)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-[#333333] line-clamp-2 group-hover:text-[#F58220] transition-colors">
                                    {item.title}
                                  </p>
                                  {isCompleted && (
                                    <CheckCircle size={16} className="text-[#78BE20] flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500 uppercase group-hover:text-[#F58220] transition-colors">
                                    {item.type}
                                  </span>
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
                      <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                      <p>No content items available</p>
                    </div>
                  )
                ) : (
                  // Quizzes Tab
                  selectedCourse.quizzes && selectedCourse.quizzes.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {selectedCourse.quizzes.map((quiz, index) => {
                        const statusInfo = getQuizStatusInfo(quiz);
                        
                        return (
                          <div
                            key={quiz.id}
                            className="p-4 transition-all cursor-pointer group border-l-4 border-transparent hover:bg-gradient-to-r hover:from-[#78BE20]/10 hover:to-transparent hover:border-[#78BE20]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center border border-gray-200">
                                  <HelpCircle size={20} className="text-[#78BE20]" />
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-[#333333] line-clamp-2 group-hover:text-[#78BE20] transition-colors">
                                    {quiz.title}
                                  </p>
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
                                    {statusInfo.icon}
                                    <span className={statusInfo.color}>{statusInfo.text}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span>Attempts: {quiz.attempts_remaining}/3</span>
                                  {quiz.best_score !== null && (
                                    <span className="text-[#78BE20] font-medium">
                                      Best: {quiz.best_score}%
                                    </span>
                                  )}
                                </div>
                                
                                {quiz.missing_prerequisites && quiz.missing_prerequisites.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-amber-600">
                                      Complete {quiz.missing_prerequisites.length} prerequisite{quiz.missing_prerequisites.length !== 1 ? 's' : ''} first
                                    </p>
                                  </div>
                                )}
                                
                                {quiz.next_attempt_at && (
                                  <div className="mt-2">
                                    <p className="text-xs text-blue-600">
                                      Next attempt: {new Date(quiz.next_attempt_at).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <HelpCircle size={48} className="mx-auto text-gray-300 mb-4" />
                      <p>No quizzes available</p>
                    </div>
                  )
                )}
              </div>
            </Card>
          </div>

          {/* Main Content - Content Items and Quizzes */}
          <div className="lg:col-span-2">
            {/* Content Items Section */}
            {selectedCourse.items && selectedCourse.items.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#F58220] flex items-center justify-center">
                    <FileText size={18} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#333333]">Content Items</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {selectedCourse.items.map((item, index) => {
                    const itemProgress = getItemProgress(selectedCourse.id, item.id);
                    const isCompleted = isItemCompleted(item.id);
                    const progressPercent = itemProgress?.progress || 0;

                    return (
                      <div
                        key={item.id}
                        ref={(el) => (contentRefs.current[item.id] = el)}
                        className={`transition-all duration-500 ${
                          activeItemId === item.id ? 'ring-4 ring-[#F58220]/30 rounded-xl' : ''
                        }`}
                      >
                        <Card className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                          {/* Card Header with Status */}
                          <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                                  {item.thumbnail_url ? (
                                    <img
                                      src={item.thumbnail_url}
                                      alt={item.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {getContentIcon(item.type)}
                                    </div>
                                  )}
                                </div>
                                
                                <div>
                                  <h3 className="text-base font-bold text-[#333333]">{item.title}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase">{item.type}</span>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-xs text-gray-500">Item {index + 1}</span>
                                  </div>
                                </div>
                              </div>
                              {isCompleted && (
                                <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                                  <CheckCircle size={14} className="text-[#78BE20]" />
                                  <span className="text-xs font-medium text-[#78BE20]">Completed</span>
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
                              <CourseContentPreview item={item} />
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
                            <MarkAsDoneButton
                              itemId={item.id}
                              itemType={item.type}
                              isCompleted={isCompleted}
                              progress={progressPercent}
                            />
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quizzes Section */}
            {selectedCourse.quizzes && selectedCourse.quizzes.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#78BE20] flex items-center justify-center">
                    <HelpCircle size={18} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#333333]">Course Quizzes</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {selectedCourse.quizzes.map((quiz, index) => {
                    const statusInfo = getQuizStatusInfo(quiz);
                    
                    return (
                      <Card key={quiz.id} className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                        {/* Quiz Header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center border border-gray-200">
                                <HelpCircle size={20} className="text-[#78BE20]" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-[#333333]">{quiz.title}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Quiz {index + 1}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">
                                    {quiz.attempts_remaining} attempt{quiz.attempts_remaining !== 1 ? 's' : ''} remaining
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
                              {statusInfo.icon}
                              <span className={statusInfo.color}>{statusInfo.text}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quiz Body */}
                        <div className="p-4">
                          {/* Quiz Stats */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">Attempts</span>
                              </div>
                              <p className="text-lg font-bold text-blue-900 mt-1">
                                {quiz.attempts_remaining}/3
                              </p>
                            </div>
                            
                            {quiz.best_score !== null ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  <Trophy size={16} className="text-green-600" />
                                  <span className="text-sm font-medium text-green-900">Best Score</span>
                                </div>
                                <p className="text-lg font-bold text-green-900 mt-1">
                                  {quiz.best_score}%
                                </p>
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  <HelpCircle size={16} className="text-gray-600" />
                                  <span className="text-sm font-medium text-gray-900">Best Score</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900 mt-1">
                                  Not taken
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Prerequisites Warning */}
                          {quiz.missing_prerequisites && quiz.missing_prerequisites.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                              <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-amber-900">Prerequisites Required</p>
                                  <p className="text-sm text-amber-700 mt-1">
                                    Complete {quiz.missing_prerequisites.length} content item{quiz.missing_prerequisites.length !== 1 ? 's' : ''} before taking this quiz.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cooldown Notice */}
                          {quiz.next_attempt_at && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                              <div className="flex items-start gap-2">
                                <Clock size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-blue-900">Cooldown Period</p>
                                  <p className="text-sm text-blue-700 mt-1">
                                    Next attempt available: {new Date(quiz.next_attempt_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Button */}
                          <Button
                            variant={quiz.status === 'can_take' ? 'primary' : 'secondary'}
                            disabled={quiz.status !== 'can_take'}
                            className="w-full"
                            onClick={() => {
                              if (quiz.status === 'can_take') {
                                navigate(`/employee/quiz/${quiz.id}`);
                              }
                            }}
                          >
                            {quiz.status === 'can_take' && 'Take Quiz'}
                            {quiz.status === 'locked' && 'Quiz Locked'}
                            {quiz.status === 'completed' && 'Retake Quiz'}
                            {quiz.status === 'cooldown' && 'On Cooldown'}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!selectedCourse.items || selectedCourse.items.length === 0) && 
             (!selectedCourse.quizzes || selectedCourse.quizzes.length === 0) && (
              <Card className="text-center border border-gray-200 p-12">
                <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Content Available</h3>
                <p className="text-gray-500">This course doesn't have any content items or quizzes yet.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseContent;