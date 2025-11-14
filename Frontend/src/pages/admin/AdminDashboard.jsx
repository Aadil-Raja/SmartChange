// pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { FileText, Upload, Download, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
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

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);


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
                      <div className="flex items-start gap-2">
                        <Clock size={18} className="text-[#F58220] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[#333333]">Duration</p>
                          <p className="text-xs text-gray-600">Typically 2-5 minutes</p>
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
                {documents.length > 0 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
                  </span>
                )}
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
                variant="primary"
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