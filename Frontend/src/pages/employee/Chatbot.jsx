// src/pages/employee/Chatbot.jsx
import { useState, useEffect } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import ChatSidebar from "../../components/ui/ChatSidebar";
import ChatWindow from "../../components/ui/ChatWindow";
import DocumentSelector from "../../components/ui/DocumentSelector";
import { MessageSquare, FileText } from "lucide-react";
import Alert from "../../components/ui/Alert";

const Chatbot = () => {
  const {
    activeChatId,
    selectedDocumentId,
    error,
    success,
    clearMessages,
    fetchChatHeads,
    fetchDocuments,
  } = useChatbot();

  const [showDocumentSelector, setShowDocumentSelector] = useState(false);

  useEffect(() => {
    // Load chat heads and documents on mount
    fetchChatHeads();
    fetchDocuments();
    
    return () => clearMessages();
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
      {/* Chat Sidebar */}
      <ChatSidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Alerts */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4">
            {success && (
              <Alert variant="success" className="mb-2" onClose={clearMessages}>
                {success}
              </Alert>
            )}
            {error && (
              <Alert variant="error" className="mb-2" onClose={clearMessages}>
                {error}
              </Alert>
            )}
            
            {/* Document Status Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                  <MessageSquare size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">AI Assistant</h1>
                  <p className="text-sm text-gray-600">
                    {selectedDocumentId 
                      ? "Ready to answer your questions"
                      : "Select a document to get started"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowDocumentSelector(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedDocumentId
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 animate-pulse"
                }`}
              >
                <FileText size={18} />
                <span>{selectedDocumentId ? "Change Document" : "Select Document"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chat Window */}
        <ChatWindow />
      </div>

      {/* Document Selector Modal */}
      {showDocumentSelector && (
        <DocumentSelector onClose={() => setShowDocumentSelector(false)} />
      )}
    </div>
  );
};

export default Chatbot;