// src/context/AnnouncementContext.jsx
import { createContext, useState } from "react";
import {
  createAnnouncement,
  getTeamAnnouncements,
  getAnnouncementDetails,
  addComment,
  updateAnnouncement,
  deleteAnnouncement,
  deleteComment,
  uploadAttachment,
  getAttachments,
  deleteAttachment,
} from "../services/announcements";

export const AnnouncementContext = createContext(null);

export const AnnouncementProvider = ({ children }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Pagination states
  const [announcementsPagination, setAnnouncementsPagination] = useState({
    offset: 0,
    limit: 10,
    total: 0,
    hasMore: false
  });

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ==================== ANNOUNCEMENTS ====================

  // Fetch all announcements for a team WITH COMMENTS and pagination
  const fetchAnnouncements = async (teamId, loadMore = false) => {
    setLoading(true);
    setError(null);
    
    const currentOffset = loadMore ? announcementsPagination.offset + announcementsPagination.limit : 0;
    
    try {
      const res = await getTeamAnnouncements(teamId, currentOffset, announcementsPagination.limit);
      if (res?.success) {
        const announcementsList = res.data?.items || [];
        const total = res.data?.total || 0;
        
        // Fetch details (including comments and attachments) for each announcement
        const announcementsWithComments = await Promise.all(
          announcementsList.map(async (announcement) => {
            try {
              const detailsRes = await getAnnouncementDetails(teamId, announcement.id, 0, 5); // Load first 5 comments
              if (detailsRes?.success && detailsRes.data) {
                return {
                  ...detailsRes.data.announcement,
                  comments: detailsRes.data.comments?.items || [],
                  commentsTotal: detailsRes.data.comments?.total || 0,
                  attachments: detailsRes.data.attachments || []
                };
              }
              return { ...announcement, comments: [], commentsTotal: 0, attachments: [] };
            } catch (err) {
              console.error(`Failed to fetch details for announcement ${announcement.id}:`, err);
              return { ...announcement, comments: [], commentsTotal: 0, attachments: [] };
            }
          })
        );
        
        if (loadMore) {
          setAnnouncements(prev => [...prev, ...announcementsWithComments]);
        } else {
          setAnnouncements(announcementsWithComments);
        }
        
        const newOffset = currentOffset;
        const hasMore = (newOffset + announcementsPagination.limit) < total;
        
        setAnnouncementsPagination({
          offset: newOffset,
          limit: announcementsPagination.limit,
          total: total,
          hasMore: hasMore
        });
        
        return { success: true, data: announcementsWithComments };
      } else {
        throw new Error(res.message || "Failed to fetch announcements");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Load more comments for a specific announcement
  const loadMoreComments = async (teamId, announcementId) => {
    try {
      // Find the announcement to get current comments count
      const announcement = announcements.find(a => a.id === announcementId);
      if (!announcement) return { success: false, message: 'Announcement not found' };
      
      const currentCommentsCount = announcement.comments?.length || 0;
      
      const detailsRes = await getAnnouncementDetails(teamId, announcementId, currentCommentsCount, 20);
      if (detailsRes?.success && detailsRes.data) {
        const newComments = detailsRes.data.comments?.items || [];
        const commentsTotal = detailsRes.data.comments?.total || 0;
        
        // Update the specific announcement with new comments
        setAnnouncements(prevAnnouncements =>
          prevAnnouncements.map(a =>
            a.id === announcementId
              ? {
                  ...a,
                  comments: [...(a.comments || []), ...newComments],
                  commentsTotal: commentsTotal
                }
              : a
          )
        );
        
        const hasMore = (currentCommentsCount + newComments.length) < commentsTotal;
        return { success: true, hasMore };
      }
    } catch (err) {
      console.error('Error loading more comments:', err);
      return { success: false, message: err.message };
    }
  };

  // Create new announcement (Manager only)
  const createNewAnnouncement = async (teamId, announcementData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createAnnouncement(teamId, announcementData);
      if (res?.success) {
        setSuccess("Announcement created successfully");
        // Refresh announcements list
        await fetchAnnouncements(teamId);
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to create announcement");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Fetch single announcement with comments
  const fetchAnnouncementDetails = async (teamId, announcementId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnnouncementDetails(teamId, announcementId);
      if (res?.success) {
        setCurrentAnnouncement(res.data?.announcement || null);
        // Handle paginated comments - backend returns { total, items }
        setComments(res.data?.comments?.items || res.data?.comments || []);
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to fetch announcement details");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Update announcement (Author only)
  const updateExistingAnnouncement = async (teamId, announcementId, updateData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateAnnouncement(teamId, announcementId, updateData);
      if (res?.success) {
        setSuccess("Announcement updated successfully");
        // Refresh announcements list
        await fetchAnnouncements(teamId);
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to update announcement");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete announcement (Author only)
  const deleteExistingAnnouncement = async (teamId, announcementId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteAnnouncement(teamId, announcementId);
      if (res?.success) {
        setSuccess("Announcement deleted successfully");
        // Remove from local state
        setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete announcement");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMMENTS ====================

  // Add comment to announcement
  const addNewComment = async (teamId, announcementId, commentBody) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await addComment(teamId, announcementId, { body: commentBody });
      if (res?.success) {
        setSuccess("Comment added successfully");
        
        // Update the specific announcement in the announcements list
        setAnnouncements((prevAnnouncements) =>
          prevAnnouncements.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  comments: [...(announcement.comments || []), res.data],
                }
              : announcement
          )
        );
        
        // Also add to separate comments state if needed
        setComments((prev) => [...prev, res.data]);
        
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to add comment");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete comment (Commentator only)
  const deleteExistingComment = async (teamId, announcementId, commentId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteComment(teamId, announcementId, commentId);
      if (res?.success) {
        setSuccess("Comment deleted successfully");
        
        // Update the specific announcement in the announcements list
        setAnnouncements((prevAnnouncements) =>
          prevAnnouncements.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  comments: (announcement.comments || []).filter((c) => c.id !== commentId),
                }
              : announcement
          )
        );
        
        // Also remove from separate comments state
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete comment");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== ATTACHMENTS ====================

  // Upload attachment to announcement
  const uploadAnnouncementAttachment = async (teamId, announcementId, file, attachmentType) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await uploadAttachment(teamId, announcementId, file, attachmentType);
      if (res?.success) {
        setSuccess("Attachment uploaded successfully");
        // Refresh announcements to get updated attachments
        await fetchAnnouncements(teamId);
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to upload attachment");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete attachment from announcement
  const deleteAnnouncementAttachment = async (teamId, announcementId, attachmentId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteAttachment(teamId, announcementId, attachmentId);
      if (res?.success) {
        setSuccess("Attachment deleted successfully");
        // Refresh announcements to get updated attachments
        await fetchAnnouncements(teamId);
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete attachment");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnnouncementContext.Provider
      value={{
        // State
        announcements,
        currentAnnouncement,
        comments,
        loading,
        error,
        success,
        // Functions
        fetchAnnouncements,
        loadMoreComments,
        createNewAnnouncement,
        updateExistingAnnouncement,
        deleteExistingAnnouncement,
        fetchAnnouncementDetails,
        addNewComment,
        deleteExistingComment,
        uploadAnnouncementAttachment,
        deleteAnnouncementAttachment,
        clearMessages,
        setCurrentAnnouncement,
        // Pagination
        announcementsPagination,
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  );
};