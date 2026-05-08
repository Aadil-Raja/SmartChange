// src/context/AnnouncementContext.jsx
import { createContext, useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';
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

  const lastSuccessRef = useRef(null);
  const lastErrorRef = useRef(null);

  useEffect(() => {
    if (success && success !== lastSuccessRef.current) {
      toast.success(success);
      lastSuccessRef.current = success;
    }

    if (!success) {
      lastSuccessRef.current = null;
    }
  }, [success]);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      toast.error(error);
      lastErrorRef.current = error;
    }

    if (!error) lastErrorRef.current = null;
  }, [error]);

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
        
        // Initialize announcements with empty comments/attachments (lazy load on expand)
        const announcementsWithDefaults = announcementsList.map(announcement => ({
          ...announcement,
          comments: [],
          commentsTotal: 0,
          attachments: [],
          detailsLoaded: false // Flag to track if details have been loaded
        }));
        
        if (loadMore) {
          setAnnouncements(prev => [...prev, ...announcementsWithDefaults]);
        } else {
          setAnnouncements(announcementsWithDefaults);
        }
        
        const newOffset = currentOffset;
        const hasMore = (newOffset + announcementsPagination.limit) < total;
        
        setAnnouncementsPagination({
          offset: newOffset,
          limit: announcementsPagination.limit,
          total: total,
          hasMore: hasMore
        });
        
        return { success: true, data: announcementsWithDefaults };
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

  // Load announcement details (comments and attachments) when user expands
  const loadAnnouncementDetails = async (teamId, announcementId) => {
    try {
      const announcement = announcements.find(a => a.id === announcementId);
      if (!announcement) return { success: false, message: 'Announcement not found' };
      
      // Skip if already loaded
      if (announcement.detailsLoaded) return { success: true, alreadyLoaded: true };
      
      const detailsRes = await getAnnouncementDetails(teamId, announcementId, 0, 5); // Load first 5 comments
      if (detailsRes?.success && detailsRes.data) {
        const comments = detailsRes.data.comments?.items || [];
        const commentsTotal = detailsRes.data.comments?.total || 0;
        const attachments = detailsRes.data.attachments || [];
        
        // Update the specific announcement with details
        setAnnouncements(prevAnnouncements =>
          prevAnnouncements.map(a =>
            a.id === announcementId
              ? {
                  ...a,
                  comments: comments,
                  commentsTotal: commentsTotal,
                  attachments: attachments,
                  detailsLoaded: true
                }
              : a
          )
        );
        
        return { success: true };
      }
    } catch (err) {
      console.error('Error loading announcement details:', err);
      return { success: false, message: err.message };
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
        
        // Update the specific announcement in state without losing details
        setAnnouncements((prevAnnouncements) =>
          prevAnnouncements.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  title: updateData.title || announcement.title,
                  body: updateData.body || announcement.body,
                }
              : announcement
          )
        );
        
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
        
        // Add the new attachment to the specific announcement without losing details
        setAnnouncements((prevAnnouncements) =>
          prevAnnouncements.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  attachments: [...(announcement.attachments || []), res.data],
                }
              : announcement
          )
        );
        
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
        
        // Remove the attachment from the specific announcement without losing details
        setAnnouncements((prevAnnouncements) =>
          prevAnnouncements.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  attachments: (announcement.attachments || []).filter((att) => att.id !== attachmentId),
                }
              : announcement
          )
        );
        
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
        loadAnnouncementDetails,
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