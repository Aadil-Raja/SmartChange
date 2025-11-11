// src/pages/employee/TeamAnnouncements.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { useTeams } from "../../hooks/useTeams";
import {
  Megaphone,
  Plus,
  MessageSquare,
  Calendar,
  User,
  Send,
  ArrowLeft,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import CreateAnnouncementModal from "../../components/ui/CreateAnnouncementModal";
import AnnouncementCard from "../../components/ui/AnnouncementCard";

const TeamAnnouncements = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { teams } = useTeams();

  const {
    announcements,
    loading,
    error,
    success,
    fetchAnnouncements,
    fetchAnnouncementDetails,
    addNewComment,
    clearMessages,
  } = useAnnouncements();

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Find current team and check if user is manager
  const currentTeam = teams.find(t => t.team_id === parseInt(teamId));
  const isManager = currentTeam?.role_in_team === "manager";

  useEffect(() => {
    if (teamId) {
      fetchAnnouncements(teamId);
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

      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F58220] via-[#F58220] to-[#F58220] border-b border-orange-300">
        {/* Subtle background blur/light overlay */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />

        <div className="relative container mx-auto max-w-6xl px-4 py-20">
          <div className="text-center max-w-3xl mx-auto text-white">
            {/* Icon */}
            <div className="inline-flex p-4 bg-white/20 border border-white/30 rounded-2xl mb-5 shadow-md backdrop-blur-sm">
              <Megaphone size={48} className="text-white drop-shadow-md" />
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold mb-3 drop-shadow-md">
              {currentTeam?.team_name || "Team"} Announcements
            </h1>

            {/* Subtitle */}
            <p className="text-orange-50 text-lg mb-8">
              {isManager ? (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles size={18} className="text-white" />
                  Share important updates with your team
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp size={18} className="text-white" />
                  Stay informed with the latest team news
                </span>
              )}
            </p>

            {/* Stats + Action */}
            <div className="flex items-center justify-center gap-5 flex-wrap">
              {/* Stats Card */}
              <div className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-lg px-5 py-3 shadow-sm backdrop-blur-sm">
                <MessageSquare size={18} className="text-white" />
                <span className="font-semibold text-white text-lg">
                  {announcements.length}
                </span>
                <span className="text-orange-100 text-sm">
                  {announcements.length === 1 ? "Post" : "Posts"}
                </span>
              </div>

              {/* Button */}
              {isManager && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  className="bg-white text-[#F58220] hover:bg-orange-50 shadow-lg font-semibold px-5 py-2 rounded-lg transition-all duration-200"
                >
                  <Plus size={18} />
                  <span className="ml-2">New Announcement</span>
                </Button>
              )}
            </div>
          </div>
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
                  onCommentAdded={() => fetchAnnouncements(teamId)}
                />
              </div>
            ))}
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
        />
      )}
    </div>
  );
};

export default TeamAnnouncements;