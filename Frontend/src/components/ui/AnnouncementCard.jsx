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
  Edit2,
  Trash2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Upload,
} from "lucide-react";
import Button from "../ui/Button";
import Textarea from "../ui/Textarea";
import LoadingSpinner from "../ui/LoadingSpinner";
import Card from "../ui/Card";
import LoadMoreButton from "../ui/LoadMoreButton";

const AnnouncementCard = ({ announcement, isManager, teamId, onLoadMoreComments, loadingMoreComments = false }) => {
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

  const commentCount = announcement.comments?.length || 0;
  const commentsTotal = announcement.commentsTotal || 0;
  const attachments = announcement.attachments || [];
  const canEdit = announcement.can_edit;
  const canDelete = announcement.can_delete;

  // Handle expand/collapse with lazy loading
  const handleToggleExpand = async () => {
    if (!isExpanded && !announcement.detailsLoaded) {
      // Load details when expanding for the first time
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
      // State is already updated by addNewComment in context
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    const result = await deleteExistingComment(teamId, announcement.id, commentId);
    // State is already updated by deleteExistingComment in context
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
      // State is already updated by updateExistingAnnouncement in context
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!window.confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) return;
    
    const result = await deleteExistingAnnouncement(teamId, announcement.id);
    if (result.success) {
      // The announcement will be removed from the list by the context
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Determine attachment type based on file type
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

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setUploadingAttachment(true);
    const result = await uploadAnnouncementAttachment(teamId, announcement.id, file, attachmentType);
    setUploadingAttachment(false);

    if (result.success) {
      setShowAttachmentUpload(false);
      // State is already updated by uploadAnnouncementAttachment in context
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;
    
    const result = await deleteAnnouncementAttachment(teamId, announcement.id, attachmentId);
    // State is already updated by deleteAnnouncementAttachment in context
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
    <Card variant="default" padding="none" shadow="md" hover className="overflow-hidden">
      {/* Announcement Header */}
      <div className="p-6 lg:p-8">
        {isEditing ? (
          // Edit Mode
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-[#333333] mb-2">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#333333] mb-2">Body</label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={6}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleUpdateAnnouncement} variant="primary" size="sm">
                Save Changes
              </Button>
              <Button 
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(announcement.title);
                  setEditBody(announcement.body);
                }} 
                variant="secondary" 
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Title & Actions */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#333333] mb-3 leading-tight">
                  {announcement.title}
                </h2>
                
                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md">
                    <User size={16} />
                    <span className="font-medium">{announcement.author_name || "Manager"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    <span>{formatRelativeTime(announcement.created_at)}</span>
                  </div>
                  {/* <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md">
                    <MessageSquare size={16} /> */}
                    {/* <span className="font-medium">
                      {commentCount} {commentCount === 1 ? "comment" : "comments"}
                    </span> */}
                  {/* </div> */}
                  {/* {attachments.length > 0 && (
                    <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md">
                      <Paperclip size={16} /> */}
                      {/* <span className="font-medium">
                        {attachments.length} {attachments.length === 1 ? "attachment" : "attachments"}
                      </span> */}
                    {/* </div> */}
                  {/* )} */}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit announcement"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDeleteAnnouncement}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete announcement"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={handleToggleExpand}
                  disabled={loadingDetails}
                  className="p-3 hover:bg-gray-100 rounded-md transition-colors group disabled:opacity-50"
                >
                  {loadingDetails ? (
                    <LoadingSpinner size="small" />
                  ) : isExpanded ? (
                    <ChevronUp size={24} className="text-gray-400 group-hover:text-[#F58220]" />
                  ) : (
                    <ChevronDown size={24} className="text-gray-400 group-hover:text-[#F58220]" />
                  )}
                </button>
              </div>
            </div>

            {/* Announcement Body */}
            <div className="prose prose-lg max-w-none mb-4">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                {announcement.body}
              </p>
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group border border-gray-200 rounded-lg overflow-hidden hover:border-[#F58220] transition-all"
                    >
                      {attachment.attachment_type === "image" ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={attachment.url}
                            alt={attachment.filename}
                            className="w-full h-40 object-cover"
                          />
                        </a>
                      ) : attachment.attachment_type === "video" ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <div className="relative w-full h-40 bg-gray-100">
                            {attachment.thumbnail_url ? (
                              <img
                                src={attachment.thumbnail_url}
                                alt={attachment.filename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Video size={48} className="text-gray-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                <Video size={24} className="text-gray-700" />
                              </div>
                            </div>
                          </div>
                        </a>
                      ) : (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                          <div className="flex items-center gap-3 p-4 bg-gray-50">
                            <FileText size={32} className="text-red-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">
                                {attachment.filename}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(attachment.size_bytes)}
                              </p>
                            </div>
                          </div>
                        </a>
                      )}
                      
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Delete attachment"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action Bar */}
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={handleToggleExpand}
                disabled={loadingDetails}
                className="flex items-center gap-2 text-[#F58220] hover:text-[#E0741C] font-medium transition-colors group disabled:opacity-50"
              >
                {loadingDetails ? (
                  <>
                    <LoadingSpinner size="small" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                    <span>
                      {isExpanded ? "Hide" : "View"}  {"comments and attachments"}
                    </span>
                  </>
                )}
              </button>

              {canEdit && (
                <button
                  onClick={() => setShowAttachmentUpload(!showAttachmentUpload)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Paperclip size={18} />
                  <span>Add Attachment</span>
                </button>
              )}
            </div>

            {/* Attachment Upload Section */}
            {showAttachmentUpload && canEdit && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[#333333]">Upload Attachment</h4>
                  <button
                    onClick={() => setShowAttachmentUpload(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Supported formats: Images, Videos, PDF (Max 50MB)
                </p>
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <Upload size={20} className="text-blue-600" />
                  <span className="font-medium text-blue-600">
                    {uploadingAttachment ? "Uploading..." : "Choose File"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploadingAttachment}
                    className="hidden"
                  />
                </label>
                {uploadingAttachment && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                    <LoadingSpinner size="small" />
                    <span className="text-sm">Uploading attachment...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Comments Section (Expandable) */}
      {isExpanded && !isEditing && (
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
                        {(comment.user_name || "U")[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-[#333333]">
                            {comment.user_name || "Team Member"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} />
                              {formatRelativeTime(comment.created_at)}
                            </span>
                            {comment.can_delete && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete comment"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {/* Load More Comments Button */}
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
