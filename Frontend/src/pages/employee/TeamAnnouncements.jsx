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
      <div className="min-h-screen bg-white from-white-50 via-white to-white-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600 font-medium">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white">
      {/* Hero Header Section */}
      <div className="bg-gradient-to-r from-[#FDB913] to-[#F58220] text-white py-10 px-4 shadow-lg">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/employee/myteams")}
            className="mb-6 text-white hover:bg-white/20 border-white/30"
          >
            <ArrowLeft size={20} />
            <span className="ml-2">Back to My Teams</span>
          </Button>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Megaphone size={32} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold">
                    {currentTeam?.team_name || "Team"} Updates
                  </h1>
                  <p className="text-white/90 mt-1 flex items-center gap-2">
                    {isManager ? (
                      <>
                        <Sparkles size={16} />
                        <span>Share important updates with your team</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp size={16} />
                        <span>Stay in the loop with team news</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <MessageSquare size={18} />
                  <span className="font-semibold">{announcements.length}</span>
                  <span className="text-white/80 text-sm">
                    {announcements.length === 1 ? "Post" : "Posts"}
                  </span>
                </div>
                {isManager && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                    <User size={18} />
                    <span className="text-white/80 text-sm">Manager</span>
                  </div>
                )}
              </div>
            </div>

            {isManager && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-[#FDB913] hover:bg-white/90 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all px-6 py-3 border-2 border-white/20"
              >
                <Plus size={20} />
                <span className="ml-2 font-semibold">New Announcement</span>
              </Button>
            )}
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
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6 inline-flex p-6 bg-gradient-to-br from-[#FDB913]/10 to-[#F58220]/10 rounded-full">
                <Megaphone size={64} className="text-[#FDB913]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                No announcements yet
              </h3>
              <p className="text-gray-600 mb-8 text-lg">
                {isManager 
                  ? "Start the conversation! Create your first announcement to keep your team informed and engaged." 
                  : "Your team manager will share important updates and news here. Check back soon!"}
              </p>
              {isManager && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-[#FDB913] to-[#F58220] hover:from-[#E5A50F] hover:to-[#E0741C] text-white px-8 py-3 text-lg shadow-lg"
                >
                  <Plus size={24} />
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