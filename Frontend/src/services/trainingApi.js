// src/services/trainingApi.js
import api from './api';

// ==================== COURSES ====================

// Get all courses
export const getCourses = async () => {
  const response = await api.get('/admin-training/courses');
  return response.data;
};

// Create a new course
export const createCourse = async (courseData) => {
  const response = await api.post('/admin-training/courses', courseData);
  return response.data;
};

// Get course details with content items
export const getCourseDetails = async (courseId) => {
  const response = await api.get(`/admin-training/courses/${courseId}`);
  return response.data;
};

// Update course
export const updateCourse = async (courseId, courseData) => {
  const response = await api.patch(`/admin-training/courses/${courseId}`, courseData);
  return response.data;
};

// Set course thumbnail
export const setCourseThumbnail = async (courseId, file) => {
  const maxSize = 100 * 1024 * 1024; // 100MB
  
  if (file.size > maxSize) {
    throw new Error(`File size exceeds 100MB limit`);
  }

  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(
    `/admin-training/courses/${courseId}/thumbnail`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// ==================== CONTENT ITEMS ====================

// Add content item to a course
export const addContentItem = async (courseId, contentData) => {
  const response = await api.post(
    `/admin-training/courses/${courseId}/content`,
    contentData
  );
  return response.data;
};

// Update content item
export const updateContentItem = async (contentId, contentData) => {
  const response = await api.patch(
    `/admin-training/content/${contentId}`,
    contentData
  );
  return response.data;
};

// Delete content item
export const deleteContentItem = async (contentId) => {
  const response = await api.delete(`/admin-training/content/${contentId}`);
  return response.data;
};