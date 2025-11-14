// src/components/ui/ChatSidebar.jsx
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
  FileText,
} from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import IconButton from "./IconButton";
import ChatCard from "./ChatCard";
import LoadingSpinner from "./LoadingSpinner";

const ChatSidebar = ({ onNewChat, minimal = false }) => {
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

  const handleNewChat = () => {
      startNewChat(); // Fallback to original behavior
    
  };

  return (
    <div className={`${minimal ? 'w-full' : 'w-80 sm:w-80'} bg-white ${minimal ? '' : 'border-r border-gray-200'} flex flex-col ${minimal ? '' : 'shadow-lg'} h-full`}>
      {/* Header */}
      {!minimal && (
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#F58220] to-[#E0741C]">
          <PrimaryButton
            onClick={handleNewChat}
            variant="secondary"
            size="lg"
            className="w-full shadow-md font-semibold bg-white text-[#F58220] hover:bg-gray-50 border-0"
          >
            <Plus size={20} />
            <span className="ml-2">New Chat</span>
          </PrimaryButton>
        </div>
      )}
      
      {minimal && (
        <div className="p-4 border-b border-gray-200">
          <PrimaryButton
            onClick={handleNewChat}
            variant="primary"
            size="md"
            className="w-full"
          >
            <Plus size={18} />
            <span className="ml-2">New Chat</span>
          </PrimaryButton>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && chatHeads.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner size="md" />
          </div>
        ) : chatHeads.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="p-4 bg-gradient-to-br from-[#F58220]/10 to-[#E0741C]/10 rounded-xl mb-4">
              <MessageSquare size={48} className="mx-auto text-[#F58220] mb-3" />
            </div>
            <p className="text-gray-600 text-sm font-medium mb-2">
              No conversations yet
            </p>
            <p className="text-gray-500 text-xs">
              Click "New Chat" to start your first conversation!
            </p>
          </div>
        ) : (
          chatHeads.map((chat) => (
            <ChatCard
              key={chat.id}
              onClick={() => !editingChatId && switchToChat(chat.id)}
              variant={activeChatId === chat.id ? "primary" : "default"}
              padding="md"
              hover={!editingChatId}
              className={`group relative cursor-pointer transition-all ${
                activeChatId === chat.id
                  ? "border-2 border-[#F58220] shadow-md bg-gradient-to-r from-[#F58220]/5 to-[#E0741C]/5"
                  : "hover:border-gray-300"
              }`}
            >
              {editingChatId === chat.id ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border-2 border-[#F58220]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(chat.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <IconButton
                    onClick={() => handleSaveEdit(chat.id)}
                    variant="ghost"
                    size="sm"
                    className="text-green-600 hover:bg-green-100"
                  >
                    <Check size={16} />
                  </IconButton>
                  <IconButton
                    onClick={handleCancelEdit}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-100"
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-lg ${
                        activeChatId === chat.id 
                          ? "bg-[#F58220]/20" 
                          : "bg-gray-100"
                      }`}>
                        <FileText size={14} className={
                          activeChatId === chat.id ? "text-[#F58220]" : "text-gray-600"
                        } />
                      </div>
                      <h3 className={`text-sm font-semibold truncate ${
                        activeChatId === chat.id ? "text-[#F58220]" : "text-gray-900"
                      }`}>
                        {chat.title || "New Chat"}
                      </h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(chat);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-[#F58220]"
                      >
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton
                        onClick={(e) => handleDelete(chat.id, e)}
                        variant="danger"
                        size="sm"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>{formatRelativeTime(chat.last_active_at || chat.created_at)}</span>
                  </div>
                </>
              )}
            </ChatCard>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;