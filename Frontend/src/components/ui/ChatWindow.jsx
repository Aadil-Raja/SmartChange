// src/components/ui/ChatWindow.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { Send, Bot, User, Sparkles, FileText, MessageCircle } from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import IconButton from "./IconButton";
import ChatCard from "./ChatCard";
import LoadingSpinner from "./LoadingSpinner";
import ChatTextArea from "./ChatTextArea";
import MarkdownMessage from "./MarkdownMessage";

const ChatWindow = ({ onOpenDocumentSelector, onCloseSidebar, minimal = false }) => {
  const {
    activeChatId,
    messages,
    selectedDocumentIds,
    loading,
    sendMessage,
    fetchMessages,
  } = useChatbot();

  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];
  
  // Check if we're in read-only mode (viewing history without a document)
  const isReadOnlyMode = activeChatId && (!selectedDocumentIds || selectedDocumentIds.length === 0);
  const hasDocuments = selectedDocumentIds && selectedDocumentIds.length > 0;

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  // Load messages when switching chats
  useEffect(() => {
    if (activeChatId && !messages[activeChatId]) {
      fetchMessages(activeChatId);
    }
  }, [activeChatId]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !hasDocuments || sending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Generate title for new chats
    const title = !activeChatId ? messageText.substring(0, 50) : null;

    await sendMessage(messageText, activeChatId, title);
    setSending(false);

    // Focus input after sending
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show welcome screen only if no document AND no active chat
  if (!hasDocuments && !activeChatId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="inline-flex p-8 bg-gradient-to-br from-[#F58220]/5 to-[#E0741C]/5 rounded-full mb-8">
            <Sparkles size={64} className="text-[#F58220]/60" />
          </div>
          <h2 className="text-2xl font-semibold text-[#333333] mb-4">
            Ready to assist you
          </h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Select one or more documents to start an intelligent conversation and get insights from your content.
          </p>
          <PrimaryButton
            onClick={onOpenDocumentSelector}
            size="lg"
            className="shadow-sm"
          >
            <FileText size={20} />
            <span>Choose Documents</span>
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#FFFDF7] min-h-0">
      {/* Read-Only Mode Banner */}
      {isReadOnlyMode && currentMessages.length > 0 && (
        <div className="flex-shrink-0 px-6 pt-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <MessageCircle size={16} className="text-blue-600" />
            </div>
            <p className="text-sm text-blue-800 font-medium">
              You're viewing a previous conversation. Select a document to continue chatting.
            </p>
          </div>
        </div>
      )}
      
      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 scroll-smooth" onClick={onCloseSidebar}>
        {currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl">
              <div className="inline-flex p-6 bg-gradient-to-br from-[#F58220]/5 to-[#E0741C]/5 rounded-full mb-8">
                <Bot size={48} className="text-[#F58220]/60" />
              </div>
              <h2 className="text-xl font-semibold text-[#333333] mb-4">
                How can I help you today?
              </h2>
              <p className="text-gray-600 mb-8">
                Ask me anything about your document. I'm here to help you understand and extract insights.
              </p>
              <div className="grid gap-3 max-w-md mx-auto">
                <button
                  onClick={() => setInputMessage("Summarize the key points from this document")}
                  className="p-4 text-left border border-gray-200 hover:border-[#F58220]/40 rounded-xl cursor-pointer group transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F58220]/10 rounded-lg group-hover:bg-[#F58220]/20 transition-colors">
                      <Sparkles size={16} className="text-[#F58220]" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-[#F58220]">
                      Summarize the key points
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setInputMessage("What are the main topics covered?")}
                  className="p-4 text-left border border-gray-200 hover:border-[#00ADEF]/40 rounded-xl cursor-pointer group transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#00ADEF]/10 rounded-lg group-hover:bg-[#00ADEF]/20 transition-colors">
                      <MessageCircle size={16} className="text-[#00ADEF]" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-[#00ADEF]">
                      What are the main topics?
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          currentMessages.map((message, index) => (
            <div
              key={message.id || index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } animate-in slide-in-from-bottom duration-300`}
            >
              <div
                className={`flex gap-4 max-w-3xl ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-[#F58220] to-[#E0741C]"
                      : "bg-gradient-to-br from-[#333333] to-[#555555]"
                  }`}
                >
                  {message.role === "user" ? (
                    <User size={16} className="text-white" />
                  ) : (
                    <Bot size={16} className="text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div
                  className={`flex-1 px-4 py-3 rounded-2xl ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-[#F58220] to-[#E0741C] text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <MarkdownMessage 
                    content={message.message} 
                    isUser={message.role === "user"}
                  />
                  <span
                    className={`text-xs mt-2 block ${
                      message.role === "user" ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {sending && (
          <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
            <div className="flex gap-4 max-w-3xl">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#333333] to-[#555555]">
                <Bot size={16} className="text-white" />
              </div>
              <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <LoadingSpinner size="small" />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#F58220] rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-[#F58220] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-1 bg-[#F58220] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="flex-shrink-0 p-6 bg-white/50 backdrop-blur-sm border-t border-gray-200/50">
        <div className="max-w-3xl mx-auto">
          {isReadOnlyMode ? (
            /* Read-Only Mode Message */
            <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <FileText size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    Viewing Chat History
                  </p>
                  <p className="text-xs text-amber-700">
                    Select a document to continue this conversation
                  </p>
                </div>
              </div>
              <PrimaryButton
                onClick={onOpenDocumentSelector}
                variant="primary"
                size="sm"
                className="shadow-sm whitespace-nowrap"
              >
                <FileText size={16} />
                <span>Select Document</span>
              </PrimaryButton>
            </div>
          ) : (
            /* Normal Input Mode */
            <>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <ChatTextArea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your documents..."
                    disabled={sending || !hasDocuments}
                    maxRows={4}
                    className="w-full border border-gray-300 focus:border-[#F58220] focus:ring-2 focus:ring-[#F58220]/20 rounded-xl px-4 py-3 resize-none bg-white shadow-sm"
                  />
                </div>
                <IconButton
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || sending || !hasDocuments}
                  variant="primary"
                  size="lg"
                  tooltip={sending ? "Sending..." : "Send message"}
                  className="bg-gradient-to-r from-[#F58220] to-[#E0741C] hover:from-[#E0741C] hover:to-[#D06419] shadow-sm hover:shadow-md flex-shrink-0 border-0 rounded-xl"
                >
                  {sending ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Send size={18} />
                  )}
                </IconButton>
              </div>
              <div className="flex items-center justify-center mt-3">
                <p className="text-xs text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send • 
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs ml-1">Shift + Enter</kbd> for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;