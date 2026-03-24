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
  ChevronRight,
} from "lucide-react";
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
  const hasFetchedTeam = useRef(null);

  const currentTeam = teams.find((t) => t.team_id === parseInt(teamId));
  const isManager = currentTeam?.role_in_team === "manager";

  const fetchCourses = async () => {
    try {
      const response = await getEmployeeCourses();
      if (response.success && response.data) {
        setCourses(response.data.courses || response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    }
  };

  const handleCopyCode = async () => {
    if (currentTeam?.join_code) {
      try {
        await navigator.clipboard.writeText(currentTeam.join_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleLoadMoreAnnouncements = async () => {
    setLoadingMoreAnnouncements(true);
    await fetchAnnouncements(teamId, true);
    setLoadingMoreAnnouncements(false);
  };

  const handleLoadMoreComments = async (announcementId) => {
    setLoadingMoreComments((prev) => ({ ...prev, [announcementId]: true }));
    await loadMoreComments(teamId, announcementId);
    setLoadingMoreComments((prev) => ({ ...prev, [announcementId]: false }));
  };

  useEffect(() => {
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
      <div className="min-h-screen" style={{ background: "#faf6ef" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div
            className="rounded-2xl border border-gray-100 bg-white py-20 flex items-center justify-center"
            style={{ boxShadow: "0 4px 24px rgba(26,18,9,0.08)" }}
          >
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "#f7953f transparent #f7953f #f7953f" }} />
              <p className="mt-3" style={{ color: "#6b5e4e" }}>Loading announcements...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#faf6ef" }}>
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: "1px solid #e8e0d4" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate("/employee/myteams")}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium transition-all"
            style={{ borderColor: "#e0d8ce", color: "#6b5e4e", background: "white" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#f7953f";
              e.currentTarget.style.color = "#f7953f";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e0d8ce";
              e.currentTarget.style.color = "#6b5e4e";
            }}
          >
            <ArrowLeft size={13} /> My Teams
          </button>
          <ChevronRight size={14} style={{ color: "#c4b8a8" }} />
          <span className="font-semibold truncate max-w-xs" style={{ color: "#1a1209" }}>
            {currentTeam?.team_name || "Team Announcements"}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-[24px] overflow-hidden border border-gray-100" style={{ boxShadow: "0 4px 24px rgba(26,18,9,0.08)" }}>
          <div className="relative h-44 flex items-center justify-center overflow-hidden" style={{ background: "#1a1209" }}>
            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full border-2 opacity-10" style={{ borderColor: "#faf6ef" }} />
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border-2 opacity-10" style={{ borderColor: "#faf6ef" }} />
            <div className="absolute top-8 right-24 w-20 h-20 rounded-full border opacity-10" style={{ borderColor: "#f7953f" }} />
            <Megaphone size={58} className="text-[#faf6ef] z-10" />
          </div>

          <div className="px-8 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#1a1209", fontFamily: "Georgia, serif" }}>
                  {currentTeam?.team_name || "Team Announcements"}
                </h1>
                <p style={{ color: "#6b5e4e", fontSize: 14, marginTop: 4 }}>
                  Share updates, discussion points, and important team communication
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatChip
                  icon={isManager ? <Crown size={14} /> : <UserCheck size={14} />}
                  value={isManager ? "Manager" : "Member"}
                  label="Role"
                  tint={isManager ? "orange" : "teal"}
                />
                <StatChip
                  icon={<Megaphone size={14} />}
                  value={announcements.length}
                  label="Posts"
                  tint="neutral"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isManager && (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={{ border: "1px solid #e0d8ce", color: "#4b4540", background: "white" }}
                >
                  <Users size={15} /> Members
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all"
                  style={{ background: "#1a1209" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7953f")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1209")}
                >
                  <Plus size={15} /> New Post
                </button>
              )}
            </div>

            {isManager && currentTeam?.join_code && (
              <div className="mt-5 rounded-xl p-4" style={{ background: "#faf6ef", border: "1px solid #ede8e0" }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: "#fff0e8" }}>
                      <Key size={18} className="text-[#f7953f]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9c8e80" }}>Team Join Code</p>
                      <code className="text-base font-bold" style={{ color: "#f7953f" }}>{currentTeam.join_code}</code>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                    style={{ background: "white", border: "1px solid #e0d8ce" }}
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-[#0d9488]" />
                        <span className="text-sm font-medium text-[#0d9488]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="text-[#6b5e4e]" />
                        <span className="text-sm font-medium" style={{ color: "#6b5e4e" }}>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {success && (
          <Alert variant="success" onClose={clearMessages}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert variant="error" onClose={clearMessages}>
            {error}
          </Alert>
        )}

        {announcements.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6 inline-flex w-20 h-20 rounded-full items-center justify-center" style={{ background: "#f3ede4" }}>
                <Megaphone size={36} className="text-[#9c8e80]" />
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#1a1209" }}>
                No announcements yet
              </h3>
              <p style={{ color: "#6b5e4e" }} className="mb-8">
                {isManager
                  ? "Create your first announcement to keep your team informed and engaged."
                  : "Your team manager will share important updates and news here. Check back soon!"}
              </p>
              {isManager && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                  style={{ background: "#f7953f" }}
                >
                  <Plus size={16} /> Create First Announcement
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                isManager={isManager}
                teamId={teamId}
                onLoadMoreComments={() => handleLoadMoreComments(announcement.id)}
                loadingMoreComments={loadingMoreComments[announcement.id] || false}
              />
            ))}

            {announcementsPagination.hasMore && (
              <LoadMoreButton
                onClick={handleLoadMoreAnnouncements}
                loading={loadingMoreAnnouncements}
                hasMore={announcementsPagination.hasMore}
                text="Load More Announcements"
                loadingText="Loading announcements..."
                variant="outline"
                className="mt-6"
              />
            )}
          </div>
        )}
      </div>

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

const StatChip = ({ icon, value, label, tint }) => {
  const s = {
    teal: { background: "#e6f4f1", color: "#0d9488" },
    orange: { background: "#fff0e8", color: "#E0741C" },
    neutral: { background: "#f3ede4", color: "#78716c" },
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={s[tint] || s.neutral}>
      {icon}
      <span className="font-bold">{value}</span>
      <span className="font-normal opacity-75">{label}</span>
    </div>
  );
};

export default TeamAnnouncements;
