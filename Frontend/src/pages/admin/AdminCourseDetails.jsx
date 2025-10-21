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
        return <FileText size={20} className="text-blue-500" />;
      case "video":
        return <Video size={20} className="text-purple-500" />;
      case "link":
        return <LinkIcon size={20} className="text-green-500" />;
      default:
        return <FileText size={20} className="text-gray-500" />;
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/training")}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Back to Courses
        </Button>
      </div>

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

      {/* Course Info Card */}
      <Card className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thumbnail */}
          <div className="lg:col-span-1">
            <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg overflow-hidden relative group">
              {currentCourse.thumbnail_url ? (
                <img
                  src={currentCourse.thumbnail_url}
                  alt={currentCourse.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Upload size={48} className="text-indigo-300" />
                </div>
              )}
              
              {/* Upload Overlay */}
              <label
                htmlFor="thumbnail-upload"
                className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
              >
                <div className="text-white text-center">
                  <Upload size={32} className="mx-auto mb-2" />
                  <p className="text-sm font-medium">
                    {uploadingThumbnail ? "Uploading..." : "Change Thumbnail"}
                  </p>
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
            </div>
          </div>

          {/* Course Details */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {currentCourse.title}
                </h1>
                {currentCourse.department && (
                  <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                    {currentCourse.department}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/training/edit/${id}`)}
                className="flex items-center gap-2"
              >
                <Edit size={18} />
                Edit Course
              </Button>
            </div>

            {currentCourse.description && (
              <p className="text-gray-700 mb-4 leading-relaxed">
                {currentCourse.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Created: {formatDate(currentCourse.created_at)}</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentCourse.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {currentCourse.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Items Section */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Course Content</h2>
        <Button 
          onClick={handleAddContent}
        className="flex items-center gap-2">
          <Plus size={20} />
          Add Content
        </Button>
      </div>

      {/* Content Items List */}
      {contentItems.length === 0 ? (
        <Card className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No content yet
          </h3>
          <p className="text-gray-500 mb-4">
            Add lessons, videos, or links to get started
          </p>
          
        </Card>
      ) : (
        <div className="space-y-4">
          {contentItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getContentIcon(item.type)}</div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-gray-600 text-sm mb-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded capitalize">
                      {item.type}
                    </span>
                    {item.external_url && (
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Link
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditContent(item)}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    <Edit3 size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(item)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </Card>
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
  );
};

export default AdminCourseDetails;