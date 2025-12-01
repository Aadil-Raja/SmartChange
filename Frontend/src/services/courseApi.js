import api from './api';

// ===== EMPLOYEE COURSE APIs =====

// Get all active courses visible to employees
export const getEmployeeCourses = async () => {
  const response = await api.get('/employee/courses');
  return response.data;
};

// Get employee courses overview (includes starred, in_progress, completed)
export const getEmployeeCoursesOverview = async () => {
  const response = await api.get('/employee/me/courses/overview');
  return response.data;
};

// Get single active course with its items/modules
export const getCourseById = async (courseId) => {
  const response = await api.get(`/employee/courses/${courseId}`);
  return response.data;
};

// ===== PROGRESS TRACKING APIs =====

// Update progress for a single content item (document, video, or link)
export const updateContentProgress = async (contentId, progressData) => {
  console.log('Updating content progress for contentId:', contentId, 'with data:', progressData);
  const response = await api.post(`/employee/content/${contentId}/progress`, progressData);
  return response.data;
};

// Get overall course progress for current user (completed_items/total_items %)
export const getCourseProgress = async (courseId) => {
  const response = await api.get(`/employee/courses/${courseId}/progress`);
  console.log('Course progress response:', response.data);
  return response.data;
};

// Get detailed progress for each item in a course
export const getCourseItemsProgress = async (courseId) => {
  const response = await api.get(`/employee/courses/${courseId}/progress/items`);
  return response.data;
};

// ===== DOCUMENT APIs =====

// Get all processed documents available for chatbot/viewing
export const getProcessedDocuments = async () => {
  const response = await api.get('/employee/documents/processed');
  return response.data;
};

// Note: Videos and external links are now included directly in the course items
// with thumbnail_url and access_url, so separate API calls are no longer needed

// ===== COURSE STARRING APIs =====

// Star a course (POST)
export const starCourse = async (courseId) => {
  const response = await api.post(`/employee/courses/${courseId}/star`);
  return response.data;
};

// Unstar a course (DELETE)
export const unstarCourse = async (courseId) => {
  const response = await api.delete(`/employee/courses/${courseId}/star`);
  return response.data;
};

// ===== PROFILE PICTURE APIs =====

// Upload or update profile picture
export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/employee/me/profile-picture', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Remove profile picture
export const removeProfilePicture = async () => {
  const response = await api.delete('/employee/me/profile-picture');
  return response.data;
};

// Get user profile (includes profile picture URL)
export const getUserProfile = async () => {
  const response = await api.get('/employee/me/profile');
  return response.data;
};
