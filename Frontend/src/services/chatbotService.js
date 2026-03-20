// src/services/chatbotService.js
import chatbotApi from './chatbotapi'; // Fixed import path

// ==================== CHAT MANAGEMENT ====================

// Get list of chat sessions
export const getChatHeads = async (limit = 20, offset = 0) => {
  const response = await chatbotApi.get('/chat/manage/heads', {
    params: { limit, offset}
  });
  return response.data;
};

// Get messages for a specific chat
export const getChatMessages = async (chatHeadId, limit = 50, beforeId = null, afterId = null) => {
  // FIXED: Was using template literal wrong - should be regular string
  const response = await chatbotApi.get(`/chat/manage/${chatHeadId}/messages`, {
    params: { limit, before_id: beforeId, after_id: afterId }
  });
  return response.data;
};

// Rename a chat
export const renameChatHead = async (chatHeadId, title) => {
  // FIXED: Was using template literal wrong
  const response = await chatbotApi.patch(`/chat/manage/${chatHeadId}/title`, {
    title
  });
  return response.data;
};

// Delete a chat
export const deleteChatHead = async (chatHeadId) => {
  // FIXED: Was using template literal wrong
  const response = await chatbotApi.delete(`/chat/manage/${chatHeadId}`);
  return response.data;
};

// ==================== CHAT INTERACTION ====================

// Send message and get response
export const sendChatMessage = async (messageData) => {
  console.log("🚀 sendChatMessage called with:", messageData);
  console.log("🔑 Token in localStorage:", localStorage.getItem("token"));
  
  const response = await chatbotApi.post('/chat/respond', {
    message: messageData.message,
    active_doc_ids: messageData.active_doc_ids,
    chathead_id: messageData.chathead_id || null,
    title: messageData.title || null
  });
  
  console.log("✅ sendChatMessage response:", response.data);
  return response.data;
};