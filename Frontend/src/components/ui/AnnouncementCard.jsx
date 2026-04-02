import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import {
  MessageSquare,
  User,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Trash2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Upload,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import Button from "../ui/Button";
import Textarea from "../ui/Textarea";
import LoadingSpinner from "../ui/LoadingSpinner";
import LoadMoreButton from "../ui/LoadMoreButton";

const AnnouncementCard = ({ announcement, isManager, teamId, onLoadMoreComments, loadingMoreComments = false }) => {
  const navigate = useNavigate();
  const {
    addNewComment,
    deleteExistingComment,
    updateExistingAnnouncement,
    deleteExistingAnnouncement,
    uploadAnnouncementAttachment,
    deleteAnnouncementAttachment,
    loadAnnouncementDetails,
  } = useAnnouncements();

  const [isExpanded, setIsExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(announcement.title);
  const [editBody, setEditBody] = useState(announcement.body);
  const [showAttachmentUpload, setShowAttachmentUpload] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hovered, setHovered] = useState(false);

  const commentCount = announcement.comments?.length || 0;
  const attachments = announcement.attachments || [];
  const canEdit = announcement.can_edit;
  const canDelete = announcement.can_delete;

  const handleToggleExpand = async () => {
    if (!isExpanded && !announcement.detailsLoaded) {
      setLoadingDetails(true);
      await loadAnnouncementDetails(teamId, announcement.id);
      setLoadingDetails(false);
    }
    setIsExpanded(!isExpanded);
  };

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

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    const result = await addNewComment(teamId, announcement.id, commentText.trim());
    setSubmittingComment(false);

    if (result.success) {
      setCommentText("");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    await deleteExistingComment(teamId, announcement.id, commentId);
  };

  const handleUpdateAnnouncement = async () => {
    if (!editTitle.trim() || !editBody.trim()) {
      alert("Title and body cannot be empty");
      return;
    }

    const result = await updateExistingAnnouncement(teamId, announcement.id, {
      title: editTitle.trim(),
      body: editBody.trim(),
    });

    if (result.success) {
      setIsEditing(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!window.confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) return;
    await deleteExistingAnnouncement(teamId, announcement.id);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let attachmentType;
    if (file.type.startsWith("image/")) {
      attachmentType = "image";
    } else if (file.type.startsWith("video/")) {
      attachmentType = "video";
    } else if (file.type === "application/pdf") {
      attachmentType = "pdf";
    } else {
      alert("Only images, videos, and PDF files are supported");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setUploadingAttachment(true);
    const result = await uploadAnnouncementAttachment(teamId, announcement.id, file, attachmentType);
    setUploadingAttachment(false);

    if (result.success) {
      setShowAttachmentUpload(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;
    await deleteAnnouncementAttachment(teamId, announcement.id, attachmentId);
  };

  const getAttachmentIcon = (type) => {
    switch (type) {
      case "image":
        return <ImageIcon size={20} className="text-blue-500" />;
      case "video":
        return <Video size={20} className="text-purple-500" />;
      case "pdf":
        return <FileText size={20} className="text-red-500" />;
      default:
        return <Paperclip size={20} className="text-gray-500" />;
    }
  };

  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden border border-gray-100 transition-all duration-200"
      style={{ boxShadow: hovered ? "0 12px 32px rgba(26,18,9,0.13)" : "0 2px 8px rgba(26,18,9,0.06)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-6 lg:p-7">
        {isEditing ? (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#3d3228" }}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-xl"
                style={{ border: "1.5px solid #e0d8ce", outline: "none" }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#3d3228" }}>Body</label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={6}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleUpdateAnnouncement} className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: "#f7953f" }}>
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(announcement.title);
                  setEditBody(announcement.body);
                }}
                className="px-4 py-2 rounded-full text-sm font-semibold border"
                style={{ borderColor: "#d0c8be", color: "#6b5e4e", background: "white" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-3 leading-tight" style={{ color: "#1a1209", fontFamily: "Georgia, serif" }}>
                  {announcement.title}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "#f3ede4", color: "#6b5e4e" }}>
                    {announcement.author_profile_picture ? (
                      <img
                        src={announcement.author_profile_picture}
                        alt={announcement.author_name || "Author"}
                        className="w-6 h-6 rounded-full object-cover border"
                        style={{ borderColor: "#d0c8be" }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#1a1209" }}>
                        <User size={13} className="text-[#faf6ef]" />
                      </div>
                    )}
                    <span className="font-medium">{announcement.author_name || "Manager"}</span>
                  </div>

                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "#faf6ef", color: "#6b5e4e" }}>
                    <Clock size={13} />
                    <span>{formatRelativeTime(announcement.created_at)}</span>
                  </div>

                  {announcement.related_course_id && announcement.related_course_title && (
                    <button
                      onClick={() => navigate(`/employee/course/${announcement.related_course_id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                      style={{ background: "#e8f4fd", color: "#0369a1", borderColor: "#bfdbfe" }}
                    >
                      <BookOpen size={13} />
                      {announcement.related_course_title}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: "#0369a1", background: "#e8f4fd" }}
                    title="Edit announcement"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDeleteAnnouncement}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: "#dc2626", background: "#fff1f2" }}
                    title="Delete announcement"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  onClick={handleToggleExpand}
                  disabled={loadingDetails}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                  style={{ color: "#6b5e4e", background: "#f3ede4" }}
                >
                  {loadingDetails ? <LoadingSpinner size="small" /> : isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "#3d3228" }}>
                {announcement.body}
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group rounded-xl overflow-hidden"
                      style={{ border: "1px solid #ede8e0", background: "#faf6ef" }}
                    >
                      {attachment.attachment_type === "image" ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <img src={attachment.url} alt={attachment.filename} className="w-full h-36 object-cover" />
                        </a>
                      ) : attachment.attachment_type === "video" ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <div className="relative w-full h-36" style={{ background: "#f3ede4" }}>
                            {attachment.thumbnail_url ? (
                              <img src={attachment.thumbnail_url} alt={attachment.filename} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Video size={36} className="text-gray-500" />
                              </div>
                            )}
                          </div>
                        </a>
                      ) : (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <div className="flex items-center gap-3 p-3">
                            {getAttachmentIcon(attachment.attachment_type)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" style={{ color: "#1a1209" }}>
                                {attachment.filename}
                              </p>
                              <p className="text-xs text-gray-500">{formatFileSize(attachment.size_bytes)}</p>
                            </div>
                          </div>
                        </a>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: "#dc2626", color: "white" }}
                          title="Delete attachment"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid #ede8e0" }}>
              <button
                onClick={handleToggleExpand}
                disabled={loadingDetails}
                className="flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                style={{ color: "#f7953f" }}
              >
                {loadingDetails ? (
                  <>
                    <LoadingSpinner size="small" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} />
                    <span>{isExpanded ? "Hide" : "View"} comments and attachments</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => setShowAttachmentUpload(!showAttachmentUpload)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={{ borderColor: "#d0c8be", color: "#6b5e4e", background: "white" }}
                  >
                    <Paperclip size={14} /> Add Attachment
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{ background: "#1a1209" }}
                  title="Open details"
                >
                  <ArrowUpRight size={14} color="#fff" />
                </button>
              </div>
            </div>

            {showAttachmentUpload && canEdit && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: "#e8f4fd", border: "1px solid #bfdbfe" }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold" style={{ color: "#1a1209" }}>Upload Attachment</h4>
                  <button onClick={() => setShowAttachmentUpload(false)} style={{ color: "#6b5e4e" }}>
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm mb-3" style={{ color: "#475569" }}>
                  Supported formats: Images, Videos, PDF (Max 50MB)
                </p>
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all"
                  style={{ background: "white", border: "2px dashed #93c5fd", color: "#0369a1" }}>
                  <Upload size={18} />
                  <span className="font-semibold text-sm">{uploadingAttachment ? "Uploading..." : "Choose File"}</span>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploadingAttachment}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>

      {isExpanded && !isEditing && (
        <div style={{ background: "#faf6ef", borderTop: "1px solid #ede8e0" }}>
          <div className="p-6 lg:p-7">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#fff0e8" }}>
                <MessageSquare size={16} className="text-[#f7953f]" />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1a1209" }}>
                {isManager ? "Team Discussion" : "Comments"}
              </h3>
              <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#f3ede4", color: "#6b5e4e" }}>
                {commentCount}
              </span>
            </div>

            {announcement.comments && announcement.comments.length > 0 ? (
              <div className="space-y-3 mb-5">
                {announcement.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border p-3" style={{ background: "white", borderColor: "#ede8e0" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold overflow-hidden" style={{ background: "#1a1209" }}>
                        {comment.user_profile_picture ? (
                          <img src={comment.user_profile_picture} alt={comment.user_name || "User"} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(comment.user_name || "U")[0].toUpperCase()}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm" style={{ color: "#1a1209" }}>
                            {comment.user_name || "Team Member"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex items-center gap-1" style={{ color: "#9c8e80" }}>
                              <Clock size={11} />
                              {formatRelativeTime(comment.created_at)}
                            </span>
                            {comment.can_delete && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 rounded transition-colors"
                                style={{ color: "#dc2626" }}
                                title="Delete comment"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#3d3228" }}>
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {announcement.commentsTotal > announcement.comments.length && onLoadMoreComments && (
                  <LoadMoreButton
                    onClick={onLoadMoreComments}
                    loading={loadingMoreComments}
                    hasMore={announcement.commentsTotal > announcement.comments.length}
                    text="Load More Comments"
                    loadingText="Loading comments..."
                    noMoreText="All comments loaded"
                    variant="secondary"
                    className="mt-2"
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-8 mb-5">
                <div className="inline-flex p-4 rounded-full mb-3" style={{ background: "#f3ede4" }}>
                  <MessageSquare size={28} className="text-[#9c8e80]" />
                </div>
                <p style={{ color: "#9c8e80" }} className="italic text-sm">
                  No comments yet. Be the first to share your thoughts!
                </p>
              </div>
            )}

            <div className="rounded-xl border p-4" style={{ background: "white", borderColor: "#ede8e0" }}>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-[#f7953f]" />
                <span className="font-semibold text-sm" style={{ color: "#1a1209" }}>Add your comment</span>
              </div>
              <Textarea
                placeholder="Share your thoughts or ask a question..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                disabled={submittingComment}
                className="mb-3"
              />
              <div className="flex justify-end mt-1">
                <button
                  onClick={handleAddComment}
                  type="button"
                  disabled={submittingComment || !commentText.trim()}
                  className="flex w-fit items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingComment ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Post Comment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementCard;
