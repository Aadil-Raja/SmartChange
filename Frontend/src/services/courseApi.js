import api from './api';

// ===== EMPLOYEE COURSE APIs =====

// Get all active courses visible to employees
export const getEmployeeCourses = async () => {
  const response = await api.get('/employee/courses');
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

// ===== VIDEO & EXTERNAL LINK APIs (using admin endpoints) =====

// Get all videos from admin training (accessible to employees for viewing)
export const getVideos = async () => {
  console.log('courseApi: getVideos called');
  try {
    const response = await api.get('/admin-training/videos');
    console.log('courseApi: getVideos response:', response.data);
    return response.data;
  } catch (error) {
    console.error('courseApi: getVideos error:', error);
    throw error;
  }
};

// Get all external links from admin training (accessible to employees for viewing)
export const getExternalLinks = async () => {
  console.log('courseApi: getExternalLinks called');
  try {
    const response = await api.get('/admin-training/links');
    console.log('courseApi: getExternalLinks response:', response.data);
    return response.data;
  } catch (error) {
    console.error('courseApi: getExternalLinks error:', error);
    throw error;
  }
};
