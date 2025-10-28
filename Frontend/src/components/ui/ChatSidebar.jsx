// src/components/chatbot/ChatSidebar.jsx
import { useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import {
  Plus,
  MessageSquare,
  Clock,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import Button from "../ui/Button";
import LoadingSpinner from "../ui/LoadingSpinner";

const ChatSidebar = () => {
  const {
    chatHeads,
    activeChatId,
    loading,
    startNewChat,
    switchToChat,
    renameChat,
    deleteChat,
  } = useChatbot();

  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleStartEdit = (chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveEdit = async (chatId) => {
    if (editTitle.trim()) {
      await renameChat(chatId, editTitle.trim());
    }
    setEditingChatId(null);
    setEditTitle("");
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditTitle("");
  };

  const handleDelete = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this chat?")) {
      await deleteChat(chatId);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600">
        <Button
          onClick={startNewChat}
          className="w-full bg-white text-indigo-600 hover:bg-gray-50 shadow-md font-semibold"
        >
          <Plus size={20} />
          <span className="ml-2">New Chat</span>
        </Button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && chatHeads.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner size="md" />
          </div>
        ) : chatHeads.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              No chats yet. Start a new conversation!
            </p>
          </div>
        ) : (
          chatHeads.map((chat) => (
            <div
              key={chat.id}
              onClick={() => !editingChatId && switchToChat(chat.id)}
              className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                activeChatId === chat.id
                  ? "bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-400 shadow-md"
                  : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {editingChatId === chat.id ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(chat.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(chat.id)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`text-sm font-semibold line-clamp-1 flex-1 ${
                      activeChatId === chat.id ? "text-indigo-900" : "text-gray-900"
                    }`}>
                      {chat.title || "New Chat"}
                    </h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(chat);
                        }}
                        className="p-1 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(chat.id, e)}
                        className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>{formatRelativeTime(chat.last_active_at || chat.created_at)}</span>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;