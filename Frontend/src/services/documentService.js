// src/services/documentService.js
import api from './api'; // Your main API instance (port 8000)

// Get processed documents from document management service
export const getProcessedDocuments = async () => {
  const response = await api.get('/employee/documents/processed');
  return response.data;
};

// Get a single processed document by ID (used by citation viewer fallback)
export const getProcessedDocumentById = async (documentId) => {
  const response = await api.get(`/employee/documents/processed/${documentId}`);
  return response.data;
};

// Get suggested questions for a document (chatbot chips)
export const getDocumentSuggestedQuestions = async (documentId) => {
  const response = await api.get(`/employee/documents/${documentId}/suggested-questions`);
  return response.data;
};
