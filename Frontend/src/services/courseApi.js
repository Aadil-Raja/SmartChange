import api from './api';

// Get all courses assigned to employee
export const getEmployeeCourses = async () => {
  const response = await api.get('/employee/courses');
  return response.data;
};

// Get single course with items/modules
export const getCourseById = async (courseId) => {
  const response = await api.get(`/employee/courses/${courseId}`);
  return response.data;
};

export const updateContentProgress = async (contentId, progressData) => {
console.log('Updating content progress for contentId:', contentId, 'with data:', progressData);
  const response = await api.post(`/employee/content/${contentId}/progress`, progressData);
  return response.data;
};

// Get course progress for current user
export const getCourseProgress = async (courseId) => {
  const response = await api.get(`/employee/courses/${courseId}/progress`);
  console.log('Course progress response:', response.data);
  return response.data;
};
