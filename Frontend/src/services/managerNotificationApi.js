import api from './api';

// ===== MANAGER NOTIFICATION APIs =====

// Send direct message to team member
export const sendDirectMessage = async (teamId, recipientUserId, title, message, relatedCourseId = null) => {
  const response = await api.post('/employee/manager/notifications/send-message', {
    team_id: teamId,
    recipient_user_id: recipientUserId,
    title,
    message,
    related_course_id: relatedCourseId
  });
  return response.data;
};
