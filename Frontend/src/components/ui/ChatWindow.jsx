// src/components/ui/ChatWindow.jsx
import { useState, useEffect, useRef } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { Send, Bot, User, Sparkles, FileText, MessageCircle, Zap, BookOpen, Quote, Copy, Check } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import ChatTextArea from "./ChatTextArea";
import MarkdownMessage from "./MarkdownMessage";
import DocumentCitationViewer from "./DocumentCitationViewer";
import { getDocumentSuggestedQuestions } from "../../services/documentService";

/* Quick-prompt suggestions shown on empty state */
const QUICK_PROMPTS = [
  { icon: Sparkles, text: "Summarize the key points from this document" },
  { icon: BookOpen, text: "What are the main topics covered?" },
  { icon: Zap,      text: "List the most important takeaways" },
];

const getCitationGroups = (message) => {
  const citations = Array.isArray(message?.citations) ? message.citations : [];
  return citations
    .map((citationDoc, docIndex) => {
      const references = Array.isArray(citationDoc?.references) ? citationDoc.references : [];
      
      const pageMap = new Map();
      references.forEach((ref) => {
        const pageValue = ref?.page;
        const pageNumber = pageValue === null || pageValue === undefined ? null : Number(pageValue);
        if (!Number.isFinite(pageNumber) || pageNumber <= 0) return;
        if (!pageMap.has(pageNumber)) {
          pageMap.set(pageNumber, {
            key: `${citationDoc?.doc_id || docIndex}-${pageNumber}`,
            page: pageNumber,
            section: ref?.section ?? null,
            snippet: ref?.snippet ?? null,
          });
        }
      });
      
      const pages = Array.from(pageMap.values());
      if (pages.length === 0) return null;

      return {
        key: `group-${citationDoc?.doc_id || docIndex}`,
        docId: citationDoc?.doc_id,
        docTitle: citationDoc?.doc_title || `Document ${citationDoc?.doc_id}`,
        cloudinaryUrl: citationDoc?.cloudinary_url || null,
        pages,
      };
    })
    .filter(Boolean);
};

const getCitationRefs = (message) => {
  return getCitationGroups(message).flatMap((group) =>
    group.pages.map((pageRef) => ({
      ...pageRef,
      docId: group.docId,
      docTitle: group.docTitle,
    }))
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silently fail */ }
  };
  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy message"}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-all"
      style={{ color: copied ? "#22c55e" : "#c4b8a8", background: "transparent" }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = "#9c8e80"; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "#c4b8a8"; }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span style={{ fontSize: 10 }}>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
};

const ChatWindow = ({ onOpenDocumentSelector, minimal = false }) => {
  const { activeChatId, messages, selectedDocumentIds, availableDocuments, loading, sendMessage, fetchMessages, fetchDocuments, quota } = useChatbot();
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];
  const isReadOnlyMode = activeChatId && (!selectedDocumentIds || selectedDocumentIds.length === 0);
  const hasDocuments = selectedDocumentIds && selectedDocumentIds.length > 0;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentMessages]);
  useEffect(() => { if (activeChatId && !messages[activeChatId]) fetchMessages(activeChatId); }, [activeChatId]);
  useEffect(() => {
    if (!availableDocuments || availableDocuments.length === 0) {
      fetchDocuments();
    }
  }, []);

  // Fetch suggested questions when document selection changes (single doc only)
  useEffect(() => {
    if (selectedDocumentIds?.length === 1) {
      getDocumentSuggestedQuestions(selectedDocumentIds[0])
        .then(res => setSuggestedQuestions(res?.data?.questions || []))
        .catch(() => setSuggestedQuestions([]));
    } else if (selectedDocumentIds?.length > 1) {
      // Multiple docs: take up to 2-3 from each, merge, deduplicate, cap at 5
      Promise.all(selectedDocumentIds.map(id =>
        getDocumentSuggestedQuestions(id).then(res => res?.data?.questions || []).catch(() => [])
      )).then(results => {
        const perDoc = Math.max(1, Math.floor(5 / results.length));
        const seen = new Set();
        const merged = [];
        // First pass: take perDoc from each
        results.forEach(docQuestions => {
          docQuestions.slice(0, perDoc).forEach(q => {
            if (!seen.has(q.text)) { seen.add(q.text); merged.push(q); }
          });
        });
        // Second pass: fill remaining slots from leftovers
        results.forEach(docQuestions => {
          docQuestions.slice(perDoc).forEach(q => {
            if (merged.length >= 5) return;
            if (!seen.has(q.text)) { seen.add(q.text); merged.push(q); }
          });
        });
        setSuggestedQuestions(merged.slice(0, 5));
      });
    } else {
      setSuggestedQuestions([]);
    }
  }, [JSON.stringify(selectedDocumentIds)]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !hasDocuments || sending) return;
    if (quota?.token_limit != null && quota?.tokens_remaining === 0) return;
    const text = inputMessage.trim();
    setInputMessage("");
    setSending(true);
    await sendMessage(text, activeChatId, !activeChatId ? text.substring(0, 50) : null);
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isExhausted = quota?.token_limit != null && quota?.tokens_remaining === 0;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── No-document welcome screen ── */
  if (!hasDocuments && !activeChatId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10" style={{ background: "#FAF6EF" }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "#1A1209" }}
        >
          <Bot size={30} color="#F58220" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-center" style={{ color: "#3D2C1C", fontFamily: "Georgia, serif" }}>
          Ready to assist you
        </h2>
        <p className="text-sm text-center mb-7 max-w-xs" style={{ color: "rgba(65,50,24,0.55)" }}>
          Select one or more documents to start an intelligent conversation and extract insights from your content.
        </p>
        <button
          onClick={onOpenDocumentSelector}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "#1A1209", color: "#faf6ef" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        >
          <FileText size={16} /> Choose Documents
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: "#fff" }}>

      {/* Read-only mode banner */}
      {isReadOnlyMode && currentMessages.length > 0 && (
        <div className="flex-shrink-0 px-5 pt-4">
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
            style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
          >
            <MessageCircle size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
            <p className="text-xs font-medium" style={{ color: "#1d4ed8" }}>
              Viewing previous conversation — select a document to continue chatting.
            </p>
          </div>
        </div>
      )}

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">

        {/* Empty / first-time state with quick prompts */}
        {currentMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "#FAF6EF" }}
            >
              <Bot size={26} style={{ color: "#F58220" }} />
            </div>
            <h3 className="font-bold text-base mb-1" style={{ color: "#3D2C1C", fontFamily: "Georgia, serif" }}>
              How can I help you today?
            </h3>
            <p className="text-xs mb-6 text-center" style={{ color: "rgba(65,50,24,0.5)" }}>
              Ask me anything about your selected {selectedDocumentIds.length > 1 ? "documents" : "document"}.
            </p>
            <div className="w-full max-w-sm space-y-2">
              {QUICK_PROMPTS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => setInputMessage(text)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all"
                  style={{ background: "#FAF6EF", border: "1px solid #e0d8ce", color: "#6b5e4e" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#F58220"; e.currentTarget.style.color = "#1A1209"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0d8ce"; e.currentTarget.style.color = "#6b5e4e"; }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fff0e8" }}>
                    <Icon size={14} style={{ color: "#F58220" }} />
                  </div>
                  <span className="font-medium">{text}</span>
                </button>
              ))}
            </div>

            {/* Suggested questions chips */}
            {suggestedQuestions.length > 0 && (
              <div className="w-full max-w-sm mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-center" style={{ color: "rgba(65,50,24,0.4)" }}>
                  Suggested
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setInputMessage(q.text);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{ background: "#fff0e8", color: "#c2620a", border: "1px solid #f6dec1" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#ffe4cc"; e.currentTarget.style.borderColor = "#f7953f"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff0e8"; e.currentTarget.style.borderColor = "#f6dec1"; }}
                    >
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {currentMessages.map((message, index) => {
          const isUser = message.role === "user";
          const citationGroups = isUser ? [] : getCitationGroups(message);
          return (
            <div key={message.id || index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[78%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end"
                  style={{ background: isUser ? "#F58220" : "#1A1209" }}
                >
                  {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="#F58220" />}
                </div>

                {/* Bubble */}
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={isUser
                    ? {
                        background: "#1A1209",
                        color: "#faf6ef",
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: "#FAF6EF",
                        color: "#2c1a08",
                        border: "1px solid #e0d8ce",
                        borderBottomLeftRadius: 4,
                      }
                  }
                >
                  <MarkdownMessage content={message.message} isUser={isUser} />

                  {!isUser && (
                    <div className="mt-3">
                      {citationGroups.length > 0 ? (
                        <>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Quote size={11} style={{ color: "#9c8e80" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9c8e80" }}>Citations</span>
                          </div>
                          <div className="space-y-2">
                            {citationGroups.map((group) => (
                              <div key={group.key} className="rounded-lg p-2" style={{ background: "#fff", border: "1px solid #e0d8ce" }}>
                                <p className="text-[10px] font-semibold mb-1 truncate" style={{ color: "#6b5e4e" }} title={group.docTitle}>
                                  {group.docTitle}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.pages.map((ref) => (
                                    <button
                                      key={ref.key}
                                      onClick={() => setActiveCitation({ ...ref, docId: group.docId, docTitle: group.docTitle, cloudinaryUrl: group.cloudinaryUrl })}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                                      style={{ background: "#fff9f3", border: "1px solid #f1c9a5", color: "#8a5a2b" }}
                                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F58220"; e.currentTarget.style.color = "#F58220"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f1c9a5"; e.currentTarget.style.color = "#8a5a2b"; }}
                                      title={ref.snippet || ref.section || `Page ${ref.page}`}
                                    >
                                      <span>p.{ref.page}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] italic" style={{ color: "#c4b8a8" }}>
                          No document citations for this response.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1.5">
                    <span
                      className="text-[10px]"
                      style={{ color: isUser ? "rgba(250,246,239,0.5)" : "#c4b8a8" }}
                    >
                      {new Date(message.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {!isUser && (
                      <CopyButton text={message.message} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end" style={{ background: "#1A1209" }}>
                <Bot size={14} color="#F58220" />
              </div>
              <div
                className="px-4 py-3 rounded-2xl"
                style={{ background: "#FAF6EF", border: "1px solid #e0d8ce", borderBottomLeftRadius: 4 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(65,50,24,0.5)" }}>Thinking</span>
                  <div className="flex gap-1 ml-1">
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce inline-block"
                        style={{ background: "#F58220", animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderTop: "1px solid #e0d8ce", background: "#fff" }}
      >
        {isReadOnlyMode ? (
          /* Read-only CTA */
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
            style={{ background: "#FAF6EF", border: "1px solid #e0d8ce" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fff0e8" }}>
                <FileText size={15} style={{ color: "#F58220" }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#1A1209" }}>Viewing Chat History</p>
                <p className="text-[10px]" style={{ color: "rgba(65,50,24,0.5)" }}>Select a document to continue this conversation</p>
              </div>
            </div>
            <button
              onClick={onOpenDocumentSelector}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-all"
              style={{ background: "#1A1209", color: "#faf6ef" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              <FileText size={13} /> Select Document
            </button>
          </div>
        ) : (
          /* Normal input */
          <>
            <div
              className="flex items-end gap-0 rounded-xl overflow-hidden transition-all"
              style={{ border: "1.5px solid #e0d8ce", background: "#FAF6EF" }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = "#F58220"; }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = "#e0d8ce"; }}
            >
              <ChatTextArea
                ref={inputRef}
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isExhausted ? "Token limit reached. Contact your admin to reset." : "Ask me anything about your documents…"}
                disabled={sending || !hasDocuments || isExhausted}
                maxRows={4}
                className="flex-1 px-4 py-3 resize-none text-sm outline-none bg-transparent"
                style={{ color: "#1A1209", fontFamily: "inherit", minHeight: 44 }}
              />
              <div className="flex items-end p-2 flex-shrink-0">
                <button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || sending || !hasDocuments || isExhausted}
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: (!inputMessage.trim() || sending || !hasDocuments || isExhausted) ? "#e8dfd2" : "#1A1209",
                    color: (!inputMessage.trim() || sending || !hasDocuments || isExhausted) ? "#b0a090" : "#faf6ef",
                    cursor: (!inputMessage.trim() || sending || !hasDocuments || isExhausted) ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (inputMessage.trim() && !sending && hasDocuments && !isExhausted) e.currentTarget.style.opacity = "0.85"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  {sending ? <LoadingSpinner size="small" /> : <Send size={15} />}
                </button>
              </div>
            </div>
            <p className="text-[10px] mt-2 text-center" style={{ color: "#c4b8a8" }}>
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "#f0e8de", border: "1px solid #e0d8ce" }}>Enter</kbd>
              {" "}to send ·{" "}
              <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "#f0e8de", border: "1px solid #e0d8ce" }}>Shift + Enter</kbd>
              {" "}for new line
            </p>
          </>
        )}
      </div>

      {activeCitation && (
        <DocumentCitationViewer
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      )}
    </div>
  );
};

export default ChatWindow;