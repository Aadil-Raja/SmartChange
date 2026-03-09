// src/pages/employee/Chatbot.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import ChatSidebar from "../../components/ui/ChatSidebar";
import ChatWindow from "../../components/ui/ChatWindow";
import DocumentSelector from "../../components/ui/DocumentSelector";
import { MessageSquare, FileText, Sparkles, History, ChevronRight } from "lucide-react";
import Alert from "../../components/ui/Alert";
import PrimaryButton from "../../components/ui/PrimaryButton";
import EmployeeSidebar from "../../components/ui/EmployeeSidebar";

const Chatbot = () => {
  const {
    selectedDocumentId,
    error,
    success,
    clearMessages,
    fetchChatHeads,
    fetchDocuments,
  } = useChatbot();

  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const hasFetchedChats = useRef(false);
  useEffect(() => {
    // Load chat heads and documents on mount
    if (!hasFetchedChats.current) {
      hasFetchedChats.current=true;
      fetchChatHeads();
      fetchDocuments();
    }
    return () => clearMessages();
  }, []);

  return (
    <div className="flex h-screen bg-[#FFFDF7] overflow-hidden">
      {/* Employee Sidebar */}
      <EmployeeSidebar
        collapsed={navCollapsed}
        onToggle={() => setNavCollapsed(!navCollapsed)}
      />

      {/* Main Chat Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-[#F58220]/10 to-[#E0741C]/10 rounded-xl">
                <MessageSquare size={20} className="text-[#F58220]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#333333] flex items-center gap-2">
                  AI Assistant
                  <Sparkles size={16} className="text-[#F58220]" />
                </h1>
                <p className="text-sm text-gray-600">
                  {selectedDocumentId ? "Ready to help with your document" : "Select a document to begin"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setChatDrawerOpen(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Chat History"
              >
                <History size={18} />
              </button>
              <PrimaryButton
                onClick={() => setShowDocumentSelector(true)}
                variant={selectedDocumentId ? "secondary" : "primary"}
                size="sm"
                className="shadow-sm"
              >
                <FileText size={16} />
                <span>{selectedDocumentId ? "Change Document" : "Select Document"}</span>
              </PrimaryButton>
            </div>
          </div>

          {/* Alerts */}
          {(success || error) && (
            <div className="max-w-4xl mx-auto mt-4">
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
            </div>
          )}
        </div>

        {/* Chat Area - Fixed Height */}
        <div className="flex-1 flex flex-col p-6 min-h-0">
          <div className="w-full max-w-4xl mx-auto h-full bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden flex flex-col">
            <ChatWindow
              onOpenDocumentSelector={() => setShowDocumentSelector(true)}
              minimal={true}
            />
          </div>
        </div>
      </div>

      {/* Right Chat Drawer */}
      {chatDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setChatDrawerOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 transform transition-transform duration-300">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-[#333333]">Chat History</h3>
              <button
                onClick={() => setChatDrawerOpen(false)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="h-full overflow-hidden">
              <ChatSidebar
                onNewChat={() => {
                  setShowDocumentSelector(true);
                  setChatDrawerOpen(false);
                }}
                minimal={true}
              />
            </div>
          </div>
        </>
      )}

      {/* Document Selector Modal */}
      {showDocumentSelector && (
        <DocumentSelector onClose={() => setShowDocumentSelector(false)} />
      )}
    </div>
  );
};

export default Chatbot;