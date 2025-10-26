// src/components/announcements/AnnouncementCard.jsx
import { useState } from "react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import {
  MessageSquare,
  Calendar,
  User,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from "lucide-react";
import Button from "../ui/Button";
import TextArea from "../ui/TextArea";
import LoadingSpinner from "../ui/LoadingSpinner";

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
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
      {/* Announcement Header */}
      <div className="p-6 lg:p-8">
        {/* Title & Toggle */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
              {announcement.title}
            </h2>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full">
                <User size={16} />
                <span className="font-medium">{announcement.author?.name || "Manager"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span>{formatRelativeTime(announcement.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full">
                <MessageSquare size={16} />
                <span className="font-medium">
                  {commentCount} {commentCount === 1 ? "comment" : "comments"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-3 hover:bg-gray-100 rounded-xl transition-colors group"
          >
            {isExpanded ? (
              <ChevronUp size={24} className="text-gray-400 group-hover:text-yellow-600" />
            ) : (
              <ChevronDown size={24} className="text-gray-400 group-hover:text-yellow-600" />
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
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-yellow-600 hover:text-yellow-700 font-medium transition-colors group"
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
        <div className="bg-gradient-to-b from-gray-50 to-white border-t border-gray-100">
          <div className="p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <MessageSquare size={20} className="text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {isManager ? "Team Discussion" : "Comments"}
              </h3>
              <span className="ml-auto bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-semibold">
                {commentCount}
              </span>
            </div>

            {/* Comments List */}
            {announcement.comments && announcement.comments.length > 0 ? (
              <div className="space-y-4 mb-6">
                {announcement.comments.map((comment, index) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow animate-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(comment.user?.name || "U")[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-gray-900">
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
                  </div>
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
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:border-yellow-300 transition-colors">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={18} className="text-yellow-600" />
                  <span className="font-semibold text-gray-900">Add your comment</span>
                </div>
                <TextArea
                  placeholder="Share your thoughts or ask a question..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  disabled={submittingComment}
                  className="mb-3 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddComment}
                                type="button"
            variant="outline"
            className="px-6"
                  >
                    {submittingComment ? (
                      <>
                        <LoadingSpinner size="small" />
                        <span className="ml-2">Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        <span className="ml-2 font-semibold">Post Comment</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementCard;