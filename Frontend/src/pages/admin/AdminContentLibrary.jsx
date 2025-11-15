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
  Play
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
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
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex h-16 items-center justify-between px-6">
          <button
            onClick={() => navigate("/admin/training")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#F58220] transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Training</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]" />
          </div>
        </div>
      </header>

        {/* Page Header Section */}
        <div className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#333333] mb-2">Content Library</h1>
                <p className="text-gray-600">Manage videos, links, and documents for training courses</p>
              </div>
              
              {/* Quick Stats */}
              <div className="flex gap-4">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Video size={20} className="text-[#F58220]" />
                    <div>
                      <p className="text-2xl font-bold text-[#333333]">{videos.length}</p>
                      <p className="text-xs text-gray-600">Videos</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <LinkIcon size={20} className="text-[#00ADEF]" />
                    <div>
                      <p className="text-2xl font-bold text-[#333333]">{externalLinks.length}</p>
                      <p className="text-xs text-gray-600">Links</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-[#78BE20]" />
                    <div>
                      <p className="text-2xl font-bold text-[#333333]">{documents.length}</p>
                      <p className="text-xs text-gray-600">Documents</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="p-6">
          <div className="max-w-7xl mx-auto">
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

            {/* Tabs and Search Bar */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-1 p-2">
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'videos'
                        ? 'bg-[#F58220] text-white shadow-sm'
                        : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                    }`}
                  >
                    <Video size={16} />
                    <span>Videos</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'videos' 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {videos.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('links')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'links'
                        ? 'bg-[#F58220] text-white shadow-sm'
                        : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                    }`}
                  >
                    <LinkIcon size={16} />
                    <span>Links</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'links' 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {externalLinks.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'documents'
                        ? 'bg-[#F58220] text-white shadow-sm'
                        : 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
                    }`}
                  >
                    <FileText size={16} />
                    <span>Documents</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'documents' 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {documents.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Search and Actions Bar */}
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] transition-colors text-sm"
                  />
                </div>
                
                <div className="flex gap-3">
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
                      className="flex items-center gap-2"
                    >
                      <Upload size={16} />
                      <span>Upload Video</span>
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
                      className="flex items-center gap-2"
                    >
                      <Plus size={16} />
                      <span>Add Link</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Videos Tab */}
                {activeTab === 'videos' && filterItems(videos, 'video').map((video) => (
                  <Card key={video.id} className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
                    {/* Video Thumbnail/Preview */}
                    <div 
                      className="aspect-video bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center cursor-pointer relative overflow-hidden"
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
                            className="w-full h-full object-cover"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white rounded-full p-4 shadow-lg transform group-hover:scale-110 transition-transform">
                              <Play size={28} className="text-[#F58220] ml-1" fill="#F58220" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Video size={56} className="text-gray-300" />
                          {/* Play button overlay for no thumbnail */}
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white rounded-full p-3 shadow-lg">
                              <Play size={24} className="text-[#F58220] ml-0.5" fill="#F58220" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      <h3 className="font-bold text-[#333333] line-clamp-2 min-h-[3rem]">{video.title}</h3>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600 border-t border-gray-100 pt-3">
                        {video.duration_sec && (
                          <div className="flex items-center gap-1">
                            <Play size={12} />
                            <span>{Math.floor(video.duration_sec / 60)}:{(video.duration_sec % 60).toString().padStart(2, '0')}</span>
                          </div>
                        )}
                        {video.size_bytes && (
                          <div className="flex items-center gap-1">
                            <FileText size={12} />
                            <span>{formatFileSize(video.size_bytes)}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500">Uploaded {formatDate(video.created_at)}</p>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        {(video.secure_url || video.cloudinary_url) && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => window.open(video.secure_url || video.cloudinary_url, '_blank')}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            <Play size={14} />
                            <span>Watch</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ ...video, type: 'video' })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Links Tab */}
                {activeTab === 'links' && filterItems(externalLinks, 'link').map((link) => (
                  <Card key={link.id} className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
                    <div className="aspect-video bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
                      <LinkIcon size={56} className="text-[#00ADEF]/30" />
                      <div className="absolute top-3 right-3">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm">
                          <LinkIcon size={16} className="text-[#00ADEF]" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      <h3 className="font-bold text-[#333333] line-clamp-2 min-h-[3rem]">{link.title}</h3>
                      
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-[#00ADEF] hover:text-[#0090C8] hover:underline line-clamp-1 border-t border-gray-100 pt-3"
                      >
                        {link.url}
                      </a>
                      
                      <p className="text-xs text-gray-500">Created {formatDate(link.created_at)}</p>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.open(link.url, '_blank')}
                          className="flex-1 flex items-center justify-center gap-2"
                        >
                          <LinkIcon size={14} />
                          <span>Open Link</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLink(link);
                            setLinkForm({ title: link.title, url: link.url });
                            setShowLinkForm(true);
                          }}
                          className="text-[#F58220] hover:text-[#E0741C] hover:bg-[#F58220]/10 px-3"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ ...link, type: 'link' })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Documents Tab */}
                {activeTab === 'documents' && filterItems(documents, 'document').map((doc) => (
                  <Card key={doc.id} className="border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
                    <div className="aspect-video bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center relative overflow-hidden">
                      {doc.cloudinary_thumbnail_url ? (
                        <img
                          src={doc.cloudinary_thumbnail_url}
                          alt={doc.title || doc.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText size={56} className="text-[#78BE20]/30" />
                      )}
                      <div className="absolute top-3 right-3">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm">
                          <FileText size={16} className="text-[#78BE20]" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      <h3 className="font-bold text-[#333333] line-clamp-2 min-h-[3rem]">{doc.title || doc.filename}</h3>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1">
                          <FileText size={12} />
                          <span>PDF Document</span>
                        </div>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          doc.status === 'PROCESSED' 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : doc.status === 'FAILED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : doc.status === 'PROCESSING' || doc.status === 'QUEUED'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {doc.status || 'STORED'}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500">Uploaded {formatDate(doc.created_at)}</p>
                      
                      {/* Action Button */}
                      {doc.cloudinary_url && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.open(doc.cloudinary_url, '_blank')}
                          className="w-full flex items-center justify-center gap-2 mt-2"
                        >
                          <FileText size={14} />
                          <span>View Document</span>
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
                  <div className="bg-white border border-gray-200 rounded-lg text-center py-16 px-6">
                    <div className="max-w-md mx-auto">
                      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                        <Video size={48} className="text-[#F58220]" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#333333] mb-3">
                        {videos.length === 0 ? 'No videos uploaded yet' : 'No videos match your search'}
                      </h3>
                      <p className="text-gray-600 mb-8">
                        {videos.length === 0 
                          ? 'Upload your first MP4 video to get started with video training content' 
                          : 'Try adjusting your search criteria to find what you\'re looking for'
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
                          className="inline-flex items-center gap-2"
                        >
                          <Upload size={18} />
                          <span>Upload Your First Video</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'links' && filterItems(externalLinks, 'link').length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg text-center py-16 px-6">
                    <div className="max-w-md mx-auto">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                        <LinkIcon size={48} className="text-[#00ADEF]" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#333333] mb-3">
                        {externalLinks.length === 0 ? 'No links added yet' : 'No links match your search'}
                      </h3>
                      <p className="text-gray-600 mb-8">
                        {externalLinks.length === 0 
                          ? 'Add external links to training resources, articles, or websites' 
                          : 'Try adjusting your search criteria to find what you\'re looking for'
                        }
                      </p>
                      {externalLinks.length === 0 && (
                        <Button 
                          variant="primary"
                          onClick={(e) => {
                            console.log('Empty state Add Link button clicked!');
                            e.preventDefault();
                            e.stopPropagation();
                            setShowLinkForm(true);
                          }}
                          className="inline-flex items-center gap-2"
                        >
                          <Plus size={18} />
                          <span>Add Your First Link</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && filterItems(documents, 'document').length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg text-center py-16 px-6">
                    <div className="max-w-md mx-auto">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                        <FileText size={48} className="text-[#78BE20]" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#333333] mb-3">
                        {documents.length === 0 ? 'No documents found' : 'No documents match your search'}
                      </h3>
                      <p className="text-gray-600 mb-8">
                        {documents.length === 0 
                          ? 'Upload PDF documents from the main documents section to use in training courses' 
                          : 'Try adjusting your search criteria to find what you\'re looking for'
                        }
                      </p>
                      {documents.length === 0 && (
                        <Button 
                          variant="primary" 
                          onClick={() => navigate('/admin/documents')}
                          className="inline-flex items-center gap-2"
                        >
                          <FileText size={18} />
                          <span>Go to Documents</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

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