// src/pages/employee/Chatbot.jsx
import { useState, useEffect } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import ChatSidebar from "../../components/ui/ChatSidebar";
import ChatWindow from "../../components/ui/ChatWindow";
import DocumentSelector from "../../components/ui/DocumentSelector";
import MobileSidebarToggle from "../../components/ui/MobileSidebarToggle";
import { MessageSquare, FileText, Sparkles } from "lucide-react";
import Alert from "../../components/ui/Alert";
import PrimaryButton from "../../components/ui/PrimaryButton";
import StatusBadge from "../../components/ui/StatusBadge";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Load chat heads and documents on mount
    fetchChatHeads();
    fetchDocuments();

    return () => clearMessages();
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-300 ease-in-out
        fixed md:relative z-50 md:z-auto
        h-full w-80 md:w-80
      `}>
        <ChatSidebar
          onNewChat={() => {
            setShowDocumentSelector(true);
            setSidebarOpen(false);
          }}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header with Alerts - Fixed Height */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-4">
            {success && (
              <Alert variant="success" className="mb-4" onClose={clearMessages}>
                {success}
              </Alert>
            )}
            {error && (
              <Alert variant="error" className="mb-4" onClose={clearMessages}>
                {error}
              </Alert>
            )}

            {/* Document Status Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <MobileSidebarToggle
                  isOpen={sidebarOpen}
                  onToggle={() => setSidebarOpen(!sidebarOpen)}
                />
                <div className="p-2 sm:p-3 bg-gradient-to-r from-[#FDB913] to-[#F58220] rounded-xl shadow-lg">
                  <MessageSquare size={24} className="text-white sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2 truncate">
                    AI Assistant
                    <Sparkles size={16} className="text-[#FDB913] sm:w-5 sm:h-5 flex-shrink-0" />
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                    {selectedDocumentId
                      ? "Ready to answer your questions"
                      : "Select a document to start"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {selectedDocumentId && (
                  <StatusBadge variant="success" size="sm" className="hidden sm:inline-flex">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Document Active
                  </StatusBadge>
                )}
                <PrimaryButton
                  onClick={() => setShowDocumentSelector(true)}
                  variant={selectedDocumentId ? "secondary" : "primary"}
                  size="sm"
                  className={`${!selectedDocumentId ? "animate-pulse" : ""} sm:text-sm`}
                >
                  <FileText size={16} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">
                    {selectedDocumentId ? "Change Document" : "Select Document"}
                  </span>
                  <span className="sm:hidden">
                    {selectedDocumentId ? "Change" : "Select"}
                  </span>
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Window - Flexible Height */}
        <div className="flex-1 min-h-0">
          <ChatWindow
            onOpenDocumentSelector={() => setShowDocumentSelector(true)}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Document Selector Modal */}
      {showDocumentSelector && (
        <DocumentSelector onClose={() => setShowDocumentSelector(false)} />
      )}
    </div>
  );
};

export default Chatbot;