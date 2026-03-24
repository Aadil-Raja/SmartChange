// pages/AdminDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import {
  FileText, Upload, Play, CheckCircle, AlertCircle, Clock, RefreshCw,
  Edit, Plus, X, ClipboardList, Search, Filter, BookOpen
} from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import { useAdmin } from '../../hooks/useAdmin';
import { fetchProcessingJobs, fetchDocumentSections } from '../../services/adminApi';

const C = {
  bg: '#faf6ef',
  card: '#ffffff',
  orange: '#f7953f',
  orangeLight: 'rgba(245,130,32,0.10)',
  orangeBorder: 'rgba(245,130,32,0.25)',
  ink: '#1a1209',
  muted: '#9c8e80',
  border: '#e8e0d5',
  cream: '#f5f0e8',
  blue: '#00ADEF',
  green: '#78BE20',
};

// ─── tiny helpers ────────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
};

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const formatDuration = (s) => {
  if (!s) return 'N/A';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'STORED':     return { color: '#00ADEF', bg: 'rgba(0,173,239,0.10)',  label: 'Stored' };
    case 'QUEUED':     return { color: '#f7953f', bg: 'rgba(245,130,32,0.10)', label: 'Queued' };
    case 'PROCESSING': return { color: '#f7953f', bg: 'rgba(245,130,32,0.10)', label: 'Processing' };
    case 'PROCESSED':  return { color: '#78BE20', bg: 'rgba(120,190,32,0.10)', label: 'Processed' };
    case 'FAILED':     return { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  label: 'Failed' };
    default:           return { color: C.muted,   bg: C.cream,                 label: status };
  }
};

const auditStatusColor = (s) => {
  switch (s?.toLowerCase()) {
    case 'queued':     return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
    case 'processing': return { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' };
    case 'completed':  return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
    case 'failed':     return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
    default:           return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  }
};

// ─── shared input style ───────────────────────────────────────────────────────
const inputCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all
  focus:ring-2 focus:ring-[#f7953f]/20 focus:border-[#f7953f]`;


const AdminDashboard = () => {
  const {
    documents, loading, error, jobStatuses,
    loadDocuments, uploadDoc, queueDoc, checkJobStatus,
    deleteDoc, downloadDoc, clearError,
  } = useAdmin();

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditJobs, setAuditJobs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditStats, setAuditStats] = useState({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; loadDocuments(); }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      Object.entries(jobStatuses).forEach(([jobId, s]) => {
        if (s.status !== 'finished' && s.status !== 'failed') checkJobStatus(jobId);
      });
    }, 2000);
    return () => clearInterval(id);
  }, [jobStatuses, checkJobStatus]);

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { e.target.value = ''; return; }
    setUploadingFile(file);
    if (!uploadTitle) setUploadTitle(file.name);
  };

  const handleUpload = async () => {
    if (!uploadingFile) return;
    setUploading(true);
    try {
      const result = await uploadDoc(uploadingFile, uploadTitle.trim() || null);
      if (result.success) { setShowUploadModal(false); setUploadingFile(null); setUploadTitle(''); }
    } finally { setUploading(false); }
  };

  const handleQueueDocument = async (documentId) => {
    setProcessingDocs(prev => new Set(prev).add(documentId));
    try { await queueDoc(documentId); }
    finally {
      setProcessingDocs(prev => { const s = new Set(prev); s.delete(documentId); return s; });
    }
  };

  const handleOpenSections = async (doc) => {
    setSelectedDoc(doc);
    setLoadingSections(true);
    setShowSectionsModal(true);
    try {
      const r = await fetchDocumentSections(doc.id);
      setSections(r.success ? (r.data.sections || []) : []);
    } catch { setSections([]); }
    finally { setLoadingSections(false); }
  };

  const handleOpenAuditLog = async () => {
    setShowAuditLog(true); setLoadingAudit(true);
    try {
      const r = await fetchProcessingJobs();
      if (r.success) { setAuditJobs(r.data.jobs || []); setAuditStats(r.data.stats || {}); }
    } catch { setAuditJobs([]); }
    finally { setLoadingAudit(false); }
  };

  const getFilteredAuditJobs = () => {
    let f = auditJobs;
    if (auditStatusFilter !== 'all') f = f.filter(j => j.status.toLowerCase() === auditStatusFilter);
    if (auditSearchTerm) f = f.filter(j =>
      j.document_title?.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      j.job_id?.toLowerCase().includes(auditSearchTerm.toLowerCase())
    );
    return f;
  };

  const docStats = {
    total: documents.length,
    ready: documents.filter(d => d.status === 'STORED').length,
    processing: documents.filter(d => d.status === 'PROCESSING' || d.status === 'QUEUED').length,
    completed: documents.filter(d => d.status === 'PROCESSED').length,
  };


  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Hero Banner ── */}
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF',borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
              Document Dashboard
            </h1>
            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
              Manage documents and monitor system activity
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Total',      value: docStats.total,      dot: '#1a1918' },
              { label: 'Ready',      value: docStats.ready,      dot: C.blue },
              { label: 'Processing', value: docStats.processing, dot: C.orange },
              { label: 'Completed',  value: docStats.completed,  dot: C.green },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                {s.label}: <span className="font-bold ml-0.5">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">

          {/* ── Error ── */}
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 14 }}
              className="flex items-start justify-between p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} color="#dc2626" className="mt-0.5" />
                <p style={{ color: '#991b1b', fontSize: 13 }}>{error}</p>
              </div>
              <button onClick={clearError} style={{ color: '#dc2626' }}><X size={16} /></button>
            </div>
          )}

          {/* ── Upload Card ── */}
          <div>

            {/* Upload / Document Management Card */}
            <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}` }}
              className="p-6 shadow-sm">

              {/* Icon + Title */}
              <div className="flex items-start gap-4 mb-5">
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={26} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Georgia, serif', color: C.ink, fontSize: 22, fontWeight: 700 }}>
                    Document Management
                  </h2>
                  <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
                    Upload and process PDF documents for AI training
                  </p>
                </div>
              </div>

              {/* Requirements box */}
              <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 12 }}
                className="p-4 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: <FileText size={16} color={C.blue} />, label: 'File Format', desc: 'PDF documents only', dot: C.blue },
                    { icon: <AlertCircle size={16} color={C.orange} />, label: 'File Size', desc: 'Maximum 100 MB per file', dot: C.orange },
                    { icon: <CheckCircle size={16} color={C.green} />, label: 'Processing', desc: 'Automatic AI extraction', dot: C.green },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">{icon}</div>
                      <div>
                        <p style={{ color: C.ink, fontSize: 13, fontWeight: 600 }}>{label}</p>
                        <p style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload button */}
              <button
                onClick={() => setShowUploadModal(true)}
                style={{
                  width: '100%', background: C.orange, color: '#fff', border: 'none',
                  borderRadius: 50, padding: '12px 0', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e0741c'}
                onMouseLeave={e => e.currentTarget.style.background = C.orange}
              >
                <Upload size={18} /> Upload New Document
              </button>
            </div>
          </div>

          {/* ── Recent Documents Card ── */}
          <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}` }}
            className="p-6 shadow-sm">

            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', color: C.ink, fontSize: 22, fontWeight: 700 }}>
                  Recent Documents
                </h2>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
                  Manage and process your uploaded files
                </p>
              </div>
              <div className="flex items-center gap-3">
                {documents.length > 0 && (
                  <span style={{
                    background: C.cream, color: C.muted, borderRadius: 50,
                    padding: '4px 14px', fontSize: 12, fontWeight: 600,
                  }}>
                    {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                  </span>
                )}
                <button
                  onClick={handleOpenAuditLog}
                  style={{
                    border: `1.5px solid ${C.orange}`, color: C.orange, background: 'transparent',
                    borderRadius: 50, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.orangeLight}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ClipboardList size={14} /> Audit Log
                </button>
              </div>
            </div>

            {/* Document rows */}
            {loading ? (
              <div className="py-12 text-center" style={{ color: C.muted }}>Loading documents…</div>
            ) : documents.length === 0 ? (
              <div className="py-16 text-center">
                <div style={{ display: 'inline-flex', padding: 24, background: C.cream, borderRadius: '50%', marginBottom: 16 }}>
                  <FileText size={48} color={C.border} />
                </div>
                <h3 style={{ color: C.ink, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No documents yet</h3>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
                  Upload your first document to get started with AI processing
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    background: C.orange, color: '#fff', border: 'none', borderRadius: 50,
                    padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Upload size={16} /> Upload First Document
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const badge = getStatusBadge(doc.status);
                  const isProcessing = processingDocs.has(doc.id);
                  return (
                    <div key={doc.id}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card }}
                      className="flex items-center justify-between px-4 py-3 hover:shadow-sm transition-shadow">

                      {/* Left: icon + info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <FileText size={28} color={C.muted} className="mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p style={{ color: C.ink, fontWeight: 600, fontSize: 14 }} className="truncate">
                            {doc.title}
                          </p>
                          <p style={{ color: C.muted, fontSize: 12 }} className="truncate">{doc.original_filename}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Status pill */}
                            <span style={{
                              background: badge.bg, color: badge.color,
                              borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                            }}>
                              {badge.label}
                            </span>
                            <span style={{ color: C.muted, fontSize: 11 }}>{formatFileSize(doc.size_bytes)}</span>
                            <span style={{ color: C.muted, fontSize: 11 }}>{formatDate(doc.created_at)}</span>
                            <span style={{ color: C.muted, fontSize: 11 }}>by {doc.uploader_email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {doc.status === 'STORED' && (
                          <button
                            onClick={() => handleQueueDocument(doc.id)}
                            disabled={isProcessing}
                            style={{
                              background: C.orange, color: '#fff', border: 'none',
                              borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                              cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            <Play size={13} /> {isProcessing ? 'Queuing…' : 'Process'}
                          </button>
                        )}
                        {(doc.status === 'QUEUED' || doc.status === 'PROCESSING') && (
                          <span style={{
                            background: 'rgba(245,130,32,0.10)', color: C.orange,
                            borderRadius: 50, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                          }}>
                            In Progress…
                          </span>
                        )}
                        {doc.status === 'FAILED' && (
                          <button
                            onClick={() => handleQueueDocument(doc.id)}
                            disabled={isProcessing}
                            style={{
                              background: '#ef4444', color: '#fff', border: 'none',
                              borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            <RefreshCw size={13} /> {isProcessing ? 'Reprocessing…' : 'Reprocess'}
                          </button>
                        )}
                        {/* Sections button — only for PROCESSED docs */}
                        {doc.status === 'PROCESSED' && (
                          <button
                            onClick={() => handleOpenSections(doc)}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: C.orange, padding: 6, borderRadius: 8,
                              display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = C.orangeLight}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="View Sections"
                          >
                            <BookOpen size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>{/* end scrollable body */}
      </div>{/* end flex-col */}


      {/* ════════════════════════════════════════════════════════════════
          UPLOAD MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 480 }} className="shadow-2xl">
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ color: C.ink, fontSize: 18, fontWeight: 700 }}>Upload Document</h2>
              <button onClick={() => { setShowUploadModal(false); setUploadingFile(null); setUploadTitle(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label style={{ color: C.ink, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="Enter document title (optional)"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className={inputCls}
                  style={{ borderColor: C.border, color: C.ink, background: C.cream }}
                />
              </div>
              <div style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <input type="file" onChange={handleFileSelect} className="hidden" id="file-input" />
                <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'block' }}>
                  <Upload size={40} color={C.muted} style={{ margin: '0 auto 10px' }} />
                  <p style={{ color: C.ink, fontWeight: 600, fontSize: 14 }}>
                    {uploadingFile ? uploadingFile.name : 'Click to select or drag & drop'}
                  </p>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                    {uploadingFile ? formatFileSize(uploadingFile.size) : 'Maximum file size: 100 MB'}
                  </p>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!uploadingFile || uploading}
                  style={{
                    flex: 1, background: C.orange, color: '#fff', border: 'none',
                    borderRadius: 50, padding: '11px 0', fontSize: 14, fontWeight: 600,
                    cursor: (!uploadingFile || uploading) ? 'not-allowed' : 'pointer',
                    opacity: (!uploadingFile || uploading) ? 0.6 : 1,
                  }}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  onClick={() => { setShowUploadModal(false); setUploadingFile(null); setUploadTitle(''); }}
                  style={{
                    flex: 1, background: 'transparent', color: C.orange,
                    border: `1.5px solid ${C.orange}`, borderRadius: 50,
                    padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          AUDIT LOG MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            className="shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ color: C.ink, fontSize: 18, fontWeight: 700 }}>Processing Audit Log</h2>
              <button onClick={() => { setShowAuditLog(false); setAuditSearchTerm(''); setAuditStatusFilter('all'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Stat tiles */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Queued',     value: auditStats.queued,     bg: '#fef3c7', text: '#92400e' },
                  { label: 'Processing', value: auditStats.processing, bg: '#dbeafe', text: '#1e40af' },
                  { label: 'Completed',  value: auditStats.completed,  bg: '#dcfce7', text: '#166534' },
                  { label: 'Failed',     value: auditStats.failed,     bg: '#fee2e2', text: '#991b1b' },
                ].map(({ label, value, bg, text }) => (
                  <div key={label} style={{ background: bg, borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
                    <p style={{ color: text, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</p>
                    <p style={{ color: text, fontSize: 11, fontWeight: 600, marginTop: 6 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Search + filter */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search size={16} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by document title or job ID…"
                    value={auditSearchTerm}
                    onChange={e => setAuditSearchTerm(e.target.value)}
                    className={inputCls}
                    style={{ paddingLeft: 36, borderColor: C.border, background: C.cream, color: C.ink, borderRadius: 50 }}
                  />
                </div>
                <div className="relative">
                  <Filter size={14} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={auditStatusFilter}
                    onChange={e => setAuditStatusFilter(e.target.value)}
                    style={{
                      paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                      border: `1.5px solid ${C.border}`, borderRadius: 50, fontSize: 13,
                      background: C.cream, color: C.ink, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              {/* Jobs */}
              {loadingAudit ? (
                <div className="py-12 text-center" style={{ color: C.muted }}>Loading audit log…</div>
              ) : getFilteredAuditJobs().length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList size={40} color={C.border} style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: C.muted }}>No processing jobs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getFilteredAuditJobs().map((job) => {
                    const sc = auditStatusColor(job.status);
                    return (
                      <div key={job.job_id}
                        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}
                        className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>{job.document_title}</p>
                            <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Job ID: {job.job_id}</p>
                          </div>
                          <span style={{
                            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                            borderRadius: 50, padding: '3px 12px', fontSize: 11, fontWeight: 700,
                          }}>
                            {job.status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                          {[
                            { label: 'Stage', value: job.current_stage },
                            { label: 'Duration', value: formatDuration(job.time_elapsed_seconds) },
                            { label: 'Chunks Created', value: job.chunks_created || 0 },
                            ...(job.pages_processed > 0 ? [{ label: 'Pages Processed', value: job.pages_processed }] : []),
                            ...(job.queued_at ? [{ label: 'Queued At', value: formatDate(job.queued_at) }] : []),
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{label}</p>
                              <p style={{ color: C.ink, fontWeight: 600, fontSize: 13 }}>{value}</p>
                            </div>
                          ))}
                          {/* Progress bar spans full width */}
                          <div className="col-span-2">
                            <p style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Progress</p>
                            <div className="flex items-center gap-3">
                              <div style={{ flex: 1, background: C.border, borderRadius: 50, height: 8 }}>
                                <div style={{
                                  width: `${job.progress_percentage}%`, background: C.orange,
                                  height: 8, borderRadius: 50, transition: 'width 0.3s',
                                }} />
                              </div>
                              <span style={{ color: C.ink, fontWeight: 700, fontSize: 13, minWidth: 36 }}>
                                {job.progress_percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                        {job.error_message && (
                          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                            <p style={{ color: '#991b1b', fontSize: 12, fontWeight: 600 }}>Error: {job.error_message}</p>
                            {job.error_stage && <p style={{ color: '#b91c1c', fontSize: 11, marginTop: 2 }}>Failed at: {job.error_stage}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer close button */}
            <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => { setShowAuditLog(false); setAuditSearchTerm(''); setAuditStatusFilter('all'); }}
                style={{
                  width: '100%', background: 'transparent', color: C.orange,
                  border: `1.5px solid ${C.orange}`, borderRadius: 50,
                  padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════════════════════════════
          DOCUMENT SECTIONS MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showSectionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            className="shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h2 style={{ color: C.ink, fontSize: 18, fontWeight: 700 }}>Document Sections</h2>
                {selectedDoc && (
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }} className="truncate max-w-xs">
                    {selectedDoc.title}
                  </p>
                )}
              </div>
              <button onClick={() => { setShowSectionsModal(false); setSections([]); setSelectedDoc(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5">
              {loadingSections ? (
                <div className="py-12 text-center" style={{ color: C.muted }}>Loading sections…</div>
              ) : sections.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen size={40} color={C.border} style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: C.muted, fontSize: 14 }}>No sections found for this document.</p>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Sections are created during processing.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary pill */}
                  <div style={{ background: C.cream, borderRadius: 10, padding: '8px 14px', marginBottom: 12 }}
                    className="flex items-center justify-between">
                    <span style={{ color: C.muted, fontSize: 12 }}>Total sections</span>
                    <span style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>{sections.length}</span>
                  </div>

                  {sections.map((sec, i) => (
                    <div key={sec.id}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: C.card }}>

                      {/* Section header */}
                      <div style={{ background: C.cream, padding: '10px 14px' }}
                        className="flex items-start gap-3">
                        <div style={{
                          width: 26, height: 26, borderRadius: 8, background: C.orange,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: C.ink, fontWeight: 700, fontSize: 13 }} className="truncate">
                            {sec.section_title}
                          </p>
                          <p style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                            {sec.chunk_count} {sec.chunk_count === 1 ? 'chunk' : 'chunks'}
                          </p>
                        </div>
                      </div>

                      {/* Text previews */}
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sec.single_chunk ? (
                          /* Single chunk — just show one preview */
                          <div style={{
                            background: 'rgba(245,130,32,0.06)', border: '1px solid rgba(245,130,32,0.18)',
                            borderRadius: 10, padding: '8px 12px',
                          }}>
                            <p style={{ color: C.orange, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                              ↳ Single chunk
                            </p>
                            <p style={{ color: C.ink, fontSize: 12, lineHeight: 1.55 }}>
                              {sec.start_preview || <span style={{ color: C.muted, fontStyle: 'italic' }}>No preview available</span>}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Start preview */}
                            <div style={{
                              background: 'rgba(0,173,239,0.06)', border: '1px solid rgba(0,173,239,0.18)',
                              borderRadius: 10, padding: '8px 12px',
                            }}>
                              <p style={{ color: C.blue, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                                ↳ Opening
                              </p>
                              <p style={{ color: C.ink, fontSize: 12, lineHeight: 1.55 }}>
                                {sec.start_preview || <span style={{ color: C.muted, fontStyle: 'italic' }}>No preview available</span>}
                              </p>
                            </div>

                            {/* End preview */}
                            <div style={{
                              background: 'rgba(120,190,32,0.06)', border: '1px solid rgba(120,190,32,0.18)',
                              borderRadius: 10, padding: '8px 12px',
                            }}>
                              <p style={{ color: C.green, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                                ↳ Closing
                              </p>
                              <p style={{ color: C.ink, fontSize: 12, lineHeight: 1.55 }}>
                                {sec.end_preview || <span style={{ color: C.muted, fontStyle: 'italic' }}>No preview available</span>}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => { setShowSectionsModal(false); setSections([]); setSelectedDoc(null); }}
                style={{
                  width: '100%', background: 'transparent', color: C.orange,
                  border: `1.5px solid ${C.orange}`, borderRadius: 50,
                  padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
