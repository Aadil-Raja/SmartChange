// src/pages/admin/training/AdminCourseDetails.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import {
  ArrowLeft,
  Edit,
  Upload,
  Plus,
  FileText,
  Video,
  Link as LinkIcon,
  Trash2,
  Edit3,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import AdminContentForm from "./AdminContentForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const AdminCourseDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    currentCourse,
    contentItems,
    loading,
    error,
    success,
    fetchCourseDetails,
    uploadThumbnail,
    deleteContent,
    clearMessages,
  } = useAdminTraining();

  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (id) {
      fetchCourseDetails(id);
    }
    return () => clearMessages();
  }, [id]);

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert(`File size exceeds 100MB limit`);
      e.target.value = "";
      return;
    }

    setUploadingThumbnail(true);
    const result = await uploadThumbnail(id, file);
    setUploadingThumbnail(false);
    e.target.value = "";

    if (result.success) {
      await fetchCourseDetails(id);
    }
  };

  const handleAddContent = () => {
    setEditingContent(null);
    setShowContentForm(true);
  };

  const handleEditContent = (content) => {
    setEditingContent(content);
    setShowContentForm(true);
  };

  const handleDeleteContent = async () => {
    if (!deleteConfirm) return;
    
    const result = await deleteContent(deleteConfirm.id, id);
    setDeleteConfirm(null);
    
    if (result.success) {
      await fetchCourseDetails(id);
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case "document":
        return <FileText size={22} className="text-[#00ADEF]" />;
      case "video":
        return <Video size={22} className="text-[#F58220]" />;
      case "link":
        return <LinkIcon size={22} className="text-[#78BE20]" />;
      default:
        return <FileText size={22} className="text-gray-500" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading && !currentCourse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!currentCourse) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="error">Course not found</Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen  bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/admin/training")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#F58220] transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Courses</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Success/Error Alerts */}
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

        {/* Course Hero Section */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-8">
          {/* Thumbnail Banner */}
          <div className="relative h-64 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 overflow-hidden group">
            {currentCourse.thumbnail_url ? (
              <>
                <img
                  src={currentCourse.thumbnail_url}
                  alt={currentCourse.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Upload size={64} className="text-[#F58220]/30" />
              </div>
            )}
            
            {/* Upload Overlay */}
            <label
              htmlFor="thumbnail-upload"
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
            >
              <div className="text-white text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 inline-block mb-3">
                  <Upload size={32} />
                </div>
                <p className="text-lg font-semibold">
                  {uploadingThumbnail ? "Uploading..." : "Change Thumbnail"}
                </p>
                <p className="text-sm text-white/80 mt-1">Click to upload a new image</p>
              </div>
            </label>
            <input
              type="file"
              id="thumbnail-upload"
              className="hidden"
              accept="image/*"
              onChange={handleThumbnailUpload}
              disabled={uploadingThumbnail}
            />

            {/* Status Badge & Edit Button */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => navigate(`/admin/training/edit/${id}`)}
                className="group flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm border-2 border-gray-200 rounded-lg shadow-lg hover:border-[#F58220] hover:bg-[#F58220] transition-all duration-300"
                title="Edit Course"
              >
                <Edit size={18} className="text-gray-700 group-hover:text-white transition-colors" />
                <span className="text-sm font-semibold text-gray-700 group-hover:text-white transition-colors">
                  Edit
                </span>
              </button>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm ${
                  currentCourse.is_active
                    ? "bg-green-500/90 text-white"
                    : "bg-gray-500/90 text-white"
                }`}
              >
                {currentCourse.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Course Details */}
          <div className="p-6">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-[#333333] mb-3">
                {currentCourse.title}
              </h1>
              {currentCourse.department && (
                <div className="mb-4">
                  <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-[#F58220] px-4 py-2 rounded-lg text-sm font-semibold">
                    <FileText size={16} />
                    {currentCourse.department}
                  </span>
                </div>
              )}
              {currentCourse.description && (
                <p className="text-gray-700 leading-relaxed text-base max-w-3xl mx-auto">
                  {currentCourse.description}
                </p>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <div className="bg-gray-100 rounded-lg p-2">
                  <FileText size={18} className="text-[#F58220]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Content Items</p>
                  <p className="font-bold text-[#333333]">{contentItems.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="bg-gray-100 rounded-lg p-2">
                  <Video size={18} className="text-[#00ADEF]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Videos</p>
                  <p className="font-bold text-[#333333]">
                    {contentItems.filter(item => item.type === 'video').length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="bg-gray-100 rounded-lg p-2">
                  <LinkIcon size={18} className="text-[#78BE20]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Links</p>
                  <p className="font-bold text-[#333333]">
                    {contentItems.filter(item => item.type === 'link').length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm ml-auto">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="font-semibold text-gray-700">{formatDate(currentCourse.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Items Section Header */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#333333] mb-1">Course Content</h2>
              <p className="text-gray-600 text-sm">Manage lessons, videos, and resources for this course</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate("/admin/training/library")}
                className="flex items-center gap-2"
              >
                <FileText size={18} />
                <span>Content Library</span>
              </Button>
              <Button 
                variant="primary"
                onClick={handleAddContent}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Add Content</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Items List */}
        {contentItems.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg text-center py-16 px-6">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <FileText size={48} className="text-[#F58220]" />
              </div>
              <h3 className="text-2xl font-bold text-[#333333] mb-3">
                No content yet
              </h3>
              <p className="text-gray-600 mb-8">
                Add lessons, videos, documents, or links to build your course curriculum
              </p>
              <Button 
                variant="primary"
                onClick={handleAddContent}
                className="inline-flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Add Your First Content</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {contentItems.map((item, index) => (
              <div 
                key={item.id} 
                className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all group"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Index Number */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-white border-2 border-[#F58220] flex items-center justify-center text-[#E0741C] font-bold shadow-sm">
                        {index + 1}
                      </div>
                    </div>

                    {/* Content Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getContentIcon(item.type)}
                    </div>
                    
                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-lg font-bold text-[#333333] group-hover:text-[#F58220] transition-colors">
                          {item.title}
                        </h3>
                        <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                          item.type === 'video' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : item.type === 'link'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {item.type}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {item.external_url && (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#00ADEF] hover:text-[#0090C8] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LinkIcon size={14} />
                          <span>View External Link</span>
                        </a>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditContent(item)}
                        className="text-[#F58220] hover:text-[#E0741C] hover:bg-[#F58220]/10"
                      >
                        <Edit3 size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(item)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content Form Modal */}
        {showContentForm && (
          <AdminContentForm
            courseId={parseInt(id)}
            editingContent={editingContent}
            onClose={() => {
              setShowContentForm(false);
              setEditingContent(null);
            }}
            onSuccess={() => {
              setShowContentForm(false);
              setEditingContent(null);
              fetchCourseDetails(id);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <ConfirmDialog
            title="Delete Content"
            message={`Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            onConfirm={handleDeleteContent}
            onCancel={() => setDeleteConfirm(null)}
            variant="danger"
          />
        )}
      </div>
    </div>
  );
};

export default AdminCourseDetails;