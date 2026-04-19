// src/components/ui/DocumentSelector.jsx
import { useEffect, useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { X, FileText, Check, Search, RefreshCw, ExternalLink } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

const DocumentSelector = ({ onClose }) => {
  const { availableDocuments, selectedDocumentIds, loading, selectDocument, fetchDocuments, maxActiveDocs } = useChatbot();
  const MAX_DOCS = maxActiveDocs;
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelection, setLocalSelection] = useState(selectedDocumentIds || []);
  const [limitWarning, setLimitWarning] = useState(false);

  useEffect(() => { if (availableDocuments.length === 0) fetchDocuments(); }, []);

  const filtered = availableDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (id) => {
    setLocalSelection(prev => {
      if (prev.includes(id)) {
        setLimitWarning(false);
        return prev.filter(x => x !== id);
      }
      if (prev.length >= MAX_DOCS) {
        setLimitWarning(true);
        return prev;
      }
      setLimitWarning(false);
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    selectedDocumentIds.forEach(id => { if (!localSelection.includes(id)) selectDocument(id); });
    localSelection.forEach(id => { if (!selectedDocumentIds.includes(id)) selectDocument(id); });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,18,9,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#fff",
          border: "1px solid #e0d8ce",
          boxShadow: "0 24px 56px rgba(26,18,9,0.25)",
          maxHeight: "84vh",
        }}
      >
        {/* ── Modal Header ── */}
        <div
          className="flex-shrink-0"
          style={{ background: "#1A1209", borderBottom: "2px solid #F58220" }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,130,32,0.15)", border: "1.5px solid rgba(245,130,32,0.35)" }}
              >
                <FileText size={16} style={{ color: "#F58220" }} />
              </div>
              <div>
                <h2 className="font-bold text-sm" style={{ color: "#faf6ef", fontFamily: "Georgia, serif" }}>
                  Select Documents
                </h2>
                <p className="text-[11px]" style={{ color: "rgba(250,246,239,0.45)", marginTop: 1 }}>
                  Choose up to {MAX_DOCS} documents to chat with
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "rgba(250,246,239,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,130,32,0.15)"; e.currentTarget.style.color = "#F58220"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.4)"; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search row */}
          <div className="px-5 pb-4">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(250,246,239,0.35)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents…"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "rgba(250,246,239,0.07)",
                  border: "1.5px solid rgba(250,246,239,0.12)",
                  color: "#faf6ef",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,130,32,0.5)"; e.currentTarget.style.background = "rgba(250,246,239,0.1)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(250,246,239,0.12)"; e.currentTarget.style.background = "rgba(250,246,239,0.07)"; }}
              />
            </div>
          </div>
        </div>

        {/* ── Document list ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: "#FAF6EF" }}>
          {limitWarning && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium mb-1"
              style={{ background: "#fff3cd", color: "#92400e", border: "1px solid #fcd34d" }}
            >
              <span>⚠️</span>
              <span>Maximum {MAX_DOCS} documents allowed. Deselect one to choose another.</span>
            </div>
          )}
          {loading && availableDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="large" />
              <p className="mt-3 text-xs" style={{ color: "rgba(65,50,24,0.5)" }}>Loading documents…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#fff0e8" }}>
                <FileText size={24} style={{ color: "#F58220" }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: "#3D2C1C" }}>
                {searchQuery ? "No documents found" : "No processed documents"}
              </p>
              <p className="text-xs mb-4" style={{ color: "rgba(65,50,24,0.5)" }}>
                {searchQuery ? "Try a different search term" : "Upload and process documents to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={fetchDocuments}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#fff", color: "#6b5e4e", border: "1px solid #e0d8ce" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#F58220"; e.currentTarget.style.color = "#F58220"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0d8ce"; e.currentTarget.style.color = "#6b5e4e"; }}
                >
                  <RefreshCw size={12} /> Refresh List
                </button>
              )}
            </div>
          ) : (
            filtered.map(doc => {
              const isSelected = localSelection.includes(doc.id);
              const isActive = selectedDocumentIds.includes(doc.id);
              const isDisabled = !isSelected && localSelection.length >= MAX_DOCS;
              return (
                <div
                  key={doc.id}
                  onClick={() => !isDisabled && handleToggle(doc.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: isSelected ? "#fff0e8" : "#fff",
                    border: `1.5px solid ${isSelected ? "#F58220" : "#e0d8ce"}`,
                    boxShadow: isSelected ? "0 2px 8px rgba(245,130,32,0.1)" : "none",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.45 : 1,
                  }}
                  onMouseEnter={e => { if (!isSelected && !isDisabled) e.currentTarget.style.borderColor = "#c4b4a0"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "#e0d8ce"; }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? "#F58220" : "#f3ede4" }}
                  >
                    <FileText size={16} style={{ color: isSelected ? "#fff" : "#9c8e80" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isSelected ? "#1A1209" : "#6b5e4e" }}>
                      {doc.title}
                    </p>
                    {isActive && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                        style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}
                      >
                        <Check size={8} /> Active
                      </span>
                    )}
                  </div>
                  {doc.cloudinary_url && (
                    <a
                      href={doc.cloudinary_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ color: "#9c8e80", background: "transparent" }}
                      title="Open PDF"
                      onMouseEnter={e => { e.currentTarget.style.background = "#fff0e8"; e.currentTarget.style.color = "#F58220"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9c8e80"; }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isSelected ? "#F58220" : "#fff",
                      border: `2px solid ${isSelected ? "#F58220" : "#d4c4a8"}`,
                    }}
                  >
                    {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4"
          style={{ background: "#fff", borderTop: "1px solid #e0d8ce" }}
        >
          <span className="text-xs" style={{ color: "rgba(65,50,24,0.5)" }}>
            {localSelection.length === 0
              ? "No documents selected"
              : `${localSelection.length} / ${MAX_DOCS} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: "#f3ede4", color: "#6b5e4e" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#e8dfd2"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f3ede4"; }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={localSelection.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: localSelection.length === 0 ? "#e8dfd2" : "#1A1209",
                color: localSelection.length === 0 ? "#b0a090" : "#faf6ef",
                cursor: localSelection.length === 0 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (localSelection.length > 0) e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              <Check size={14} />
              Confirm{localSelection.length > 0 ? ` (${localSelection.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSelector;