// src/services/quizApi.js
import api from './api';

// ==================== QUIZZES ====================

// Generate quiz from document
export const generateQuiz = async (documentId, quizData) => {
  console.log('quizApi: generateQuiz called with:', { documentId, quizData });
  
  try {
    const response = await api.post(
      `/api/quizzes/generate?document_id=${documentId}`,
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
    const response = await api.get(`/api/quizzes/${quizId}`);
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
    const response = await api.get(`/api/quizzes/document/${documentId}`);
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
    const response = await api.put(`/api/quizzes/${quizId}`, quizData);
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
    const response = await api.post(`/api/quizzes/${quizId}/publish`);
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
    const response = await api.delete(`/api/quizzes/${quizId}`);
    console.log('quizApi: deleteQuiz response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteQuiz error:', error);
    throw error;
  }
};

// ==================== QUESTIONS ====================

// Add question to quiz
export const addQuestion = async (quizId, questionData) => {
  console.log('quizApi: addQuestion called with:', { quizId, questionData });
  
  try {
    const response = await api.post(
      `/api/quizzes/${quizId}/questions`,
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
      `/api/quizzes/questions/${questionId}`,
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
    const response = await api.delete(`/api/quizzes/questions/${questionId}`);
    console.log('quizApi: deleteQuestion response:', response.data);
    // Extract data from the response wrapper
    return response.data.data || response.data;
  } catch (error) {
    console.error('quizApi: deleteQuestion error:', error);
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
