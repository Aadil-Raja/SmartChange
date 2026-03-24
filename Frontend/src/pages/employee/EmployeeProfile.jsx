import { useState, useEffect, useRef } from 'react';
import { User, BookOpen, Star, Clock, CheckCircle, TrendingUp, Award, Calendar, Camera, Trash2, Upload } from 'lucide-react';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
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

  const stats = profileData?.stats || {};

  const getTabMeta = (tab) => {
    switch (tab) {
      case 'starred':
        return { label: 'Starred', icon: Star, emptyText: 'Star courses to keep track of your favorites' };
      case 'in_progress':
        return { label: 'In Progress', icon: Clock, emptyText: 'Start learning to see courses in progress here' };
      case 'completed':
        return { label: 'Completed', icon: CheckCircle, emptyText: 'Complete courses to see them here' };
      case 'expired':
        return { label: 'Expired', icon: Calendar, emptyText: 'Courses with expired deadlines will appear here' };
      default:
        return { label: 'Courses', icon: BookOpen, emptyText: 'No courses found' };
    }
  };

  const tabMeta = getTabMeta(activeTab);
  const ActiveTabIcon = tabMeta.icon;

  const tabConfig = [
    { key: 'starred', label: 'Starred', icon: Star, count: (profileData?.starred || []).length },
    { key: 'in_progress', label: 'In Progress', icon: Clock, count: (profileData?.in_progress || []).length },
    { key: 'completed', label: 'Completed', icon: CheckCircle, count: (profileData?.completed || []).length },
  ];

  if ((stats?.total_expired || 0) > 0) {
    tabConfig.push({ key: 'expired', label: 'Expired', icon: Calendar, count: (profileData?.expired || []).length, danger: true });
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[#faf6ef] overflow-hidden">
        <EmployeeSidebar 
          collapsed={navCollapsed} 
          onToggle={() => setNavCollapsed(!navCollapsed)} 
        />
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center bg-white rounded-3xl p-8 border" style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 24px rgba(26,18,9,0.08)' }}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7953f] mx-auto mb-4" />
              <p style={{ color: '#6b5e4e' }}>Loading your profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-[#faf6ef] overflow-hidden">
        <EmployeeSidebar 
          collapsed={navCollapsed} 
          onToggle={() => setNavCollapsed(!navCollapsed)} 
        />
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <div className="p-8 text-center rounded-3xl border" style={{ background: '#fff7f7', borderColor: '#f6caca', boxShadow: '0 8px 24px rgba(220,38,38,0.08)' }}>
              <p className="font-semibold" style={{ color: '#b91c1c' }}>{error}</p>
              <button
                onClick={fetchProfileData}
                className="mt-4 px-5 py-2.5 rounded-full text-white font-semibold transition-all"
                style={{ background: '#dc2626' }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#faf6ef] overflow-hidden">
      <EmployeeSidebar 
        collapsed={navCollapsed} 
        onToggle={() => setNavCollapsed(!navCollapsed)} 
      />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <section
            className="relative overflow-visible rounded-[28px] p-6 sm:p-8 mb-8 border"
            style={{
              background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)',
              borderColor: '#2f2317',
              boxShadow: '0 20px 48px rgba(26,18,9,0.28)',
            }}
          >
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full" style={{ background: 'rgba(247,149,63,0.12)' }} />
            <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full" style={{ background: 'rgba(247,149,63,0.08)' }} />

            <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-7">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                <div className="relative group profile-picture-container shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center overflow-hidden border-[3px]"
                    style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)' }}>
                    {profileData?.profile_picture_url ? (
                      <img src={profileData.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={46} className="text-[#fff8ef]" />
                    )}
                  </div>

                  <button
                    onClick={() => setShowPictureMenu(!showPictureMenu)}
                    disabled={uploadingPicture}
                    className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                  >
                    {uploadingPicture ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                    ) : (
                      <Camera size={30} className="text-white" />
                    )}
                  </button>

                  {showPictureMenu && !uploadingPicture && (
                    <div className="absolute top-full left-0 mt-3 rounded-2xl border py-2 z-50 min-w-[220px]"
                      style={{ background: '#fffdf8', borderColor: '#e8e0d4', boxShadow: '0 18px 30px rgba(26,18,9,0.16)' }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-4 py-2.5 text-left flex items-center gap-2"
                        style={{ color: '#3d3228' }}
                      >
                        <Upload size={16} />
                        <span>{profileData?.profile_picture_url ? 'Change Picture' : 'Upload Picture'}</span>
                      </button>
                      {profileData?.profile_picture_url && (
                        <button
                          onClick={handleRemovePicture}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-2"
                          style={{ color: '#dc2626' }}
                        >
                          <Trash2 size={16} />
                          <span>Remove Picture</span>
                        </button>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="absolute -bottom-2 -right-1 rounded-full p-2 border-[3px]"
                    style={{ background: '#78BE20', borderColor: '#fff4e8' }}>
                    <Award size={15} className="text-white" />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                    style={{ background: 'rgba(247,149,63,0.2)', color: '#ffd9b8' }}>
                    <TrendingUp size={14} />
                    <span className="text-xs font-semibold tracking-wide">{stats.overall_progress || 0}% OVERALL PROGRESS</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-1" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>
                    {profileData?.user_name || 'Employee Profile'}
                  </h1>
                  <p className="text-sm sm:text-base" style={{ color: '#f6d5b8' }}>Learning Journey Dashboard</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full xl:w-auto">
                <div className="rounded-2xl px-5 py-4 border" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
                  <div className="text-2xl font-bold" style={{ color: '#fffaf0' }}>{stats.total_courses_started || 0}</div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Courses Started</div>
                </div>
                <div className="rounded-2xl px-5 py-4 border" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
                  <div className="text-2xl font-bold" style={{ color: '#fffaf0' }}>{stats.total_items_completed || 0}</div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Items Completed</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="rounded-3xl p-5 border bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#ecf6fd' }}>
                <BookOpen size={21} className="text-[#0a7cb8]" />
              </div>
              <div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_enrolled || 0}</div>
              <p className="text-sm mt-1" style={{ color: '#6b5e4e' }}>Enrolled Courses</p>
            </div>

            <div className="rounded-3xl p-5 border bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fff3e8' }}>
                <Clock size={21} className="text-[#e0741c]" />
              </div>
              <div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_in_progress || 0}</div>
              <p className="text-sm mt-1" style={{ color: '#6b5e4e' }}>In Progress</p>
            </div>

            <div className="rounded-3xl p-5 border bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#edf8ea' }}>
                <CheckCircle size={21} className="text-[#3f8e1b]" />
              </div>
              <div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_completed || 0}</div>
              <p className="text-sm mt-1" style={{ color: '#6b5e4e' }}>Completed</p>
            </div>

            <div className="rounded-3xl p-5 border bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fff8e8' }}>
                <Star size={21} className="text-[#d59a11]" />
              </div>
              <div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_starred || 0}</div>
              <p className="text-sm mt-1" style={{ color: '#6b5e4e' }}>Starred</p>
            </div>
          </section>

          <section className="rounded-3xl border p-6 mb-8 bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 22px rgba(26,18,9,0.08)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-2xl font-bold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Overall Learning Progress</h3>
              <span className="text-2xl font-bold" style={{ color: '#f7953f' }}>{stats.overall_progress || 0}%</span>
            </div>
            <div className="w-full rounded-full h-3 mb-3" style={{ background: '#eee4d7' }}>
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.overall_progress || 0}%`, background: 'linear-gradient(90deg, #f2b44d 0%, #f7953f 55%, #e0741c 100%)' }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm" style={{ color: '#6b5e4e' }}>
              <span>{stats.total_items_completed || 0} of {stats.total_items || 0} items completed</span>
              <span>{stats.total_completed || 0} courses completed</span>
            </div>
          </section>

          <section className="rounded-3xl border bg-white overflow-hidden" style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 24px rgba(26,18,9,0.08)' }}>
            <div className="p-6 border-b" style={{ borderColor: '#ede6dc' }}>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>My Course Collections</h3>

              <div className="flex flex-wrap gap-2">
                {tabConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all"
                      style={{
                        background: isActive
                          ? (tab.danger ? '#dc2626' : '#1a1209')
                          : (tab.danger ? '#fff1f2' : '#f6f1e8'),
                        color: isActive
                          ? '#ffffff'
                          : (tab.danger ? '#b91c1c' : '#6b5e4e'),
                        border: isActive
                          ? '1px solid transparent'
                          : `1px solid ${tab.danger ? '#fecdd3' : '#eadfce'}`,
                      }}
                    >
                      <Icon size={15} className={tab.key === 'starred' && isActive ? 'fill-current' : ''} />
                      <span>{tab.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#ffffff' }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              {getActiveTabCourses().length === 0 ? (
                <div className="text-center py-14">
                  <div className="inline-flex p-5 rounded-full mb-4" style={{ background: '#f3ede4' }}>
                    <ActiveTabIcon size={44} style={{ color: '#b1a492' }} />
                  </div>
                  <h4 className="text-xl font-semibold mb-2" style={{ color: '#1a1209' }}>
                    No {activeTab.replace('_', ' ')} courses yet
                  </h4>
                  <p style={{ color: '#7c6f61' }}>{tabMeta.emptyText}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                        variant={activeTab}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;