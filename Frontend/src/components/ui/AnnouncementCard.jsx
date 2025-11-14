// src/components/announcements/AnnouncementCard.jsx
import { useState } from "react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import {
  MessageSquare,
  User,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from "lucide-react";
import Button from "../ui/Button";
import Textarea from "../ui/Textarea";
import LoadingSpinner from "../ui/LoadingSpinner";
import Card from "../ui/Card";

const AnnouncementCard = ({ announcement, isManager, teamId, onCommentAdded }) => {
  const { addNewComment } = useAnnouncements();
  const [isExpanded, setIsExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const commentCount = announcement.comments?.length || 0;

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    const result = await addNewComment(teamId, announcement.id, commentText.trim());
    setSubmittingComment(false);

    if (result.success) {
      setCommentText("");
      onCommentAdded();
    }
  };

  return (
    <Card variant="default" padding="none" shadow="md" hover className="overflow-hidden">
      {/* Announcement Header */}
      <div className="p-6 lg:p-8">
        {/* Title & Toggle */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#333333] mb-3 leading-tight">
              {announcement.title}
            </h2>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md">
                <User size={16} />
                <span className="font-medium">{announcement.author?.name || "Manager"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span>{formatRelativeTime(announcement.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md">
                <MessageSquare size={16} />
                <span className="font-medium">
                  {commentCount} {commentCount === 1 ? "comment" : "comments"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-3 hover:bg-gray-100 rounded-md transition-colors group"
          >
            {isExpanded ? (
              <ChevronUp size={24} className="text-gray-400 group-hover:text-[#F58220]" />
            ) : (
              <ChevronDown size={24} className="text-gray-400 group-hover:text-[#F58220]" />
            )}
          </button>
        </div>

        {/* Announcement Body */}
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
            {announcement.body}
          </p>
        </div>

        {/* Quick Action Bar */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-[#F58220] hover:text-[#E0741C] font-medium transition-colors group"
          >
            <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
            <span>
              {isExpanded ? "Hide" : "View"} {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </span>
          </button>
        </div>
      </div>

      {/* Comments Section (Expandable) */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-[rgba(245,130,32,0.1)] rounded-md">
                <MessageSquare size={20} className="text-[#F58220]" />
              </div>
              <h3 className="text-lg font-bold text-[#333333]">
                {isManager ? "Team Discussion" : "Comments"}
              </h3>
              <span className="ml-auto bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm font-semibold">
                {commentCount}
              </span>
            </div>

            {/* Comments List */}
            {announcement.comments && announcement.comments.length > 0 ? (
              <div className="space-y-4 mb-6">
                {announcement.comments.map((comment, index) => (
                  <Card
                    key={comment.id}
                    variant="default"
                    padding="md"
                    shadow="sm"
                    className="animate-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#FDB913] to-[#F58220] rounded-full flex items-center justify-center text-white font-bold">
                        {(comment.user?.name || "U")[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-[#333333]">
                            {comment.user?.name || "Team Member"}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} />
                            {formatRelativeTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-6">
                <div className="inline-flex p-4 bg-gray-100 rounded-full mb-3">
                  <MessageSquare size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500 italic">
                  No comments yet. Be the first to share your thoughts!
                </p>
              </div>
            )}

            {/* Add Comment Form */}
            <Card variant="default" padding="md" shadow="sm" className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-[#F58220]" />
                <span className="font-semibold text-[#333333]">Add your comment</span>
              </div>
              <Textarea
                placeholder="Share your thoughts or ask a question..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                disabled={submittingComment}
                className="mb-3"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddComment}
                  type="button"
                  variant="primary"
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span className="ml-2">Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span className="ml-2">Post Comment</span>
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AnnouncementCard;