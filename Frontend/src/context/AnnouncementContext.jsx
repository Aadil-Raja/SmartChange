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

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ==================== ANNOUNCEMENTS ====================

  // Fetch all announcements for a team WITH COMMENTS
  const fetchAnnouncements = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamAnnouncements(teamId);
      if (res?.success) {
        // Handle paginated response - backend returns { total, items }
        const announcementsList = res.data?.items || res.data || [];
        
        // Fetch details (including comments and attachments) for each announcement
        const announcementsWithComments = await Promise.all(
          announcementsList.map(async (announcement) => {
            try {
              const detailsRes = await getAnnouncementDetails(teamId, announcement.id);
              if (detailsRes?.success && detailsRes.data) {
                // Merge announcement with comments and attachments from the API response
                return {
                  ...detailsRes.data.announcement,
                  comments: detailsRes.data.comments?.items || detailsRes.data.comments || [],
                  attachments: detailsRes.data.attachments || []
                };
              }
              // Fallback: return announcement without comments/attachments
              return { ...announcement, comments: [], attachments: [] };
            } catch (err) {
              console.error(`Failed to fetch details for announcement ${announcement.id}:`, err);
              // Return announcement without comments/attachments on error
              return { ...announcement, comments: [], attachments: [] };
            }
          })
        );
        
        setAnnouncements(announcementsWithComments);
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
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  );
};