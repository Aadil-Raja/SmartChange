// src/services/documentService.js
import api from './api'; // Your main API instance (port 8000)

// Get processed documents from document management service
export const getProcessedDocuments = async () => {
  const response = await api.get('/employee/documents/processed');
  return response.data;
};