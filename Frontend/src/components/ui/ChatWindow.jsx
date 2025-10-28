// src/components/ui/ChatWindow.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { Send, Bot, User, Sparkles, FileText, MessageCircle } from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import IconButton from "./IconButton";
import ChatCard from "./ChatCard";
import LoadingSpinner from "./LoadingSpinner";
import ChatTextArea from "./ChatTextArea";

const ChatWindow = ({ onOpenDocumentSelector, onCloseSidebar }) => {
  const {
    activeChatId,
    messages,
    selectedDocumentId,
    loading,
    sendMessage,
    fetchMessages,
  } = useChatbot();

  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];

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
    if (!inputMessage.trim() || !selectedDocumentId || sending) return;

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

  if (!selectedDocumentId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-yellow-50/50 to-orange-50/50">
        <ChatCard variant="primary" padding="xl" className="text-center max-w-lg shadow-lg">
          <div className="inline-flex p-6 bg-gradient-to-br from-[#FDB913]/10 to-[#F58220]/10 rounded-full mb-6">
            <Sparkles size={64} className="text-[#FDB913]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Select a Document to Get Started
          </h2>
          <p className="text-gray-600 mb-6">
            Choose a processed document to start an intelligent conversation and get insights from your content.
          </p>
          <PrimaryButton
            onClick={onOpenDocumentSelector}
            size="lg"
            className="mx-auto"
          >
            <FileText size={20} />
            <span>Choose Document</span>
          </PrimaryButton>
        </ChatCard>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-yellow-50/30 to-white">
      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6" onClick={onCloseSidebar}>
        {currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <ChatCard variant="primary" padding="xl" className="text-center max-w-lg shadow-lg">
              <div className="inline-flex p-6 bg-gradient-to-br from-[#FDB913]/10 to-[#F58220]/10 rounded-full mb-6">
                <Bot size={64} className="text-[#FDB913]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Start a Conversation
              </h2>
              <p className="text-gray-600 mb-6">
                Ask me anything about your selected document. I'm here to help you understand and extract insights!
              </p>
              <div className="grid gap-3">
                <ChatCard
                  onClick={() => setInputMessage("Summarize the key points from this document")}
                  hover={true}
                  padding="md"
                  className="text-left border-2 border-[#FDB913]/20 hover:border-[#FDB913]/40 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FDB913]/10 rounded-lg group-hover:bg-[#FDB913]/20 transition-colors">
                      <Sparkles size={18} className="text-[#FDB913]" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-[#FDB913]">
                      Summarize the key points
                    </span>
                  </div>
                </ChatCard>
                <ChatCard
                  onClick={() => setInputMessage("What are the main topics covered?")}
                  hover={true}
                  padding="md"
                  className="text-left border-2 border-[#F58220]/20 hover:border-[#F58220]/40 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F58220]/10 rounded-lg group-hover:bg-[#F58220]/20 transition-colors">
                      <MessageCircle size={18} className="text-[#F58220]" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-[#F58220]">
                      What are the main topics?
                    </span>
                  </div>
                </ChatCard>
              </div>
            </ChatCard>
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
                className={`flex gap-4 max-w-4xl ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-[#FDB913] to-[#F58220]"
                      : "bg-gradient-to-br from-gray-600 to-gray-700"
                  }`}
                >
                  {message.role === "user" ? (
                    <User size={20} className="text-white" />
                  ) : (
                    <Bot size={20} className="text-white" />
                  )}
                </div>

                {/* Message Content */}
                <ChatCard
                  variant={message.role === "user" ? "primary" : "default"}
                  padding="md"
                  className={`flex-1 shadow-md ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-[#FDB913] to-[#F58220] text-white border-0"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      message.role === "user" ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {message.message}
                  </p>
                  <span
                    className={`text-xs mt-3 block ${
                      message.role === "user" ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </ChatCard>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {sending && (
          <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
            <div className="flex gap-4 max-w-4xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-700 shadow-lg">
                <Bot size={20} className="text-white" />
              </div>
              <ChatCard padding="md" className="shadow-md">
                <div className="flex items-center gap-3">
                  <LoadingSpinner size="small" />
                  <span className="text-sm text-gray-600 font-medium">AI is thinking...</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#FDB913] rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-[#FDB913] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-1 bg-[#FDB913] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </ChatCard>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 sm:p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 sm:gap-4 items-end">
            <div className="flex-1">
              <ChatTextArea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your document..."
                disabled={sending || !selectedDocumentId}
                maxRows={3}
                className="w-full"
              />
            </div>
            <IconButton
              onClick={handleSend}
              disabled={!inputMessage.trim() || sending || !selectedDocumentId}
              variant="primary"
              size="lg"
              tooltip={sending ? "Sending..." : "Send message"}
              className="shadow-lg hover:shadow-xl flex-shrink-0"
            >
              {sending ? (
                <LoadingSpinner size="small" />
              ) : (
                <Send size={18} className="sm:w-5 sm:h-5" />
              )}
            </IconButton>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-500 hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to send • 
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs ml-1">Shift + Enter</kbd> for new line
            </p>
            <p className="text-xs text-gray-500 sm:hidden">
              Tap send or press Enter
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="hidden sm:inline">AI Ready</span>
              <span className="sm:hidden">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;