// src/pages/admin/AdminQuizDetail.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Save,
  CheckCircle,
  X
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

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const response = await quizApi.getQuiz(quizId);
      setQuiz(response);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load quiz');
    } finally {
      setLoading(false);
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
    setShowAddQuestion(true);
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
    setShowAddQuestion(true);
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingQuestion) {
        // Update existing question
        await quizApi.updateQuestion(editingQuestion.id, questionForm);
        setSuccess('Question updated successfully');
      } else {
        // Add new question
        await quizApi.addQuestion(quizId, {
          ...questionForm,
          question_order: quiz.questions.length
        });
        setSuccess('Question added successfully');
      }
      setShowAddQuestion(false);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      await quizApi.deleteQuestion(questionId);
      setSuccess('Question deleted successfully');
      setDeleteConfirm(null);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete question');
    }
  };

  const handlePublishQuiz = async () => {
    try {
      await quizApi.publishQuiz(quizId);
      setSuccess('Quiz published successfully');
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to publish quiz');
    }
  };

  const updateOptionText = (index, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index].option_text = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

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
              <h1 className="text-3xl font-bold text-[#333333] mb-2">{quiz.title}</h1>
              <p className="text-gray-600">{quiz.description || 'No description'}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-gray-500">
                  {quiz.total_questions} questions
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
              <Button
                onClick={handleAddQuestion}
                className="bg-[#78BE20] hover:bg-[#6BA51D]"
              >
                <Plus size={16} />
                <span>Add Question</span>
              </Button>
              {quiz.status === 'DRAFT' && quiz.total_questions > 0 && (
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

        {/* Questions List */}
        <div className="space-y-4">
          {quiz.questions.length === 0 ? (
            <Card className="p-12 text-center">
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No questions yet</h3>
              <p className="text-gray-500 mb-4">Add questions to this quiz</p>
              <Button onClick={handleAddQuestion} className="bg-[#78BE20] hover:bg-[#6BA51D]">
                <Plus size={16} />
                <span>Add First Question</span>
              </Button>
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
                        <p className="text-lg font-medium text-[#333333] mb-3">
                          {question.question_text}
                        </p>
                        <div className="space-y-2">
                          {question.options.map((option, optIndex) => (
                            <div
                              key={option.id}
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
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(question.id)}
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
