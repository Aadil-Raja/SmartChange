// src/pages/admin/AdminContentLibrary.jsx
import { useState, useEffect, useRef } from "react";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import AdminSidebar from "../../components/ui/AdminSidebar";
import {
  Video, Link as LinkIcon, FileText, Upload, Edit2,
  Trash2, Search, Play, Plus, X, ExternalLink,
} from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const C = {
  bg: "#faf6ef",
  card: "#ffffff",
  orange: '#f7953f',
  orangeLight: "rgba(245,130,32,0.10)",
  orangeBorder: "rgba(245,130,32,0.25)",
  ink: "#1a1209",
  muted: "#9c8e80",
  border: "#e8e0d5",
  blue: "#00ADEF",
  blueLight: "rgba(0,173,239,0.10)",
  green: "#78BE20",
  greenLight: "rgba(120,190,32,0.10)",
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const formatSize = (bytes) => {
  if (!bytes) return null;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 10) / 10} ${sizes[i]}`;
};

// ── Tab Button ────────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all"
    style={
      active
        ? { background: C.orange, color: "#fff" }
        : { background: "transparent", color: C.muted }
    }
  >
    {label}
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={
        active
          ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
          : { background: "#f0ebe3", color: C.muted }
      }
    >
      {count}
    </span>
  </button>
);

// ── shared card shell ─────────────────────────────────────────────────────────
const cardStyle = {
  background: C.card,
  border: `1px solid #e5ddd0`,
  borderRadius: "16px",
  boxShadow: "0 1px 4px rgba(26,18,9,0.06)",
  transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
};
const cardHover = {
  transform: "translateY(-4px)",
  boxShadow: "0 8px 24px rgba(26,18,9,0.12)",
  borderColor: "#c8bfb0",
};

// ── Video Card ────────────────────────────────────────────────────────────────
const VideoCard = ({ video, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const url = video.secure_url || video.cloudinary_url;

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{ ...cardStyle, ...(hovered ? cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover — fixed 180px */}
      <div
        className="relative flex-shrink-0 cursor-pointer group overflow-hidden"
        style={{ height: 180, background: "#1a1209" }}
        onClick={() => url && window.open(url, "_blank")}
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(245,130,32,0.18)" }}>
              <Play size={22} style={{ color: C.orange }} fill={C.orange} />
            </div>
          </div>
        )}
        {/* hover overlay */}
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ background: C.orange }}>
            <Play size={20} color="#fff" fill="#fff" />
          </div>
        </div>
        {/* status dot */}
        <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: C.orange }} />
        {/* duration badge */}
        {video.duration_sec && (
          <span
            className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide"
            style={{ background: "rgba(0,0,0,0.72)", color: "#fff" }}
          >
            {Math.floor(video.duration_sec / 60)}:{String(Math.floor(video.duration_sec % 60)).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1 flex-1 flex flex-col gap-1">
        <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: C.ink, fontFamily: "Georgia, serif" }}>{video.title}</p>
        <p className="text-xs" style={{ color: C.muted }}>{formatDate(video.created_at)}</p>
        {video.size_bytes && (
          <p className="text-xs" style={{ color: C.muted }}>{formatSize(video.size_bytes)}</p>
        )}
      </div>

      {/* Footer — anchored */}
      <div className="px-4 pb-4 pt-2 flex items-center gap-2">
        <button
          onClick={() => url && window.open(url, "_blank")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-88"
          style={{ background: C.orange }}
        >
          <Play size={12} fill="#fff" /> Watch
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors hover:bg-red-50"
          style={{ border: "1.5px solid #fca5a5" }}
        >
          <Trash2 size={13} color="#ef4444" />
        </button>
      </div>
    </div>
  );
};

// ── Document Card ─────────────────────────────────────────────────────────────
const DocCard = ({ doc }) => {
  const [hovered, setHovered] = useState(false);
  const statusMap = {
    PROCESSED:  { label: "Processed",  bg: "rgba(120,190,32,0.12)", color: C.green,   dot: C.green   },
    STORED:     { label: "Stored",     bg: "rgba(0,173,239,0.12)",  color: C.blue,    dot: C.blue    },
    QUEUED:     { label: "Queued",     bg: C.orangeLight,           color: C.orange,  dot: C.orange  },
    PROCESSING: { label: "Processing", bg: C.orangeLight,           color: C.orange,  dot: C.orange  },
    FAILED:     { label: "Failed",     bg: "rgba(239,68,68,0.10)",  color: "#ef4444", dot: "#ef4444" },
  };
  const badge = statusMap[doc.status] || statusMap.STORED;
  const viewUrl = doc.cloudinary_url;
  const canView = doc.status === "PROCESSED" || doc.status === "STORED";

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{ ...cardStyle, ...(hovered ? cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover — fixed 180px */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ height: 180, background: "rgba(120,190,32,0.08)" }}
      >
        {doc.cloudinary_thumbnail_url ? (
          <img
            src={doc.cloudinary_thumbnail_url}
            alt={doc.title || doc.filename}
            className="w-full h-full object-cover transition-transform duration-300"
            style={{ transform: hovered ? "scale(1.04)" : "scale(1)" }}
          />
        ) : (
          <FileText
            size={52}
            style={{ color: C.green, opacity: 0.28, transition: "transform 0.3s", transform: hovered ? "scale(1.08)" : "scale(1)" }}
          />
        )}
        {/* status dot corner */}
        <div
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white"
          style={{ background: badge.bg }}
          title={badge.label}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: badge.dot }} />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1 flex-1 flex flex-col gap-1">
        <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: C.ink, fontFamily: "Georgia, serif" }}>{doc.title || doc.filename}</p>
        <div className="flex items-center gap-1.5">
          <FileText size={11} style={{ color: C.muted }} />
          <span className="text-xs" style={{ color: C.muted }}>PDF Document</span>
        </div>
        <span
          className="self-start flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
          style={{ background: badge.bg, color: badge.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.dot }} />
          {badge.label}
        </span>
        <p className="text-xs" style={{ color: C.muted }}>{formatDate(doc.created_at)}</p>
      </div>

      {/* Footer — anchored */}
      <div className="px-4 pb-4 pt-2">
        <button
          onClick={() => viewUrl && canView && window.open(viewUrl, "_blank")}
          disabled={!viewUrl || !canView}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold text-white transition-opacity"
          style={{
            background: canView && viewUrl ? C.orange : "#d4cdc5",
            cursor: canView && viewUrl ? "pointer" : "not-allowed",
            opacity: canView && viewUrl ? 1 : 0.6,
          }}
        >
          <FileText size={12} /> View Document
        </button>
      </div>
    </div>
  );
};

// ── Link Card ─────────────────────────────────────────────────────────────────
const LinkCard = ({ link, onEdit, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{ ...cardStyle, ...(hovered ? cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover — fixed 180px */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ height: 180, background: "#e8f4fd" }}
      >
        <LinkIcon
          size={52}
          style={{ color: C.blue, opacity: 0.30, transition: "transform 0.3s", transform: hovered ? "scale(1.08)" : "scale(1)" }}
        />
        <div
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-white"
          style={{ background: "rgba(0,173,239,0.15)" }}
        >
          <LinkIcon size={12} style={{ color: C.blue }} />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1 flex-1 flex flex-col gap-1">
        <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: C.ink, fontFamily: "Georgia, serif" }}>{link.title}</p>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs truncate hover:underline"
          style={{ color: C.orange }}
        >
          {link.url}
        </a>
        <p className="text-xs" style={{ color: C.muted }}>{formatDate(link.created_at)}</p>
      </div>

      {/* Footer — anchored */}
      <div className="px-4 pb-4 pt-2 flex items-center gap-2">
        <button
          onClick={() => window.open(link.url, "_blank")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-88"
          style={{ background: C.orange }}
        >
          <ExternalLink size={12} /> Open Link
        </button>
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors hover:bg-orange-50"
          style={{ border: `1.5px solid ${C.orangeBorder}` }}
        >
          <Edit2 size={13} style={{ color: C.orange }} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors hover:bg-red-50"
          style={{ border: "1.5px solid #fca5a5" }}
        >
          <Trash2 size={13} color="#ef4444" />
        </button>
      </div>
    </div>
  );
};

// ── Upload Video Modal ────────────────────────────────────────────────────────
const VideoUploadModal = ({ onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState({ title: "", file: null });
  const fileRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.file) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: C.ink }}>Upload Video</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: C.muted }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: C.ink }}>Title <span style={{ color: C.orange }}>*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter video title"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ border: `1.5px solid ${C.border}`, color: C.ink }}
              onFocus={e => { e.target.style.borderColor = C.orange; e.target.style.boxShadow = `0 0 0 3px ${C.orangeLight}`; }}
              onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: C.ink }}>MP4 File <span style={{ color: C.orange }}>*</span></label>
            <div
              className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-6 cursor-pointer transition-colors hover:bg-orange-50"
              style={{ borderColor: form.file ? C.orange : C.border }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} style={{ color: form.file ? C.orange : C.muted }} />
              <p className="text-sm mt-2" style={{ color: form.file ? C.orange : C.muted }}>
                {form.file ? form.file.name : "Click to select MP4 file"}
              </p>
              {form.file && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{formatSize(form.file.size)}</p>}
            </div>
            <input ref={fileRef} type="file" accept=".mp4" className="hidden" onChange={e => setForm(f => ({ ...f, file: e.target.files[0] || null }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors hover:bg-gray-100" style={{ color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.file}
              className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: C.orange }}
            >
              {submitting ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Add / Edit Link Modal ─────────────────────────────────────────────────────
const LinkModal = ({ editing, onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState({ title: editing?.title || "", url: editing?.url || "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    onSubmit(form);
  };

  const fieldStyle = {
    border: `1.5px solid ${C.border}`,
    color: C.ink,
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: C.ink }}>{editing ? "Edit Link" : "Add Link"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: C.muted }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: C.ink }}>Title <span style={{ color: C.orange }}>*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Link title"
              style={fieldStyle}
              onFocus={e => { e.target.style.borderColor = C.orange; e.target.style.boxShadow = `0 0 0 3px ${C.orangeLight}`; }}
              onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: C.ink }}>URL <span style={{ color: C.orange }}>*</span></label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com"
              style={fieldStyle}
              onFocus={e => { e.target.style.borderColor = C.orange; e.target.style.boxShadow = `0 0 0 3px ${C.orangeLight}`; }}
              onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors hover:bg-gray-100" style={{ color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.url.trim()}
              className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: C.orange }}
            >
              {submitting ? "Saving…" : editing ? "Save Changes" : "Add Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const AdminContentLibrary = () => {
  const {
    externalLinks, videos, loading,
    fetchExternalLinks, fetchVideos,
    createNewExternalLink, updateExistingExternalLink, deleteExistingExternalLink,
    uploadNewVideo, deleteExistingVideo,
    fetchProcessedDocuments, clearMessages,
  } = useAdminTraining();

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState("videos");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetched = useRef({ links: false, videos: false, docs: false });

  useEffect(() => {
    if (!fetched.current.links)   { fetchExternalLinks(); fetched.current.links = true; }
    if (!fetched.current.videos)  { fetchVideos();        fetched.current.videos = true; }
    if (!fetched.current.docs)    { loadDocs();           fetched.current.docs = true; }
    return () => clearMessages();
  }, []);

  const loadDocs = async () => {
    const res = await fetchProcessedDocuments();
    if (res.success) setDocuments(res.data?.documents || res.data || []);
  };

  const filter = (items) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.filename?.toLowerCase().includes(q) ||
      i.url?.toLowerCase().includes(q)
    );
  };

  const handleVideoUpload = async (form) => {
    setSubmitting(true);
    const res = await uploadNewVideo(form.title.trim(), form.file);
    setSubmitting(false);
    if (res.success) setShowVideoModal(false);
  };

  const handleLinkSubmit = async (form) => {
    setSubmitting(true);
    const res = editingLink
      ? await updateExistingExternalLink(editingLink.id, form)
      : await createNewExternalLink(form);
    setSubmitting(false);
    if (res.success) { setShowLinkModal(false); setEditingLink(null); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const res = deleteConfirm.type === "video"
      ? await deleteExistingVideo(deleteConfirm.id)
      : await deleteExistingExternalLink(deleteConfirm.id);
    if (res?.success) {
      setDeleteConfirm(null);
      setDeleteError(null);
    } else {
      setDeleteError(res?.message || "Failed to delete item.");
    }
  };

  const filteredVideos = filter(videos);
  const filteredLinks  = filter(externalLinks);
  const filteredDocs   = filter(documents);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(p => !p)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Hero Banner ── */}
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
              Content Library
            </h1>
            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
              Manage videos, links, and processed documents
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Videos",    value: videos.length,        dot: C.orange },
              { label: "Links",     value: externalLinks.length, dot: C.blue   },
              { label: "Documents", value: documents.length,     dot: C.green  },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                {s.label}: <span className="font-bold ml-0.5">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab Container ── */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(26,18,9,0.06)" }}>

            {/* ── Unified Toolbar ── */}
            <div className="px-6 py-4 flex items-center justify-between gap-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              {/* Tabs (left) */}
              <div className="flex items-center gap-1">
                <TabBtn active={activeTab === "videos"}    onClick={() => setActiveTab("videos")}    label="Videos"    count={videos.length} />
                <TabBtn active={activeTab === "links"}     onClick={() => setActiveTab("links")}     label="Links"     count={externalLinks.length} />
                <TabBtn active={activeTab === "documents"} onClick={() => setActiveTab("documents")} label="Documents" count={documents.length} />
              </div>

              {/* Search + Action button (right) */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg outline-none transition-all"
                    style={{ background: C.bg, border: `1.5px solid ${C.border}`, color: C.ink }}
                    onFocus={e => { e.target.style.borderColor = C.orange; e.target.style.boxShadow = `0 0 0 3px ${C.orangeLight}`; }}
                    onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {activeTab === "videos" && (
                  <button
                    onClick={() => setShowVideoModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                    style={{ background: C.orange }}
                  >
                    <Upload size={14} /> Upload Video
                  </button>
                )}
                {activeTab === "links" && (
                  <button
                    onClick={() => { setEditingLink(null); setShowLinkModal(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                    style={{ background: C.orange }}
                  >
                    <Plus size={14} /> Add Link
                  </button>
                )}
              </div>
            </div>

            {/* ── Grid ── */}
            <div className="p-5">
              {loading ? (
                <div className="py-20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.orange} transparent ${C.orange} ${C.orange}` }} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {activeTab === "videos"    && filteredVideos.map(v => <VideoCard key={v.id} video={v} onDelete={() => setDeleteConfirm({ ...v, type: "video" })} />)}
                  {activeTab === "links"     && filteredLinks.map(l  => <LinkCard  key={l.id} link={l}  onEdit={() => { setEditingLink(l); setShowLinkModal(true); }} onDelete={() => setDeleteConfirm({ ...l, type: "link" })} />)}
                  {activeTab === "documents" && filteredDocs.map(d   => <DocCard   key={d.id} doc={d} />)}
                </div>
              )}

              {/* Empty states */}
              {!loading && activeTab === "videos"    && filteredVideos.length === 0 && <EmptyState icon={Video}    color={C.orange} bg={C.orangeLight} title={videos.length === 0 ? "No videos yet" : "No results"} sub={videos.length === 0 ? "Upload your first MP4 video" : "Try a different search"} />}
              {!loading && activeTab === "links"     && filteredLinks.length  === 0 && <EmptyState icon={LinkIcon} color={C.blue}   bg={C.blueLight}   title={externalLinks.length === 0 ? "No links yet" : "No results"} sub={externalLinks.length === 0 ? "Add your first external link" : "Try a different search"} />}
              {!loading && activeTab === "documents" && filteredDocs.length   === 0 && <EmptyState icon={FileText} color={C.green}  bg={C.greenLight}  title={documents.length === 0 ? "No documents yet" : "No results"} sub={documents.length === 0 ? "Upload documents from the Dashboard" : "Try a different search"} />}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showVideoModal && <VideoUploadModal onClose={() => setShowVideoModal(false)} onSubmit={handleVideoUpload} submitting={submitting} />}
      {showLinkModal  && <LinkModal editing={editingLink} onClose={() => { setShowLinkModal(false); setEditingLink(null); }} onSubmit={handleLinkSubmit} submitting={submitting} />}
      {deleteConfirm  && (
        <>
          {deleteError && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto max-w-sm w-full mx-4 px-4 py-3 rounded-xl flex items-start gap-3 shadow-lg"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "220px" }}
              >
                <span className="text-red-500 text-lg leading-none flex-shrink-0">⚠</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Cannot delete</p>
                  <p className="text-xs text-red-600 mt-0.5">{deleteError}</p>
                </div>
                <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            </div>
          )}
          <ConfirmDialog
            title={`Delete ${deleteConfirm.type === "video" ? "Video" : "Link"}`}
            message={`Are you sure you want to delete "${deleteConfirm.title}"? This cannot be undone.`}
            onConfirm={handleDelete}
            onCancel={() => { setDeleteConfirm(null); setDeleteError(null); }}
          />
        </>
      )}
    </div>
  );
};

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, color, bg, title, sub }) => (
  <div className="py-16 flex flex-col items-center gap-3">
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: bg }}>
      <Icon size={32} style={{ color }} />
    </div>
    <p className="font-bold text-base" style={{ color: C.ink }}>{title}</p>
    <p className="text-sm" style={{ color: C.muted }}>{sub}</p>
  </div>
);

export default AdminContentLibrary;
