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

// Update announcement (Author only)
export const updateAnnouncement = async (teamId, announcementId, updateData) => {
  const response = await api.patch(`/teams/${teamId}/announcements/${announcementId}`, updateData);
  return response.data;
};

// Delete announcement (Author only)
export const deleteAnnouncement = async (teamId, announcementId) => {
  const response = await api.delete(`/teams/${teamId}/announcements/${announcementId}`);
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

// Delete comment (Commentator only)
export const deleteComment = async (teamId, announcementId, commentId) => {
  const response = await api.delete(
    `/teams/${teamId}/announcements/${announcementId}/comments/${commentId}`
  );
  return response.data;
};

// ==================== ATTACHMENTS ====================

// Upload attachment to announcement (Author only)
export const uploadAttachment = async (teamId, announcementId, file, attachmentType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('attachment_type', attachmentType);
  
  const response = await api.post(
    `/teams/${teamId}/announcements/${announcementId}/attachments`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// List attachments for an announcement
export const getAttachments = async (teamId, announcementId) => {
  const response = await api.get(`/teams/${teamId}/announcements/${announcementId}/attachments`);
  return response.data;
};

// Delete attachment (Author only)
export const deleteAttachment = async (teamId, announcementId, attachmentId) => {
  const response = await api.delete(
    `/teams/${teamId}/announcements/${announcementId}/attachments/${attachmentId}`
  );
  return response.data;
};