import { useState, useEffect, useRef } from 'react';
import { User, BookOpen, Star, Clock, CheckCircle, TrendingUp, Award, Calendar, Camera, Trash2, Upload } from 'lucide-react';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import Card from '../../components/ui/Card';
import CourseCard from '../../components/ui/CourseCard';
import { getEmployeeCoursesOverview, uploadProfilePicture, removeProfilePicture } from '../../services/courseApi';

const EmployeeProfile = () => {
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('starred');
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showPictureMenu, setShowPictureMenu] = useState(false);
  const fileInputRef = useRef(null);
  const hasFetchedProfile=useRef(false);

  useEffect(() => {
    if(!hasFetchedProfile.current){
      hasFetchedProfile.current=true;
      fetchProfileData();
    }
  }, []);

  // Close picture menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPictureMenu && !event.target.closest('.profile-picture-container')) {
        setShowPictureMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPictureMenu]);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmployeeCoursesOverview();
      if (res.success) {
        setProfileData(res.data);
      } else {
        throw new Error(res.message || 'Failed to fetch profile data');
      }
    } catch (err) {
      setError(err.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const getActiveTabCourses = () => {
    if (!profileData) return [];
    switch (activeTab) {
      case 'starred':
        return profileData.starred || [];
      case 'in_progress':
        return profileData.in_progress || [];
      case 'completed':
        return profileData.completed || [];
      case 'expired':
        return profileData.expired || [];
      default:
        return [];
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    setShowPictureMenu(false);
    
    try {
      const res = await uploadProfilePicture(file);
      if (res.success) {
        // Update profile data with new picture URL
        setProfileData(prev => ({
          ...prev,
          profile_picture_url: res.data.profile_picture_url
        }));
      } else {
        alert(res.message || 'Failed to upload profile picture');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePicture = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

    setUploadingPicture(true);
    setShowPictureMenu(false);
    
    try {
      const res = await removeProfilePicture();
      if (res.success) {
        // Remove picture URL from profile data
        setProfileData(prev => ({
          ...prev,
          profile_picture_url: null
        }));
      } else {
        alert(res.message || 'Failed to remove profile picture');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <EmployeeSidebar 
          collapsed={navCollapsed} 
          onToggle={() => setNavCollapsed(!navCollapsed)} 
        />
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7953f] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <EmployeeSidebar 
          collapsed={navCollapsed} 
          onToggle={() => setNavCollapsed(!navCollapsed)} 
        />
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <Card className="p-8 text-center border-red-200 bg-red-50">
              <p className="text-red-800 font-semibold">{error}</p>
              <button
                onClick={fetchProfileData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const stats = profileData?.stats || {};

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <EmployeeSidebar 
        collapsed={navCollapsed} 
        onToggle={() => setNavCollapsed(!navCollapsed)} 
      />
      
      <div className="flex-1 overflow-auto">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-[#f7953f] to-[#E0741C] border-b border-orange-300">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              {/* Avatar + Info */}
              <div className="flex items-center gap-6">
                <div className="relative group profile-picture-container">
                  {/* Profile Picture */}
                  <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg overflow-hidden">
                    {profileData?.profile_picture_url ? (
                      <img
                        src={profileData.profile_picture_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={48} className="text-white" />
                    )}
                  </div>

                  {/* Upload/Remove Button Overlay */}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <button
                      onClick={() => setShowPictureMenu(!showPictureMenu)}
                      disabled={uploadingPicture}
                      className="text-white hover:scale-110 transition-transform"
                    >
                      {uploadingPicture ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      ) : (
                        <Camera size={32} />
                      )}
                    </button>
                  </div>

                  {/* Picture Menu */}
                  {showPictureMenu && !uploadingPicture && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 min-w-[200px]">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                      >
                        <Upload size={16} />
                        <span>{profileData?.profile_picture_url ? 'Change Picture' : 'Upload Picture'}</span>
                      </button>
                      {profileData?.profile_picture_url && (
                        <button
                          onClick={handleRemovePicture}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                        >
                          <Trash2 size={16} />
                          <span>Remove Picture</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* Achievement Badge */}
                  <div className="absolute -bottom-2 -right-2 bg-[#78BE20] rounded-full p-2 border-4 border-white shadow-lg">
                    <Award size={16} className="text-white" />
                  </div>
                </div>
                
                <div className="text-white">
                  <h1 className="text-3xl font-bold mb-2">{profileData?.user_name || 'Employee Profile'}</h1>
                  <p className="text-orange-100 text-lg mb-1">Learning Journey Dashboard</p>
                  <div className="flex items-center gap-4 text-sm text-orange-100">
                    <div className="flex items-center gap-1">
                      <TrendingUp size={16} />
                      <span>{stats.overall_progress || 0}% Overall Progress</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4 text-center">
                  <div className="text-2xl font-bold text-white">{stats.total_courses_started || 0}</div>
                  <div className="text-xs text-orange-100">Courses Started</div>
                </Card>
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4 text-center">
                  <div className="text-2xl font-bold text-white">{stats.total_items_completed || 0}</div>
                  <div className="text-xs text-orange-100">Items Completed</div>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 text-center border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-blue-50 rounded-full">
                  <BookOpen size={24} className="text-[#00ADEF]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#333333] mb-1">{stats.total_enrolled || 0}</div>
              <div className="text-sm text-gray-600 font-medium">Enrolled</div>
            </Card>

            <Card className="p-6 text-center border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-orange-50 rounded-full">
                  <Clock size={24} className="text-[#f7953f]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#333333] mb-1">{stats.total_in_progress || 0}</div>
              <div className="text-sm text-gray-600 font-medium">In Progress</div>
            </Card>

            <Card className="p-6 text-center border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-green-50 rounded-full">
                  <CheckCircle size={24} className="text-[#78BE20]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#333333] mb-1">{stats.total_completed || 0}</div>
              <div className="text-sm text-gray-600 font-medium">Completed</div>
            </Card>

            <Card className="p-6 text-center border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-yellow-50 rounded-full">
                  <Star size={24} className="text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#333333] mb-1">{stats.total_starred || 0}</div>
              <div className="text-sm text-gray-600 font-medium">Starred</div>
            </Card>
          </div>

          {/* Overall Progress Bar */}
          <Card className="p-6 mb-8 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#333333]">Overall Learning Progress</h3>
              <span className="text-2xl font-bold text-[#f7953f]">{stats.overall_progress || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className="bg-gradient-to-r from-[#FDB913] to-[#f7953f] h-4 rounded-full transition-all duration-500"
                style={{ width: `${stats.overall_progress || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{stats.total_items_completed || 0} of {stats.total_items || 0} items completed</span>
              <span>{stats.total_completed || 0} courses completed</span>
            </div>
          </Card>

          {/* Course Collections */}
          <Card className="border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-[#333333] mb-4">My Course Collections</h3>
              
              {/* Tabs */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('starred')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'starred'
                      ? 'bg-[#f7953f] text-white shadow-md'
                      : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                  }`}
                >
                  <Star size={16} className={activeTab === 'starred' ? 'fill-current' : ''} />
                  <span>Starred</span>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === 'starred' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(profileData?.starred || []).length}
                  </span>
                </button>
                
                <button
                  onClick={() => setActiveTab('in_progress')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'in_progress'
                      ? 'bg-[#f7953f] text-white shadow-md'
                      : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                  }`}
                >
                  <Clock size={16} />
                  <span>In Progress</span>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === 'in_progress' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(profileData?.in_progress || []).length}
                  </span>
                </button>
                
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'completed'
                      ? 'bg-[#f7953f] text-white shadow-md'
                      : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                  }`}
                >
                  <CheckCircle size={16} />
                  <span>Completed</span>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === 'completed' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(profileData?.completed || []).length}
                  </span>
                </button>
                
                {stats.total_expired > 0 && (
                  <button
                    onClick={() => setActiveTab('expired')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'expired'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                    }`}
                  >
                    <Calendar size={16} />
                    <span>Expired</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'expired' 
                        ? 'bg-white/20 text-white' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {(profileData?.expired || []).length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Course Grid */}
            <div className="p-6">
              {getActiveTabCourses().length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    {activeTab === 'starred' && <Star size={48} className="text-gray-300" />}
                    {activeTab === 'in_progress' && <Clock size={48} className="text-gray-300" />}
                    {activeTab === 'completed' && <CheckCircle size={48} className="text-gray-300" />}
                    {activeTab === 'expired' && <Calendar size={48} className="text-gray-300" />}
                  </div>
                  <h4 className="text-xl font-semibold text-[#333333] mb-2">
                    No {activeTab.replace('_', ' ')} courses yet
                  </h4>
                  <p className="text-gray-600">
                    {activeTab === 'starred' && 'Star courses to keep track of your favorites'}
                    {activeTab === 'in_progress' && 'Start learning to see courses in progress here'}
                    {activeTab === 'completed' && 'Complete courses to see them here'}
                    {activeTab === 'expired' && 'Courses with expired deadlines will appear here'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getActiveTabCourses().map((course) => {
                    const progress = course.progress ? {
                      completed: course.completed_items || 0,
                      total: course.total_items || 0,
                      percentage: Math.round(course.progress || 0)
                    } : null;
                    
                    return (
                      <CourseCard
                        key={course.id}
                        course={course}
                        progress={progress}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;