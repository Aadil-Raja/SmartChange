// RAGChatbot.jsx — Enhanced UI. Zero functionality changes.
// Improvements: larger type scale, richer spacing, refined animations,
// stronger visual hierarchy, better empty states, premium micro-interactions.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ChatTextArea from "../../components/ui/ChatTextArea";
import MarkdownMessage from "../../components/ui/MarkdownMessage";
import DocumentCitationViewer from "../../components/ui/DocumentCitationViewer";
import TokenUsageBar from "../../components/ui/TokenUsageBar";
import EmployeeSidebar from "../../components/ui/EmployeeSidebar";
import Alert from "../../components/ui/Alert";
import { getDocumentSuggestedQuestions } from "../../services/documentService";

/* ─────────────────────────────────────────
   GLOBAL CSS — Ink on Parchment, elevated
───────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,300;1,9..144,400;1,9..144,600;1,9..144,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300;1,9..40,400&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');

  :root {
    /* ── Palette ── */
    --ink:       #0e0b07;
    --ink-2:     #1c1710;
    --ink-3:     #2e2619;
    --ink-4:     rgba(14,11,7,0.78);
    --ink-5:     rgba(14,11,7,0.52);
    --ink-6:     rgba(14,11,7,0.34);
    --ink-7:     rgba(14,11,7,0.16);
    --ink-8:     rgba(14,11,7,0.08);

    --parchment:   #f7f2e9;
    --parchment-2: #f0e9db;
    --parchment-3: #e8dece;
    --parchment-4: #d8ccb8;

    --canvas:    #faf6ef;
    --panel:     #f4ede2;

    --gold:      #e8922a;
    --gold-2:    #c97a18;
    --gold-3:    #f5aa55;
    --gold-4:    #ffeabc;
    --gold-dim:  rgba(232,146,42,0.13);
    --gold-glow: rgba(232,146,42,0.24);
    --gold-halo: rgba(232,146,42,0.07);
    --gold-line: rgba(232,146,42,0.38);

    --teal:      #1a8a7a;
    --teal-dim:  rgba(26,138,122,0.11);
    --red:       #c0392b;
    --red-dim:   rgba(192,57,43,0.1);
    --blue:      #2563eb;
    --blue-dim:  rgba(37,99,235,0.08);

    /* ── Typography — ENLARGED SCALE ── */
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
    --font-mono:    'DM Mono', 'Fira Code', monospace;

    /* Base size bumped to 15px → everything scales up */
    font-size: 15px;

    /* ── Radii ── */
    --r-xs:  5px;
    --r-sm:  10px;
    --r-md:  16px;
    --r-lg:  22px;
    --r-xl:  30px;
    --r-2xl: 44px;

    /* ── Shadows ── */
    --shadow-xs: 0 1px 4px rgba(14,11,7,0.07);
    --shadow-sm: 0 2px 10px rgba(14,11,7,0.1), 0 1px 3px rgba(14,11,7,0.06);
    --shadow-md: 0 6px 24px rgba(14,11,7,0.13), 0 2px 8px rgba(14,11,7,0.07);
    --shadow-lg: 0 14px 44px rgba(14,11,7,0.17), 0 4px 14px rgba(14,11,7,0.08);
    --shadow-xl: 0 28px 72px rgba(14,11,7,0.22), 0 8px 28px rgba(14,11,7,0.1);
    --shadow-gold: 0 0 40px rgba(232,146,42,0.22), 0 4px 20px rgba(232,146,42,0.12);

    /* ── Easings ── */
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-back:   cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--parchment-3); border-radius: 99px; transition: background 0.2s; }
  ::-webkit-scrollbar-thumb:hover { background: var(--gold); }

  /* ── Selection ── */
  ::selection { background: var(--gold-dim); color: var(--ink); }

  /* ── Keyframes ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.91) translateY(14px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-18px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes msg-user {
    from { opacity: 0; transform: translateX(28px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes msg-ai {
    from { opacity: 0; transform: translateX(-28px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
  }
  @keyframes orbit-slow {
    from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
  }
  @keyframes orbit-reverse {
    from { transform: rotate(0deg) translateX(60px) rotate(0deg); }
    to   { transform: rotate(-360deg) translateX(60px) rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes bounce-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
    40%           { transform: translateY(-8px); opacity: 1; }
  }
  @keyframes check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes logo-breathe {
    0%, 100% { box-shadow: 0 0 0 4px rgba(232,146,42,0.09), 0 0 20px rgba(232,146,42,0.1); }
    50%       { box-shadow: 0 0 0 6px rgba(232,146,42,0.14), 0 0 40px rgba(232,146,42,0.2); }
  }
  @keyframes border-dance {
    0%, 100% { border-color: rgba(232,146,42,0.38); box-shadow: 0 0 0 4px var(--gold-dim), var(--shadow-sm); }
    50%       { border-color: rgba(232,146,42,0.65); box-shadow: 0 0 0 5px rgba(232,146,42,0.09), var(--shadow-sm); }
  }
  @keyframes grain {
    0%, 100% { transform: translate(0, 0); }
    10%  { transform: translate(-2%, -3%); }
    20%  { transform: translate(3%, 2%); }
    30%  { transform: translate(-1%, 4%); }
    40%  { transform: translate(2%, -2%); }
    50%  { transform: translate(-3%, 1%); }
    60%  { transform: translate(1%, 3%); }
    70%  { transform: translate(-2%, -1%); }
    80%  { transform: translate(3%, -3%); }
    90%  { transform: translate(-1%, 2%); }
  }
  @keyframes shimmer-sweep {
    0%   { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(300%) skewX(-12deg); }
  }
  @keyframes underline-grow {
    from { width: 0; }
    to   { width: 100%; }
  }
`;

/* ─── Utility ─── */
const formatTime = (ds) => {
  const d = new Date(ds), n = new Date();
  const diff = Math.floor((n - d) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  const days = Math.floor(diff / 1440);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const groupByDate = (chats) => {
  const groups = {};
  chats.forEach(c => {
    const d = new Date(c.last_active_at || c.created_at);
    const diff = Math.floor((new Date() - d) / 86400000);
    const key = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? "This week" : "Earlier";
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return groups;
};

const getCitationGroups = (message) => {
  const citations = Array.isArray(message?.citations) ? message.citations : [];
  return citations.map((doc, i) => {
    const refs = Array.isArray(doc?.references) ? doc.references : [];
    const pageMap = new Map();
    refs.forEach(r => {
      const pg = r?.page === null || r?.page === undefined ? null : Number(r.page);
      if (!Number.isFinite(pg) || pg <= 0) return;
      const newSnippets = Array.isArray(r?.snippets) ? r.snippets : [];
      if (!pageMap.has(pg)) {
        pageMap.set(pg, { 
          key: `${doc?.doc_id || i}-${pg}`, 
          page: pg, 
          section: r?.section ?? null, 
          snippets: newSnippets
        });
      } else {
        // Merge snippets from multiple references on the same page
        const existing = pageMap.get(pg);
        existing.snippets = [...new Set([...existing.snippets, ...newSnippets])];
      }
    });
    const pages = Array.from(pageMap.values());
    if (!pages.length) return null;
    return { key: `g-${doc?.doc_id || i}`, docId: doc?.doc_id, docTitle: doc?.doc_title || `Document ${doc?.doc_id}`, cloudinaryUrl: doc?.cloudinary_url || null, pages };
  }).filter(Boolean);
};

/* ─────────────────────────────────────────
   GRAIN TEXTURE
───────────────────────────────────────── */
const GrainOverlay = () => (
  <div style={{
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, opacity: 0.022,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "200px 200px", animation: "grain 0.45s steps(1) infinite", mixBlendMode: "multiply",
  }} />
);

/* ─────────────────────────────────────────
   BACKGROUND MOTIF
───────────────────────────────────────── */
const BackgroundMotif = () => (
  <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
    {/* Warm radial — top right */}
    <div style={{
      position: "absolute", top: -180, right: -180, width: 720, height: 720, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(232,146,42,0.07) 0%, transparent 62%)",
    }} />
    {/* Cool radial — bottom left */}
    <div style={{
      position: "absolute", bottom: -280, left: -80, width: 640, height: 640, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(26,138,122,0.045) 0%, transparent 62%)",
    }} />
    {/* Very subtle grid */}
    <div style={{
      position: "absolute", inset: 0, opacity: 0.016,
      backgroundImage: `linear-gradient(var(--ink) 1px, transparent 1px),linear-gradient(90deg, var(--ink) 1px, transparent 1px)`,
      backgroundSize: "72px 72px",
    }} />
    {/* Diagonal lines — bottom right corner */}
    <svg style={{ position: "absolute", bottom: 0, right: 0, opacity: 0.025 }} width="440" height="440" viewBox="0 0 440 440">
      {[0, 80, 160, 240, 320].map(o => (
        <line key={o} x1={440} y1={o} x2={o} y2={440} stroke="var(--ink)" strokeWidth="1"/>
      ))}
    </svg>
  </div>
);

/* ─────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────── */
const Sidebar = ({ onNewChat }) => {
  const { chatHeads, activeChatId, loading, startNewChat, switchToChat, renameChat, deleteChat } = useChatbot();
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [hovered, setHovered] = useState(null);
  const groups = useMemo(() => groupByDate(chatHeads), [chatHeads]);
  const groupOrder = ["Today", "Yesterday", "This week", "Earlier"];

  const handleNew = () => (onNewChat ? onNewChat() : startNewChat());
  const startEdit = (c, e) => { e.stopPropagation(); setEditingId(c.id); setEditVal(c.title); };
  const saveEdit = async (id) => { if (editVal.trim()) await renameChat(id, editVal.trim()); setEditingId(null); };
  const handleDel = async (id, e) => { e.stopPropagation(); if (window.confirm("Delete this conversation?")) await deleteChat(id); };

  return (
    <aside style={{
      width: 284, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--parchment)", borderRight: "1px solid var(--parchment-3)",
      height: "100%", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        .sb-new {
          margin: 20px 18px 14px; padding: 13px 18px;
          background: var(--ink); border: none; border-radius: var(--r-md);
          cursor: pointer; font-family: var(--font-body);
          font-size: 14px; font-weight: 600; color: var(--parchment);
          display: flex; align-items: center; gap: 10px; letter-spacing: 0.01em;
          transition: all 0.22s var(--ease-out);
          box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
        }
        .sb-new::after {
          content: ''; position: absolute; top: 0; left: -100%; width: 55%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
          transition: left 0.55s ease;
        }
        .sb-new:hover { background: var(--ink-3); transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .sb-new:hover::after { left: 150%; }
        .sb-new:active { transform: translateY(0) scale(0.99); }
        .sb-new-icon {
          width: 22px; height: 22px; border-radius: 7px;
          background: rgba(255,255,255,0.12); display: flex;
          align-items: center; justify-content: center; flex-shrink: 0;
        }

        .sb-divider { height: 1px; background: var(--parchment-3); margin: 0 18px 6px; }

        .sb-group-label {
          padding: 16px 20px 6px; font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ink-6); font-family: var(--font-mono);
        }

        .sb-item {
          margin: 2px 10px; padding: 11px 12px; border-radius: var(--r-sm);
          cursor: pointer; display: flex; align-items: flex-start; gap: 11px;
          border: 1px solid transparent; transition: all 0.17s ease;
          position: relative; animation: slideRight 0.22s ease both;
        }
        .sb-item:hover { background: var(--parchment-2); border-color: var(--parchment-4); }
        .sb-item.active { background: var(--parchment-3); border-color: var(--parchment-4); }
        .sb-item.active::before {
          content: ''; position: absolute; left: -1px; top: 22%; bottom: 22%;
          width: 3px; border-radius: 0 3px 3px 0; background: var(--gold);
        }

        .sb-icon {
          width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--parchment-2); border: 1px solid var(--parchment-3);
          margin-top: 1px; transition: all 0.16s;
        }
        .sb-item.active .sb-icon { background: var(--gold-dim); border-color: rgba(232,146,42,0.28); }

        .sb-title {
          font-size: 13.5px; font-weight: 500; color: var(--ink-5);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.35; flex: 1; min-width: 0; font-family: var(--font-body);
          transition: color 0.15s;
        }
        .sb-item.active .sb-title, .sb-item:hover .sb-title { color: var(--ink); }

        .sb-time {
          font-size: 10px; color: var(--ink-6); font-family: var(--font-mono); margin-top: 3px;
        }

        .sb-actions {
          position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
          display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s;
        }
        .sb-item:hover .sb-actions { opacity: 1; }

        .sb-act {
          width: 26px; height: 26px; border-radius: 7px; border: none;
          background: transparent; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-5); transition: all 0.15s;
        }
        .sb-act:hover.edit { color: var(--gold-2); background: var(--gold-dim); }
        .sb-act:hover.del  { color: var(--red); background: var(--red-dim); }

        .sb-rename {
          background: var(--canvas); border: 1.5px solid var(--gold);
          border-radius: 7px; padding: 4px 9px; font-size: 13px;
          color: var(--ink); font-family: var(--font-body); outline: none;
          flex: 1; min-width: 0; box-shadow: 0 0 0 3px var(--gold-dim);
        }

        .sb-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; gap: 14px;
          text-align: center; padding: 40px 28px;
        }
        .sb-empty-icon {
          width: 56px; height: 56px; border-radius: 18px;
          background: var(--parchment-2); border: 1px solid var(--parchment-3);
          display: flex; align-items: center; justify-content: center;
          animation: float 3.5s ease-in-out infinite;
        }
      `}</style>

      {/* Top warm wash */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90,
        background: "linear-gradient(180deg, rgba(232,146,42,0.05) 0%, transparent 100%)",
        pointerEvents: "none", zIndex: 1 }} />

      <button className="sb-new" onClick={handleNew}>
        <span className="sb-new-icon">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1.5v8M1.5 5.5h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </span>
        New conversation
      </button>

      <div className="sb-divider" />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24, position: "relative", zIndex: 2 }}>
        {loading && chatHeads.length === 0 ? (
          <div className="sb-empty"><LoadingSpinner size="md" /></div>
        ) : chatHeads.length === 0 ? (
          <div className="sb-empty">
            <div className="sb-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H8L3 22.5V7a2 2 0 012-2z" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-4)", fontFamily: "var(--font-body)" }}>No conversations yet</p>
            <p style={{ fontSize: 11.5, color: "var(--ink-6)", fontFamily: "var(--font-mono)" }}>Start chatting to begin</p>
          </div>
        ) : (
          groupOrder.map(g => {
            const chats = groups[g];
            if (!chats) return null;
            return (
              <div key={g}>
                <div className="sb-group-label">{g}</div>
                {chats.map((chat, i) => {
                  const isActive = activeChatId === chat.id;
                  const isEditing = editingId === chat.id;
                  return (
                    <div key={chat.id} className={`sb-item ${isActive ? "active" : ""}`}
                      style={{ animationDelay: `${i * 0.035}s` }}
                      onClick={() => !isEditing && switchToChat(chat.id)}
                      onMouseEnter={() => setHovered(chat.id)}
                      onMouseLeave={() => setHovered(null)}>
                      <div className="sb-icon">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M1.5 1.5h10a.5.5 0 01.5.5v7a.5.5 0 01-.5.5H4.5L1 12V2a.5.5 0 01.5-.5z"
                            stroke={isActive ? "var(--gold)" : "var(--ink-5)"} strokeWidth="1.3" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: hovered === chat.id && !isEditing ? 56 : 0 }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                            <input className="sb-rename" value={editVal} autoFocus
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveEdit(chat.id); if (e.key === "Escape") setEditingId(null); }} />
                            <button className="sb-act edit" onClick={() => saveEdit(chat.id)}>
                              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <path d="M1.5 5.5l3 3 5-5" stroke="var(--teal)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="sb-title">{chat.title || "New Conversation"}</div>
                            <div className="sb-time">{formatTime(chat.last_active_at || chat.created_at)}</div>
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="sb-actions">
                          <button className="sb-act edit" title="Rename" onClick={e => startEdit(chat, e)}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M7.5 1.5l3 3L4 11H1V8l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button className="sb-act del" title="Delete" onClick={e => handleDel(chat.id, e)}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M1.5 3.5h9M4.5 3.5v-2h3v2M3.5 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
        background: "linear-gradient(0deg, var(--parchment) 0%, transparent 100%)",
        pointerEvents: "none" }} />
    </aside>
  );
};

/* ─────────────────────────────────────────
   DOCUMENT SELECTOR MODAL
───────────────────────────────────────── */
const DocSelector = ({ onClose }) => {
  const { availableDocuments, selectedDocumentIds, loading, selectDocument, fetchDocuments, maxActiveDocs } = useChatbot();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(selectedDocumentIds || []);
  const [limitWarning, setLimitWarning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => { setMounted(true); setTimeout(() => inputRef.current?.focus(), 180); });
    if (!availableDocuments.length) fetchDocuments();
  }, []);

  const filtered = availableDocuments.filter(d => d.title.toLowerCase().includes(q.toLowerCase()));
  const allSel = filtered.length > 0 && filtered.every(d => sel.includes(d.id));

  const toggle = (id) => setSel(p => {
    if (p.includes(id)) { setLimitWarning(false); return p.filter(x => x !== id); }
    if (p.length >= maxActiveDocs) { setLimitWarning(true); return p; }
    setLimitWarning(false); return [...p, id];
  });

  const toggleAll = () => {
    if (allSel) { setSel([]); setLimitWarning(false); return; }
    setSel(filtered.slice(0, maxActiveDocs).map(d => d.id));
    setLimitWarning(filtered.length > maxActiveDocs);
  };

  const confirm = () => {
    selectedDocumentIds.forEach(id => { if (!sel.includes(id)) selectDocument(id); });
    sel.forEach(id => { if (!selectedDocumentIds.includes(id)) selectDocument(id); });
    onClose();
  };

  return (
    <>
      <style>{`
        .ds-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(14,11,7,0.52);
          backdrop-filter: blur(22px) saturate(0.8);
          display: flex; align-items: center; justify-content: center;
          padding: 28px; animation: fadeIn 0.18s ease;
        }
        .ds-modal {
          width: 100%; max-width: 580px; max-height: 88vh;
          background: var(--canvas); border: 1px solid var(--parchment-3);
          border-radius: var(--r-xl); display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-xl), 0 0 0 1px rgba(232,146,42,0.1);
          transition: all 0.4s var(--ease-spring);
          transform: ${mounted ? "translateY(0) scale(1)" : "translateY(32px) scale(0.94)"};
          opacity: ${mounted ? 1 : 0};
        }
        .ds-head {
          padding: 30px 30px 0;
          background: linear-gradient(180deg, var(--parchment) 0%, var(--canvas) 100%);
          position: relative; overflow: hidden;
        }
        .ds-head::after {
          content: ''; position: absolute; top: -80px; right: -80px;
          width: 260px; height: 260px; border-radius: 50%;
          background: radial-gradient(circle, rgba(232,146,42,0.09) 0%, transparent 65%);
          pointer-events: none;
        }
        .ds-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
        .ds-icon-box {
          width: 46px; height: 46px; border-radius: 14px;
          background: var(--gold-dim); border: 1px solid rgba(232,146,42,0.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; box-shadow: 0 0 0 5px var(--gold-halo);
        }
        .ds-modal-title {
          font-family: var(--font-display); font-size: 24px; font-weight: 700;
          color: var(--ink); letter-spacing: -0.03em; line-height: 1.1;
        }
        .ds-modal-sub {
          font-size: 12px; color: var(--ink-5); font-family: var(--font-mono);
          margin-top: 5px; letter-spacing: 0.03em;
        }
        .ds-close {
          width: 34px; height: 34px; border-radius: var(--r-sm);
          border: 1px solid var(--parchment-3); background: var(--parchment);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: var(--ink-5); flex-shrink: 0; transition: all 0.16s;
        }
        .ds-close:hover { border-color: var(--parchment-4); color: var(--ink); background: var(--parchment-2); }
        .ds-search-wrap { position: relative; margin: 22px 0 20px; }
        .ds-search-icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--ink-5); pointer-events: none; }
        .ds-search {
          width: 100%; padding: 13px 16px 13px 46px;
          background: var(--parchment-2); border: 1.5px solid var(--parchment-3);
          border-radius: var(--r-md); color: var(--ink); font-family: var(--font-body);
          font-size: 14px; outline: none; transition: all 0.2s;
        }
        .ds-search:focus { background: var(--canvas); border-color: var(--gold); box-shadow: 0 0 0 4px var(--gold-dim); }
        .ds-search::placeholder { color: var(--ink-6); }
        .ds-meta-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 30px 14px; border-bottom: 1px solid var(--parchment-3);
        }
        .ds-count-label { font-size: 11px; color: var(--ink-6); font-family: var(--font-mono); letter-spacing: 0.04em; }
        .ds-select-all {
          background: none; border: none; cursor: pointer;
          font-family: var(--font-mono); font-size: 11px; font-weight: 500;
          color: var(--gold-2); padding: 3px 9px; border-radius: 7px; transition: all 0.15s;
        }
        .ds-select-all:hover { background: var(--gold-dim); }
        .ds-list { flex: 1; overflow-y: auto; padding: 14px 18px 22px; }
        .ds-limit-warn {
          margin-bottom: 14px; padding: 11px 16px; border-radius: var(--r-sm);
          font-size: 12px; color: #92400e; background: rgba(251,191,36,0.12);
          border: 1px solid rgba(251,191,36,0.3); font-family: var(--font-mono); letter-spacing: 0.02em;
        }
        .ds-item {
          display: flex; align-items: center; gap: 14px; padding: 14px 16px;
          border-radius: var(--r-md); cursor: pointer; margin-bottom: 6px;
          border: 1.5px solid transparent; transition: all 0.18s ease;
          position: relative; overflow: hidden;
        }
        .ds-item::before {
          content: ''; position: absolute; top: 0; left: -50%; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(232,146,42,0.06), transparent);
          opacity: 0; transition: opacity 0.25s;
        }
        .ds-item:hover { background: var(--parchment); border-color: var(--parchment-4); }
        .ds-item:hover::before { opacity: 1; }
        .ds-item.sel { background: var(--parchment-2); border-color: rgba(232,146,42,0.38); }
        .ds-file-wrap {
          width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--parchment); border: 1px solid var(--parchment-3); transition: all 0.2s;
        }
        .ds-item.sel .ds-file-wrap { background: var(--gold-dim); border-color: rgba(232,146,42,0.32); }
        .ds-doc-title {
          font-size: 14px; font-weight: 500; color: var(--ink-4); flex: 1; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: var(--font-body); transition: color 0.15s;
        }
        .ds-item.sel .ds-doc-title, .ds-item:hover .ds-doc-title { color: var(--ink); }
        .ds-active-tag {
          padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: var(--teal-dim); color: var(--teal);
          border: 1px solid rgba(26,138,122,0.25); font-family: var(--font-mono);
          display: inline-block; margin-top: 4px;
        }
        .ds-ext {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-6); border: 1px solid transparent; text-decoration: none; transition: all 0.15s;
        }
        .ds-ext:hover { color: var(--gold-2); background: var(--gold-dim); border-color: rgba(232,146,42,0.28); }
        .ds-checkbox {
          width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0;
          border: 1.5px solid var(--parchment-4); background: var(--canvas);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.24s var(--ease-spring);
        }
        .ds-item.sel .ds-checkbox { background: var(--ink); border-color: var(--ink); transform: scale(1.07); box-shadow: 0 0 0 3px var(--gold-dim); }
        .check-svg { stroke-dasharray: 24; stroke-dashoffset: 24; animation: check-draw 0.22s ease 0.06s forwards; }
        .ds-footer {
          padding: 18px 24px; border-top: 1px solid var(--parchment-3); background: var(--parchment);
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
        }
        .ds-sel-count { font-size: 12px; color: var(--ink-5); font-family: var(--font-mono); }
        .ds-btn-cancel {
          padding: 10px 20px; border-radius: var(--r-md);
          border: 1.5px solid var(--parchment-3); background: transparent;
          color: var(--ink-4); cursor: pointer; font-family: var(--font-body); font-size: 14px; font-weight: 500; transition: all 0.17s;
        }
        .ds-btn-cancel:hover { border-color: var(--parchment-4); color: var(--ink); background: var(--parchment-2); }
        .ds-btn-confirm {
          padding: 10px 24px; border-radius: var(--r-md); border: none;
          background: var(--ink); color: var(--parchment); cursor: pointer;
          font-family: var(--font-body); font-size: 14px; font-weight: 600;
          display: flex; align-items: center; gap: 8px;
          transition: all 0.2s var(--ease-out); box-shadow: var(--shadow-sm);
        }
        .ds-btn-confirm:hover:not(:disabled) { background: var(--ink-3); transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .ds-btn-confirm:disabled { background: var(--parchment-3); color: var(--ink-6); cursor: not-allowed; box-shadow: none; }
      `}</style>

      <div className="ds-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="ds-modal">
          <div className="ds-head">
            <div className="ds-title-row">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="ds-icon-box">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 2h9l5 5v13H4V2z" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round"/>
                    <path d="M13 2v5h5" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round"/>
                    <path d="M7 10h6M7 13h4" stroke="var(--gold-3)" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="ds-modal-title">Knowledge Sources</div>
                  <div className="ds-modal-sub">Select up to {maxActiveDocs} documents · Responses grounded in your content</div>
                </div>
              </div>
              <button className="ds-close" onClick={onClose}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="ds-search-wrap">
              <svg className="ds-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11.5 11.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input ref={inputRef} className="ds-search" value={q}
                onChange={e => setQ(e.target.value)} placeholder="Search documents…" />
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="ds-meta-bar">
              <span className="ds-count-label">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
              <button className="ds-select-all" onClick={toggleAll}>{allSel ? "Deselect all" : "Select all"}</button>
            </div>
          )}

          <div className="ds-list">
            {limitWarning && (
              <div className="ds-limit-warn">Max {maxActiveDocs} sources — deselect one to add another.</div>
            )}
            {loading && !availableDocuments.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 0", gap: 14 }}>
                <LoadingSpinner size="large" />
                <p style={{ fontSize: 13, color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>Loading documents…</p>
              </div>
            ) : !filtered.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px", textAlign: "center", gap: 14 }}>
                <div style={{ width: 60, height: 60, borderRadius: 20, background: "var(--parchment)", border: "1px solid var(--parchment-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <path d="M5.5 3h11.5L22 7.5V23h-16.5V3z" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M17 3v4.5h5" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--ink-4)" }}>{q ? "No results" : "No documents"}</p>
                <p style={{ fontSize: 12.5, color: "var(--ink-6)", fontFamily: "var(--font-mono)" }}>{q ? "Try a different search term" : "Upload documents to get started"}</p>
                {!q && (
                  <button onClick={fetchDocuments} style={{ padding: "9px 18px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--parchment-3)", background: "var(--parchment)", color: "var(--ink-4)", fontSize: 13, fontFamily: "var(--font-mono)", cursor: "pointer", transition: "all 0.15s" }}>
                    Refresh list
                  </button>
                )}
              </div>
            ) : (
              filtered.map(doc => {
                const isSelected = sel.includes(doc.id);
                const isActive = selectedDocumentIds.includes(doc.id);
                const isDisabled = !isSelected && sel.length >= maxActiveDocs;
                return (
                  <div key={doc.id} className={`ds-item ${isSelected ? "sel" : ""}`}
                    onClick={() => !isDisabled && toggle(doc.id)}
                    style={isDisabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
                    <div className="ds-file-wrap">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4.5 2h9l4.5 4.5V18h-13.5V2z" stroke={isSelected ? "var(--gold)" : "var(--ink-5)"} strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M13.5 2v4.5h4.5" stroke={isSelected ? "var(--gold)" : "var(--ink-5)"} strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M7 10h6M7 13h4" stroke={isSelected ? "var(--gold-3)" : "var(--parchment-4)"} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ds-doc-title">{doc.title}</div>
                      {isActive && <span className="ds-active-tag">● Active</span>}
                    </div>
                    {doc.cloudinary_url && (
                      <a href={doc.cloudinary_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ds-ext">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M5.5 1H12v6.5M12 1L5 8M1 5h3.5M1 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    )}
                    <div className="ds-checkbox">
                      {isSelected && (
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path className="check-svg" d="M1.5 6.5l4 4 6-7.5" stroke="var(--parchment)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="ds-footer">
            <span className="ds-sel-count">{sel.length === 0 ? "Nothing selected" : `${sel.length} source${sel.length !== 1 ? "s" : ""} selected`}</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ds-btn-cancel" onClick={onClose}>Cancel</button>
              <button className="ds-btn-confirm" onClick={confirm} disabled={sel.length === 0}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 7.5l4 4 7.5-9" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Load {sel.length > 0 ? sel.length : ""} source{sel.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────
   DOC QUESTIONS (collapsible per-doc)
───────────────────────────────────────── */
const DocQuestions = ({ docTitle, questions, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? questions : questions.slice(0, 2);
  const btnStyle = { display: 'block', width: '100%', marginBottom: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, transition: 'all 0.15s' };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1h6.5l2 2v7h-8.5V1z" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{docTitle}</span>
      </div>
      {visible.map(q => (
        <button key={q.id} style={btnStyle}
          onClick={() => onSelect(q.text)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,146,42,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,146,42,0.35)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        >{q.text}</button>
      ))}
      {questions.length > 2 && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gold)', padding: '2px 0', fontWeight: 600 }}>
          {expanded ? '▲ Show less' : `▼ +${questions.length - 2} more`}
        </button>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   COPY BUTTON
───────────────────────────────────────── */
const CopyBtn = ({ text, isUser = false }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silently fail */ }
  };
  const baseColor = isUser ? 'rgba(250,246,239,0.45)' : '#b0a090';
  const hoverColor = isUser ? 'rgba(250,246,239,0.8)' : '#7a6a5a';
  return (
    <button onClick={handleCopy} title={copied ? "Copied!" : "Copy"}
      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: copied ? '#22c55e' : baseColor, fontSize: 10, fontWeight: 500, transition: 'color 0.15s' }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = hoverColor; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = copied ? '#22c55e' : baseColor; }}
    >
      {copied
        ? <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="3.5" y="1" width="6.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1"/><rect x="1" y="3.5" width="6.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1" fill="transparent"/></svg>
      }
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

/* ─────────────────────────────────────────
   TYPING INDICATOR
───────────────────────────────────────── */
const TypingBubble = () => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "16px 22px",
    background: "var(--canvas)",
    border: "1px solid var(--parchment-3)",
    borderRadius: "20px 20px 20px 6px",
    width: "fit-content",
    boxShadow: "var(--shadow-xs)",
  }}>
    <span style={{ fontSize: 12, color: "var(--ink-5)", fontFamily: "var(--font-mono)", marginRight: 4, letterSpacing: "0.07em" }}>thinking</span>
    {[0, 1, 2].map(i => (
      <span key={i} style={{
        width: 7, height: 7, borderRadius: "50%", background: "var(--gold)",
        display: "inline-block",
        animation: `bounce-dot 1.2s ${i * 0.18}s ease-in-out infinite`,
      }} />
    ))}
  </div>
);

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
const RAGChatbot = () => {
  const {
    selectedDocumentIds, error, success, clearMessages,
    fetchChatHeads, fetchDocuments, fetchConfig, startNewChat,
    activeChatId, messages, availableDocuments, loading,
    sendMessage, fetchMessages, selectDocument, clearDocumentSelection, quota,
  } = useChatbot();

  const [showDocSel, setShowDocSel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]); // flat, for empty state
  const [suggestedByDoc, setSuggestedByDoc] = useState([]); // [{docId, docTitle, questions}] for panel
  const [inputFocused, setInputFocused] = useState(false);
  const [rerankerModel, setRerankerModel] = useState("fast"); // "fast" or "deep"
  const hasFetched = useRef(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];
  const isReadOnly = activeChatId && (!selectedDocumentIds || !selectedDocumentIds.length);
  const hasDocs = selectedDocumentIds && selectedDocumentIds.length > 0;

  // Debug logging
  console.log('[DEBUG] activeChatId:', activeChatId);
  console.log('[DEBUG] hasDocs:', hasDocs);
  console.log('[DEBUG] selectedDocumentIds:', selectedDocumentIds);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchChatHeads(); fetchDocuments(); fetchConfig();
    }
    return () => clearMessages();
  }, []);

  useEffect(() => { if (activeChatId && !messages[activeChatId]) fetchMessages(activeChatId); }, [activeChatId]);
  useEffect(() => { if (!availableDocuments?.length) fetchDocuments(); }, []);

  // Auto-load docs from last message when switching chats
  useEffect(() => {
    if (!activeChatId) return;
    const msgs = messages[activeChatId];
    if (!msgs?.length) return;
    const lastAssistantMsg = [...msgs].reverse().find(m => m.role === 'assistant' && m.active_doc_ids?.length > 0);
    const fallback = [...msgs].reverse().find(m => m.active_doc_ids?.length > 0);
    const source = lastAssistantMsg || fallback;
    if (!source) return;
    clearDocumentSelection();
    source.active_doc_ids.forEach(id => selectDocument(id));
  }, [activeChatId, messages[activeChatId]?.length]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentMessages, sending]);

  const handleRerankerChange = (newModel) => {
    setRerankerModel(newModel);
  };

  useEffect(() => {
    if (!selectedDocumentIds?.length) {
      setSuggestedQuestions([]);
      setSuggestedByDoc([]);
      return;
    }
    Promise.all(
      selectedDocumentIds.map(id => {
        const doc = availableDocuments.find(d => d.id === id);
        return getDocumentSuggestedQuestions(id)
          .then(res => ({ docId: id, docTitle: doc?.title || `Doc ${id}`, questions: res?.data?.questions || [] }))
          .catch(() => ({ docId: id, docTitle: doc?.title || `Doc ${id}`, questions: [] }));
      })
    ).then(results => {
      // Per-doc grouped for panel
      setSuggestedByDoc(results.filter(r => r.questions.length > 0));
      // Flat merged for empty state (max 5)
      const perDoc = Math.max(1, Math.floor(5 / results.length));
      const seen = new Set(); const merged = [];
      results.forEach(r => r.questions.slice(0, perDoc).forEach(q => { if (!seen.has(q.text)) { seen.add(q.text); merged.push(q); } }));
      results.forEach(r => r.questions.slice(perDoc).forEach(q => { if (merged.length >= 5) return; if (!seen.has(q.text)) { seen.add(q.text); merged.push(q); } }));
      setSuggestedQuestions(merged.slice(0, 5));
    });
  }, [JSON.stringify(selectedDocumentIds), availableDocuments]);

  const handleNewChat = () => { startNewChat(); setShowDocSel(true); };

  const isExhausted = quota?.token_limit != null && quota?.tokens_remaining === 0;

  const handleSend = useCallback(async () => {
    if (!inputMsg.trim() || !hasDocs || sending || isExhausted) return;
    const text = inputMsg.trim();
    const wasNewChat = !activeChatId;
    setInputMsg(""); setSending(true);
    await sendMessage(text, activeChatId, wasNewChat ? text.substring(0, 50) : null, rerankerModel);
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [inputMsg, hasDocs, sending, activeChatId, sendMessage, isExhausted]);

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const QUICK = [
    { icon: "↗", label: "Summarize the key points" },
    { icon: "◎", label: "What are the main topics?" },
    { icon: "✦", label: "Most important takeaways" },
    { icon: "◈", label: "What questions does this answer?" },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <style>{`
        /* ── Root ── */
        .rag-root {
          display: flex; height: 100vh; overflow: hidden;
          background: var(--canvas); font-family: var(--font-body);
          position: relative; color: var(--ink);
        }
        .rag-main { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; overflow: hidden; }

        /* ── Header ── */
        .rag-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 68px; flex-shrink: 0;
          background: rgba(247,242,233,0.93);
          backdrop-filter: blur(28px) saturate(1.3);
          -webkit-backdrop-filter: blur(28px) saturate(1.3);
          border-bottom: 1px solid var(--parchment-3);
          position: relative; z-index: 10;
        }
        /* Gradient hairline under header */
        .rag-header::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, var(--gold-line) 25%, var(--gold-line) 75%, transparent 100%);
        }

        .hdr-brand { display: flex; align-items: center; gap: 16px; }

        /* Hamburger */
        .hdr-menu-btn {
          width: 38px; height: 38px; border-radius: var(--r-sm);
          border: 1px solid var(--parchment-3); background: var(--parchment);
          cursor: pointer; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 4.5px; transition: all 0.17s; flex-shrink: 0;
        }
        .hdr-menu-btn:hover { border-color: var(--parchment-4); background: var(--parchment-2); }
        .hdr-menu-btn span { display: block; height: 1.5px; border-radius: 2px; background: var(--ink-4); transition: all 0.18s; }
        .hdr-menu-btn span:nth-child(1) { width: 15px; }
        .hdr-menu-btn span:nth-child(2) { width: 11px; }
        .hdr-menu-btn span:nth-child(3) { width: 13px; }
        .hdr-menu-btn:hover span { background: var(--ink); }
        .hdr-menu-btn:hover span:nth-child(2) { width: 15px; }

        /* Logo mark */
        .hdr-logomark {
          width: 40px; height: 40px; border-radius: 13px; background: var(--ink);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          animation: logo-breathe 4.5s ease-in-out infinite;
        }

        /* Wordmark */
        .hdr-product-name {
          font-family: var(--font-display); font-size: 18px; font-weight: 700;
          color: var(--ink); letter-spacing: -0.035em; line-height: 1;
        }
        .hdr-product-sub {
          font-family: var(--font-mono); font-size: 10px; color: var(--ink-6);
          letter-spacing: 0.1em; text-transform: uppercase; line-height: 1; margin-top: 3px;
        }

        /* Right actions */
        .hdr-right { display: flex; align-items: center; gap: 10px; }

        .hdr-ghost-btn {
          display: flex; align-items: center; gap: 7px; padding: 8px 15px;
          border-radius: var(--r-sm); border: 1px solid var(--parchment-3);
          background: var(--parchment); color: var(--ink-4); cursor: pointer;
          font-family: var(--font-body); font-size: 13px; font-weight: 500; transition: all 0.17s;
        }
        .hdr-ghost-btn:hover { border-color: var(--parchment-4); color: var(--ink); background: var(--parchment-2); }

        /* Sources button */
        .hdr-sources-btn {
          display: flex; align-items: center; gap: 9px; padding: 9px 20px;
          border-radius: var(--r-sm); border: 1.5px solid var(--ink); background: var(--ink);
          color: var(--parchment); cursor: pointer; font-family: var(--font-body);
          font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
          box-shadow: var(--shadow-sm); transition: all 0.2s var(--ease-out);
          position: relative; overflow: hidden;
        }
        .hdr-sources-btn::after {
          content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transition: left 0.5s ease;
        }
        .hdr-sources-btn:hover { background: var(--ink-3); transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .hdr-sources-btn:hover::after { left: 130%; }
        .hdr-sources-btn.has-docs {
          background: var(--parchment); color: var(--ink); border-color: var(--parchment-4); box-shadow: none;
        }
        .hdr-sources-btn.has-docs:hover { border-color: var(--gold); color: var(--gold-2); background: var(--gold-dim); transform: translateY(-1px); }
        .src-badge {
          background: var(--gold); color: var(--ink); border-radius: 20px;
          padding: 1px 9px; font-size: 11px; font-weight: 700; line-height: 1.7;
        }
        .hdr-sources-btn:not(.has-docs) .src-badge { background: rgba(255,255,255,0.16); color: var(--parchment); }

        /* ── Content ── */
        .rag-content { flex: 1; display: flex; overflow: hidden; min-height: 0; }

        .rag-sb-drawer {
          width: 284px; flex-shrink: 0; overflow: hidden;
          animation: slideRight 0.27s var(--ease-out);
          border-right: 1px solid var(--parchment-3);
        }

        .rag-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }

        /* ── Source strip ── */
        .source-strip {
          display: flex; align-items: center; gap: 10px; padding: 10px 32px;
          flex-shrink: 0; border-bottom: 1px solid var(--parchment-3);
          background: rgba(247,242,233,0.65); animation: slideDown 0.22s ease;
        }
        .source-strip-label {
          font-size: 10px; color: var(--ink-6); font-family: var(--font-mono);
          letter-spacing: 0.1em; text-transform: uppercase; flex-shrink: 0;
        }
        .source-pill {
          display: flex; align-items: center; gap: 7px; padding: 4px 12px;
          border-radius: 20px; background: var(--canvas); border: 1px solid var(--parchment-3);
          font-size: 11px; color: var(--ink-4); font-family: var(--font-mono);
          cursor: pointer; transition: all 0.15s; white-space: nowrap; max-width: 160px;
        }
        .source-pill span { overflow: hidden; text-overflow: ellipsis; }
        .source-pill:hover { border-color: var(--gold); color: var(--gold-2); background: var(--gold-dim); }
        .src-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); flex-shrink: 0; }
        .source-edit-pill {
          display: flex; align-items: center; gap: 6px; padding: 4px 12px;
          border-radius: 20px; background: transparent; border: 1px solid var(--parchment-3);
          font-size: 11px; color: var(--ink-6); font-family: var(--font-mono);
          cursor: pointer; transition: all 0.15s; margin-left: auto; white-space: nowrap;
        }
        .source-edit-pill:hover { border-color: var(--gold); color: var(--gold-2); background: var(--gold-dim); }

        /* ── Readonly bar ── */
        .readonly-bar {
          display: flex; align-items: center; gap: 10px; padding: 11px 28px;
          border-bottom: 1px solid rgba(37,99,235,0.12);
          background: var(--blue-dim); animation: slideDown 0.22s ease; flex-shrink: 0;
        }

        /* ── Welcome screen ── */
        .welcome-wrap {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 64px 48px; position: relative; overflow: hidden;
        }
        .welcome-hero { position: relative; margin-bottom: 44px; animation: float 5s ease-in-out infinite; }
        .welcome-orb {
          width: 108px; height: 108px; border-radius: 36px;
          background: linear-gradient(145deg, var(--parchment-2) 0%, var(--parchment) 100%);
          border: 1px solid var(--parchment-4);
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-lg), 0 0 90px rgba(232,146,42,0.09);
          position: relative;
        }
        .welcome-orb::before {
          content: ''; position: absolute; inset: -22px; border-radius: 58px;
          border: 1px dashed rgba(232,146,42,0.22);
        }
        .welcome-orb::after {
          content: ''; position: absolute; inset: -42px; border-radius: 78px;
          border: 1px dashed rgba(232,146,42,0.1);
        }
        .orbit-dot-1 {
          position: absolute; width: 9px; height: 9px; border-radius: 50%;
          background: var(--gold); box-shadow: 0 0 10px rgba(232,146,42,0.7);
          animation: orbit-slow 7.5s linear infinite; top: 50%; left: 50%; margin: -4.5px;
        }
        .orbit-dot-2 {
          position: absolute; width: 6px; height: 6px; border-radius: 50%;
          background: var(--teal); opacity: 0.75;
          animation: orbit-reverse 12s linear infinite; top: 50%; left: 50%; margin: -3px;
        }
        .pulse-ring-outer {
          position: absolute; inset: -4px; border-radius: 40px;
          border: 1.5px solid rgba(232,146,42,0.35);
          animation: pulse-ring 3.5s ease-out infinite;
        }

        .welcome-eyebrow {
          font-family: var(--font-mono); font-size: 11px; color: var(--gold-2);
          letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px;
          animation: fadeUp 0.5s ease 0.1s both;
          display: flex; align-items: center; gap: 10px;
        }
        .welcome-eyebrow::before, .welcome-eyebrow::after {
          content: ''; display: block; width: 32px; height: 1px; background: var(--gold-3); opacity: 0.5;
        }

        .welcome-title {
          font-family: var(--font-display); font-size: 52px; font-weight: 800;
          color: var(--ink); letter-spacing: -0.045em; text-align: center;
          line-height: 1.02; margin-bottom: 18px;
          animation: fadeUp 0.56s var(--ease-out) 0.15s both;
        }
        .welcome-title em { font-style: italic; font-weight: 300; color: var(--ink-5); }

        .welcome-sub {
          font-family: var(--font-display); font-style: italic;
          font-size: 19px; color: var(--ink-5); text-align: center;
          max-width: 440px; line-height: 1.65; margin-bottom: 44px;
          animation: fadeUp 0.56s var(--ease-out) 0.22s both;
        }

        .welcome-cta-primary {
          display: flex; align-items: center; gap: 11px;
          padding: 16px 34px; border-radius: var(--r-md); border: none;
          background: var(--ink); color: var(--parchment);
          cursor: pointer; font-family: var(--font-body); font-size: 15px; font-weight: 600;
          box-shadow: var(--shadow-md); transition: all 0.24s var(--ease-out);
          position: relative; overflow: hidden; letter-spacing: 0.01em;
          animation: fadeUp 0.56s var(--ease-out) 0.3s both;
        }
        .welcome-cta-primary::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, transparent, rgba(255,255,255,0.07), transparent);
          transform: translateX(-100%); transition: transform 0.55s ease;
        }
        .welcome-cta-primary:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); background: var(--ink-3); }
        .welcome-cta-primary:hover::before { transform: translateX(110%); }
        .welcome-cta-primary:active { transform: translateY(0) scale(0.99); }

        .welcome-feat-row {
          display: flex; gap: 10px; margin-top: 40px; flex-wrap: wrap; justify-content: center;
          animation: fadeUp 0.56s var(--ease-out) 0.38s both;
        }
        .feat-tag {
          padding: 6px 16px; border-radius: 20px; border: 1px solid var(--parchment-3);
          background: var(--parchment); font-size: 12px; color: var(--ink-5);
          font-family: var(--font-mono); letter-spacing: 0.04em;
        }

        /* ── Messages area ── */
        .messages-area {
          flex: 1; overflow-y: auto; padding: 36px 44px;
          display: flex; flex-direction: column; gap: 10px; min-height: 0;
        }

        /* ── Empty chat state (docs loaded) ── */
        .chat-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 36px; padding: 48px 48px;
        }
        .chat-empty-label {
          font-family: var(--font-display); font-style: italic;
          font-size: 22px; color: var(--ink-5); text-align: center;
        }
        .chat-empty-label strong { font-style: normal; font-weight: 700; color: var(--ink-3); }

        /* Quick prompts */
        .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 560px; }
        .quick-card {
          padding: 18px 20px; border-radius: var(--r-md); border: 1px solid var(--parchment-3);
          background: var(--canvas); cursor: pointer; text-align: left;
          position: relative; overflow: hidden; display: flex; align-items: flex-start; gap: 13px;
          transition: all 0.2s ease; box-shadow: var(--shadow-xs);
        }
        .quick-card::after {
          content: ''; position: absolute; inset: 0; opacity: 0;
          background: linear-gradient(135deg, var(--gold-dim) 0%, transparent 70%);
          transition: opacity 0.22s;
        }
        .quick-card:hover { border-color: rgba(232,146,42,0.32); background: var(--parchment); box-shadow: var(--shadow-sm); transform: translateY(-2px); }
        .quick-card:hover::after { opacity: 1; }
        .quick-card:active { transform: translateY(0); }
        .qc-icon-wrap {
          width: 34px; height: 34px; border-radius: 10px;
          background: var(--parchment-2); border: 1px solid var(--parchment-3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 16px; transition: all 0.2s;
          position: relative; z-index: 1;
        }
        .quick-card:hover .qc-icon-wrap { background: var(--gold-dim); border-color: rgba(232,146,42,0.3); }
        .qc-text {
          font-size: 14px; font-weight: 500; color: var(--ink-4); line-height: 1.45;
          font-family: var(--font-body); position: relative; z-index: 1; transition: color 0.16s;
        }
        .quick-card:hover .qc-text { color: var(--ink); }

        /* Suggested question pills */
        .suggested-pills { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 600px; }
        .sugg-pill {
          padding: 7px 16px; border-radius: 20px; font-size: 12.5px; font-weight: 500;
          border: 1px solid rgba(232,146,42,0.24); background: var(--gold-halo);
          color: var(--ink-4); cursor: pointer; transition: all 0.17s; font-family: var(--font-body);
        }
        .sugg-pill:hover { background: var(--gold-dim); border-color: rgba(232,146,42,0.42); color: var(--gold-2); transform: translateY(-1px); }

        /* ── Message rows ── */
        .msg-row { display: flex; gap: 14px; padding: 7px 0; }
        .msg-row.user { flex-direction: row-reverse; }

        .msg-avatar {
          width: 34px; height: 34px; border-radius: 11px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; align-self: flex-end; margin-bottom: 5px;
        }
        .msg-avatar.user-av { background: var(--ink); border: 1px solid var(--ink-3); box-shadow: var(--shadow-xs); }
        .msg-avatar.ai-av { background: var(--parchment); border: 1px solid var(--parchment-3); box-shadow: var(--shadow-xs); }

        /* Bubbles */
        .msg-bubble { max-width: 70%; position: relative; font-size: 15px; line-height: 1.74; }
        .msg-bubble.user-bub {
          background: var(--ink); border: 1px solid var(--ink-3);
          border-radius: 22px 22px 6px 22px; padding: 16px 22px;
          color: rgba(247,242,233,0.93); box-shadow: var(--shadow-sm);
          animation: msg-user 0.28s var(--ease-out);
        }
        .msg-bubble.ai-bub {
          background: var(--canvas); border: 1px solid var(--parchment-3);
          border-radius: 6px 22px 22px 22px; padding: 18px 24px;
          color: var(--ink-4); box-shadow: var(--shadow-xs);
          animation: msg-ai 0.28s var(--ease-out);
          transition: border-color 0.16s, box-shadow 0.16s;
        }
        .msg-bubble.ai-bub:hover { border-color: var(--parchment-4); box-shadow: var(--shadow-sm); }

        .msg-time {
          display: block; font-size: 10px; font-family: var(--font-mono);
          color: var(--ink-6); margin-top: 9px; letter-spacing: 0.03em;
        }
        .msg-time.user-t { text-align: right; color: rgba(247,242,233,0.35); }

        /* ── Citations ── */
        .cites-wrap { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--parchment-3); }
        .cite-header {
          display: flex; align-items: center; gap: 7px; margin-bottom: 12px;
          font-size: 10px; font-weight: 600; letter-spacing: 0.13em;
          text-transform: uppercase; color: var(--ink-6); font-family: var(--font-mono);
        }
        .cite-group { margin-bottom: 11px; }
        .cite-doc-name {
          display: flex; align-items: center; gap: 6px; font-size: 11px;
          color: var(--ink-5); font-family: var(--font-mono); margin-bottom: 7px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cite-pages { display: flex; flex-wrap: wrap; gap: 5px; }
        .cite-pg-btn {
          padding: 4px 12px; border-radius: 20px; background: var(--parchment-2);
          border: 1px solid var(--parchment-3); font-family: var(--font-mono);
          font-size: 11px; font-weight: 500; color: var(--ink-5); cursor: pointer;
          transition: all 0.15s;
        }
        .cite-pg-btn:hover { border-color: var(--gold); color: var(--gold-2); background: var(--gold-dim); box-shadow: 0 0 10px rgba(232,146,42,0.15); }
        .no-cite { font-size: 11.5px; color: var(--ink-6); font-style: italic; font-family: var(--font-mono); }

        /* ── Input zone ── */
        .input-zone {
          flex-shrink: 0; padding: 18px 44px 28px;
          background: linear-gradient(0deg, var(--parchment) 55%, transparent 100%);
          position: relative;
        }
        .input-container {
          border: 1.5px solid var(--parchment-3); border-radius: var(--r-lg);
          background: var(--canvas); overflow: hidden;
          transition: border-color 0.22s, box-shadow 0.22s;
          box-shadow: var(--shadow-sm);
        }
        .input-container.focused {
          animation: border-dance 3.5s ease-in-out infinite;
        }
        .rag-textarea {
          width: 100%; padding: 18px 22px 14px; resize: none;
          background: transparent; border: none; outline: none;
          font-family: var(--font-body); font-size: 15px;
          color: var(--ink); min-height: 58px; line-height: 1.6;
        }
        .rag-textarea::placeholder { color: var(--ink-6); }

        .input-footer-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 16px 13px; border-top: 1px solid var(--parchment-3);
        }
        .input-hints {
          display: flex; align-items: center; gap: 12px;
          font-size: 11px; color: var(--ink-6); font-family: var(--font-mono);
        }
        .kbd {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 2px 7px; border-radius: 5px; font-size: 10px;
          background: var(--parchment-2); border: 1px solid var(--parchment-3);
          color: var(--ink-5); font-family: var(--font-mono);
        }

        /* Send button */
        .send-btn {
          width: 44px; height: 44px; border-radius: var(--r-sm); border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.22s var(--ease-out);
          position: relative; overflow: hidden;
        }
        .send-btn.idle { background: var(--parchment-2); color: var(--ink-6); border: 1px solid var(--parchment-3); }
        .send-btn.ready { background: var(--ink); color: var(--parchment); box-shadow: var(--shadow-sm); }
        .send-btn.ready::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 40% 40%, rgba(255,255,255,0.13), transparent 65%);
          opacity: 0; transition: opacity 0.2s;
        }
        .send-btn.ready:hover { background: var(--ink-3); transform: scale(1.07) translateY(-1px); box-shadow: var(--shadow-md); }
        .send-btn.ready:hover::before { opacity: 1; }
        .send-btn:disabled { cursor: not-allowed; }
        .send-btn:active { transform: scale(0.97); }

        /* ── Readonly input ── */
        .readonly-input-wrap {
          display: flex; align-items: center; justify-content: space-between; gap: 18px;
          padding: 20px 26px; border-radius: var(--r-lg);
          background: var(--canvas); border: 1.5px solid var(--parchment-3); box-shadow: var(--shadow-xs);
        }
        .readonly-icon {
          width: 40px; height: 40px; border-radius: 13px;
          background: var(--gold-dim); border: 1px solid rgba(232,146,42,0.22);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .readonly-load-btn {
          display: flex; align-items: center; gap: 9px; padding: 10px 22px;
          border-radius: var(--r-sm); border: 1.5px solid var(--ink); background: var(--ink);
          color: var(--parchment); cursor: pointer; font-family: var(--font-body);
          font-size: 13px; font-weight: 600; transition: all 0.19s; box-shadow: var(--shadow-xs); flex-shrink: 0;
        }
        .readonly-load-btn:hover { background: var(--ink-3); transform: translateY(-1px); box-shadow: var(--shadow-sm); }

        /* ── Readability boost: typography only ── */
        .rag-root .hdr-product-name { font-size: 20px; }
        .rag-root .hdr-product-sub { font-size: 11px; }
        .rag-root .hdr-sources-btn { font-size: 14px; }
        .rag-root .source-strip-label { font-size: 11px; }
        .rag-root .source-pill,
        .rag-root .source-edit-pill { font-size: 12px; }

        .rag-root .welcome-eyebrow { font-size: 12px; }
        .rag-root .welcome-sub { font-size: 20px; }
        .rag-root .feat-tag { font-size: 13px; }

        .rag-root .chat-empty-label { font-size: 24px; }
        .rag-root .qc-text { font-size: 15px; }
        .rag-root .sugg-pill { font-size: 13px; }

        .rag-root .msg-bubble { font-size: 16px; line-height: 1.76; }
        .rag-root .msg-time { font-size: 11px; }
        .rag-root .cite-header { font-size: 11px; }
        .rag-root .cite-doc-name { font-size: 12px; }
        .rag-root .cite-pg-btn { font-size: 12px; }
        .rag-root .no-cite { font-size: 12px; }

        .rag-root .readonly-bar span { font-size: 14px !important; }
        .rag-root .readonly-input-wrap p:first-child { font-size: 15px !important; }
        .rag-root .readonly-input-wrap p:last-child { font-size: 13px !important; }
        .rag-root .readonly-load-btn { font-size: 14px; }

        .rag-root .rag-textarea { font-size: 16px; }
        .rag-root .input-hints { font-size: 12px; }
        .rag-root .kbd { font-size: 11px; }
      `}</style>

      <div className="rag-root">
        <BackgroundMotif />
        <GrainOverlay />

        {/* Employee nav */}
        <div style={{ position: "relative", zIndex: 20 }}>
          <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        </div>

        {/* Main */}
        <div className="rag-main" style={{ position: "relative", zIndex: 1 }}>

          {/* ── Header ── */}
          <header className="rag-header">
            <div className="hdr-brand">
              <button className="hdr-menu-btn" onClick={() => setShowSidebar(v => !v)} aria-label="Toggle history">
                <span /><span /><span />
              </button>
              <div className="hdr-logomark">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="rgba(232,146,42,0.09)"/>
                  <path d="M10 4.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 2.2c.91 0 1.65.74 1.65 1.65s-.74 1.65-1.65 1.65-1.65-.74-1.65-1.65.74-1.65 1.65-1.65zm0 7.9c-1.65 0-3.1-.84-3.96-2.12.02-1.31 2.64-2.03 3.96-2.03 1.32 0 3.94.72 3.96 2.03A4.67 4.67 0 0110 14.6z" fill="var(--gold)"/>
                </svg>
              </div>
              <div>
                <div className="hdr-product-name">Lexis</div>
                <div className="hdr-product-sub">Research Terminal · RAG</div>
              </div>
            </div>

            <div className="hdr-right">
              {(success || error) && (
                <div style={{ animation: "slideDown 0.22s ease" }}>
                  {success && <Alert variant="success" onClose={clearMessages}>{success}</Alert>}
                  {error && <Alert variant="error" onClose={clearMessages}>{error}</Alert>}
                </div>
              )}
              <button className={`hdr-sources-btn ${hasDocs ? "has-docs" : ""}`} onClick={() => setShowDocSel(true)}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2.5 1.5h8l4 4v9h-12v-13z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M10.5 1.5v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  {!hasDocs && <path d="M6.5 7.5v3.5M4.75 9.25h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>}
                </svg>
                {hasDocs ? (
                  <><span>Sources</span><span className="src-badge">{selectedDocumentIds.length}</span></>
                ) : "Add sources"}
              </button>
              {hasDocs && (
                <button
                  onClick={() => setShowPromptPanel(v => !v)}
                  title={showPromptPanel ? "Hide suggestions" : "Show suggestions"}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${showPromptPanel ? 'var(--gold)' : '#e0d8ce'}`, background: showPromptPanel ? 'rgba(232,146,42,0.08)' : '#fff', color: showPromptPanel ? 'var(--gold)' : '#6b5e4e', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!showPromptPanel) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; } }}
                  onMouseLeave={e => { if (!showPromptPanel) { e.currentTarget.style.borderColor = '#e0d8ce'; e.currentTarget.style.color = '#6b5e4e'; } }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M6.5 4v3.5M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Suggest
                </button>
              )}
            </div>
          </header>

          {/* ── Content ── */}
          <div className="rag-content">
            {showSidebar && (
              <div className="rag-sb-drawer">
                <Sidebar onNewChat={() => { startNewChat(); setShowDocSel(true); setShowSidebar(false); }} />
              </div>
            )}

            <div className="rag-chat" style={{ position: 'relative' }}>
              {/* ── Prompt panel (right, absolute overlay) ── */}
              {hasDocs && showPromptPanel && (
                <div style={{
                  position: 'fixed', top: 56, right: 16, width: 240, zIndex: 100,
                  borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(22,14,6,0.97)', backdropFilter: 'blur(16px)',
                  display: 'flex', flexDirection: 'column', padding: '14px 12px', gap: 10,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>How to use</span>
                    <button onClick={() => setShowPromptPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>✕</button>
                  </div>

                  {/* Steps */}
                  {[
                    { n: '1', label: 'Get overview / sections', prompt: 'List the main sections of this document' },
                    { n: '2', label: 'Get a summary', prompt: 'Summarize the key points of this document' },
                    { n: '3', label: 'Ask a question', prompt: null },
                  ].map(({ n, label, prompt }) => (
                    <button key={n}
                      onClick={() => { if (prompt) { setInputMsg(prompt); inputRef.current?.focus(); } else inputRef.current?.focus(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,146,42,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,146,42,0.35)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(232,146,42,0.18)', color: 'var(--gold)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>{label}</span>
                    </button>
                  ))}

                  {/* Per-doc suggested questions — collapsed */}
                  {suggestedByDoc.length > 0 && (
                    <>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Suggested questions</span>
                      {suggestedByDoc.map(({ docId, docTitle, questions }) => (
                        <DocQuestions key={docId} docTitle={docTitle} questions={questions} onSelect={q => { setInputMsg(q); inputRef.current?.focus(); }} />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Source strip */}
              {hasDocs && (
                <div className="source-strip">
                  <span className="source-strip-label">Sources</span>
                  {selectedDocumentIds.slice(0, 4).map((id, i) => {
                    const doc = availableDocuments.find(d => d.id === id);
                    return (
                      <span key={id} className="source-pill"
                        style={{ animationDelay: `${i * 0.05}s`, animation: "slideRight 0.2s ease both", paddingRight: 6 }}>
                        <span className="src-dot" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                          onClick={() => setShowDocSel(true)}>
                          {doc?.title || `Doc ${id}`}
                        </span>
                        <button
                          onClick={() => selectDocument(id)}
                          title="Remove"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(100,80,60,0.45)', padding: '0 2px', lineHeight: 1, fontSize: 10, flexShrink: 0, marginLeft: 2 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,80,60,0.45)'}
                        >✕</button>
                      </span>
                    );
                  })}
                  {selectedDocumentIds.length > 4 && (
                    <button className="source-pill" onClick={() => setShowDocSel(true)}>
                      +{selectedDocumentIds.length - 4} more
                    </button>
                  )}
                  <button className="source-edit-pill" onClick={() => setShowDocSel(true)}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1.5v8M1.5 5.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                    Edit
                  </button>
                </div>
              )}

              {/* Readonly notice — only shown at bottom input area, not here */}

              {/* ── Welcome (no docs, no active chat) ── */}
              {!hasDocs && !activeChatId ? (
                <div className="welcome-wrap">
                  <div className="welcome-hero">
                    <div className="welcome-orb">
                      <div className="pulse-ring-outer" />
                      <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
                        <circle cx="27" cy="27" r="27" fill="rgba(232,146,42,0.06)"/>
                        <path d="M27 13a14 14 0 100 28 14 14 0 000-28zm0 5.4c1.88 0 3.4 1.52 3.4 3.4s-1.52 3.4-3.4 3.4-3.4-1.52-3.4-3.4 1.52-3.4 3.4-3.4zm0 19.2c-3.02 0-5.69-1.54-7.28-3.88.04-3.03 4.86-4.7 7.28-4.7s7.24 1.67 7.28 4.7A8.52 8.52 0 0127 37.6z" fill="var(--gold)"/>
                      </svg>
                      <span className="orbit-dot-1" />
                      <span className="orbit-dot-2" />
                    </div>
                  </div>

                  <div className="welcome-eyebrow">Retrieval-Augmented Generation</div>
                  <h1 className="welcome-title">Intelligent answers<br /><em>from your documents</em></h1>
                  <p className="welcome-sub">Upload sources, ask anything. Get precise answers with page-level citations and synthesized insights across your entire knowledge base.</p>

                  <button className="welcome-cta-primary" onClick={() => setShowDocSel(true)}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <path d="M3 2h9l4.5 4.5V16H3V2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                      <path d="M12 2v4.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                      <path d="M8.5 8.5v4M6.5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Load your first source
                  </button>

                  <div className="welcome-feat-row">
                    {["Cited answers", "Multi-doc synthesis", "Page references", "Semantic search"].map(f => (
                      <span key={f} className="feat-tag">{f}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Messages ── */}
                  <div className="messages-area">
                    {currentMessages.length === 0 ? (
                      <div className="chat-empty">
                        <p className="chat-empty-label">
                          <strong>{selectedDocumentIds.length} document{selectedDocumentIds.length !== 1 ? "s" : ""}</strong> loaded — ask anything
                        </p>
                        <div className="quick-grid">
                          {QUICK.map(({ icon, label }, i) => (
                            <button key={label} className="quick-card"
                              style={{ animationDelay: `${i * 0.07}s`, animation: "fadeUp 0.42s var(--ease-out) both" }}
                              onClick={() => { setInputMsg(label); inputRef.current?.focus(); }}>
                              <div className="qc-icon-wrap">{icon}</div>
                              <span className="qc-text">{label}</span>
                            </button>
                          ))}
                        </div>
                        {suggestedQuestions.length > 0 && (
                          <div className="suggested-pills">
                            {suggestedQuestions.map(q => (
                              <button key={q.id} className="sugg-pill"
                                onClick={() => { setInputMsg(q.text); setTimeout(() => inputRef.current?.focus(), 50); }}>
                                {q.text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      currentMessages.map((msg, idx) => {
                        const isUser = msg.role === "user";
                        const citeGroups = isUser ? [] : getCitationGroups(msg);
                        const isLast = idx === currentMessages.length - 1;
                        return (
                          <div key={msg.id || idx} className={`msg-row ${isUser ? "user" : ""}`}
                            style={isLast ? { animation: `${isUser ? "msg-user" : "msg-ai"} 0.28s var(--ease-out)` } : {}}>
                            <div className={`msg-avatar ${isUser ? "user-av" : "ai-av"}`}>
                              {isUser ? (
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                  <circle cx="7.5" cy="5.5" r="2.8" stroke="rgba(247,242,233,0.85)" strokeWidth="1.4"/>
                                  <path d="M1.5 13.5c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="rgba(247,242,233,0.85)" strokeWidth="1.4" strokeLinecap="round"/>
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                  <path d="M7.5 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 2.4c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm0 7.7c-1.23 0-2.32-.63-2.97-1.58.02-.98 1.98-1.52 2.97-1.52s2.95.54 2.97 1.52A3.54 3.54 0 017.5 12.1z" fill="var(--gold)"/>
                                </svg>
                              )}
                            </div>
                            <div className={`msg-bubble ${isUser ? "user-bub" : "ai-bub"}`}>
                              <MarkdownMessage content={msg.message} isUser={isUser} />
                              {!isUser && (
                                <div className="cites-wrap">
                                  {citeGroups.length > 0 ? (
                                    <>
                                      <div className="cite-header">
                                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                          <rect x="0.5" y="0.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                                          <rect x="6" y="0.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                                          <rect x="0.5" y="6" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                                          <rect x="6" y="6" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                                        </svg>
                                        Sources cited
                                      </div>
                                      {citeGroups.map(g => (
                                        <div key={g.key} className="cite-group">
                                          <div className="cite-doc-name">
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                              <path d="M1.5 1h6.5l2 2v7h-8.5V1z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round"/>
                                            </svg>
                                            {g.docTitle}
                                          </div>
                                          <div className="cite-pages">
                                            {g.pages.map(ref => (
                                              <button key={ref.key} className="cite-pg-btn"
                                                onClick={() => setActiveCitation({ ...ref, docId: g.docId, docTitle: g.docTitle, cloudinaryUrl: g.cloudinaryUrl })}
                                                title={ref.snippet || ref.section || `Page ${ref.page}`}>
                                                p.{ref.page}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <p className="no-cite">No document citations for this response.</p>
                                  )}
                                </div>
                              )}
                              <div className={`msg-time-row ${isUser ? "user-t" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                <span className={`msg-time ${isUser ? "user-t" : ""}`}>
                                  {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <CopyBtn text={msg.message} isUser={isUser} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {sending && (
                      <div className="msg-row" style={{ animation: "msg-ai 0.24s var(--ease-out)" }}>
                        <div className="msg-avatar ai-av">
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                            <path d="M7.5 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 2.4c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm0 7.7c-1.23 0-2.32-.63-2.97-1.58.02-.98 1.98-1.52 2.97-1.52s2.95.54 2.97 1.52A3.54 3.54 0 017.5 12.1z" fill="var(--gold)"/>
                          </svg>
                        </div>
                        <TypingBubble />
                      </div>
                    )}

                    <div ref={messagesEndRef} style={{ height: 1 }} />
                  </div>

                  <TokenUsageBar />

                  {/* ── Reranker Model Selector ── */}
                  {hasDocs && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
                      padding: '12px 20px', background: 'var(--parchment)',
                      borderTop: '1px solid var(--parchment-3)'
                    }}>
                      <span style={{ 
                        fontSize: 11, fontWeight: 600, color: 'var(--ink-5)', 
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' 
                      }}>
                        Reranker:
                      </span>
                      <select
                        value={rerankerModel}
                        onChange={(e) => handleRerankerChange(e.target.value)}
                        disabled={false}
                        style={{
                          fontSize: 12, padding: '6px 12px', borderRadius: 8,
                          border: '1.5px solid var(--parchment-3)', background: 'var(--canvas)',
                          color: 'var(--ink)', fontFamily: 'var(--font-body)', fontWeight: 500,
                          cursor: 'pointer', 
                          outline: 'none', transition: 'all 0.15s',
                          opacity: 1
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--parchment-3)'}
                        title=""
                      >
                        <option value="fast">⚡ Fast</option>
                        <option value="deep">🎯 Deep Thinking</option>
                      </select>
                    </div>
                  )}

                  {/* ── Input area ── */}
                  <div className="input-zone">
                    {isReadOnly ? (
                      <div className="readonly-input-wrap">
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div className="readonly-icon">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M3.5 2h8.5L15.5 5.5V16h-12V2z" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"/>
                              <path d="M12 2v3.5h3.5" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-body)" }}>Archived conversation</p>
                            <p style={{ fontSize: 12, color: "var(--ink-5)", fontFamily: "var(--font-mono)", marginTop: 3 }}>Load sources to continue chatting</p>
                          </div>
                        </div>
                        <button className="readonly-load-btn" onClick={() => setShowDocSel(true)}>
                          Load sources
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2 6.5h9M8 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className={`input-container ${inputFocused ? "focused" : ""}`}>
                        <ChatTextArea
                          ref={inputRef}
                          value={inputMsg}
                          onChange={e => setInputMsg(e.target.value)}
                          onKeyDown={handleKey}
                          onFocus={() => setInputFocused(true)}
                          onBlur={() => setInputFocused(false)}
                          placeholder={isExhausted ? "Token limit reached. Contact your admin to reset." : hasDocs ? "Ask anything about your sources…" : "Load sources to start chatting"}
                          disabled={sending || !hasDocs || isExhausted}
                          maxRows={5}
                          className="rag-textarea"
                        />
                        <div className="input-footer-bar">
                          <div className="input-hints">
                            <span><span className="kbd">↵</span> send</span>
                            <span style={{ color: "var(--parchment-4)" }}>·</span>
                            <span><span className="kbd">⇧ ↵</span> newline</span>
                          </div>
                          <button
                            className={`send-btn ${inputMsg.trim() && !sending && hasDocs && !isExhausted ? "ready" : "idle"}`}
                            onClick={handleSend}
                            disabled={!inputMsg.trim() || sending || !hasDocs || isExhausted}>
                            {sending ? (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.85s linear infinite" }}>
                                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="13 28" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M14 1.5L7 8.5M14 1.5L10 14.5l-3-6-6-3L14 1.5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDocSel && <DocSelector onClose={() => setShowDocSel(false)} />}
      {activeCitation && <DocumentCitationViewer citation={activeCitation} onClose={() => setActiveCitation(null)} />}
    </>
  );
};

export default RAGChatbot;