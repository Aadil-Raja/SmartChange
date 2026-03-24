import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuizForTaking, submitQuizAttempt } from '../../services/courseApi';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Alert from '../../components/ui/Alert';
import {
  ArrowLeft,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Timer
} from 'lucide-react';

const QuizTaking = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  
  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Quiz taking state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Load quiz data
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await getQuizForTaking(quizId);
        
        if (response.success) {
          setQuiz(response.data);
          // Initialize answers object
          const initialAnswers = {};
          response.data.questions.forEach(question => {
            initialAnswers[question.id] = null;
          });
          setAnswers(initialAnswers);
        } else {
          setError(response.message || 'Failed to load quiz');
        }
      } catch (err) {
        console.error('Quiz loading error:', err);
        if (err.response?.status === 403) {
          setError('Quiz is not available for taking. Please check prerequisites or attempt limits.');
        } else {
          setError(err.response?.data?.message || 'Failed to load quiz');
        }
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  // Timer effect (if quiz has time limit)
  useEffect(() => {
    if (quizStarted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitQuiz(); // Auto-submit when time runs out
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, timeRemaining]);

  // Start quiz
  const handleStartQuiz = () => {
    setQuizStarted(true);
    // Set timer if quiz has time limit (you can add this to API response)
    // setTimeRemaining(quiz.time_limit_minutes * 60);
  };

  // Handle answer selection
  const handleAnswerSelect = (questionId, optionId) => {
    // Find the option to get its order
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
    
    setAnswers(prev => ({
      ...prev,
      [questionId]: selectedOption ? selectedOption.option_order : null
    }));
  };

  // Navigate between questions
  const goToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      // Transform answers to the format expected by API
      // API expects: {"question_id": option_order} where question_id is string and option_order is integer
      const formattedAnswers = {};
      Object.entries(answers).forEach(([questionId, optionOrder]) => {
        if (optionOrder !== null && optionOrder !== undefined) {
          formattedAnswers[questionId] = optionOrder;
        }
      });

      console.log('Submitting quiz with formatted answers:', formattedAnswers);
      
      const response = await submitQuizAttempt(quizId, formattedAnswers);
      
      if (response.success) {
        // Navigate to results page with the results data
        navigate(`/employee/quiz/${quizId}/results`, {
          state: { results: response.data },
          replace: true
        });
      } else {
        setError(response.message || 'Failed to submit quiz');
      }
    } catch (err) {
      console.error('Quiz submission error:', err);
      setError(err.response?.data?.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  // Show submit confirmation
  const handleSubmitClick = () => {
    setShowSubmitConfirm(true);
  };

  // Format time display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get answered questions count
  const getAnsweredCount = () => {
    return Object.values(answers).filter(answer => answer !== null && answer !== undefined).length;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
          <Button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const answeredCount = getAnsweredCount();
  const allAnswered = answeredCount === quiz.questions.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-[#f7953f] transition-colors"
                disabled={quizStarted}
              >
                <ArrowLeft size={20} />
                <span className="font-medium">Back</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#333333]">{quiz.title}</h1>
                <p className="text-sm text-gray-600">
                  Attempt {quiz.attempt_number} of {quiz.max_attempts}
                </p>
              </div>
            </div>
            
            {quizStarted && (
              <div className="flex items-center gap-4">
                {timeRemaining && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <Timer size={16} className="text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  {answeredCount} of {quiz.questions.length} answered
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {!quizStarted ? (
          // Quiz Start Screen
          <Card className="text-center p-8">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-[#78BE20] rounded-full flex items-center justify-center mx-auto mb-6">
                <HelpCircle size={32} className="text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-[#333333] mb-4">Ready to Start?</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Questions:</span>
                  <span className="font-semibold">{quiz.questions.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Attempt:</span>
                  <span className="font-semibold">{quiz.attempt_number} of {quiz.max_attempts}</span>
                </div>
                {timeRemaining && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Time Limit:</span>
                    <span className="font-semibold">{formatTime(timeRemaining)}</span>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-amber-900">Important Notes:</p>
                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                      <li>• You cannot pause once started</li>
                      <li>• Make sure you have a stable internet connection</li>
                      <li>• Review all questions before submitting</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStartQuiz}
                className="bg-[#78BE20] hover:bg-[#6BA51D] px-8 py-3"
              >
                Start Quiz
              </Button>
            </div>
          </Card>
        ) : (
          // Quiz Taking Interface
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Question Navigation Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-[#333333]">Questions</h3>
                  <p className="text-sm text-gray-600">
                    {answeredCount} of {quiz.questions.length} answered
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-5 gap-2">
                    {quiz.questions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => goToQuestion(index)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          index === currentQuestionIndex
                            ? 'bg-[#f7953f] text-white'
                            : answers[question.id] !== null && answers[question.id] !== undefined
                            ? 'bg-[#78BE20] text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#f7953f] rounded"></div>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#78BE20] rounded"></div>
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-200 rounded"></div>
                      <span>Not answered</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Question Area */}
            <div className="lg:col-span-3">
              <Card className="p-6">
                {/* Question Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-[#f7953f] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {currentQuestionIndex + 1}
                    </span>
                    <span className="text-sm text-gray-600">
                      Question {currentQuestionIndex + 1} of {quiz.questions.length}
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-[#333333] leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>
                </div>

                {/* Answer Options */}
                <div className="space-y-3 mb-8">
                  {currentQuestion.options
                    .sort((a, b) => a.option_order - b.option_order)
                    .map((option) => (
                    <label
                      key={option.id}
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-[#f7953f] ${
                        answers[currentQuestion.id] === option.option_order
                          ? 'border-[#f7953f] bg-orange-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option.id}
                          checked={answers[currentQuestion.id] === option.option_order}
                          onChange={() => handleAnswerSelect(currentQuestion.id, option.id)}
                          className="w-4 h-4 text-[#f7953f] focus:ring-[#f7953f]"
                        />
                        <span className="text-[#333333]">{option.option_text}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={goToPreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>

                  <div className="flex gap-3">
                    {!isLastQuestion ? (
                      <Button
                        onClick={goToNextQuestion}
                        className="bg-[#f7953f] hover:bg-[#E0741C]"
                      >
                        Next Question
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmitClick}
                        disabled={submitting || !allAnswered}
                        className="bg-[#78BE20] hover:bg-[#6BA51D]"
                      >
                        {submitting ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle size={18} />
                            Submit Quiz
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Submit Warning */}
                {isLastQuestion && !allAnswered && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <p className="text-sm text-amber-700">
                        Please answer all questions before submitting.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              
              <h3 className="text-lg font-bold text-[#333333] mb-2">Submit Quiz?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to submit your quiz? You won't be able to change your answers after submission.
              </p>
              
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="bg-[#78BE20] hover:bg-[#6BA51D]"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Submitting...
                    </>
                  ) : (
                    'Yes, Submit'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuizTaking;