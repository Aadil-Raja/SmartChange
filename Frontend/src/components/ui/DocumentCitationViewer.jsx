import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { getProcessedDocumentById } from "../../services/documentService";

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const deriveCloudinaryPdfUrlFromThumbnail = (thumbnailUrl, publicId) => {
  if (typeof thumbnailUrl !== "string" || !thumbnailUrl.includes("res.cloudinary.com")) {
    return null;
  }

  const cloudNameMatch = thumbnailUrl.match(/res\.cloudinary\.com\/([^/]+)\//);
  if (!cloudNameMatch?.[1]) return null;

  const cloudName = cloudNameMatch[1];
  if (publicId) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/v1/${publicId}.pdf`;
  }

  const v1Index = thumbnailUrl.indexOf("/v1/");
  if (v1Index === -1) return null;

  const afterV1 = thumbnailUrl.slice(v1Index + 4);
  const lastDotIndex = afterV1.lastIndexOf(".");
  if (lastDotIndex === -1) return null;

  const assetPath = afterV1.slice(0, lastDotIndex);
  return `https://res.cloudinary.com/${cloudName}/image/upload/v1/${assetPath}.pdf`;
};

const getDocumentUrl = (documentItem) => {
  if (!documentItem) return null;

  const reconstructedFromThumb = deriveCloudinaryPdfUrlFromThumbnail(
    documentItem.cloudinary_thumbnail_url,
    documentItem.cloudinary_public_id
  );

  return (
    documentItem.cloudinary_url ||
    reconstructedFromThumb ||
    documentItem.url ||
    documentItem.secure_url ||
    documentItem.access_url ||
    null
  );
};

const getDocumentThumbnail = (documentItem) => {
  if (!documentItem) return null;
  return documentItem.cloudinary_thumbnail_url || null;
};

const withPageAnchor = (url, page) => {
  if (!url) return null;
  if (!page || Number.isNaN(Number(page))) return url;
  const sanitized = url.split("#")[0];
  return `${sanitized}#page=${Number(page)}`;
};

const DocumentCitationViewer = ({ citation, documents, onClose }) => {
  const [fetchedDocument, setFetchedDocument] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  const matchedDocument = useMemo(() => {
    const items = Array.isArray(documents) ? documents : [];
    if (items.length === 0) return null;

    const byId = citation?.docId
      ? items.find((doc) => Number(doc.id) === Number(citation.docId))
      : null;
    if (byId) return byId;

    const wantedTitle = normalizeText(citation?.docTitle);
    if (!wantedTitle) return null;

    return (
      items.find((doc) => normalizeText(doc.title) === wantedTitle) ||
      items.find((doc) => normalizeText(doc.original_filename) === wantedTitle) ||
      null
    );
  }, [citation, documents]);

  useEffect(() => {
    let isMounted = true;

    const resolveDocument = async () => {
      setFetchedDocument(null);

      if (!citation?.docId) return;

      const localUrl = getDocumentUrl(matchedDocument);
      if (localUrl) return;

      setIsResolving(true);
      try {
        const res = await getProcessedDocumentById(citation.docId);
        if (!isMounted) return;

        if (res?.success && res?.data?.document) {
          setFetchedDocument(res.data.document);
        }
      } catch (_err) {
        if (!isMounted) return;
        setFetchedDocument(null);
      } finally {
        if (isMounted) {
          setIsResolving(false);
        }
      }
    };

    resolveDocument();

    return () => {
      isMounted = false;
    };
  }, [citation?.docId, matchedDocument]);

  const resolvedDocument = useMemo(() => {
    const fetchedUrl = getDocumentUrl(fetchedDocument);
    if (fetchedUrl) return fetchedDocument;
    return matchedDocument || fetchedDocument;
  }, [matchedDocument, fetchedDocument]);

  const baseUrl = getDocumentUrl(resolvedDocument);
  const thumbnailUrl = getDocumentThumbnail(resolvedDocument);
  const viewerUrl = withPageAnchor(baseUrl, citation?.page);

  if (!citation) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(26,18,9,0.62)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#fff",
          border: "1px solid #e0d8ce",
          boxShadow: "0 30px 70px rgba(26,18,9,0.32)",
          height: "88vh",
        }}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 flex-shrink-0"
          style={{ background: "#1A1209", borderBottom: "2px solid #F58220" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,130,32,0.18)", border: "1px solid rgba(245,130,32,0.35)" }}
              >
                <FileText size={15} style={{ color: "#F58220" }} />
              </div>
              <h3
                className="text-sm sm:text-base font-bold truncate"
                style={{ color: "#faf6ef", fontFamily: "Georgia, serif" }}
                title={citation.docTitle || "Document"}
              >
                {citation.docTitle || "Document"}
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs" style={{ color: "rgba(250,246,239,0.6)" }}>
              {citation.page ? `Page ${citation.page}` : "Referenced section"}
              {citation.section ? ` | ${citation.section}` : ""}
            </p>
            {citation.snippet && (
              <p
                className="text-[11px] mt-2 max-w-3xl line-clamp-2"
                style={{ color: "rgba(250,246,239,0.5)" }}
                title={citation.snippet}
              >
                {citation.snippet}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {viewerUrl && (
              <a
                href={viewerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "rgba(245,130,32,0.16)", color: "#F58220", border: "1px solid rgba(245,130,32,0.35)" }}
              >
                <ExternalLink size={12} />
                Open in new tab
              </a>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "rgba(250,246,239,0.6)" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "rgba(250,246,239,0.12)";
                event.currentTarget.style.color = "#faf6ef";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
                event.currentTarget.style.color = "rgba(250,246,239,0.6)";
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-4" style={{ background: "#FAF6EF" }}>
          {isResolving ? (
            <div
              className="h-full rounded-xl flex flex-col items-center justify-center text-center px-6"
              style={{ background: "#fff", border: "1px solid #e0d8ce" }}
            >
              <div
                className="w-12 h-12 rounded-2xl mb-4 animate-pulse"
                style={{ background: "#fff0e8", border: "1px solid #f1c9a5" }}
              />
              <p className="text-sm font-bold mb-2" style={{ color: "#3D2C1C" }}>
                Resolving document preview...
              </p>
              <p className="text-xs max-w-md" style={{ color: "rgba(65,50,24,0.6)" }}>
                Fetching latest document metadata for this citation.
              </p>
            </div>
          ) : viewerUrl ? (
            <iframe
              src={viewerUrl}
              title={citation.docTitle || "Cited document"}
              className="w-full h-full rounded-xl"
              style={{ border: "1px solid #d7c8b3", background: "#fff" }}
            />
          ) : (
            <div
              className="h-full rounded-xl flex flex-col items-center justify-center text-center px-6"
              style={{ background: "#fff", border: "1px solid #e0d8ce" }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={citation.docTitle || "Document thumbnail"}
                  className="w-full max-w-md h-48 object-cover rounded-xl mb-4"
                  style={{ border: "1px solid #e0d8ce" }}
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "#fff0e8" }}
                >
                  <FileText size={24} style={{ color: "#F58220" }} />
                </div>
              )}
              <p className="text-sm font-bold mb-2" style={{ color: "#3D2C1C" }}>
                Preview unavailable for this document
              </p>
              <p className="text-xs max-w-md" style={{ color: "rgba(65,50,24,0.6)" }}>
                This citation is mapped, but no viewable document URL is currently available.
                You can still use the citation details above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentCitationViewer;
