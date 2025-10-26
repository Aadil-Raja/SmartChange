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

  // Fetch all announcements for a team
  const fetchAnnouncements = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamAnnouncements(teamId);
      if (res?.success) {
        setAnnouncements(res.data || []);
        return { success: true, data: res.data };
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
        // Add comment to local state
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