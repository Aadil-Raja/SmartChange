// src/context/ChatbotContext.jsx
import { createContext, useState, useCallback } from "react";
import {
  getChatHeads,
  getChatMessages,
  sendChatMessage,
  renameChatHead,
  deleteChatHead,
} from "../services/chatbotService";
import { getProcessedDocuments } from "../services/documentService";

export const ChatbotContext = createContext(null);

export const ChatbotProvider = ({ children }) => {
  const [chatHeads, setChatHeads] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState({});
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ==================== CHAT HEADS ====================

  // Fetch all chat sessions
  const fetchChatHeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getChatHeads(20, 0);
      if (res?.success) {
        setChatHeads(res.data?.items || []);
        return { success: true, data: res.data?.items };
      } else {
        throw new Error(res.message || "Failed to fetch chats");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Rename chat
  const renameChat = async (chatHeadId, newTitle) => {
    setLoading(true);
    setError(null);
    try {
      const res = await renameChatHead(chatHeadId, newTitle);
      if (res?.success) {
        setSuccess("Chat renamed successfully");
        // Update local state
        setChatHeads((prev) =>
          prev.map((chat) =>
            chat.id === chatHeadId ? { ...chat, title: newTitle } : chat
          )
        );
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to rename chat");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete chat
  const deleteChat = async (chatHeadId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await deleteChatHead(chatHeadId);
      if (res?.success) {
        setSuccess("Chat deleted successfully");
        // Remove from local state
        setChatHeads((prev) => prev.filter((chat) => chat.id !== chatHeadId));
        // Clear messages for this chat
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages[chatHeadId];
          return newMessages;
        });
        // Clear active chat if it was deleted
        if (activeChatId === chatHeadId) {
          setActiveChatId(null);
        }
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete chat");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== MESSAGES ====================

  // Fetch messages for a chat
  const fetchMessages = async (chatHeadId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getChatMessages(chatHeadId, 50);
      if (res?.success) {
        setMessages((prev) => ({
          ...prev,
          [chatHeadId]: res.data?.items || [],
        }));
        return { success: true, data: res.data?.items };
      } else {
        throw new Error(res.message || "Failed to fetch messages");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (messageText, chatHeadId = null, title = null) => {
    if (!selectedDocumentIds || selectedDocumentIds.length === 0) {
      setError("Please select at least one document first");
      return { success: false, message: "No document selected" };
    }
    console.log("Sending message:", { messageText, chatHeadId, title });

    setLoading(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      message: messageText,
      created_at: new Date().toISOString(),
      active_doc_ids: selectedDocumentIds,
    };

    console.log("Temp user message:", tempUserMessage);
    const currentChatId = chatHeadId || activeChatId;
    
    // For new chats, we'll use a temporary ID until we get the real one
    const tempChatId = currentChatId || `temp-chat-${Date.now()}`;
    
    setMessages((prev) => ({
      ...prev,
      [tempChatId]: [...(prev[tempChatId] || []), tempUserMessage],
    }));
    
    console.log("Messages after adding temp message:", messages);
    try {
      console.log("Calling sendChatMessage API");
      console.log("Parameters:", {
        chathead_id: chatHeadId,
        active_doc_ids: selectedDocumentIds,
        message: messageText,
        title: title,
      });
      const res = await sendChatMessage({
        message: messageText,
        active_doc_ids: selectedDocumentIds,
        chathead_id: chatHeadId,
        title: title,
      });
      console.log("Send message response:", res);

      if (res?.success) {
        const newChatId = res.data?.chathead_id;
        const assistantResponse = res.data?.answer;

        // Update active chat ID if this was a new chat
        if (!chatHeadId && newChatId) {
          setActiveChatId(newChatId);
        }

        // Add assistant message
        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          message: assistantResponse,
          created_at: new Date().toISOString(),
          active_doc_ids: selectedDocumentIds,
        };

        // Handle message updates properly
        setMessages((prev) => {
          const updatedMessages = { ...prev };
          
          // If this was a new chat, move messages from temp ID to real ID
          if (!chatHeadId && newChatId) {
            const tempMessages = updatedMessages[tempChatId] || [];
            // Remove temp user message and add both user and assistant messages
            const userMessage = tempMessages.find(msg => msg.role === "user");
            updatedMessages[newChatId] = userMessage ? [userMessage, assistantMessage] : [assistantMessage];
            // Clean up temp chat
            if (tempChatId !== newChatId) {
              delete updatedMessages[tempChatId];
            }
          } else {
            // Existing chat - just add assistant message
            const chatId = newChatId || currentChatId;
            updatedMessages[chatId] = [...(updatedMessages[chatId] || []), assistantMessage];
          }
          
          return updatedMessages;
        });

        // Refresh chat heads to show new chat or updated timestamp
        await fetchChatHeads();

        return { success: true, chathead_id: newChatId };
      } else {
        throw new Error(res.message || "Failed to send message");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      
      // Remove optimistic message on error
      setMessages((prev) => ({
        ...prev,
        [tempChatId]: (prev[tempChatId] || []).filter(
          (msg) => msg.id !== tempUserMessage.id
        ),
      }));
      
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== DOCUMENTS ====================

  // Fetch available documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProcessedDocuments();
      if (res?.success) {
        setAvailableDocuments(res.data?.documents || []);
        return { success: true, data: res.data?.documents };
      } else {
        throw new Error(res.message || "Failed to fetch documents");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Select document (now supports multiple)
  const selectDocument = (documentId) => {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(documentId)) {
        // Remove if already selected
        return prev.filter((id) => id !== documentId);
      } else {
        // Add to selection
        return [...prev, documentId];
      }
    });
  };

  // Clear document selection
  const clearDocumentSelection = () => {
    setSelectedDocumentIds([]);
  };

  // ==================== CHAT ACTIONS ====================

  // Start new chat
  const startNewChat = () => {
    setActiveChatId(null);
    clearMessages();
  };

  // Switch to existing chat
  const switchToChat = useCallback(async (chatHeadId) => {
    setActiveChatId(chatHeadId);
    clearMessages();
    
    // Fetch messages if not already loaded
    if (!messages[chatHeadId]) {
      await fetchMessages(chatHeadId);
    }
  }, [messages]);

  return (
    <ChatbotContext.Provider
      value={{
        // State
        chatHeads,
        activeChatId,
        messages,
        selectedDocumentIds,
        availableDocuments,
        loading,
        error,
        success,
        // Chat Head Functions
        fetchChatHeads,
        renameChat,
        deleteChat,
        // Message Functions
        fetchMessages,
        sendMessage,
        // Document Functions
        fetchDocuments,
        selectDocument,
        clearDocumentSelection,
        // Chat Actions
        startNewChat,
        switchToChat,
        // Utility
        clearMessages,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
};