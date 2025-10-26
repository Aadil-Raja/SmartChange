// src/context/AnnouncementContext.jsx
import { createContext, useState } from "react";
import {
  createAnnouncement,
  getTeamAnnouncements,
  getAnnouncementDetails,
  addComment,
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
        const announcementsList = res.data || [];
        
        // Fetch details (including comments) for each announcement
        const announcementsWithComments = await Promise.all(
          announcementsList.map(async (announcement) => {
            try {
              const detailsRes = await getAnnouncementDetails(teamId, announcement.id);
              if (detailsRes?.success && detailsRes.data?.announcement) {
                // Return the full announcement object with comments
                return detailsRes.data.announcement;
              }
              // Fallback: return announcement without comments
              return { ...announcement, comments: [] };
            } catch (err) {
              console.error(`Failed to fetch comments for announcement ${announcement.id}:`, err);
              // Return announcement without comments on error
              return { ...announcement, comments: [] };
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
        setComments(res.data?.comments || []);
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
        fetchAnnouncementDetails,
        addNewComment,
        clearMessages,
        setCurrentAnnouncement,
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  );
};