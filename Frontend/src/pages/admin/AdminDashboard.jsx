// pages/AdminDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Play, CheckCircle, AlertCircle, Clock, RefreshCw, Edit, Plus, X, ClipboardList, Search, Filter } from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useAdmin } from '../../hooks/useAdmin';
import { getMainTopics, updateMainTopics, generateMainTopicsAI, fetchProcessingJobs } from '../../services/adminApi';

const AdminDashboard = () => {
  const {
    documents,
    loading,
    error,
    jobStatuses,
    loadDocuments,
    uploadDoc,
    queueDoc,
    checkJobStatus,
    deleteDoc,
    downloadDoc,
    clearError
  } = useAdmin();

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showMainTopicsModal, setShowMainTopicsModal] = useState(false);
  const [mainTopics, setMainTopics] = useState({});
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [savingTopics, setSavingTopics] = useState(false);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditJobs, setAuditJobs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditStats, setAuditStats] = useState({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      loadDocuments();
    }
  }, []);


  // Poll for job status updates
  useEffect(() => {
    const pollInterval = setInterval(() => {
      Object.entries(jobStatuses).forEach(([jobId, status]) => {
        if (status.status !== 'finished' && status.status !== 'failed') {
          checkJobStatus(jobId);
        }
      });
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobStatuses, checkJobStatus]);



  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 100 * 1024 * 1024; // 100MB in bytes

      if (file.size > maxSize) {
        // alert(`File size (${formatFileSize(file.size)}) exceeds the 100MB limit`);
        e.target.value = ''; // Reset the file input
        return;
      }

      setUploadingFile(file);
      // Auto-fill title with filename if empty
      if (!uploadTitle) {
        setUploadTitle(file.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    try {
      // Pass the title if it's not empty, otherwise pass null to use the filename
      const titleToUse = uploadTitle.trim() ? uploadTitle.trim() : null;
      const result = await uploadDoc(uploadingFile, titleToUse);
      if (result.success) {
        setShowUploadModal(false);
        setUploadingFile(null);
        setUploadTitle('');
      } else {
        // alert(result.message || 'Upload failed');
      }
    } catch (err) {
      // alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleQueueDocument = async (documentId) => {
    setProcessingDocs(prev => new Set(prev).add(documentId));
    try {
      const result = await queueDoc(documentId);
      if (!result.success) {
        // This handles cases where the API returns a structured error (e.g., 404)
        // alert(`Failed to queue document: ${result.message}`);
      }
    } catch (err) {
      // --- THIS IS THE IMPORTANT PART FOR A 500 ERROR ---
      // The error object 'err' from Axios/fetch contains the server response
      const status = err.response?.status;
      // if (status === 500) {
      //   alert('Queue Error: The server encountered an unexpected issue. Please contact support or check the backend logs.');
      // } else {
      //   alert('Queue error: ' + err.message);
      // }
      // --------------------------------------------------------
    } finally {
      setProcessingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };




  const handleOpenMainTopics = async (doc) => {
    setSelectedDoc(doc);
    setLoadingTopics(true);
    setShowMainTopicsModal(true);
    
    try {
      const result = await getMainTopics(doc.id);
      if (result.success) {
        setMainTopics(result.data.topics || {});
      } else {
        setMainTopics({});
      }
    } catch (err) {
      console.error('Failed to load main topics:', err);
      setMainTopics({});
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleSaveMainTopics = async () => {
    if (!selectedDoc) return;
    
    setSavingTopics(true);
    try {
      const result = await updateMainTopics(selectedDoc.id, mainTopics);
      if (result.success) {
        setShowMainTopicsModal(false);
        setMainTopics({});
        setSelectedDoc(null);
        // Optionally reload documents to show updated data
        loadDocuments();
      }
    } catch (err) {
      console.error('Failed to save main topics:', err);
    } finally {
      setSavingTopics(false);
    }
  };

  const handleAddTopic = () => {
    const newKey = `Topic ${Object.keys(mainTopics).length + 1}`;
    setMainTopics(prev => ({ ...prev, [newKey]: '' }));
  };

  const handleUpdateTopic = (oldKey, newKey, value) => {
    setMainTopics(prev => {
      const updated = { ...prev };
      if (oldKey !== newKey && oldKey in updated) {
        delete updated[oldKey];
      }
      updated[newKey] = value;
      return updated;
    });
  };

  const handleRemoveTopic = (key) => {
    setMainTopics(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleGenerateMainTopics = async () => {
    if (!selectedDoc) return;
    
    setGeneratingTopics(true);
    try {
      const result = await generateMainTopicsAI(selectedDoc.id);
      if (result.success) {
        // Update the topics with AI-generated ones
        setMainTopics(result.data.main_topics || {});
        alert(`✅ Generated ${Object.keys(result.data.main_topics || {}).length} topics from ${result.data.chunks_analyzed} chunks!`);
      } else {
        alert(`❌ Failed to generate topics: ${result.message}`);
      }
    } catch (err) {
      console.error('Failed to generate main topics:', err);
      alert(`❌ Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setGeneratingTopics(false);
    }
  };

  const handleReprocess = async (documentId) => {
    await handleQueueDocument(documentId);
  };

  const handleOpenAuditLog = async () => {
    setShowAuditLog(true);
    setLoadingAudit(true);
    
    try {
      const result = await fetchProcessingJobs();
      if (result.success) {
        setAuditJobs(result.data.jobs || []);
        setAuditStats(result.data.stats || { queued: 0, processing: 0, completed: 0, failed: 0 });
      }
    } catch (err) {
      console.error('Failed to load audit log:', err);
      setAuditJobs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const getFilteredAuditJobs = () => {
    let filtered = auditJobs;

    // Filter by status
    if (auditStatusFilter !== 'all') {
      filtered = filtered.filter(job => job.status.toLowerCase() === auditStatusFilter);
    }

    // Filter by search term
    if (auditSearchTerm) {
      filtered = filtered.filter(job => 
        job.document_title?.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
        job.job_id?.toLowerCase().includes(auditSearchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'STORED':
        return { icon: FileText, color: 'bg-blue-100 text-blue-800', label: 'Stored' };
      case 'QUEUED':
        return { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Queued' };
      case 'PROCESSING':
        return { icon: Clock, color: 'bg-orange-100 text-orange-800', label: 'Processing' };
      case 'PROCESSED':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Processed' };
      case 'FAILED':
        return { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Failed' };
      default:
        return { icon: FileText, color: 'bg-gray-100 text-gray-800', label: status };
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar 
        collapsed={navCollapsed} 
        onToggle={() => setNavCollapsed(!navCollapsed)} 
      />
      
      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-[#333333]">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage documents and monitor system activity</p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Error Alert */}
            {error && (
              <Card className="border-l-4 border-red-500 bg-red-50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="mt-0.5 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-900">Error</h3>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={clearError}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              </Card>
            )}

            {/* Welcome Section with Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upload Card - Takes 2 columns */}
              <Card className="lg:col-span-2 overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-md">
                      <Upload size={28} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-[#333333]">Document Management</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Upload and process PDF documents for AI training
                      </p>
                    </div>
                  </div>

                  {/* Requirements Section */}
                  <div className="mb-4 p-4 bg-white-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-[#333333] mb-3">Upload Requirements</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <FileText size={18} className="text-[#00ADEF] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[#333333]">File Format</p>
                          <p className="text-xs text-gray-600">PDF documents only</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertCircle size={18} className="text-[#F58220] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[#333333]">File Size</p>
                          <p className="text-xs text-gray-600">Maximum 100MB per file</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle size={18} className="text-[#78BE20] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[#333333]">Processing</p>
                          <p className="text-xs text-gray-600">Automatic AI extraction</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    variant="primary"
                    className="w-full flex items-center justify-center gap-2 py-3 shadow-md hover:shadow-lg transition-all"
                  >
                    <Upload size={20} />
                    Upload New Document
                  </Button>
                </div>
              </Card>

              {/* Stats Card - Takes 1 column */}
              <Card className="border border-gray-200">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-[#333333] mb-4">Document Statistics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#333333]"></div>
                        <span className="text-sm text-gray-600">Total</span>
                      </div>
                      <span className="text-xl font-bold text-[#333333]">{documents.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#00ADEF]"></div>
                        <span className="text-sm text-gray-600">Ready</span>
                      </div>
                      <span className="text-xl font-bold text-[#00ADEF]">
                        {documents.filter(d => d.status === 'STORED').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#F58220]"></div>
                        <span className="text-sm text-gray-600">Processing</span>
                      </div>
                      <span className="text-xl font-bold text-[#F58220]">
                        {documents.filter(d => d.status === 'PROCESSING' || d.status === 'QUEUED').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#78BE20]"></div>
                        <span className="text-sm text-gray-600">Completed</span>
                      </div>
                      <span className="text-xl font-bold text-[#78BE20]">
                        {documents.filter(d => d.status === 'PROCESSED').length}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Documents List */}
            <Card className="p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#333333]">Recent Documents</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage and process your uploaded files</p>
                </div>
                <div className="flex items-center gap-3">
                  {documents.length > 0 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium whitespace-nowrap">
                      {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                    </span>
                  )}
                  <Button
                    onClick={handleOpenAuditLog}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <ClipboardList size={16} />
                    Audit Log
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    <FileText size={64} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#333333] mb-2">No documents yet</h3>
                  <p className="text-gray-600 mb-6">Upload your first document to get started with AI processing</p>
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    variant="primary"
                    className="inline-flex items-center gap-2"
                  >
                    <Upload size={18} />
                    Upload First Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const statusInfo = getStatusBadge(doc.status);
                    const StatusIcon = statusInfo.icon;
                    const isProcessing = processingDocs.has(doc.id);

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md"
                      >
                        <div className="flex flex-1 items-start gap-4">
                          <FileText size={32} className="mt-1 text-gray-400" />

                          <div className="flex-1">
                            <h3 className="font-semibold text-[#333333]">{doc.title}</h3>
                            <p className="text-xs text-gray-500">{doc.original_filename}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}>
                                <StatusIcon size={14} />
                                {statusInfo.label}
                              </div>
                              <span className="text-xs text-gray-500">{formatFileSize(doc.size_bytes)}</span>
                              <span className="text-xs text-gray-500">{formatDate(doc.created_at)}</span>
                              <span className="text-xs text-gray-500">by {doc.uploader_email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Queue Button - Only for STORED documents */}
                          {doc.status === 'STORED' && (
                            <Button
                              onClick={() => handleQueueDocument(doc.id)}
                              disabled={isProcessing}
                              variant="primary"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Play size={16} />
                              {isProcessing ? 'Queuing...' : 'Process'}
                            </Button>
                          )}

                          {/* Status Badge for In-Progress */}
                          {(doc.status === 'QUEUED' || doc.status === 'PROCESSING') && (
                            <div className="rounded-md bg-orange-100 px-3 py-2 text-xs font-medium text-orange-800">
                              In Progress...
                            </div>
                          )}

                          {/* Reprocess Button - Only for FAILED documents */}
                          {doc.status === 'FAILED' && (
                            <Button
                              onClick={() => handleReprocess(doc.id)}
                              disabled={isProcessing}
                              variant="danger"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <RefreshCw size={16} />
                              {isProcessing ? 'Reprocessing...' : 'Reprocess'}
                            </Button>
                          )}

                          {/* Update Main Topics Button - For all documents */}
                          <button
                            onClick={() => handleOpenMainTopics(doc)}
                            className="rounded-md p-2 text-[#F58220] transition-colors hover:bg-orange-50"
                            title="Update Main Topics"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadingFile(null);
          setUploadTitle('');
        }}
        title="Upload Document"
        closeOnOverlayClick={false}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Document Title</label>
            <input
              type="text"
              placeholder="Enter document title (optional)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
            />
          </div>

          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6">
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="flex cursor-pointer flex-col items-center justify-center text-center"
            >
              <Upload size={48} className="mb-2 text-gray-400" />
              <p className="font-medium text-gray-700">
                {uploadingFile ? uploadingFile.name : 'Click to select file or drag and drop'}
              </p>
              <p className="text-xs text-gray-500">
                {uploadingFile ? `${formatFileSize(uploadingFile.size)}` : 'Maximum file size: 100MB'}
              </p>
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              variant="primary"
              className="flex-1"
              disabled={!uploadingFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              onClick={() => {
                setShowUploadModal(false);
                setUploadingFile(null);
                setUploadTitle('');
              }}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Main Topics Modal */}
      <Modal
        isOpen={showMainTopicsModal}
        onClose={() => {
          setShowMainTopicsModal(false);
          setMainTopics({});
          setSelectedDoc(null);
        }}
        title="Update Main Topics"
        closeOnOverlayClick={false}
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Document</p>
              <p className="text-sm font-semibold text-[#333333]">{selectedDoc.title}</p>
            </div>

            {loadingTopics ? (
              <div className="py-8 text-center text-gray-500">Loading topics...</div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(mainTopics).map(([key, value], index) => (
                    <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => handleUpdateTopic(key, e.target.value, value)}
                          placeholder="Topic name (e.g., AI)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220]"
                        />
                        <button
                          onClick={() => handleRemoveTopic(key)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove topic"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <textarea
                        value={value}
                        onChange={(e) => handleUpdateTopic(key, key, e.target.value)}
                        placeholder="Description (e.g., Artificial Intelligence fundamentals, neural networks)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleAddTopic}
                    variant="ghost"
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-[#F58220]"
                  >
                    <Plus size={18} />
                    Add New Topic
                  </Button>

                  {/* 🤖 AI Generate Button - Only for PROCESSED documents */}
                  {selectedDoc?.status === 'PROCESSED' && (
                    <Button
                      onClick={handleGenerateMainTopics}
                      variant="secondary"
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
                      disabled={generatingTopics}
                    >
                      {generatingTopics ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5h-1v1.27c.6.34 1 .99 1 1.73a2 2 0 0 1-4 0c0-.74.4-1.39 1-1.73V9h-1a5 5 0 0 0-5 5H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                          </svg>
                          🤖 Generate with AI
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    onClick={handleSaveMainTopics}
                    variant="primary"
                    className="flex-1"
                    disabled={savingTopics}
                  >
                    {savingTopics ? 'Saving...' : 'Save Topics'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowMainTopicsModal(false);
                      setMainTopics({});
                      setSelectedDoc(null);
                    }}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Audit Log Modal */}
      <Modal
        isOpen={showAuditLog}
        onClose={() => {
          setShowAuditLog(false);
          setAuditSearchTerm('');
          setAuditStatusFilter('all');
        }}
        title="Processing Audit Log"
        closeOnOverlayClick={false}
      >
        <div className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-800">{auditStats.queued}</p>
              <p className="text-xs text-yellow-600 font-medium">Queued</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-800">{auditStats.processing}</p>
              <p className="text-xs text-blue-600 font-medium">Processing</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-800">{auditStats.completed}</p>
              <p className="text-xs text-green-600 font-medium">Completed</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-800">{auditStats.failed}</p>
              <p className="text-xs text-red-600 font-medium">Failed</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by document title or job ID..."
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220]"
              />
            </div>
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={auditStatusFilter}
                onChange={(e) => setAuditStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Jobs List */}
          {loadingAudit ? (
            <div className="py-12 text-center text-gray-500">Loading audit log...</div>
          ) : getFilteredAuditJobs().length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">No processing jobs found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {getFilteredAuditJobs().map((job) => (
                <div key={job.job_id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#333333] text-sm">{job.document_title}</h4>
                      <p className="text-xs text-gray-500 mt-1">Job ID: {job.job_id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <p className="text-gray-500">Stage</p>
                      <p className="font-medium text-[#333333]">{job.current_stage}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Progress</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#F58220] h-2 rounded-full transition-all"
                            style={{ width: `${job.progress_percentage}%` }}
                          />
                        </div>
                        <span className="font-medium text-[#333333]">{job.progress_percentage}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-medium text-[#333333]">{formatDuration(job.time_elapsed_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Chunks Created</p>
                      <p className="font-medium text-[#333333]">{job.chunks_created || 0}</p>
                    </div>
                    {job.pages_processed > 0 && (
                      <div>
                        <p className="text-gray-500">Pages Processed</p>
                        <p className="font-medium text-[#333333]">{job.pages_processed}</p>
                      </div>
                    )}
                    {job.queued_at && (
                      <div>
                        <p className="text-gray-500">Queued At</p>
                        <p className="font-medium text-[#333333]">{formatDate(job.queued_at)}</p>
                      </div>
                    )}
                  </div>

                  {job.error_message && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-semibold text-red-800">Error:</p>
                      <p className="text-xs text-red-700 mt-1">{job.error_message}</p>
                      {job.error_stage && (
                        <p className="text-xs text-red-600 mt-1">Failed at: {job.error_stage}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={() => {
                setShowAuditLog(false);
                setAuditSearchTerm('');
                setAuditStatusFilter('all');
              }}
              variant="secondary"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;