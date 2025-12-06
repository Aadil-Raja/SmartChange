// src/pages/admin/AdminQuizManagement.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  FileText,
  Trash2,
  Search,
  Eye,
  CheckCircle,
  Clock,
  Loader,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import Modal from "../../components/ui/Modal";
import Input2 from "../../components/ui/Input2";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import * as quizApi from "../../services/quizApi";

const AdminQuizManagement = () => {
  const navigate = useNavigate();
  const { fetchProcessedDocuments, clearMessages } = useAdminTraining();

  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState({});
  const [quizStats, setQuizStats] = useState(null);
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  const [loadingQuizzes, setLoadingQuizzes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Generate quiz form
  const [generateForm, setGenerateForm] = useState({
    title: '',
    description: '',
    num_questions: 10
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDocuments();
    loadQuizStats();
    return () => clearMessages();
  }, []);

  const loadQuizStats = async () => {
    try {
      const stats = await quizApi.getQuizStats();
      setQuizStats(stats);
    } catch (err) {
      console.error('Failed to load quiz stats:', err);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const result = await fetchProcessedDocuments();
      if (result.success) {
        const docs = result.data?.documents || [];
        // Filter only PROCESSED documents
        const processedDocs = docs.filter(doc => doc.status === 'PROCESSED');
        setDocuments(processedDocs);
        
        // Don't load quizzes automatically - load on demand when document card is expanded
      }
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzesForDocument = async (documentId, forceReload = false) => {
    // Don't reload if already loaded (unless forced)
    if (quizzes[documentId] && !forceReload) {
      return;
    }

    setLoadingQuizzes(prev => ({ ...prev, [documentId]: true }));
    try {
      const response = await quizApi.getQuizzesByDocument(documentId);
      setQuizzes(prev => ({
        ...prev,
        [documentId]: response.quizzes || []
      }));
    } catch (err) {
      console.error(`Failed to load quizzes for document ${documentId}:`, err);
      setQuizzes(prev => ({
        ...prev,
        [documentId]: []
      }));
    } finally {
      setLoadingQuizzes(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const toggleDocumentExpand = (documentId) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(documentId)) {
      newExpanded.delete(documentId);
    } else {
      newExpanded.add(documentId);
      // Load quizzes when expanding
      loadQuizzesForDocument(documentId);
    }
    setExpandedDocs(newExpanded);
  };

  const handleGenerateQuiz = (document) => {
    setSelectedDocument(document);
    setGenerateForm({
      title: `${document.title} - Quiz`,
      description: '',
      num_questions: 10
    });
    setShowGenerateModal(true);
  };

  const submitGenerateQuiz = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await quizApi.generateQuiz(selectedDocument.id, generateForm);

      setSuccess(`Quiz generation started! Quiz ID: ${response.quiz_id}`);
      setShowGenerateModal(false);
      
      // Reload quizzes for this document and stats after a delay (force reload)
      setTimeout(() => {
        loadQuizzesForDocument(selectedDocument.id, true);
        loadQuizStats();
      }, 2000);
    } catch (err) {
      console.error('Generate quiz error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate quiz';
      setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuiz = async (quizId, documentId) => {
    try {
      await quizApi.deleteQuiz(quizId);
      setSuccess('Quiz deleted successfully');
      loadQuizzesForDocument(documentId, true);
      loadQuizStats();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete quiz');
    }
  };

  const handlePublishQuiz = async (quizId, documentId) => {
    try {
      await quizApi.publishQuiz(quizId);
      setSuccess('Quiz published successfully');
      loadQuizzesForDocument(documentId, true);
      loadQuizStats();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to publish quiz');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      GENERATING: { color: 'bg-blue-100 text-blue-700', icon: Loader, text: 'Generating' },
      DRAFT: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, text: 'Draft' },
      PUBLISHED: { color: 'bg-green-100 text-green-700', icon: CheckCircle, text: 'Published' },
      ARCHIVED: { color: 'bg-gray-100 text-gray-700', icon: FileText, text: 'Archived' }
    };

    const config = statusConfig[status] || statusConfig.DRAFT;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {config.text}
      </span>
    );
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/training')}
            className="mb-4"
          >
            <ArrowLeft size={16} />
            <span>Back to Training</span>
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#333333] mb-2">Quiz Management</h1>
              <p className="text-gray-600">Generate and manage quizzes from processed documents</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="error" className="mb-6" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-6" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <FileText size={20} className="text-[#78BE20]" />
              <div>
                <p className="text-2xl font-bold text-[#333333]">{documents.length}</p>
                <p className="text-xs text-gray-600">Processed Documents</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <CheckCircle size={20} className="text-[#F58220]" />
              <div>
                <p className="text-2xl font-bold text-[#333333]">
                  {quizStats?.total_quizzes || 0}
                </p>
                <p className="text-xs text-gray-600">Total Quizzes</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Clock size={20} className="text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-[#333333]">
                  {quizStats?.published_count || 0}
                </p>
                <p className="text-xs text-gray-600">Published Quizzes</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#78BE20] focus:border-transparent"
            />
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-6">
          {filteredDocuments.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No processed documents found</h3>
              <p className="text-gray-500 mb-4">Upload and process documents first to generate quizzes</p>
              <Button onClick={() => navigate('/admin/training/library')}>
                Go to Content Library
              </Button>
            </Card>
          ) : (
            filteredDocuments.map((doc) => (
              <Card key={doc.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => toggleDocumentExpand(doc.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      {expandedDocs.has(doc.id) ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-[#333333]">{doc.title}</h3>
                      {(() => {
                        const docStats = quizStats?.by_document?.find(d => d.document_id === doc.id);
                        const count = docStats?.total || 0;
                        return count > 0 && (
                          <p className="text-xs text-[#78BE20] mt-0.5">
                            {count} {count === 1 ? 'quiz' : 'quizzes'}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerateQuiz(doc)}
                    size="sm"
                    fullWidth={false}
                    className="bg-[#78BE20] hover:bg-[#6BA51D] flex-shrink-0"
                  >
                    <Plus size={14} />
                    <span className="text-sm">Generate Quiz</span>
                  </Button>
                </div>

                {/* Quizzes for this document - only show when expanded */}
                {expandedDocs.has(doc.id) && (
                  <div className="mt-3 space-y-2 pl-8">
                    {loadingQuizzes[doc.id] ? (
                      <div className="flex items-center justify-center py-4">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading quizzes...</span>
                      </div>
                    ) : quizzes[doc.id]?.length > 0 ? (
                    quizzes[doc.id].map((quiz) => (
                      <div
                        key={quiz.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-[#333333]">{quiz.title}</h4>
                            {getStatusBadge(quiz.status)}
                          </div>
                          <p className="text-xs text-gray-600">
                            {quiz.total_questions} questions • {new Date(quiz.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                            className="border-[#78BE20] text-[#78BE20] hover:bg-[#78BE20] hover:text-white"
                          >
                            <Eye size={16} />
                            <span>View Details</span>
                          </Button>
                          {quiz.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishQuiz(quiz.id, doc.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle size={16} />
                              <span>Publish</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ quizId: quiz.id, documentId: doc.id })}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No quizzes generated yet</p>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Generate Quiz Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Quiz"
      >
        <form onSubmit={submitGenerateQuiz} className="space-y-4">
          <Input2
            label="Quiz Title"
            name="title"
            value={generateForm.title}
            onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
            required
            disabled={submitting}
          />
          <Input2
            label="Description (Optional)"
            name="description"
            value={generateForm.description}
            onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
            disabled={submitting}
          />
          <Input2
            label="Number of Questions"
            type="number"
            name="num_questions"
            value={generateForm.num_questions}
            onChange={(e) => setGenerateForm({ ...generateForm, num_questions: parseInt(e.target.value) })}
            min="5"
            max="20"
            required
            disabled={submitting}
            helpText="Choose between 5 and 20 questions"
          />
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowGenerateModal(false)}
              disabled={submitting}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              fullWidth
              className="bg-[#78BE20] hover:bg-[#6BA51D]"
            >
              {submitting ? 'Generating...' : 'Generate Quiz'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (deleteConfirm?.quizId && deleteConfirm?.documentId) {
              handleDeleteQuiz(deleteConfirm.quizId, deleteConfirm.documentId);
            }
          }}
          title="Delete Quiz"
          message="Are you sure you want to delete this quiz? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
};

export default AdminQuizManagement;
