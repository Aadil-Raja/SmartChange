// src/pages/admin/AdminQuizManagement.jsx
import { useState, useEffect, useRef } from "react";
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
import AdminSidebar from "../../components/ui/AdminSidebar";
import Input2 from "../../components/ui/Input2";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import * as quizApi from "../../services/quizApi";

const AdminQuizManagement = () => {
  const navigate = useNavigate();
  const { fetchProcessedDocuments, fetchCourses, courses, loading: coursesLoading, clearMessages } = useAdminTraining();

  const [documents, setDocuments] = useState([]);
  const [navCollapsed, setNavCollapsed] = useState(true);
  
  // Document Quiz State
  const [quizzes, setQuizzes] = useState({});
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  const [loadingQuizzes, setLoadingQuizzes] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Course Quiz State
  const [courseQuizzes, setCourseQuizzes] = useState({});
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [loadingCourseQuizzes, setLoadingCourseQuizzes] = useState({});
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [quizStats, setQuizStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [activeTab, setActiveTab] = useState('document');

  // Generate quiz form
  const [generateForm, setGenerateForm] = useState({
    title: '',
    description: '',
    num_questions: 10
  });
  const [submitting, setSubmitting] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    const loadInitialData = async () => {
      // Load all required data in parallel for better performance
      await Promise.all([
        loadDocuments(),
        loadQuizStats(),
        fetchCourses()
      ]);
    };

    if (!hasFetched.current) {
      hasFetched.current = true;
      loadInitialData();
    }
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
      }
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzesForDocument = async (documentId, forceReload = false) => {
    if (quizzes[documentId] && !forceReload) return;

    setLoadingQuizzes(prev => ({ ...prev, [documentId]: true }));
    try {
      const response = await quizApi.getQuizzesByDocument(documentId);
      setQuizzes(prev => ({
        ...prev,
        [documentId]: response.quizzes || []
      }));
    } catch (err) {
      console.error(`Failed to load quizzes for document ${documentId}:`, err);
      setQuizzes(prev => ({ ...prev, [documentId]: [] }));
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
      loadQuizzesForDocument(documentId);
    }
    setExpandedDocs(newExpanded);
  };

  const loadQuizzesForCourse = async (courseId, forceReload = false) => {
    if (courseQuizzes[courseId] && !forceReload) return;

    setLoadingCourseQuizzes(prev => ({ ...prev, [courseId]: true }));
    try {
      const response = await quizApi.listCourseQuizzes(courseId);
      setCourseQuizzes(prev => ({
        ...prev,
        [courseId]: response.quizzes || []
      }));
    } catch (err) {
      console.error(`Failed to load quizzes for course ${courseId}:`, err);
      setCourseQuizzes(prev => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingCourseQuizzes(prev => ({ ...prev, [courseId]: false }));
    }
  };

  const toggleCourseExpand = (courseId) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
      loadQuizzesForCourse(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const handleGenerateQuiz = (document) => {
    setSelectedDocument(document);
    setSelectedCourse(null);
    setGenerateForm({
      title: `${document.title} - Quiz`,
      description: '',
      num_questions: 10
    });
    setShowGenerateModal(true);
  };

  const handleCreateCourseQuiz = (course) => {
    setSelectedCourse(course);
    setSelectedDocument(null);
    setGenerateForm({
      title: `${course.title} - Quiz`,
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
      if (activeTab === 'document' && selectedDocument) {
        const response = await quizApi.generateQuiz(selectedDocument.id, generateForm);
        setSuccess(`Quiz generation started! Quiz ID: ${response.quiz_id}`);
        setShowGenerateModal(false);
        setTimeout(() => {
          loadQuizzesForDocument(selectedDocument.id, true);
          loadQuizStats();
        }, 2000);
      } else if (activeTab === 'course' && selectedCourse) {
        const quizData = {
          title: generateForm.title,
          description: generateForm.description
        };
        const response = await quizApi.createCourseQuiz(selectedCourse.id, quizData);
        setSuccess(`Course quiz created successfully!`);
        setShowGenerateModal(false);
        loadQuizzesForCourse(selectedCourse.id, true);
        loadQuizStats();
      }
    } catch (err) {
      console.error('Generate quiz error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate quiz';
      setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuiz = async (quizId, documentId = null, courseId = null) => {
    try {
      if (documentId) {
        await quizApi.deleteQuiz(quizId);
        loadQuizzesForDocument(documentId, true);
      } else if (courseId) {
        await quizApi.deleteCourseQuiz(quizId);
        loadQuizzesForCourse(courseId, true);
      }
      setSuccess('Quiz deleted successfully');
      loadQuizStats();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete quiz');
    }
  };

  const handlePublishQuiz = async (quizId, documentId = null, courseId = null) => {
    try {
      if (documentId) {
        await quizApi.publishQuiz(quizId);
        loadQuizzesForDocument(documentId, true);
      } else if (courseId) {
        await quizApi.publishCourseQuiz(quizId);
        loadQuizzesForCourse(courseId, true);
      }
      setSuccess('Quiz published successfully');
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

  const filteredCourses = (courses || []).filter(course =>
    course.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-[#333333]">Quiz Management</h1>
            <p className="text-gray-600 mt-1">Generate and manage quizzes from processed documents</p>
          </div>
        </div>

        <div className="p-6">
          <div className="mx-auto max-w-7xl">

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => {
                    setActiveTab('document');
                    setSearchTerm('');
                  }}
                  className={`${activeTab === 'document'
                    ? 'border-[#78BE20] text-[#78BE20]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
                >
                  Document Quizzes
                </button>
                <button
                  onClick={() => {
                    setActiveTab('course');
                    setSearchTerm('');
                  }}
                  className={`${activeTab === 'course'
                    ? 'border-[#78BE20] text-[#78BE20]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
                >
                  Course Quizzes
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'document' ? (
              <div className="space-y-6">
                {/* Alerts */}
                {error && (
                  <Alert variant="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                {success && (
                  <Alert variant="success" onClose={() => setSuccess(null)}>
                    {success}
                  </Alert>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            ) : (
              <div className="space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#78BE20] focus:border-transparent"
                  />
                </div>

                {/* Course List */}
                <div className="space-y-6">
                  {coursesLoading && courses?.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : filteredCourses.length === 0 ? (
                    <Card className="p-12 text-center">
                      <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No courses found</h3>
                      <p className="text-gray-500 mb-4">Create courses first to generate quizzes</p>
                      <Button onClick={() => navigate('/admin/training/create')}>
                        Create Course
                      </Button>
                    </Card>
                  ) : (
                    filteredCourses.map((course) => (
                      <Card key={course.id} className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Expand Button */}
                            <button
                              onClick={() => toggleCourseExpand(course.id)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                            >
                              {expandedCourses.has(course.id) ? (
                                <ChevronDown size={18} className="text-gray-600" />
                              ) : (
                                <ChevronRight size={18} className="text-gray-600" />
                              )}
                            </button>

                            {/* Thumbnail */}
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                              {course.thumbnail_url ? (
                                <img
                                  src={course.thumbnail_url}
                                  alt={course.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText size={24} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-[#333333]">{course.title}</h3>
                              <p className="text-sm text-gray-500 line-clamp-1">{course.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  course.is_active 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {course.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {course.department && (
                                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                                    {course.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            onClick={() => handleCreateCourseQuiz(course)}
                            size="sm"
                            fullWidth={false}
                            className="bg-[#78BE20] hover:bg-[#6BA51D] flex-shrink-0 ml-4"
                          >
                            <Plus size={14} />
                            <span className="text-sm">Generate Quiz</span>
                          </Button>
                        </div>

                        {/* Quizzes for this course - only show when expanded */}
                        {expandedCourses.has(course.id) && (
                          <div className="mt-3 space-y-2 pl-20">
                            {loadingCourseQuizzes[course.id] ? (
                              <div className="flex items-center justify-center py-4">
                                <LoadingSpinner size="sm" />
                                <span className="ml-2 text-sm text-gray-500">Loading quizzes...</span>
                              </div>
                            ) : courseQuizzes[course.id]?.length > 0 ? (
                              courseQuizzes[course.id].map((quiz) => (
                                <div
                                  key={quiz.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-sm font-medium text-[#333333]">{quiz.title}</h4>
                                      {getStatusBadge(quiz.status || 'DRAFT')}
                                    </div>
                                    <p className="text-xs text-gray-600">
                                      {quiz.description || 'No description'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/admin/quiz/${quiz.id}?type=course`)}
                                      className="border-[#78BE20] text-[#78BE20] hover:bg-[#78BE20] hover:text-white"
                                    >
                                      <Eye size={16} />
                                      <span>View Details</span>
                                    </Button>
                                    {quiz.status === 'DRAFT' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePublishQuiz(quiz.id, null, course.id)}
                                        className="text-green-600 hover:text-green-700"
                                      >
                                        <CheckCircle size={16} />
                                        <span>Publish</span>
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteConfirm({ quizId: quiz.id, courseId: course.id })}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500 italic">No quizzes created yet</p>
                            )}
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Quiz Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={activeTab === 'document' ? "Generate Quiz" : "Create Course Quiz"}
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
          
          {activeTab === 'document' && (
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
          )}

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
              {submitting ? 'Processing...' : (activeTab === 'document' ? 'Generate Quiz' : 'Create Quiz')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (deleteConfirm?.quizId) {
              handleDeleteQuiz(deleteConfirm.quizId, deleteConfirm.documentId, deleteConfirm.courseId);
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
