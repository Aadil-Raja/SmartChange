// src/pages/admin/AdminContentLibrary.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import {
  ArrowLeft,
  Plus,
  Video,
  Link as LinkIcon,
  FileText,
  Upload,
  Edit,
  Trash2,
  Search,
  Filter,
  Menu,
  Home,
  Users,
  Settings,
  Play
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import Sidebar from "../../components/ui/Sidebar";
import Modal from "../../components/ui/Modal";
import Input2 from "../../components/ui/Input2";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const AdminContentLibrary = () => {
  const navigate = useNavigate();
  const {
    externalLinks,
    videos,
    loading,
    error,
    success,
    fetchExternalLinks,
    fetchVideos,
    createNewExternalLink,
    updateExistingExternalLink,
    deleteExistingExternalLink,
    uploadNewVideo,
    deleteExistingVideo,
    fetchProcessedDocuments,
    clearMessages,
  } = useAdminTraining();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('videos'); // 'videos', 'links', 'documents'
  const [searchTerm, setSearchTerm] = useState('');
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Debug state changes
  useEffect(() => {
    console.log('showVideoUpload changed:', showVideoUpload);
  }, [showVideoUpload]);

  useEffect(() => {
    console.log('showLinkForm changed:', showLinkForm);
  }, [showLinkForm]);

  useEffect(() => {
    console.log('Videos state updated:', videos);
    videos.forEach((video, index) => {
      console.log(`Video ${index}:`, {
        id: video.id,
        title: video.title,
        secure_url: video.secure_url,
        cloudinary_url: video.cloudinary_url,
        thumbnail_url: video.thumbnail_url,
        size_bytes: video.size_bytes,
        duration_sec: video.duration_sec
      });
    });
  }, [videos]);
  const [editingLink, setEditingLink] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [documents, setDocuments] = useState([]);

  // Form states
  const [videoForm, setVideoForm] = useState({ title: '', file: null });
  const [linkForm, setLinkForm] = useState({ title: '', url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: FileText, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Teams', path: '/admin/teams' },
    { icon: Settings, label: 'Training', path: '/admin/training' },
  ];

  useEffect(() => {
    console.log('AdminContentLibrary: Component mounted');
    console.log('AdminContentLibrary: Initial state:', {
      showVideoUpload,
      showLinkForm,
      activeTab
    });
    console.log('AdminContentLibrary: Loading initial data...');
    fetchExternalLinks().then(result => console.log('External links result:', result));
    fetchVideos().then(result => {
      console.log('Videos result:', result);
      console.log('Videos data:', result.data);
    });
    loadDocuments();
    return () => clearMessages();
  }, []);

  const loadDocuments = async () => {
    const result = await fetchProcessedDocuments();
    if (result.success) {
      setDocuments(result.data?.documents || []);
    }
  };

  const handleVideoUpload = async (e) => {
    e.preventDefault();
    if (!videoForm.title.trim() || !videoForm.file) return;

    setSubmitting(true);
    console.log('Uploading video:', { title: videoForm.title, file: videoForm.file });
    
    try {
      const result = await uploadNewVideo(videoForm.title.trim(), videoForm.file);
      console.log('Upload result:', result);
      
      if (result.success) {
        setShowVideoUpload(false);
        setVideoForm({ title: '', file: null });
        setFileInputKey(prev => prev + 1); // Force file input reset
      }
    } catch (error) {
      console.error('Video upload error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;

    setSubmitting(true);
    console.log('Submitting link:', linkForm, 'editing:', editingLink);
    
    try {
      let result;
      if (editingLink) {
        result = await updateExistingExternalLink(editingLink.id, linkForm);
      } else {
        result = await createNewExternalLink(linkForm);
      }
      console.log('Link submit result:', result);

      if (result.success) {
        setShowLinkForm(false);
        setEditingLink(null);
        setLinkForm({ title: '', url: '' });
      }
    } catch (error) {
      console.error('Link submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    let result;
    if (deleteConfirm.type === 'video') {
      result = await deleteExistingVideo(deleteConfirm.id);
    } else if (deleteConfirm.type === 'link') {
      result = await deleteExistingExternalLink(deleteConfirm.id);
    }

    if (result?.success) {
      setDeleteConfirm(null);
    }
  };

  const filterItems = (items, type) => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (type === 'link' && item.url?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        navItems={navItems}
        currentPath="/admin/training"
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333333] lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-[#333333]">Content Library</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]" />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin/training")}
                  className="mb-4 flex items-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Back to Training
                </Button>
                <h1 className="text-3xl font-bold text-[#333333]">Content Library</h1>
                <p className="text-gray-600 mt-1">Manage videos, links, and documents for training courses</p>
              </div>
            </div>

           

            {/* Alerts */}
            {success && (
              <Alert variant="success" className="mb-6" onClose={clearMessages}>
                {success}
              </Alert>
            )}
            {error && (
              <Alert variant="error" className="mb-6" onClose={clearMessages}>
                {error}
              </Alert>
            )}

            {/* Tabs and Search */}
            <Card shadow="md" className="mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'videos'
                        ? 'bg-white text-[#F58220] shadow-sm'
                        : 'text-gray-600 hover:text-[#333333]'
                    }`}
                  >
                    <Video size={16} />
                    Videos ({videos.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('links')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'links'
                        ? 'bg-white text-[#F58220] shadow-sm'
                        : 'text-gray-600 hover:text-[#333333]'
                    }`}
                  >
                    <LinkIcon size={16} />
                    Links ({externalLinks.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'documents'
                        ? 'bg-white text-[#F58220] shadow-sm'
                        : 'text-gray-600 hover:text-[#333333]'
                    }`}
                  >
                    <FileText size={16} />
                    Documents ({documents.length})
                  </button>
                </div>

                {/* Search and Actions */}
                <div className="flex gap-3">
                  <div className="relative">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] transition-colors"
                    />
                  </div>
                  
                  {activeTab === 'videos' && (
                    <Button 
                      variant="primary"
                      onClick={(e) => {
                        console.log('Upload Video button clicked!');
                        e.preventDefault();
                        e.stopPropagation();
                        setShowVideoUpload(true);
                      }}
                      fullWidth={false}
                    >
                      <Upload size={16} className="mr-2" />
                      Upload Video
                    </Button>
                  )}
                  
                  {activeTab === 'links' && (
                    <Button 
                      variant="primary"
                      onClick={(e) => {
                        console.log('Add Link button clicked!');
                        e.preventDefault();
                        e.stopPropagation();
                        setShowLinkForm(true);
                      }}
                      fullWidth={false}
                    >
                      <Plus size={16} className="mr-2" />
                      Add Link
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Content Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Videos Tab */}
                {activeTab === 'videos' && filterItems(videos, 'video').map((video) => (
                  <Card key={video.id} shadow="md" className="hover:shadow-lg transition-shadow">
                    {/* Video Thumbnail/Preview */}
                    <div 
                      className="aspect-video bg-gray-100 rounded-md mb-4 flex items-center justify-center cursor-pointer relative group overflow-hidden border border-gray-200"
                      onClick={() => {
                        console.log('Opening video:', video.secure_url || video.cloudinary_url);
                        window.open(video.secure_url || video.cloudinary_url, '_blank');
                      }}
                    >
                      {video.thumbnail_url ? (
                        <>
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover rounded-md"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 rounded-full p-3">
                              <Play size={24} className="text-[#F58220] ml-1" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Video size={48} className="text-gray-400" />
                          {/* Play button overlay for no thumbnail */}
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 rounded-full p-2">
                              <Play size={20} className="text-[#F58220] ml-0.5" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-[#333333] line-clamp-2">{video.title}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        {video.size_bytes && <p>Size: {formatFileSize(video.size_bytes)}</p>}
                        {video.duration_sec && <p>Duration: {Math.floor(video.duration_sec / 60)}:{(video.duration_sec % 60).toString().padStart(2, '0')}</p>}
                        <p>Uploaded: {formatDate(video.created_at)}</p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {(video.secure_url || video.cloudinary_url) && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => window.open(video.secure_url || video.cloudinary_url, '_blank')}
                            className="flex-1"
                          >
                            <Video size={14} className="mr-1" />
                            Watch
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ ...video, type: 'video' })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Links Tab */}
                {activeTab === 'links' && filterItems(externalLinks, 'link').map((link) => (
                  <Card key={link.id} shadow="md" className="hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-gray-100 rounded-md mb-4 flex items-center justify-center border border-gray-200">
                      <LinkIcon size={48} className="text-gray-400" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-[#333333] line-clamp-2">{link.title}</h3>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#F58220] hover:text-[#E0741C] hover:underline line-clamp-1"
                      >
                        {link.url}
                      </a>
                      <p className="text-sm text-gray-600">Created: {formatDate(link.created_at)}</p>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLink(link);
                            setLinkForm({ title: link.title, url: link.url });
                            setShowLinkForm(true);
                          }}
                          className="text-[#F58220] hover:text-[#E0741C] hover:bg-[#F58220]/10"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ ...link, type: 'link' })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Documents Tab */}
                {activeTab === 'documents' && filterItems(documents, 'document').map((doc) => (
                  <Card key={doc.id} shadow="md" className="hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-gray-100 rounded-md mb-4 flex items-center justify-center border border-gray-200">
                      <FileText size={48} className="text-gray-400" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-[#333333] line-clamp-2">{doc.title || doc.filename}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Type: PDF Document</p>
                        <p>Status: {doc.processing_status || 'Processed'}</p>
                        <p>Uploaded: {formatDate(doc.created_at)}</p>
                      </div>
                      {doc.cloudinary_url && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.open(doc.cloudinary_url, '_blank')}
                          className="w-full"
                        >
                          View Document
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty States */}
            {!loading && (
              <>
                {activeTab === 'videos' && filterItems(videos, 'video').length === 0 && (
                  <Card shadow="md" className="text-center py-12">
                    <Video size={64} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-[#333333] mb-2">
                      {videos.length === 0 ? 'No videos uploaded yet' : 'No videos match your search'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {videos.length === 0 
                        ? 'Upload your first MP4 video to get started' 
                        : 'Try adjusting your search criteria'
                      }
                    </p>
                    {videos.length === 0 && (
                      <Button 
                        variant="primary"
                        onClick={(e) => {
                          console.log('Empty state Upload Video button clicked!');
                          e.preventDefault();
                          e.stopPropagation();
                          setShowVideoUpload(true);
                        }}
                      >
                        <Upload size={16} className="mr-2" />
                        Upload Video
                      </Button>
                    )}
                  </Card>
                )}

                {activeTab === 'links' && filterItems(externalLinks, 'link').length === 0 && (
                  <Card shadow="md" className="text-center py-12">
                    <LinkIcon size={64} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-[#333333] mb-2">No links found</h3>
                    <p className="text-gray-600 mb-6">Add your first external link</p>
                    <Button 
                      variant="primary"
                      onClick={(e) => {
                        console.log('Empty state Add Link button clicked!');
                        e.preventDefault();
                        e.stopPropagation();
                        setShowLinkForm(true);
                      }}
                    >
                      <Plus size={16} className="mr-2" />
                      Add Link
                    </Button>
                  </Card>
                )}

                {activeTab === 'documents' && filterItems(documents, 'document').length === 0 && (
                  <Card shadow="md" className="text-center py-12">
                    <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-[#333333] mb-2">No documents found</h3>
                    <p className="text-gray-600 mb-6">Upload documents from the main documents section</p>
                    <Button variant="primary" onClick={() => navigate('/admin/documents')}>
                      Go to Documents
                    </Button>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Video Upload Modal */}
      <Modal
        isOpen={showVideoUpload}
        title="Upload Video"
        onClose={() => {
          console.log('Video modal closing...');
          setShowVideoUpload(false);
          setVideoForm({ title: '', file: null });
          setFileInputKey(prev => prev + 1);
        }}
      >
          <form onSubmit={handleVideoUpload} className="space-y-4">
            <Input2
              label="Video Title"
              value={videoForm.title}
              onChange={(e) => setVideoForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter video title"
              required
            />
            <div>
              <label className="block text-sm font-semibold text-[#333333] mb-2">
                Video File (MP4 only, max 500MB)
              </label>
              <input
                key={fileInputKey}
                type="file"
                accept=".mp4"
                onChange={(e) => setVideoForm(prev => ({ ...prev, file: e.target.files[0] }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] transition-colors"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => {
                  setShowVideoUpload(false);
                  setVideoForm({ title: '', file: null });
                  setFileInputKey(prev => prev + 1);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant="primary"
                disabled={!videoForm.title.trim() || !videoForm.file || submitting}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="small" />
                    Uploading...
                  </>
                ) : (
                  'Upload Video'
                )}
              </Button>
            </div>
          </form>
        </Modal>

      {/* Link Form Modal */}
      <Modal
        isOpen={showLinkForm}
        title={editingLink ? "Edit Link" : "Add External Link"}
        onClose={() => {
          console.log('Link modal closing...');
          setShowLinkForm(false);
          setEditingLink(null);
          setLinkForm({ title: '', url: '' });
        }}
      >
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <Input2
              label="Link Title"
              value={linkForm.title}
              onChange={(e) => setLinkForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter link title"
              required
            />
            <Input2
              label="URL"
              type="url"
              value={linkForm.url}
              onChange={(e) => setLinkForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com"
              required
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => {
                  setShowLinkForm(false);
                  setEditingLink(null);
                  setLinkForm({ title: '', url: '' });
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant="primary"
                disabled={!linkForm.title.trim() || !linkForm.url.trim() || submitting}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="small" />
                    {editingLink ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  editingLink ? 'Update Link' : 'Add Link'
                )}
              </Button>
            </div>
          </form>
        </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title={`Delete ${deleteConfirm.type === 'video' ? 'Video' : 'Link'}`}
          message={`Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          variant="danger"
        />
      )}
    </div>
  );
};

export default AdminContentLibrary;