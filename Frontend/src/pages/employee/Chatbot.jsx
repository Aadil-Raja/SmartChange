// src/pages/employee/Chatbot.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import ChatSidebar from "../../components/ui/ChatSidebar";
import ChatWindow from "../../components/ui/ChatWindow";
import DocumentSelector from "../../components/ui/DocumentSelector";
import TokenUsageBar from "../../components/ui/TokenUsageBar";
import { MessageSquare, FileText, PanelLeftOpen, PanelLeftClose, X } from "lucide-react";
import Alert from "../../components/ui/Alert";
import EmployeeSidebar from "../../components/ui/EmployeeSidebar";

const Chatbot = () => {
  const { selectedDocumentIds, error, success, clearMessages, fetchChatHeads, fetchDocuments, fetchConfig, fetchQuota, startNewChat } = useChatbot();
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasFetchedChats = useRef(false);

  const handleNewChatFromSidebar = () => {
    startNewChat();
    setShowDocumentSelector(true);
  };

  useEffect(() => {
    if (!hasFetchedChats.current) {
      hasFetchedChats.current = true;
      fetchChatHeads();
      fetchDocuments();
      fetchConfig();
      fetchQuota(); // load quota on page open/reload so bar is accurate immediately
    }
    return () => clearMessages();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FAF6EF" }}>
      <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Header: exact MyCourses pattern ── */}
        <div
          className="w-full px-8 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: "#FAF6EF", borderBottom: "2px solid #F58220" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#1A1209" }}>
              <MessageSquare size={17} color="#F58220" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#3D2C1C", fontFamily: "Georgia, serif" }}>
                AI Assistant
              </h1>
              <p style={{ color: "rgba(65,50,24,0.5)", fontSize: 13, marginTop: 2 }}>
                {selectedDocumentIds.length > 0
                  ? `${selectedDocumentIds.length} document${selectedDocumentIds.length > 1 ? "s" : ""} selected`
                  : "Select documents to begin chatting"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: historyOpen ? "#fff0e8" : "#fff",
                color: historyOpen ? "#F58220" : "#6b5e4e",
                border: `1px solid ${historyOpen ? "#F58220" : "#e0d8ce"}`,
              }}
              onMouseEnter={e => { if (!historyOpen) { e.currentTarget.style.borderColor = "#F58220"; e.currentTarget.style.color = "#F58220"; } }}
              onMouseLeave={e => { if (!historyOpen) { e.currentTarget.style.borderColor = "#e0d8ce"; e.currentTarget.style.color = "#6b5e4e"; } }}
            >
              {historyOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              <span>History</span>
            </button>

            <button
              onClick={() => setShowDocumentSelector(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: selectedDocumentIds.length > 0 ? "#fff0e8" : "#1A1209",
                color: selectedDocumentIds.length > 0 ? "#F58220" : "#faf6ef",
                border: `1px solid ${selectedDocumentIds.length > 0 ? "#F58220" : "transparent"}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              <FileText size={15} />
              {selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} Selected` : "Select Documents"}
            </button>
          </div>
        </div>

        {(success || error) && (
          <div className="px-8 pt-3 flex-shrink-0">
            {success && <Alert variant="success" className="mb-2" onClose={clearMessages}>{success}</Alert>}
            {error && <Alert variant="error" className="mb-2" onClose={clearMessages}>{error}</Alert>}
          </div>
        )}

        {/* ── Body: history panel + chat ── */}
        <div className="flex-1 flex overflow-hidden px-6 py-5 gap-4 min-h-0">

          {historyOpen && (
            <div
              className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
              style={{ width: 268, background: "#fff", border: "1px solid #e0d8ce", boxShadow: "0 2px 12px rgba(26,18,9,0.06)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: "1px solid #e0d8ce", background: "#FAF6EF" }}
              >
                <span className="text-sm font-bold" style={{ color: "#3D2C1C", fontFamily: "Georgia, serif" }}>
                  Chat History
                </span>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="w-6 h-6 rounded flex items-center justify-center transition-all"
                  style={{ color: "#9c8e80" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f0e8de"; e.currentTarget.style.color = "#1A1209"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9c8e80"; }}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatSidebar onNewChat={handleNewChatFromSidebar} minimal={true} />
              </div>
            </div>
          )}

          <div
            className="flex-1 flex flex-col rounded-2xl overflow-hidden min-w-0"
            style={{ background: "#fff", border: "1px solid #e0d8ce", boxShadow: "0 2px 12px rgba(26,18,9,0.06)" }}
          >
            <ChatWindow onOpenDocumentSelector={() => setShowDocumentSelector(true)} minimal={true} />
            <TokenUsageBar />
          </div>
        </div>
      </div>

      {showDocumentSelector && <DocumentSelector onClose={() => setShowDocumentSelector(false)} />}
    </div>
  );
};

export default Chatbot;