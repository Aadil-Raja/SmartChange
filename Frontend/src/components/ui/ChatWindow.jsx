// src/components/chatbot/ChatWindow.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { Send, Bot, User, Sparkles } from "lucide-react";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";
import TextArea3 from "./TextArea3";

const ChatWindow = () => {
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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="inline-flex p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
            <Sparkles size={64} className="text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Select a Document to Get Started
          </h2>
          <p className="text-gray-600 mb-6">
            Choose a processed document from the top right to start asking questions about it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="inline-flex p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
                <Bot size={64} className="text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Start a Conversation
              </h2>
              <p className="text-gray-600 mb-6">
                Ask me anything about your selected document. I'm here to help you understand and extract insights!
              </p>
              <div className="grid gap-3">
                <button
                  onClick={() => setInputMessage("Summarize the key points from this document")}
                  className="px-4 py-3 bg-white border-2 border-indigo-200 rounded-lg text-left hover:border-indigo-400 hover:shadow-md transition-all group"
                >
                  <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                    ✨ Summarize the key points
                  </span>
                </button>
                <button
                  onClick={() => setInputMessage("What are the main topics covered?")}
                  className="px-4 py-3 bg-white border-2 border-purple-200 rounded-lg text-left hover:border-purple-400 hover:shadow-md transition-all group"
                >
                  <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                    📚 What are the main topics?
                  </span>
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
                className={`flex gap-3 max-w-3xl ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-indigo-500 to-purple-500"
                      : "bg-gradient-to-br from-green-500 to-teal-500"
                  }`}
                >
                  {message.role === "user" ? (
                    <User size={20} className="text-white" />
                  ) : (
                    <Bot size={20} className="text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div
                  className={`flex-1 ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
                      : "bg-white border border-gray-200"
                  } rounded-2xl px-4 py-3 shadow-md`}
                >
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      message.role === "user" ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {message.message}
                  </p>
                  <span
                    className={`text-xs mt-2 block ${
                      message.role === "user" ? "text-white/70" : "text-gray-500"
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
            <div className="flex gap-3 max-w-3xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-500">
                <Bot size={20} className="text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-md">
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="small" />
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-gray-50 rounded-2xl border-2 border-gray-200 focus-within:border-indigo-400 transition-colors">
              <TextArea3
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your document..."
                rows={1}
                disabled={sending || !selectedDocumentId}
                className="resize-none bg-transparent border-0 focus:ring-0 text-sm"
                style={{ minHeight: "44px", maxHeight: "120px" }}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || sending || !selectedDocumentId}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              {sending ? (
                <LoadingSpinner size="small" />
              ) : (
                <Send size={20} />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send • Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;