// src/pages/employee/TeamAnnouncements.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { useTeams } from "../../hooks/useTeams";
import { getEmployeeCourses } from "../../services/courseApi";
import {
  Megaphone,
  Plus,
  ArrowLeft,
  Users,
  Copy,
  Check,
  Crown,
  UserCheck,
  Key,
} from "lucide-react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import CreateAnnouncementModal from "../../components/ui/CreateAnnouncementModal";
import AnnouncementCard from "../../components/ui/AnnouncementCard";
import TeamMembersModal from "../../components/ui/TeamMembersModal";
import LoadMoreButton from "../../components/ui/LoadMoreButton";

const TeamAnnouncements = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { teams, loadTeams } = useTeams();

  const {
    announcements,
    loading,
    error,
    success,
    fetchAnnouncements,
    loadAnnouncementDetails,
    loadMoreComments,
    clearMessages,
    announcementsPagination,
  } = useAnnouncements();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingMoreAnnouncements, setLoadingMoreAnnouncements] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState({});
  const [courses, setCourses] = useState([]);
  const hasFetchedTeam = useRef(null); // Track which team has been fetched

  // Find current team and check if user is manager
  const currentTeam = teams.find(t => t.team_id === parseInt(teamId));
  const isManager = currentTeam?.role_in_team === "manager";

  const fetchCourses = async () => {
    try {
      const response = await getEmployeeCourses();
      if (response.success && response.data) {
        setCourses(response.data.courses || response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      // Don't show error, just leave courses empty
    }
  };

  const handleCopyCode = async () => {
    if (currentTeam?.join_code) {
      try {
        await navigator.clipboard.writeText(currentTeam.join_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleLoadMoreAnnouncements = async () => {
    setLoadingMoreAnnouncements(true);
    await fetchAnnouncements(teamId, true); // loadMore = true
    setLoadingMoreAnnouncements(false);
  };

  const handleLoadMoreComments = async (announcementId) => {
    setLoadingMoreComments(prev => ({ ...prev, [announcementId]: true }));
    await loadMoreComments(teamId, announcementId);
    setLoadingMoreComments(prev => ({ ...prev, [announcementId]: false }));
  };
  
  useEffect(() => {
    // Load teams data if not already loaded (for page refresh)
    if (teams.length === 0) {
      loadTeams();
    }
    
    if (teamId && hasFetchedTeam.current !== teamId) {
      hasFetchedTeam.current = teamId;
      fetchAnnouncements(teamId);
      fetchCourses();
    }
    return () => clearMessages();
  }, [teamId]);

  if (loading && announcements.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/employee/myteams")}
            className="text-gray-600 hover:!text-black hover:!bg-transparent !bg-transparent !border-none"
          >
            <ArrowLeft size={20} />
            <span className="ml-2">Back to My Teams</span>
          </Button>

        </div>
      </div>

      {/* Hero Header Section - Redesigned */}
      <div className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          {/* Top Section - Team Info */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f7953f] to-[#E0741C] shadow-lg">
                <Megaphone size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#333333] mb-1">
                  {currentTeam?.team_name || "Team"}
                </h1>
                <div className="flex items-center gap-2">
                  {isManager ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full">
                      <Crown size={14} className="text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">Manager</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full">
                      <UserCheck size={14} className="text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Member</span>
                    </div>
                  )}
                  <span className="text-sm text-gray-600">•</span>
                  <span className="text-sm text-gray-600">{announcements.length} {announcements.length === 1 ? "announcement" : "announcements"}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {isManager && (
                <Button
                  onClick={() => setShowMembersModal(true)}
                  variant="secondary"
                  size="sm"
                  className="shadow-sm"
                >
                  <Users size={16} />
                  <span>Members</span>
                </Button>
              )}
              {isManager && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  size="sm"
                  className="shadow-sm"
                >
                  <Plus size={16} />
                  <span>New Post</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Section - Team Code (Manager Only) */}
          {isManager && currentTeam?.join_code && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#f7953f]/10 rounded-lg">
                    <Key size={20} className="text-[#f7953f]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Team Join Code</p>
                    <code className="text-lg font-bold text-[#f7953f] font-mono">
                      {currentTeam.join_code}
                    </code>
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Success Alert */}
        {success && (
          <div className="mb-6 animate-in slide-in-from-top duration-300">
            <Alert variant="success" onClose={clearMessages}>
              {success}
            </Alert>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 animate-in slide-in-from-top duration-300">
            <Alert variant="error" onClose={clearMessages}>
              {error}
            </Alert>
          </div>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6 inline-flex p-6 bg-gray-50 rounded-full">
                <Megaphone size={64} className="text-gray-300" />
              </div>
              <h3 className="text-2xl font-bold text-[#333333] mb-3">
                No announcements yet
              </h3>
              <p className="text-gray-600 mb-8">
                {isManager
                  ? "Create your first announcement to keep your team informed and engaged."
                  : "Your team manager will share important updates and news here. Check back soon!"}
              </p>
              {isManager && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                >
                  <Plus size={18} />
                  <span className="ml-2">Create First Announcement</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="animate-in slide-in-from-bottom duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <AnnouncementCard
                  announcement={announcement}
                  isManager={isManager}
                  teamId={teamId}
                  onLoadMoreComments={() => handleLoadMoreComments(announcement.id)}
                  loadingMoreComments={loadingMoreComments[announcement.id] || false}
                />
              </div>
            ))}
            
            {/* Load More Announcements Button */}
            {announcementsPagination.hasMore && (
              <LoadMoreButton
                onClick={handleLoadMoreAnnouncements}
                loading={loadingMoreAnnouncements}
                hasMore={announcementsPagination.hasMore}
                text="Load More Announcements"
                loadingText="Loading announcements..."
                variant="outline"
                className="mt-8"
              />
            )}
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      {isManager && showCreateModal && (
        <CreateAnnouncementModal
          teamId={teamId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchAnnouncements(teamId);
          }}
          courses={courses}
        />
      )}

      {/* Team Members Modal */}
      {isManager && showMembersModal && (
        <TeamMembersModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          team={currentTeam}
        />
      )}
    </div>
  );
};

export default TeamAnnouncements;