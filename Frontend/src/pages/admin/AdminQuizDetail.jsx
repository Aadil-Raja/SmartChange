// src/pages/admin/AdminQuizDetail.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Save,
  CheckCircle,
  X,
  FileText,
  Search,
  Settings
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import Modal from "../../components/ui/Modal";
import Input2 from "../../components/ui/Input2";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import * as quizApi from "../../services/quizApi";

const AdminQuizDetail = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const quizType = queryParams.get('type') || 'document';
  const isCourseQuiz = quizType === 'course';

  const [quiz, setQuiz] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Available questions state (for course quizzes)
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addQuestionTab, setAddQuestionTab] = useState('custom'); // 'custom' or 'referenced'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReferencedQuestion, setSelectedReferencedQuestion] = useState(null);

  // Quiz Configuration State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [quizConfig, setQuizConfig] = useState({
    max_attempts: 1,
    passing_score: 80,
    cooldown_minutes: 0
  });
  const [configLoading, setConfigLoading] = useState(false);

  // Check if quiz is currently being generated
  const isGenerating = !isCourseQuiz && (quiz?.status === 'GENERATING' || audit?.status === 'GENERATING');
  
  const hasFetchedQuiz = useRef(false);
  const hasFetchedAudit = useRef(false);

  // Question form
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    correct_answer_index: 0,
    explanation: '',
    options: [
      { option_text: '', option_order: 0 },
      { option_text: '', option_order: 1 },
      { option_text: '', option_order: 2 },
      { option_text: '', option_order: 3 }
    ]
  });

  useEffect(() => {
    if (!hasFetchedQuiz.current) {
      loadQuiz();
      hasFetchedQuiz.current = true;
    }
  }, [quizId, quizType]);
  
  useEffect(() => {
    if (!isCourseQuiz && !hasFetchedAudit.current) {
      loadAudit();
      hasFetchedAudit.current = true;
    }
  }, [quizId, quizType, isCourseQuiz]);

  // Poll for audit updates while generating (only audit, not full quiz)
  useEffect(() => {
    if (isCourseQuiz) return;

    // Only start polling if quiz is generating
    const shouldPoll = quiz?.status === 'GENERATING' || audit?.status === 'GENERATING';
    
    if (!shouldPoll) return;

    const interval = setInterval(async () => {
      // Only fetch audit (lighter than full quiz)
      try {
        const auditResponse = await quizApi.getQuizAudit(quizId);
        setAudit(auditResponse);
        
        // If generation completed, reload full quiz once
        if (auditResponse.status === 'COMPLETED' || auditResponse.status === 'FAILED') {
          loadQuiz();
        }
      } catch (err) {
        console.log('Error polling audit:', err);
      }
    }, 5000); // Poll every 5 seconds (less frequent)

    return () => clearInterval(interval);
  }, [quiz?.status, audit?.status, isCourseQuiz]); 

  const loadQuiz = async () => {
    setLoading(true);
    try {
      let response;
      if (isCourseQuiz) {
        response = await quizApi.getCourseQuiz(quizId);
      } else {
        response = await quizApi.getQuiz(quizId);
      }
      setQuiz(response);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      const response = await quizApi.getQuizAudit(quizId);
      setAudit(response);
    } catch (err) {
      console.log('No audit record found or error loading audit:', err);
      // Don't show error to user, audit might not exist yet
    }
  };

  const loadAvailableQuestions = async () => {
    if (!quiz?.course_id) return;
    
    setLoadingAvailable(true);
    try {
      const result = await quizApi.getAvailableCourseQuestions(quiz.course_id);
      // Ensure we have an array
      if (Array.isArray(result)) {
        setAvailableQuestions(result);
      } else if (result && Array.isArray(result.questions)) {
        setAvailableQuestions(result.questions);
      } else {
        console.warn('Available questions response is not an array:', result);
        setAvailableQuestions([]);
      }
    } catch (err) {
      console.error('Failed to load available questions:', err);
      setError('Failed to load available questions from documents');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestionForm({
      question_text: '',
      correct_answer_index: 0,
      explanation: '',
      options: [
        { option_text: '', option_order: 0 },
        { option_text: '', option_order: 1 },
        { option_text: '', option_order: 2 },
        { option_text: '', option_order: 3 }
      ]
    });
    setEditingQuestion(null);
    setAddQuestionTab('custom');
    setSelectedReferencedQuestion(null);
    setShowAddQuestion(true);

    if (isCourseQuiz) {
      loadAvailableQuestions();
    }
  };

  const handleEditQuestion = (question) => {
    setQuestionForm({
      question_text: question.question_text,
      correct_answer_index: question.correct_answer_index,
      explanation: question.explanation || '',
      options: question.options.map(opt => ({
        option_text: opt.option_text,
        option_order: opt.option_order
      }))
    });
    setEditingQuestion(question);
    setAddQuestionTab('custom'); // Editing is always custom view for now
    setShowAddQuestion(true);
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isCourseQuiz) {
        if (editingQuestion) {
          await quizApi.updateCourseQuizQuestion(editingQuestion.id, questionForm);
          setSuccess('Question updated successfully');
        } else {
          if (addQuestionTab === 'referenced') {
            if (!selectedReferencedQuestion) {
              throw new Error("Please select a question to add");
            }
            await quizApi.addCourseQuizQuestion(quizId, {
              question_type: 'REFERENCED',
              source_document_question_id: selectedReferencedQuestion.id
            });
          } else {
            await quizApi.addCourseQuizQuestion(quizId, {
              question_type: 'COURSE_SPECIFIC',
              ...questionForm
            });
          }
          setSuccess('Question added successfully');
        }
      } else {
        // Document Quiz
        if (editingQuestion) {
          await quizApi.updateQuestion(editingQuestion.id, questionForm);
          setSuccess('Question updated successfully');
        } else {
          await quizApi.addQuestion(quizId, {
            ...questionForm,
            question_order: quiz.questions.length
          });
          setSuccess('Question added successfully');
        }
      }
      setShowAddQuestion(false);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      if (isCourseQuiz) {
        await quizApi.deleteCourseQuizQuestion(questionId);
      } else {
        await quizApi.deleteQuestion(questionId);
      }
      setSuccess('Question deleted successfully');
      setDeleteConfirm(null);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete question');
    }
  };

  const handlePublishQuiz = async () => {
    try {
      if (isCourseQuiz) {
        await quizApi.publishCourseQuiz(quizId);
      } else {
        await quizApi.publishQuiz(quizId);
      }
      setSuccess('Quiz published successfully');
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to publish quiz');
    }
  };

  const loadQuizConfig = async () => {
    if (!isCourseQuiz) return;
    setConfigLoading(true);
    try {
      const config = await quizApi.getQuizConfiguration(quizId);
      if (config) {
        setQuizConfig({
          max_attempts: config.max_attempts,
          passing_score: config.passing_score,
          cooldown_minutes: config.cooldown_minutes
        });
      }
    } catch (err) {
      console.error("Failed to load quiz config", err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleOpenConfig = () => {
    loadQuizConfig();
    setShowConfigModal(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    try {
      await quizApi.updateQuizConfiguration(quizId, quizConfig);
      setSuccess('Quiz configuration updated successfully');
      setShowConfigModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleResetConfig = async () => {
    if (!window.confirm('Are you sure you want to reset configuration to defaults?')) return;
    
    setConfigLoading(true);
    try {
      const defaults = await quizApi.resetQuizConfiguration(quizId);
      setQuizConfig({
        max_attempts: defaults.max_attempts,
        passing_score: defaults.passing_score,
        cooldown_minutes: defaults.cooldown_minutes
      });
      setSuccess('Configuration reset to defaults');
    } catch (err) {
      setError('Failed to reset configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  const updateOptionText = (index, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index].option_text = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const filteredAvailableQuestions = Array.isArray(availableQuestions) 
    ? availableQuestions.filter(q => q.question_text.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-600 mb-4">Quiz not found</h2>
          <Button onClick={() => navigate('/admin/quiz')}>Back to Quiz Management</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/quiz')}
            className="mb-4"
          >
            <ArrowLeft size={16} />
            <span>Back to Quiz Management</span>
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-[#333333]">{quiz.title}</h1>
                {isCourseQuiz && (
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                    Course Quiz
                  </span>
                )}
              </div>
              <p className="text-gray-600">{quiz.description || 'No description'}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-gray-500">
                  {quiz.questions?.length || 0} questions
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  quiz.status === 'PUBLISHED' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {quiz.status}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {isCourseQuiz && (
                <Button
                  variant="outline"
                  onClick={handleOpenConfig}
                  className="flex items-center gap-2"
                >
                  <Settings size={18} />
                  <span>Configuration</span>
                </Button>
              )}
              <Button
                onClick={handleAddQuestion}
                disabled={isGenerating}
                className="bg-[#78BE20] hover:bg-[#6BA51D]"
              >
                <Plus size={16} />
                <span>{isGenerating ? 'Generating...' : 'Add Question'}</span>
              </Button>
              {quiz.status === 'DRAFT' && (quiz.questions?.length > 0 || quiz.total_questions > 0) && !isGenerating && (
                <Button
                  onClick={handlePublishQuiz}
                  className="bg-[#F58220] hover:bg-[#E07010]"
                >
                  <CheckCircle size={16} />
                  <span>Publish</span>
                </Button>
              )}
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

        {/* Generating Banner */}
        {isGenerating && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <div>
              <p className="text-sm font-medium text-blue-900">Quiz is being generated</p>
              <p className="text-xs text-blue-700">
                Questions are being created. Editing is disabled until generation completes.
              </p>
            </div>
          </div>
        )}

        {/* Generation Audit - Only for Document Quizzes */}
        {!isCourseQuiz && audit && (
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#333333] mb-4">Generation Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-sm font-medium ${
                  audit.status === 'COMPLETED' ? 'text-green-600' :
                  audit.status === 'FAILED' ? 'text-red-600' :
                  audit.status === 'GENERATING' ? 'text-blue-600' :
                  'text-gray-600'
                }`}>
                  {audit.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Stage</p>
                <p className="text-sm font-medium text-gray-700">{audit.current_stage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Chunks Used</p>
                <p className="text-sm font-medium text-gray-700">
                  {audit.chunks_selected}/{audit.total_chunks}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tokens</p>
                <p className="text-sm font-medium text-gray-700">
                  {audit.total_tokens?.toLocaleString() || 'N/A'}
                </p>
              </div>
              {audit.duration_seconds && (
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-gray-700">
                    {audit.duration_seconds.toFixed(1)}s
                  </p>
                </div>
              )}
              {audit.error_message && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-xs text-gray-500">Error</p>
                  <p className="text-sm font-medium text-red-600">{audit.error_message}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Questions List */}
        <div className="space-y-4">
          {!quiz.questions || quiz.questions.length === 0 ? (
            <Card className="p-12 text-center">
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                {isGenerating ? 'Generating questions...' : 'No questions yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {isGenerating ? 'Please wait while questions are being generated' : 'Add questions to this quiz'}
              </p>
              {!isGenerating && (
                <Button onClick={handleAddQuestion} className="bg-[#78BE20] hover:bg-[#6BA51D]">
                  <Plus size={16} />
                  <span>Add First Question</span>
                </Button>
              )}
            </Card>
          ) : (
            quiz.questions.map((question, index) => (
              <Card key={question.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-[#78BE20] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-lg font-medium text-[#333333]">
                            {question.question_text}
                          </p>
                          {question.question_type === 'REFERENCED' && (
                             <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                               Referenced
                             </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {question.options.map((option, optIndex) => (
                            <div
                              key={option.id || optIndex}
                              className={`flex items-center gap-2 p-3 rounded-lg border ${
                                optIndex === question.correct_answer_index
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <span className="font-semibold text-sm text-gray-600">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                              <span className="flex-1">{option.option_text}</span>
                              {optIndex === question.correct_answer_index && (
                                <CheckCircle size={16} className="text-green-600" />
                              )}
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-900">
                              <strong>Explanation:</strong> {question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditQuestion(question)}
                      disabled={isGenerating}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(question.id)}
                      disabled={isGenerating}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Question Modal */}
      <Modal
        isOpen={showAddQuestion}
        onClose={() => setShowAddQuestion(false)}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        <div className="space-y-4">
          {isCourseQuiz && !editingQuestion && (
            <div className="flex border-b border-gray-200 mb-4">
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${
                  addQuestionTab === 'custom'
                    ? 'border-[#78BE20] text-[#78BE20]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setAddQuestionTab('custom')}
              >
                Create Custom
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${
                  addQuestionTab === 'referenced'
                    ? 'border-[#78BE20] text-[#78BE20]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setAddQuestionTab('referenced')}
              >
                Add from Documents
              </button>
            </div>
          )}

          {addQuestionTab === 'custom' ? (
            <form onSubmit={submitQuestion} className="space-y-4">
              <Input2
                label="Question"
                name="question_text"
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                required
                disabled={submitting}
              />

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Options</label>
                {questionForm.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-600 w-6">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <Input2
                      value={option.option_text}
                      onChange={(e) => updateOptionText(index, e.target.value)}
                      required
                      disabled={submitting}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correct Answer
                </label>
                <select
                  value={questionForm.correct_answer_index}
                  onChange={(e) => setQuestionForm({ ...questionForm, correct_answer_index: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#78BE20] focus:border-transparent"
                  disabled={submitting}
                >
                  {questionForm.options.map((_, index) => (
                    <option key={index} value={index}>
                      Option {String.fromCharCode(65 + index)}
                    </option>
                  ))}
                </select>
              </div>

              <Input2
                label="Explanation (Optional)"
                name="explanation"
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                disabled={submitting}
                helpText="Explain why this answer is correct"
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddQuestion(false)}
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
                  {submitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Referenced Question Selection */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search available questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#78BE20] focus:border-transparent"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-2 bg-gray-50">
                {loadingAvailable ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : filteredAvailableQuestions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No available questions found from documents.
                  </div>
                ) : (
                  filteredAvailableQuestions.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedReferencedQuestion(q)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedReferencedQuestion?.id === q.id
                          ? 'border-[#78BE20] bg-green-50 ring-1 ring-[#78BE20]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-[#333333] mb-2">{q.question_text}</p>
                      <div className="pl-4 border-l-2 border-gray-200 space-y-1">
                        {q.options?.map((opt, idx) => (
                          <div key={idx} className={`text-sm ${idx === q.correct_answer_index ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                            {String.fromCharCode(65 + idx)}. {opt.option_text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <FileText size={12} />
                        <span>{q.document_title || 'Unknown Document'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddQuestion(false)}
                  disabled={submitting}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitQuestion}
                  disabled={submitting || !selectedReferencedQuestion}
                  fullWidth
                  className="bg-[#78BE20] hover:bg-[#6BA51D]"
                >
                  {submitting ? 'Adding...' : 'Add Selected Question'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Quiz Configuration"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Attempts
            </label>
            <Input2
              type="number"
              min="1"
              value={quizConfig.max_attempts}
              onChange={(e) => setQuizConfig({...quizConfig, max_attempts: parseInt(e.target.value)})}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Number of times an employee can take this quiz.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passing Score (%)
            </label>
            <Input2
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={quizConfig.passing_score}
              onChange={(e) => setQuizConfig({...quizConfig, passing_score: parseFloat(e.target.value)})}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Minimum percentage required to pass.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cooldown Minutes
            </label>
            <Input2
              type="number"
              min="0"
              value={quizConfig.cooldown_minutes}
              onChange={(e) => setQuizConfig({...quizConfig, cooldown_minutes: parseInt(e.target.value)})}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Waiting time before retaking the quiz after a failure.</p>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100 mt-6">
             <Button
              type="button"
              variant="danger"
              onClick={handleResetConfig}
              disabled={configLoading}
            >
              Reset to Defaults
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowConfigModal(false)}
                disabled={configLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={configLoading}
              >
                {configLoading ? <LoadingSpinner size="sm" color="white" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDeleteQuestion(deleteConfirm)}
          title="Delete Question"
          message="Are you sure you want to delete this question? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
};

export default AdminQuizDetail;
