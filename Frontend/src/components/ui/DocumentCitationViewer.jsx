import { useState, useCallback } from "react";
import { ExternalLink, FileText, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Use CDN worker to avoid MIME type issues with .mjs on some servers
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Ensure marks inside PDF text layer are visible
const HIGHLIGHT_STYLE = `
  .react-pdf__Page__textContent mark {
    background: rgba(255, 215, 0, 0.65) !important;
    color: inherit !important;
    border-radius: 2px;
    padding: 0 1px;
  }
`;

const DocumentCitationViewer = ({ citation, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(citation?.page || 1);
  const [scale, setScale] = useState(1.2);
  const [loadError, setLoadError] = useState(false);

  const url = citation?.cloudinaryUrl || null;
  const snippets = Array.isArray(citation?.snippets) ? citation.snippets : [];
  // Section summary mode: only when backend explicitly marks it as a section summary
  const isSectionSummary = citation?.isSectionSummary === true;
  const startPage = citation?.page || 1;
  // Cap section highlight to 10 pages max to avoid highlighting the entire document
  const MAX_HIGHLIGHT_PAGES = 10;
  const rawEndPage = citation?.endPage ?? startPage;
  const endPage = isSectionSummary
    ? Math.min(rawEndPage, startPage + MAX_HIGHLIGHT_PAGES - 1)
    : startPage;

  // Normalize text for comparison
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

  // Highlight matching text
  // For section summaries: highlight ALL text on every page in the section range (capped at 10 pages)
  // For regular citations (multi-doc QA): highlight only matching snippets on the cited page — unchanged
  const customTextRenderer = useCallback(
    ({ str, pageNumber: renderedPage }) => {
      // Section summary path — only when isSectionSummary is explicitly true
      if (isSectionSummary) {
        if (renderedPage >= startPage && renderedPage <= endPage) {
          return `<mark style="background:rgba(255,215,0,0.3);color:inherit;border-radius:2px;padding:0 1px;">${str}</mark>`;
        }
        return str;
      }

      // Regular citation (multi-doc QA) — snippet-based highlighting, unchanged
      if (renderedPage !== citation?.page) return str;
      if (snippets.length === 0) return str;
      
      try {
        const normalizedStr = normalize(str);
        if (normalizedStr.length < 4) return str;
        
        for (const snippet of snippets) {
          const normalizedSnippet = normalize(snippet);
          if (normalizedSnippet.length < 10) continue;
          
          if (normalizedSnippet.includes(normalizedStr) || normalizedStr.includes(normalizedSnippet)) {
            return `<mark style="background:rgba(255,215,0,0.75);color:#1a1209;border-radius:2px;padding:0 1px;">${str}</mark>`;
          }

          const stripParens = (s) => s.replace(/\s*\([^)]*\)/g, "").trim();
          const baseSnippet = stripParens(normalizedSnippet);
          const baseStr = stripParens(normalizedStr);
          if (baseSnippet.length >= 10 && baseStr.length >= 10) {
            if (baseSnippet.includes(baseStr) || baseStr.includes(baseSnippet)) {
              return `<mark style="background:rgba(255,215,0,0.75);color:#1a1209;border-radius:2px;padding:0 1px;">${str}</mark>`;
            }
          }
        }
        
        return str;
      } catch {
        return str;
      }
    },
    [snippets, citation?.page, isSectionSummary, startPage, endPage]
  );

  if (!citation) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(26,18,9,0.62)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{HIGHLIGHT_STYLE}</style>
      <div
        className="w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#fff", border: "1px solid #e0d8ce", boxShadow: "0 30px 70px rgba(26,18,9,0.32)", height: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-3 flex-shrink-0" style={{ background: "#1A1209", borderBottom: "2px solid #F58220" }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,130,32,0.18)", border: "1px solid rgba(245,130,32,0.35)" }}>
                <FileText size={13} style={{ color: "#F58220" }} />
              </div>
              <h3 className="text-sm font-bold truncate" style={{ color: "#faf6ef", fontFamily: "Georgia, serif" }}>
                {citation.docTitle || "Document"}
              </h3>
            </div>
            <p className="text-[11px]" style={{ color: "rgba(250,246,239,0.55)" }}>
              {isSectionSummary && rawEndPage !== startPage
                ? `Pages ${startPage}–${endPage}${rawEndPage > endPage ? ` (showing first ${MAX_HIGHLIGHT_PAGES})` : ""}`
                : citation.page ? `Page ${citation.page}` : "Referenced section"}
              {citation.section ? ` · ${citation.section}` : ""}
              {isSectionSummary && <span style={{ color: "rgba(245,130,32,0.8)", marginLeft: 6 }}>· Section highlighted</span>}
            </p>
            {snippets.length > 0 && (
              <p className="text-[11px] mt-1 line-clamp-2 max-w-2xl" style={{ color: "rgba(250,246,239,0.45)" }}>
                {snippets.map((snip, idx) => (
                  <span key={idx} title={snip}>
                    "{snip}"{idx < snippets.length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {url && (
              <a href={`${url}#page=${currentPage}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(245,130,32,0.16)", color: "#F58220", border: "1px solid rgba(245,130,32,0.35)" }}>
                <ExternalLink size={12} /> Open in new tab
              </a>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "rgba(250,246,239,0.6)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(250,246,239,0.12)"; e.currentTarget.style.color = "#faf6ef"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(250,246,239,0.6)"; }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ background: "#2a1d11", borderBottom: "1px solid #3d2c1c" }}>
          {/* Page nav */}
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", color: "#faf6ef" }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium" style={{ color: "#faf6ef" }}>
              {currentPage} / {numPages || "—"}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))} disabled={!numPages || currentPage >= numPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", color: "#faf6ef" }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)", color: "#faf6ef" }}>
              <ZoomOut size={13} />
            </button>
            <span className="text-xs" style={{ color: "rgba(250,246,239,0.6)" }}>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)", color: "#faf6ef" }}>
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* PDF */}
        <div className="flex-1 min-h-0 overflow-auto flex justify-center py-4 px-2" style={{ background: "#FAF6EF" }}>
          {!url || loadError ? (
            <div className="flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#fff0e8" }}>
                <FileText size={24} style={{ color: "#F58220" }} />
              </div>
              <p className="text-sm font-bold mb-2" style={{ color: "#3D2C1C" }}>No document source available</p>
              <p className="text-xs max-w-md" style={{ color: "rgba(65,50,24,0.6)" }}>
                This answer was not sourced from a specific document location.
              </p>
            </div>
          ) : (
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => { setNumPages(numPages); }}
              onLoadError={() => setLoadError(true)}
              loading={<div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full" /></div>}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                customTextRenderer={customTextRenderer}
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentCitationViewer;
