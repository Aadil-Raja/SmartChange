// src/components/ui/MemberProgressPanel.jsx
import { useState, useEffect } from 'react';
import { X, User, Mail, Crown, UserCheck, TrendingUp, BookOpen, CheckCircle, Clock, BarChart3, Award, Calendar } from 'lucide-react';
import { getMemberProgress } from '../../services/teamApi';

const MemberProgressPanel = ({ isOpen, onClose, member, teamId }) => {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && member && teamId) {
      fetchMemberProgress();
    }
  }, [isOpen, member, teamId]);

  const fetchMemberProgress = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMemberProgress(teamId, member.user_id);
      if (response.success) {
        setProgressData(response.data);
      } else {
        setError(response.message || 'Failed to fetch member progress');
      }
    } catch (err) {
      console.error('Error fetching member progress:', err);
      setError('Failed to fetch member progress');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'text-green-600 bg-green-100';
    if (progress >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getProgressBarColor = (progress) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Slide Panel */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#f7953f]/5 to-[#E0741C]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#f7953f] to-[#E0741C] rounded-full flex items-center justify-center overflow-hidden">
              {progressData?.member?.user_profile_picture || member?.user_profile_picture ? (
                <img
                  src={progressData?.member?.user_profile_picture || member?.user_profile_picture}
                  alt={member?.user_name || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-lg">
                  {member?.user_name?.charAt(0)?.toUpperCase() || 
                   member?.user_email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#333333]">Member Progress</h2>
              <p className="text-sm text-gray-600">Learning Analytics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7953f] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading progress...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="inline-flex p-4 bg-red-50 rounded-full mb-4">
                <BarChart3 size={32} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Progress</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchMemberProgress}
                className="px-4 py-2 bg-[#f7953f] text-white rounded-lg hover:bg-[#E0741C] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : progressData ? (
            <div className="p-6 space-y-6">
              {/* Member Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User size={20} className="text-[#f7953f]" />
                  <h3 className="font-semibold text-[#333333]">Member Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <span className="font-medium text-[#333333]">
                      {progressData.member.user_name || progressData.member.user_email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="font-medium text-[#333333] truncate ml-2">
                      {progressData.member.user_email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Role:</span>
                    <div className="flex items-center gap-1">
                      {progressData.member.role_in_team === 'manager' ? (
                        <>
                          <Crown size={14} className="text-[#FDB913]" />
                          <span className="text-sm font-medium text-[#FDB913]">Manager</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={14} className="text-[#00ADEF]" />
                          <span className="text-sm font-medium text-[#00ADEF]">Member</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Progress */}
              <div className="bg-gradient-to-br from-[#f7953f]/5 to-[#E0741C]/5 rounded-xl p-4 border border-[#f7953f]/20">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp size={20} className="text-[#f7953f]" />
                  <h3 className="font-semibold text-[#333333]">Overall Progress</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-[#f7953f] mb-1">
                    {progressData.stats.overall_progress}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor(progressData.stats.overall_progress)}`}
                      style={{ width: `${progressData.stats.overall_progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {progressData.stats.total_items_completed} of {progressData.stats.total_items} items completed
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <BookOpen size={24} className="text-[#00ADEF] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-[#333333] mb-1">
                    {progressData.stats.total_courses_started}
                  </div>
                  <p className="text-xs text-gray-600">Courses Started</p>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <Clock size={24} className="text-[#FDB913] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-[#333333] mb-1">
                    {progressData.stats.total_in_progress}
                  </div>
                  <p className="text-xs text-gray-600">In Progress</p>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <CheckCircle size={24} className="text-[#78BE20] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-[#333333] mb-1">
                    {progressData.stats.total_completed}
                  </div>
                  <p className="text-xs text-gray-600">Completed</p>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <Award size={24} className="text-[#f7953f] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-[#333333] mb-1">
                    {progressData.stats.total_items_completed}
                  </div>
                  <p className="text-xs text-gray-600">Items Done</p>
                </div>
              </div>

              {/* In Progress Courses */}
              {progressData.in_progress && progressData.in_progress.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock size={20} className="text-[#FDB913]" />
                    <h3 className="font-semibold text-[#333333]">Currently Learning</h3>
                  </div>
                  <div className="space-y-3">
                    {progressData.in_progress.map((course, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-[#333333] truncate">{course.title}</h4>
                          <p className="text-sm text-gray-600">Progress: {course.progress}%</p>
                        </div>
                        <div className="ml-3">
                          <div className="w-12 h-2 bg-gray-200 rounded-full">
                            <div 
                              className={`h-2 rounded-full ${getProgressBarColor(course.progress)}`}
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Courses */}
              {progressData.completed && progressData.completed.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle size={20} className="text-[#78BE20]" />
                    <h3 className="font-semibold text-[#333333]">Completed Courses</h3>
                  </div>
                  <div className="space-y-3">
                    {progressData.completed.map((course, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-[#333333] truncate">{course.title}</h4>
                          {course.completed_at && (
                            <p className="text-sm text-gray-600">
                              Completed on {formatDate(course.completed_at)}
                            </p>
                          )}
                        </div>
                        <CheckCircle size={20} className="text-[#78BE20] ml-3" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!progressData.in_progress || progressData.in_progress.length === 0) && 
               (!progressData.completed || progressData.completed.length === 0) && (
                <div className="text-center py-8">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
                    <BookOpen size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Learning Activity</h3>
                  <p className="text-gray-600">This member hasn't started any courses yet.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default MemberProgressPanel;