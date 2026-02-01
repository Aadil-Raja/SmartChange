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
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  Eye,
  GripVertical,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import AdminContentForm from "./AdminContentForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import Input2 from "../../components/ui/Input2";
import * as quizApi from "../../services/quizApi";

const AdminCourseDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    currentCourse,
    contentItems,
    quizzes,
    loading,
    error,
    success,
    fetchCourseDetails,
    uploadThumbnail,
    deleteContent,
    reorderContent,
    clearMessages,
  } = useAdminTraining();

  // Local state for quiz operation messages
  const [quizError, setQuizError] = useState(null);
  const [quizSuccess, setQuizSuccess] = useState(null);

  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Quiz management state
  const [showCreateQuizModal, setShowCreateQuizModal] = useState(false);
  const [showQuizDetailModal, setShowQuizDetailModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    prerequisite_content_ids: []
  });
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [deleteQuizConfirm, setDeleteQuizConfirm] = useState(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  // Clear quiz messages
  const clearQuizMessages = () => {
    setQuizError(null);
    setQuizSuccess(null);
  };

  useEffect(() => {
    if (id) {
      console.log('Loading course details for ID:', id);
      fetchCourseDetails(id);
    }
    return () => {
      clearMessages();
      clearQuizMessages();
    };
  }, [id]);

  // Debug effect to track quizzes changes
  useEffect(() => {
    console.log('Quizzes updated:', quizzes);
  }, [quizzes]);

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

  // Quiz management functions
  const handleCreateQuiz = () => {
    setQuizForm({
      title: `${currentCourse.title} - Quiz`,
      description: '',
      prerequisite_content_ids: []
    });
    setShowCreateQuizModal(true);
  };

  const handleEditQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setQuizForm({
      title: quiz.title,
      description: quiz.description || '',
      prerequisite_content_ids: quiz.prerequisite_content_ids || []
    });
    setShowCreateQuizModal(true);
  };

  const handleViewQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setShowQuizDetailModal(true);
  };

  // Helper function to refresh quiz data
  const refreshQuizData = async () => {
    try {
      console.log('Refreshing quiz data for course ID:', id);
      
      // Add a small delay to ensure backend has processed the changes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force a fresh fetch of course details
      const result = await fetchCourseDetails(id);
      console.log('Quiz refresh result:', result);
      
      return result;
    } catch (err) {
      console.error('Failed to refresh quiz data:', err);
      return { success: false };
    }
  };

  const submitQuiz = async (e) => {
    e.preventDefault();
    setSubmittingQuiz(true);
    clearQuizMessages();
    
    try {
      let result;
      if (selectedQuiz) {
        // Update existing quiz
        result = await quizApi.updateCourseQuiz(selectedQuiz.id, quizForm);
        setQuizSuccess('Quiz updated successfully');
      } else {
        // Create new quiz
        result = await quizApi.createCourseQuiz(id, quizForm);
        setQuizSuccess('Quiz created successfully');
      }
      
      setShowCreateQuizModal(false);
      setSelectedQuiz(null);
      
      // Immediately refresh quiz data
      await refreshQuizData();
      
    } catch (err) {
      console.error('Quiz operation error:', err);
      setQuizError(err.response?.data?.detail || 'Failed to save quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!deleteQuizConfirm) return;
    
    clearQuizMessages();
    try {
      await quizApi.deleteCourseQuiz(deleteQuizConfirm.id);
      setQuizSuccess('Quiz deleted successfully');
      setDeleteQuizConfirm(null);
      
      // Immediately refresh quiz data
      await refreshQuizData();
      
    } catch (err) {
      console.error('Quiz deletion error:', err);
      setQuizError(err.response?.data?.detail || 'Failed to delete quiz');
    }
  };

  const handlePublishQuiz = async (quizId) => {
    clearQuizMessages();
    try {
      await quizApi.publishCourseQuiz(quizId);
      setQuizSuccess('Quiz published successfully');
      
      // Immediately refresh quiz data
      await refreshQuizData();
      
    } catch (err) {
      console.error('Quiz publish error:', err);
      setQuizError(err.response?.data?.detail || 'Failed to publish quiz');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedItem || draggedItem.index === dropIndex) {
      setDraggedItem(null);
      return;
    }

    setIsReordering(true);
    
    try {
      // Create new order array
      const newItems = [...contentItems];
      const [movedItem] = newItems.splice(draggedItem.index, 1);
      newItems.splice(dropIndex, 0, movedItem);

      // Update order_index for all items
      const reorderData = newItems.map((item, index) => ({
        id: item.id,
        order_index: index
      }));

      // Call API to reorder
      const result = await reorderContent(id, reorderData);
      
      if (result.success) {
        // Success message is handled by context
      }
    } catch (err) {
      console.error('Reorder error:', err);
      setQuizError('Failed to reorder content items');
    } finally {
      setIsReordering(false);
      setDraggedItem(null);
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

  const getQuizStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case "PUBLISHED":
        return <CheckCircle size={16} className="text-green-600" />;
      case "DRAFT":
        return <Clock size={16} className="text-yellow-600" />;
      default:
        return <AlertCircle size={16} className="text-gray-600" />;
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
        {quizSuccess && (
          <Alert variant="success" className="mb-6" onClose={clearQuizMessages}>
            {quizSuccess}
          </Alert>
        )}
        {quizError && (
          <Alert variant="error" className="mb-6" onClose={clearQuizMessages}>
            {quizError}
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
                  <HelpCircle size={18} className="text-[#78BE20]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Quizzes</p>
                  <p className="font-bold text-[#333333]">{quizzes.length}</p>
                </div>
              </div>
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
              <p className="text-gray-600 text-sm">
                {isReordering 
                  ? "Reordering content items..." 
                  : "Manage lessons, videos, and resources for this course. Drag items to reorder."
                }
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate("/admin/training/library")}
                className="flex items-center gap-2"
                disabled={isReordering}
              >
                <FileText size={18} />
                <span>Content Library</span>
              </Button>
              <Button 
                variant="primary"
                onClick={handleAddContent}
                className="flex items-center gap-2"
                disabled={isReordering}
              >
                <Plus size={18} />
                <span>Add Content</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Items List */}
        {isReordering && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-700">Reordering content items...</p>
            </div>
          </div>
        )}
        
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
                className={`bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all group relative ${
                  dragOverIndex === index ? 'border-[#F58220] border-2 bg-orange-50' : ''
                } ${isReordering ? 'pointer-events-none opacity-75' : ''} ${
                  draggedItem?.index === index ? 'opacity-50 transform rotate-1' : ''
                }`}
                draggable={!isReordering}
                onDragStart={(e) => handleDragStart(e, item, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Drag Handle */}
                    <div className="flex-shrink-0 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={20} className="text-gray-400 hover:text-gray-600" />
                    </div>

                    {/* Index Number */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-white border-2 border-[#F58220] flex items-center justify-center text-[#E0741C] font-bold shadow-sm">
                        {index + 1}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {getContentIcon(item.type)}
                          </div>
                        )}
                      </div>
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
                        disabled={isReordering}
                      >
                        <Edit3 size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(item)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={isReordering}
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

        {/* Quizzes Section */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#333333] mb-1">Course Quizzes</h2>
              <p className="text-gray-600 text-sm">Manage assessments and evaluations for this course</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleCreateQuiz}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Create Quiz</span>
              </Button>
            </div>
          </div>

          {quizzes.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="max-w-md mx-auto">
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <HelpCircle size={48} className="text-[#78BE20]" />
                </div>
                <h3 className="text-2xl font-bold text-[#333333] mb-3">
                  No quizzes yet
                </h3>
                <p className="text-gray-600 mb-8">
                  Create assessments to test student knowledge and track their progress
                </p>
                <Button 
                  variant="primary"
                  onClick={handleCreateQuiz}
                  className="inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span>Create Your First Quiz</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz, index) => (
                <div 
                  key={quiz.id} 
                  className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all group"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Index Number */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-white border-2 border-[#78BE20] flex items-center justify-center text-[#78BE20] font-bold shadow-sm">
                          {index + 1}
                        </div>
                      </div>

                      {/* Quiz Icon */}
                      <div className="flex-shrink-0 mt-1">
                        <HelpCircle size={22} className="text-[#78BE20]" />
                      </div>
                      
                      {/* Quiz Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-lg font-bold text-[#333333] group-hover:text-[#78BE20] transition-colors">
                            {quiz.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                              quiz.status === 'PUBLISHED' 
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : quiz.status === 'DRAFT'
                                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                : 'bg-gray-50 text-gray-700 border border-gray-200'
                            }`}>
                              {quiz.status?.toLowerCase() || 'draft'}
                            </span>
                          </div>
                        </div>

                        {quiz.description && (
                          <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                            {quiz.description}
                          </p>
                        )}

                        {/* Quiz Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <HelpCircle size={14} />
                            <span>{quiz.total_questions} question{quiz.total_questions !== 1 ? 's' : ''}</span>
                          </div>
                          {quiz.prerequisite_content_ids && quiz.prerequisite_content_ids.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users size={14} />
                              <span>{quiz.prerequisite_content_ids.length} prerequisite{quiz.prerequisite_content_ids.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {quiz.published_at && (
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              <span>Published {formatDate(quiz.published_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewQuiz(quiz)}
                          className="text-[#00ADEF] hover:text-[#0090C5] hover:bg-[#00ADEF]/10"
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditQuiz(quiz)}
                          className="text-[#78BE20] hover:text-[#6BA01B] hover:bg-[#78BE20]/10"
                        >
                          <Edit3 size={18} />
                        </Button>
                        {quiz.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublishQuiz(quiz.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle size={18} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteQuizConfirm(quiz)}
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
        </div>

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

        {/* Quiz Delete Confirmation Dialog */}
        {deleteQuizConfirm && (
          <ConfirmDialog
            title="Delete Quiz"
            message={`Are you sure you want to delete "${deleteQuizConfirm.title}"? This action cannot be undone.`}
            confirmText="Delete Quiz"
            cancelText="Cancel"
            onConfirm={handleDeleteQuiz}
            onCancel={() => setDeleteQuizConfirm(null)}
            variant="danger"
          />
        )}

        {/* Create/Edit Quiz Modal */}
        {showCreateQuizModal && (
          <Modal
            isOpen={showCreateQuizModal}
            onClose={() => {
              setShowCreateQuizModal(false);
              setSelectedQuiz(null);
            }}
            title={selectedQuiz ? 'Edit Quiz' : 'Create New Quiz'}
            size="lg"
          >
            <form onSubmit={submitQuiz} className="space-y-4">
              <Input2
                label="Quiz Title"
                name="title"
                value={quizForm.title}
                onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                required
                disabled={submittingQuiz}
              />
              <Input2
                label="Description (Optional)"
                name="description"
                value={quizForm.description}
                onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                disabled={submittingQuiz}
                helpText="Provide a brief description of what this quiz covers"
              />

              {/* Prerequisites Selection - Only show when editing */}
              {selectedQuiz && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prerequisites (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select content items that must be completed before this quiz becomes available
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50">
                    {contentItems.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No content items available</p>
                    ) : (
                      <div className="space-y-2">
                        {contentItems.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={quizForm.prerequisite_content_ids.includes(item.id)}
                              onChange={(e) => {
                                const newPrereqs = e.target.checked
                                  ? [...quizForm.prerequisite_content_ids, item.id]
                                  : quizForm.prerequisite_content_ids.filter(id => id !== item.id);
                                setQuizForm({ ...quizForm, prerequisite_content_ids: newPrereqs });
                              }}
                              disabled={submittingQuiz}
                              className="rounded border-gray-300 text-[#78BE20] focus:ring-[#78BE20]"
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                                {item.thumbnail_url ? (
                                  <img
                                    src={item.thumbnail_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {getContentIcon(item.type)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {item.title}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {item.type}
                                </p>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {quizForm.prerequisite_content_ids.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      {quizForm.prerequisite_content_ids.length} item{quizForm.prerequisite_content_ids.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateQuizModal(false);
                    setSelectedQuiz(null);
                  }}
                  disabled={submittingQuiz}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingQuiz}
                  fullWidth
                  className="bg-[#78BE20] hover:bg-[#6BA51D]"
                >
                  {submittingQuiz ? 'Saving...' : selectedQuiz ? 'Update Quiz' : 'Create Quiz'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Quiz Detail Modal */}
        {showQuizDetailModal && selectedQuiz && (
          <Modal
            isOpen={showQuizDetailModal}
            onClose={() => {
              setShowQuizDetailModal(false);
              setSelectedQuiz(null);
            }}
            title={selectedQuiz.title}
            size="lg"
          >
            <div className="space-y-4">
              {/* Quiz Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      selectedQuiz.status === 'PUBLISHED' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedQuiz.status === 'PUBLISHED' ? (
                        <CheckCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {selectedQuiz.status || 'Draft'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Questions</p>
                    <p className="font-semibold">{selectedQuiz.total_questions || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Prerequisites</p>
                    <p className="font-semibold">
                      {selectedQuiz.prerequisite_content_ids?.length || 0} item{(selectedQuiz.prerequisite_content_ids?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-semibold">{formatDate(selectedQuiz.created_at)}</p>
                  </div>
                  {selectedQuiz.published_at && (
                    <div>
                      <p className="text-sm text-gray-600">Published</p>
                      <p className="font-semibold">{formatDate(selectedQuiz.published_at)}</p>
                    </div>
                  )}
                </div>
                {selectedQuiz.description && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="text-gray-800">{selectedQuiz.description}</p>
                  </div>
                )}
                
                {/* Prerequisites Display */}
                {selectedQuiz.prerequisite_content_ids && selectedQuiz.prerequisite_content_ids.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Prerequisites</p>
                    <div className="space-y-2">
                      {selectedQuiz.prerequisite_content_ids.map((prereqId) => {
                        const contentItem = contentItems.find(item => item.id === prereqId);
                        if (!contentItem) return null;
                        return (
                          <div key={prereqId} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="w-10 h-10 rounded bg-blue-100 overflow-hidden border border-blue-200 flex-shrink-0">
                              {contentItem.thumbnail_url ? (
                                <img
                                  src={contentItem.thumbnail_url}
                                  alt={contentItem.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getContentIcon(contentItem.type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-900">{contentItem.title}</p>
                              <p className="text-xs text-blue-700 capitalize">{contentItem.type}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Note about question management */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <HelpCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Manage Quiz Questions</p>
                    <p className="text-sm text-blue-700 mt-1">
                      To add, edit, or remove questions from this quiz, use the dedicated Quiz Management page 
                      where you can access the full question editor.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/admin/quiz')}
                      className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Go to Quiz Management
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default AdminCourseDetails;