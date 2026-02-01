// src/services/trainingApi.js
import api from './api';

// ==================== COURSES ====================

// Get all courses (includes both active and inactive)
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

// Delete course thumbnail
export const deleteCourseThumbnail = async (courseId) => {
  const response = await api.delete(`/admin-training/courses/${courseId}/thumbnail`);
  return response.data;
};

// Activate course (make visible to employees)
export const activateCourse = async (courseId) => {
  const response = await api.patch(`/admin-training/courses/${courseId}/activate`);
  return response.data;
};

// Deactivate course (hide from employees)
export const deactivateCourse = async (courseId) => {
  const response = await api.patch(`/admin-training/courses/${courseId}/deactivate`);
  return response.data;
};

// Delete course permanently
export const deleteCourse = async (courseId) => {
  const response = await api.delete(`/admin-training/courses/${courseId}`);
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

// Reorder content items
export const reorderContentItems = async (courseId, items) => {
  console.log('trainingApi: reorderContentItems called with:', { courseId, items });
  
  try {
    const response = await api.patch(
      `/admin-training/courses/${courseId}/content/reorder`,
      { items }
    );
    console.log('trainingApi: reorderContentItems response:', response.data);
    return response.data;
  } catch (error) {
    console.error('trainingApi: reorderContentItems error:', error);
    throw error;
  }
};

// ==================== EXTERNAL LINKS ====================

// Create external link
export const createExternalLink = async (linkData) => {
  console.log('trainingApi: createExternalLink called with:', linkData);
  
  try {
    const response = await api.post('/admin-training/links', linkData);
    console.log('trainingApi: Create link response:', response.data);
    return response.data;
  } catch (error) {
    console.error('trainingApi: Create link error:', error);
    throw error;
  }
};

// Get all external links
export const getExternalLinks = async () => {
  console.log('trainingApi: getExternalLinks called');
  try {
    const response = await api.get('/admin-training/links');
    console.log('trainingApi: getExternalLinks response:', response.data);
    return response.data;
  } catch (error) {
    console.error('trainingApi: getExternalLinks error:', error);
    throw error;
  }
};

// Get single external link
export const getExternalLink = async (linkId) => {
  const response = await api.get(`/admin-training/links/${linkId}`);
  return response.data;
};

// Update external link
export const updateExternalLink = async (linkId, linkData) => {
  const response = await api.patch(`/admin-training/links/${linkId}`, linkData);
  return response.data;
};

// Delete external link
export const deleteExternalLink = async (linkId) => {
  const response = await api.delete(`/admin-training/links/${linkId}`);
  return response.data;
};

// ==================== VIDEOS ====================

// Upload video
export const uploadVideo = async (title, file) => {
  console.log('trainingApi: uploadVideo called with:', { title, fileName: file.name, fileSize: file.size });
  
  const maxSize = 500 * 1024 * 1024; // 500MB for videos
  
  if (file.size > maxSize) {
    throw new Error(`Video file size exceeds 500MB limit`);
  }

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    throw new Error('Only MP4 files are allowed');
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);
  
  console.log('trainingApi: Making POST request to /admin-training/videos');
  
  try {
    const response = await api.post(
      '/admin-training/videos',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    console.log('trainingApi: Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('trainingApi: Upload error:', error);
    throw error;
  }
};

// Get all videos
export const getVideos = async () => {
  console.log('trainingApi: getVideos called');
  try {
    const response = await api.get('/admin-training/videos');
    console.log('trainingApi: getVideos response:', response.data);
    return response.data;
  } catch (error) {
    console.error('trainingApi: getVideos error:', error);
    throw error;
  }
};

// Get single video
export const getVideo = async (videoId) => {
  const response = await api.get(`/admin-training/videos/${videoId}`);
  return response.data;
};

// Delete video
export const deleteVideo = async (videoId) => {
  const response = await api.delete(`/admin-training/videos/${videoId}`);
  return response.data;
};

// ==================== UTILITY FUNCTIONS ====================

// Get all available employees for assignment
export const getAvailableEmployees = async () => {
  const response = await api.get('/admin/employees');
  return response.data;
};

// Get processed documents for course content
export const getProcessedDocuments = async () => {
  const response = await api.get('/admin/documents/list');
  return response.data;
};

// ===== ADDITIONAL UTILITY FUNCTIONS =====

// Get course by ID (alias for getCourseDetails for compatibility)
export const getCourseById = getCourseDetails;

// Toggle course status (combines activate/deactivate)
export const toggleCourseStatus = async (courseId, isActive) => {
  if (isActive) {
    return await deactivateCourse(courseId);
  } else {
    return await activateCourse(courseId);
  }
};