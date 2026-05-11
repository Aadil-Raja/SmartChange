// pages/AdminDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Upload, Play, CheckCircle, AlertCircle, Clock, RefreshCw,
  Edit, Plus, X, ClipboardList, Search, Filter, BookOpen, Sparkles
} from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import { useAdmin } from '../../hooks/useAdmin';
import { useAdminDocuments, useAdminInvalidations, useDocumentSections } from '../../hooks/useAdminQueries';
import { fetchProcessingJobs } from '../../services/adminApi';
import SuggestedQuestionsPanel from '../../components/ui/SuggestedQuestionsPanel';
import DocumentDescriptionPanel from '../../components/ui/DocumentDescriptionPanel';

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
    case 'STORED': return { color: '#00ADEF', bg: 'rgba(0,173,239,0.10)', label: 'Stored' };
    case 'QUEUED': return { color: '#f7953f', bg: 'rgba(245,130,32,0.10)', label: 'Queued' };
    case 'PROCESSING': return { color: '#f7953f', bg: 'rgba(245,130,32,0.10)', label: 'Processing' };
    case 'PROCESSED': return { color: '#78BE20', bg: 'rgba(120,190,32,0.10)', label: 'Processed' };
    case 'FAILED': return { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Failed' };
    default: return { color: C.muted, bg: C.cream, label: status };
  }
};

const auditStatusColor = (s) => {
  switch (s?.toLowerCase()) {
    case 'queued': return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
    case 'processing': return { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' };
    case 'completed': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
    case 'failed': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
    default: return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  }
};

// ─── shared input style ───────────────────────────────────────────────────────
const inputCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all
  focus:ring-2 focus:ring-[#f7953f]/20 focus:border-[#f7953f]`;


const AdminDashboard = () => {
  const {
    jobStatuses,
    uploadDoc, queueDoc, checkJobStatus,
    deleteDoc, downloadDoc, clearError,
  } = useAdmin();

  // React Query — documents list with caching
  const { data: documents = [], isLoading: loading, error: queryError } = useAdminDocuments();
  const { invalidateDocuments } = useAdminInvalidations();
  const error = queryError?.message || null;

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditJobs, setAuditJobs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditStats, setAuditStats] = useState({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');
  const [sqDocId, setSqDocId] = useState(null); // doc ID with suggested questions panel open
  const [descDocId, setDescDocId] = useState(null); // doc ID with description panel open

  // Depends on selectedDoc state — must come after useState declarations
  const { data: sections = [], isLoading: loadingSections } = useDocumentSections(selectedDoc?.id);
  const hasFetched = useRef(false);

  useEffect(() => {
    // React Query handles initial fetch — no manual loadDocuments() needed
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
      const result = await uploadDoc(uploadingFile, uploadTitle.trim() || null, uploadDescription.trim() || null);
      if (result.success) {
        setShowUploadModal(false);
        setUploadingFile(null);
        setUploadTitle('');
        setUploadDescription('');
        invalidateDocuments(); // refresh cache
      }
    } finally { setUploading(false); }
  };

  const handleQueueDocument = async (documentId) => {
    setProcessingDocs(prev => new Set(prev).add(documentId));
    try {
      await queueDoc(documentId);
      invalidateDocuments(); // refresh status
    }
    finally {
      setProcessingDocs(prev => { const s = new Set(prev); s.delete(documentId); return s; });
    }
  };

  const handleOpenSections = (doc) => {
    setSelectedDoc(doc);
    setShowSectionsModal(true);
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
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
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
              { label: 'Total', value: docStats.total, dot: '#1a1918' },
              { label: 'Ready', value: docStats.ready, dot: C.blue },
              { label: 'Processing', value: docStats.processing, dot: C.orange },
              { label: 'Completed', value: docStats.completed, dot: C.green },
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
                <button onClick={() => {}} style={{ color: '#dc2626' }}><X size={16} /></button>
              </div>
            )}

            {/* ── Document Management Banner ── */}
            <div 
              className="relative overflow-hidden w-full p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6 transition-all"
              style={{ 
                background: 'linear-gradient(to right, #ffffff, #faf6ef)', 
                borderRadius: 24, 
                border: `1px solid ${C.border}`,
                boxShadow: '0 4px 24px rgba(26,18,9,0.04)'
              }}
            >
              {/* Subtle background decorative blobs */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#f7953f] rounded-full blur-[80px] opacity-15 pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#00ADEF] rounded-full blur-[80px] opacity-10 pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 relative z-10 w-full">
                <div style={{
                  width: 64, height: 64, borderRadius: 20, flexShrink: 0,
                  background: 'linear-gradient(135deg, #f7953f 0%, #E0741C 100%)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(247,149,63,0.25)'
                }}>
                  <Upload size={30} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 style={{ fontFamily: 'Georgia, serif', color: C.ink, fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
                    Document Management
                  </h2>
                  <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, maxWidth: 480 }}>
                    Upload PDF documents to train the AI. Our system will automatically extract and process the text for immediate use.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'white', color: C.blue, border: `1px solid ${C.border}` }}>
                      <FileText size={12} /> PDF Documents Only
                    </span>
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'white', color: C.green, border: `1px solid ${C.border}` }}>
                      <CheckCircle size={12} /> Automatic Processing
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-8 py-3.5 text-sm font-bold text-white transition-all hover:shadow-[0_8px_20px_rgba(247,149,63,0.3)] hover:-translate-y-0.5"
                >
                  <Upload size={18} /> 
                  Upload Document
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
                    className="inline-flex w-fit items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                      <React.Fragment key={doc.id}>
                      <div
                        style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card }}
                        className="flex items-center justify-between px-4 py-3 hover:shadow-sm transition-shadow">

                        {/* Left: icon + info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <FileText size={28} color={C.muted} className="mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p
                              style={{ color: C.ink, fontWeight: 600, fontSize: 14, cursor: doc.cloudinary_url ? 'pointer' : 'default' }}
                              className="truncate"
                              onMouseEnter={e => { if (doc.cloudinary_url) e.currentTarget.style.color = C.orange; }}
                              onMouseLeave={e => { e.currentTarget.style.color = C.ink; }}
                              onClick={() => { if (doc.cloudinary_url) window.open(doc.cloudinary_url, '_blank'); }}
                            >
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
                          {/* Suggested Questions button — only for PROCESSED docs */}
                          {doc.status === 'PROCESSED' && (
                            <button
                              onClick={() => setSqDocId(sqDocId === doc.id ? null : doc.id)}
                              style={{
                                background: sqDocId === doc.id ? C.orangeLight : 'transparent',
                                border: 'none', cursor: 'pointer',
                                color: C.orange, padding: 6, borderRadius: 8,
                                display: 'flex', alignItems: 'center',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.orangeLight}
                              onMouseLeave={e => { if (sqDocId !== doc.id) e.currentTarget.style.background = 'transparent'; }}
                              title="Suggested Questions"
                            >
                              <Sparkles size={17} />
                            </button>
                          )}
                          {/* Description button — available for all docs */}
                          <button
                            onClick={() => setDescDocId(descDocId === doc.id ? null : doc.id)}
                            style={{
                              background: descDocId === doc.id ? 'rgba(0,173,239,0.10)' : 'transparent',
                              border: 'none', cursor: 'pointer',
                              color: '#00ADEF', padding: 6, borderRadius: 8,
                              display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,173,239,0.10)'}
                            onMouseLeave={e => { if (descDocId !== doc.id) e.currentTarget.style.background = 'transparent'; }}
                            title="Document Description"
                          >
                            <FileText size={17} />
                          </button>
                        </div>
                      </div>
                      {/* Suggested Questions Panel — inline below the row */}
                      {sqDocId === doc.id && (
                        <div className="px-4 pb-4 pt-1">
                          <SuggestedQuestionsPanel key={doc.id} documentId={doc.id} documentStatus={doc.status} />
                        </div>
                      )}
                      {/* Description Panel — inline below the row */}
                      {descDocId === doc.id && (
                        <div className="px-4 pb-4 pt-1">
                          <DocumentDescriptionPanel key={doc.id} documentId={doc.id} documentStatus={doc.status} />
                        </div>
                      )}
                      </React.Fragment>
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
              <button onClick={() => { setShowUploadModal(false); setUploadingFile(null); setUploadTitle(''); setUploadDescription(''); }}
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
                  onClick={() => { setShowUploadModal(false); setUploadingFile(null); setUploadTitle(''); setUploadDescription(''); }}
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
                  { label: 'Queued', value: auditStats.queued, bg: '#fef3c7', text: '#92400e' },
                  { label: 'Processing', value: auditStats.processing, bg: '#dbeafe', text: '#1e40af' },
                  { label: 'Completed', value: auditStats.completed, bg: '#dcfce7', text: '#166534' },
                  { label: 'Failed', value: auditStats.failed, bg: '#fee2e2', text: '#991b1b' },
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
              <button onClick={() => { setShowSectionsModal(false); setSelectedDoc(null); }}
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
                <div>
                  {/* Stats bar */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <span style={{ color: C.muted, fontSize: 12 }}>{sections.length} sections found</span>
                  </div>

                  {/* Section list */}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: C.card }}>
                  {sections.map((sec, i) => {
                    const pageLabel = sec.start_page != null
                      ? (sec.start_page === sec.end_page || sec.end_page == null)
                        ? `p. ${sec.start_page}`
                        : `pp. ${sec.start_page}–${sec.end_page}`
                      : null;
                    const isLast = i === sections.length - 1;
                    return (
                      <div key={sec.id} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border}` }}>
                        {/* Header row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span style={{
                            width: 22, height: 22, borderRadius: 6, background: C.orange, flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 10, fontWeight: 700,
                          }}>{i + 1}</span>
                          <p style={{ color: C.ink, fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }} className="truncate">
                            {sec.section_title}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {pageLabel && (
                              <span style={{
                                background: 'rgba(0,173,239,0.10)', color: C.blue,
                                borderRadius: 50, padding: '2px 9px', fontSize: 10, fontWeight: 600,
                              }}>
                                {pageLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Preview */}
                        {sec.single_chunk ? (
                          <p style={{
                            color: C.muted, fontSize: 12, lineHeight: 1.65,
                            padding: '0 16px 12px 49px',
                          }}>
                            {sec.start_preview || '—'}
                          </p>
                        ) : (
                          <div style={{ padding: '0 16px 12px 49px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.65 }}>
                              <span style={{ color: C.orange, fontWeight: 600, fontSize: 10, marginRight: 6, textTransform: 'uppercase' }}>Start</span>
                              {sec.start_preview || '—'}
                            </p>
                            <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.65 }}>
                              <span style={{ color: C.green, fontWeight: 600, fontSize: 10, marginRight: 6, textTransform: 'uppercase' }}>End</span>
                              {sec.end_preview || '—'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
