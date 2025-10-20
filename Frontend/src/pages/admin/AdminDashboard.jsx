// pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Menu, Home, Users, Settings, FileText, Upload, Trash2, Download, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import Sidebar from '../../components/ui/Sidebar';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useAdmin } from '../../hooks/useAdmin';

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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());

  useEffect(() => {
    loadDocuments();
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

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: FileText, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Teams', path: '/admin/teams' },
  ];

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
      const result = await uploadDoc(uploadingFile, uploadTitle || undefined);
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


  const handleDelete = async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      const result = await deleteDoc(documentId);
      if (!result.success) {
        // alert(result.message || 'Failed to delete document');
      }
    }
  };

  const handleDownload = async (documentId, filename) => {
    const result = await downloadDoc(documentId, filename);
    if (!result.success) {
      // alert(result.message || 'Failed to download document');
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
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        navItems={navItems}
        currentPath="/admin"
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333333] lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-[#333333]">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]" />
          </div>
        </header>

        <main className="p-4 sm:p-6">
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

            {/* Stats Card */}
            <Card className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Documents</p>
                  <p className="text-3xl font-bold text-[#333333]">{documents.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Stored</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {documents.filter(d => d.status === 'STORED').length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Processing</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {documents.filter(d => d.status === 'PROCESSING' || d.status === 'QUEUED').length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {documents.filter(d => d.status === 'PROCESSED').length}
                  </p>
                </div>
              </div>
            </Card>

            {/* Upload Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#333333]">Upload Documents</h2>
                  <p className="text-sm text-gray-600">Upload and manage your documents</p>
                </div>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2"
                >
                  <Upload size={18} />
                  Upload Document
                </Button>
              </div>
            </Card>

            {/* Documents List */}
            <Card className="p-6">
              <h2 className="mb-6 text-2xl font-bold text-[#333333]">Documents</h2>

              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No documents yet. Upload your first document to get started.</p>
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
                            <button
                              onClick={() => handleQueueDocument(doc.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#FDB913] to-[#F58220] px-3 py-2 text-sm font-medium text-white transition-all hover:from-[#F58220] hover:to-[#FDB913] disabled:opacity-50"
                            >
                              <Play size={16} />
                              {isProcessing ? 'Queuing...' : 'Process'}
                            </button>
                          )}

                          {/* Status Badge for In-Progress */}
                          {(doc.status === 'QUEUED' || doc.status === 'PROCESSING') && (
                            <div className="rounded-md bg-orange-100 px-3 py-2 text-xs font-medium text-orange-800">
                              In Progress...
                            </div>
                          )}

                          {/* Preview Button */}
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setShowPreview(true);
                            }}
                            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100"
                            title="Preview"
                          >
                            <FileText size={18} />
                          </button>

                          {/* Download Button */}
                          <button
                            onClick={() => handleDownload(doc.id, doc.original_filename)}
                            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100"
                            title="Download"
                          >
                            <Download size={18} />
                          </button>

                          {/* Delete Button */}
                          {/* <button
                            onClick={() => handleDelete(doc.id)}
                            className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button> */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </main>
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

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Document Preview"
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</p>
                <p className="text-base font-semibold text-[#333333]">{selectedDoc.title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(selectedDoc.status).color}`}>
                  {getStatusBadge(selectedDoc.status).label}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">File Size</p>
                <p className="text-sm text-gray-700">{formatFileSize(selectedDoc.size_bytes)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded</p>
                <p className="text-sm text-gray-700">{formatDate(selectedDoc.created_at)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">File Name</p>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                <FileText size={20} className="text-gray-400" />
                <p className="break-all text-sm font-medium text-[#333333]">{selectedDoc.original_filename}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Uploader</p>
              <p className="text-sm text-gray-700">{selectedDoc.uploader_email}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => handleDownload(selectedDoc.id, selectedDoc.original_filename)}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Download
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
                variant="secondary"
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;