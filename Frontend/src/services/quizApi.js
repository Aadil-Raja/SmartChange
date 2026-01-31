// src/services/quizApi.js
import api from './api';

// ==================== QUIZZES ====================

// Generate quiz from document
export const generateQuiz = async (documentId, quizData) => {
  console.log('quizApi: generateQuiz called with:', { documentId, quizData });
  
  try {
    const response = await api.post(
      `/admin-quizzes/generate?document_id=${documentId}`,
      quizData
    );
    console.log('quizApi: Generate quiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: Generate quiz error:', error);
    throw error;
  }
};

// Get quiz by ID with all questions and options
export const getQuiz = async (quizId) => {
  console.log('quizApi: getQuiz called with:', quizId);
  
  try {
    const response = await api.get(`/admin-quizzes/${quizId}`);
    console.log('quizApi: getQuiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getQuiz error:', error);
    throw error;
  }
};

// Get all quizzes for a document
export const getQuizzesByDocument = async (documentId) => {
  console.log('quizApi: getQuizzesByDocument called with:', documentId);
  
  try {
    const response = await api.get(`/admin-quizzes/document/${documentId}`);
    console.log('quizApi: getQuizzesByDocument response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getQuizzesByDocument error:', error);
    throw error;
  }
};

// Update quiz metadata (title, description)
export const updateQuiz = async (quizId, quizData) => {
  console.log('quizApi: updateQuiz called with:', { quizId, quizData });
  
  try {
    const response = await api.put(`/admin-quizzes/${quizId}`, quizData);
    console.log('quizApi: updateQuiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: updateQuiz error:', error);
    throw error;
  }
};

// Publish quiz (make visible to employees)
export const publishQuiz = async (quizId) => {
  console.log('quizApi: publishQuiz called with:', quizId);
  
  try {
    const response = await api.post(`/admin-quizzes/${quizId}/publish`);
    console.log('quizApi: publishQuiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: publishQuiz error:', error);
    throw error;
  }
};

// Delete quiz
export const deleteQuiz = async (quizId) => {
  console.log('quizApi: deleteQuiz called with:', quizId);
  
  try {
    const response = await api.delete(`/admin-quizzes/${quizId}`);
    console.log('quizApi: deleteQuiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteQuiz error:', error);
    throw error;
  }
};

// ==================== COURSE QUIZZES ====================

// Create a new course quiz
export const createCourseQuiz = async (courseId, quizData) => {
  console.log('quizApi: createCourseQuiz called with:', { courseId, quizData });
  
  try {
    const response = await api.post(
      `/admin-course-quizzes/${courseId}/quizzes`,
      quizData
    );
    console.log('quizApi: createCourseQuiz response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: createCourseQuiz error:', error);
    throw error;
  }
};

// Get course quiz by ID
export const getCourseQuiz = async (courseQuizId) => {
  console.log('quizApi: getCourseQuiz called with:', courseQuizId);
  
  try {
    const response = await api.get(`/admin-course-quizzes/${courseQuizId}`);
    console.log('quizApi: getCourseQuiz response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getCourseQuiz error:', error);
    throw error;
  }
};

// List all quizzes for a course
export const listCourseQuizzes = async (courseId) => {
  console.log('quizApi: listCourseQuizzes called with:', courseId);
  
  try {
    const response = await api.get(`/admin-course-quizzes/course/${courseId}`);
    console.log('quizApi: listCourseQuizzes response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: listCourseQuizzes error:', error);
    throw error;
  }
};

// Update course quiz
export const updateCourseQuiz = async (courseQuizId, quizData) => {
  console.log('quizApi: updateCourseQuiz called with:', { courseQuizId, quizData });
  
  try {
    const response = await api.put(
      `/admin-course-quizzes/${courseQuizId}`,
      quizData
    );
    console.log('quizApi: updateCourseQuiz response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: updateCourseQuiz error:', error);
    throw error;
  }
};

// Publish course quiz
export const publishCourseQuiz = async (courseQuizId) => {
  console.log('quizApi: publishCourseQuiz called with:', courseQuizId);
  
  try {
    const response = await api.post(`/admin-course-quizzes/${courseQuizId}/publish`);
    console.log('quizApi: publishCourseQuiz response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: publishCourseQuiz error:', error);
    throw error;
  }
};

// Delete course quiz
export const deleteCourseQuiz = async (courseQuizId) => {
  console.log('quizApi: deleteCourseQuiz called with:', courseQuizId);
  
  try {
    const response = await api.delete(`/admin-course-quizzes/${courseQuizId}`);
    console.log('quizApi: deleteCourseQuiz response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteCourseQuiz error:', error);
    throw error;
  }
};

// ==================== COURSE QUIZ QUESTIONS ====================

// Add question to course quiz
export const addCourseQuizQuestion = async (courseQuizId, questionData) => {
  console.log('quizApi: addCourseQuizQuestion called with:', { courseQuizId, questionData });
  
  try {
    const response = await api.post(
      `/admin-course-quizzes/${courseQuizId}/questions`,
      questionData
    );
    console.log('quizApi: addCourseQuizQuestion response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: addCourseQuizQuestion error:', error);
    throw error;
  }
};

// Update course quiz question
export const updateCourseQuizQuestion = async (questionId, questionData) => {
  console.log('quizApi: updateCourseQuizQuestion called with:', { questionId, questionData });
  
  try {
    const response = await api.put(
      `/admin-course-quizzes/questions/${questionId}`,
      questionData
    );
    console.log('quizApi: updateCourseQuizQuestion response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: updateCourseQuizQuestion error:', error);
    throw error;
  }
};

// Delete course quiz question
export const deleteCourseQuizQuestion = async (questionId) => {
  console.log('quizApi: deleteCourseQuizQuestion called with:', questionId);
  
  try {
    const response = await api.delete(`/admin-course-quizzes/questions/${questionId}`);
    console.log('quizApi: deleteCourseQuizQuestion response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteCourseQuizQuestion error:', error);
    throw error;
  }
};

// ==================== COURSE QUIZ HELPER ENDPOINTS ====================

// Get available document questions for a course
export const getAvailableCourseQuestions = async (courseId) => {
  console.log('quizApi: getAvailableCourseQuestions called with:', courseId);
  
  try {
    const response = await api.get(`/admin-course-quizzes/course/${courseId}/available-questions`);
    console.log('quizApi: getAvailableCourseQuestions response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getAvailableCourseQuestions error:', error);
    throw error;
  }
};

// ==================== QUIZ CONFIGURATION (COURSE QUIZZES) ====================

// Get quiz configuration
export const getQuizConfiguration = async (quizId) => {
  console.log('quizApi: getQuizConfiguration called with:', quizId);
  try {
    const response = await api.get(`/admin-course-quizzes/${quizId}/configuration`);
    console.log('quizApi: getQuizConfiguration response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getQuizConfiguration error:', error);
    throw error;
  }
};

// Update quiz configuration
export const updateQuizConfiguration = async (quizId, configData) => {
  console.log('quizApi: updateQuizConfiguration called with:', { quizId, configData });
  try {
    const response = await api.put(`/admin-course-quizzes/${quizId}/configuration`, configData);
    console.log('quizApi: updateQuizConfiguration response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: updateQuizConfiguration error:', error);
    throw error;
  }
};

// Reset quiz configuration
export const resetQuizConfiguration = async (quizId) => {
  console.log('quizApi: resetQuizConfiguration called with:', quizId);
  try {
    const response = await api.delete(`/admin-course-quizzes/${quizId}/configuration`);
    console.log('quizApi: resetQuizConfiguration response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: resetQuizConfiguration error:', error);
    throw error;
  }
};

// ==================== QUESTIONS ====================

// Add question to quiz
export const addQuestion = async (quizId, questionData) => {
  console.log('quizApi: addQuestion called with:', { quizId, questionData });
  
  try {
    const response = await api.post(
      `/admin-quizzes/${quizId}/questions`,
      questionData
    );
    console.log('quizApi: addQuestion response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: addQuestion error:', error);
    throw error;
  }
};

// Update question
export const updateQuestion = async (questionId, questionData) => {
  console.log('quizApi: updateQuestion called with:', { questionId, questionData });
  
  try {
    const response = await api.put(
      `/admin-quizzes/questions/${questionId}`,
      questionData
    );
    console.log('quizApi: updateQuestion response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: updateQuestion error:', error);
    throw error;
  }
};

// Delete question
export const deleteQuestion = async (questionId) => {
  console.log('quizApi: deleteQuestion called with:', questionId);
  
  try {
    const response = await api.delete(`/admin-quizzes/questions/${questionId}`);
    console.log('quizApi: deleteQuestion response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteQuestion error:', error);
    throw error;
  }
};

// ==================== STATISTICS ====================

// Get quiz statistics (total, published, per-document counts)
export const getQuizStats = async () => {
  console.log('quizApi: getQuizStats called');
  
  try {
    const response = await api.get('/admin-quizzes/stats');
    console.log('quizApi: getQuizStats response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getQuizStats error:', error);
    throw error;
  }
};

// ==================== UTILITY FUNCTIONS ====================

// Get quiz by ID (alias for getQuiz for compatibility)
export const getQuizById = getQuiz;

// Check if document has quizzes
export const hasQuizzes = async (documentId) => {
  try {
    const response = await getQuizzesByDocument(documentId);
    return response.quizzes && response.quizzes.length > 0;
  } catch (error) {
    console.error('quizApi: hasQuizzes error:', error);
    return false;
  }
};

// Get quiz count for document
export const getQuizCount = async (documentId) => {
  try {
    const response = await getQuizzesByDocument(documentId);
    return response.total || 0;
  } catch (error) {
    console.error('quizApi: getQuizCount error:', error);
    return 0;
  }
};


// ==================== AUDIT ====================

// Get audit record for a quiz
export const getQuizAudit = async (quizId) => {
  console.log('quizApi: getQuizAudit called with:', quizId);
  
  try {
    const response = await api.get(`/admin-quizzes/${quizId}/audit`);
    console.log('quizApi: getQuizAudit response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: getQuizAudit error:', error);
    throw error;
  }
};

// List all quiz generation audits
export const listQuizAudits = async (limit = 50, status = null) => {
  console.log('quizApi: listQuizAudits called with:', { limit, status });
  
  try {
    const params = { limit };
    if (status) params.status = status;
    
    const response = await api.get('/admin-quizzes/audits/list', { params });
    console.log('quizApi: listQuizAudits response:', response.data);
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: listQuizAudits error:', error);
    throw error;
  }
};
