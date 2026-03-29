// src/components/ui/ChatSidebar.jsx
import { useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { Plus, MessageSquare, Clock, Edit2, Trash2, Check, X, FileText } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

const ChatSidebar = ({ onNewChat, minimal = false }) => {
  const { chatHeads, activeChatId, loading, startNewChat, switchToChat, renameChat, deleteChat } = useChatbot();
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

  const handleStartEdit = (chat) => { setEditingChatId(chat.id); setEditTitle(chat.title); };
  const handleSaveEdit = async (chatId) => {
    if (editTitle.trim()) await renameChat(chatId, editTitle.trim());
    setEditingChatId(null); setEditTitle("");
  };
  const handleCancelEdit = () => { setEditingChatId(null); setEditTitle(""); };
  const handleDelete = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm("Delete this chat?")) await deleteChat(chatId);
  };
  const handleNewChat = () => { if (onNewChat) onNewChat(); else startNewChat(); };

  return (
    <div className="flex flex-col h-full" style={{ background: "#fff" }}>

      {/* New Chat button */}
      <div className="flex-shrink-0 p-3" style={{ borderBottom: "1px solid #e8dfd2" }}>
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "#1A1209", color: "#faf6ef" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        >
          <Plus size={15} /> New Chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && chatHeads.length === 0 ? (
          <div className="flex justify-center items-center h-24">
            <LoadingSpinner size="md" />
          </div>
        ) : chatHeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FAF6EF" }}>
              <MessageSquare size={22} style={{ color: "#F58220" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#3D2C1C" }}>No conversations yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(65,50,24,0.5)" }}>Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {chatHeads.map((chat) => {
              const isActive = activeChatId === chat.id;
              const isEditing = editingChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => !isEditing && switchToChat(chat.id)}
                  className="group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all"
                  style={{
                    background: isActive ? "#FAF6EF" : "transparent",
                    border: isActive ? "1px solid #e0d8ce" : "1px solid transparent",
                    boxShadow: isActive ? "inset 3px 0 0 #F58220" : "none",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#FAF6EF"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs rounded-lg outline-none"
                        style={{ border: "1.5px solid #F58220", color: "#1A1209", background: "#fff" }}
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(chat.id); if (e.key === "Escape") handleCancelEdit(); }}
                      />
                      <button onClick={() => handleSaveEdit(chat.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "#15803d" }}><Check size={13} /></button>
                      <button onClick={handleCancelEdit} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "#dc2626" }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: isActive ? "#fff0e8" : "#f3ede4" }}
                          >
                            <FileText size={13} style={{ color: isActive ? "#F58220" : "#9c8e80" }} />
                          </div>
                          <span className="text-xs font-semibold truncate" style={{ color: isActive ? "#1A1209" : "#6b5e4e" }}>
                            {chat.title || "New Chat"}
                          </span>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); handleStartEdit(chat); }}
                            className="w-6 h-6 rounded flex items-center justify-center transition-all"
                            style={{ color: "#b0a090" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#F58220"; e.currentTarget.style.background = "#fff0e8"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#b0a090"; e.currentTarget.style.background = "transparent"; }}
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={e => handleDelete(chat.id, e)}
                            className="w-6 h-6 rounded flex items-center justify-center transition-all"
                            style={{ color: "#b0a090" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.background = "#fff5f5"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#b0a090"; e.currentTarget.style.background = "transparent"; }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 pl-9">
                        <Clock size={9} style={{ color: "#c4b8a8" }} />
                        <span className="text-[10px]" style={{ color: "#c4b8a8" }}>
                          {formatRelativeTime(chat.last_active_at || chat.created_at)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;