// src/services/announcements.js
import api from './api';

// ==================== ANNOUNCEMENTS ====================

// Create announcement (Manager only)
export const createAnnouncement = async (teamId, announcementData) => {
  const response = await api.post(`/teams/${teamId}/announcements`, announcementData);
  return response.data;
};

// List all announcements for a team
export const getTeamAnnouncements = async (teamId) => {
  const response = await api.get(`/teams/${teamId}/announcements`);
  return response.data;
};

// Get single announcement with comments
export const getAnnouncementDetails = async (teamId, announcementId) => {
  const response = await api.get(`/teams/${teamId}/announcements/${announcementId}`);
  return response.data;
};

// ==================== COMMENTS ====================

// Add comment to announcement
export const addComment = async (teamId, announcementId, commentData) => {
  const response = await api.post(
    `/teams/${teamId}/announcements/${announcementId}/comments`,
    commentData
  );
  return response.data;
};