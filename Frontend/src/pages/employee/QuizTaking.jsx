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
      <div className="min-h-screen bg-[#faf6ef] flex items-center justify-center p-6">
        <div
          className="text-center rounded-3xl p-8 border bg-white"
          style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 26px rgba(26,18,9,0.08)' }}
        >
          <LoadingSpinner size="large" />
          <p className="mt-4" style={{ color: '#6b5e4e' }}>Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#faf6ef] p-6">
        <div className="max-w-2xl mx-auto">
          <Alert variant="error" className="mb-6 rounded-2xl">
            {error}
          </Alert>
          <Button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5"
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
  const progressPercent = Math.round((answeredCount / quiz.questions.length) * 100);

  return (
    <div className="min-h-screen bg-[#faf6ef]">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
        <section
          className="relative overflow-hidden rounded-[28px] p-6 sm:p-7 mb-6 border"
          style={{
            background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)',
            borderColor: '#2f2317',
            boxShadow: '0 20px 48px rgba(26,18,9,0.28)',
          }}
        >
          <div className="absolute -top-8 -right-10 w-40 h-40 rounded-full" style={{ background: 'rgba(247,149,63,0.12)' }} />
          <div className="absolute -bottom-12 -left-10 w-56 h-56 rounded-full" style={{ background: 'rgba(247,149,63,0.08)' }} />

          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all mb-4 disabled:opacity-60"
                style={{ color: '#f6d5b8', background: 'rgba(255,255,255,0.12)' }}
                disabled={quizStarted}
              >
                <ArrowLeft size={17} />
                Back
              </button>

              <h1 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>
                {quiz.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: '#f6d5b8' }}>
                Attempt {quiz.attempt_number} of {quiz.max_attempts}
              </p>
            </div>

            {quizStarted && (
              <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                {timeRemaining && (
                  <div className="rounded-2xl border px-4 py-3 inline-flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.14)', borderColor: 'rgba(252,165,165,0.34)' }}>
                    <Timer size={16} className="text-red-200" />
                    <span className="text-sm font-semibold text-red-100">{formatTime(timeRemaining)}</span>
                  </div>
                )}

                <div className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Progress</p>
                  <p className="text-sm font-semibold" style={{ color: '#fffaf0' }}>
                    {answeredCount} of {quiz.questions.length} answered ({progressPercent}%)
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {!quizStarted ? (
          <Card
            className="text-center p-8 sm:p-10 rounded-[24px] border bg-white"
            style={{ borderColor: '#e8e0d4', boxShadow: '0 12px 30px rgba(26,18,9,0.08)' }}
          >
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#edf8ea' }}>
                <HelpCircle size={32} className="text-white" />
              </div>

              <h2 className="text-3xl font-bold mb-4" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Ready to Start?</h2>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: '#eee4d7' }}>
                  <span style={{ color: '#6b5e4e' }}>Questions:</span>
                  <span className="font-semibold" style={{ color: '#1a1209' }}>{quiz.questions.length}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: '#eee4d7' }}>
                  <span style={{ color: '#6b5e4e' }}>Attempt:</span>
                  <span className="font-semibold" style={{ color: '#1a1209' }}>{quiz.attempt_number} of {quiz.max_attempts}</span>
                </div>
                {timeRemaining && (
                  <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: '#eee4d7' }}>
                    <span style={{ color: '#6b5e4e' }}>Time Limit:</span>
                    <span className="font-semibold" style={{ color: '#1a1209' }}>{formatTime(timeRemaining)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-4 mb-6 text-left" style={{ background: '#fff7eb', border: '1px solid #f6dec1' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
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
                className="px-8 py-3 rounded-full bg-[#1a1209] hover:bg-[#f7953f] transition-all"
              >
                Start Quiz
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card
                className="sticky top-6 rounded-[24px] border bg-white"
                style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 22px rgba(26,18,9,0.08)' }}
              >
                <div className="p-4 border-b" style={{ borderColor: '#eee4d7' }}>
                  <h3 className="font-semibold" style={{ color: '#1a1209' }}>Questions</h3>
                  <p className="text-sm" style={{ color: '#6b5e4e' }}>
                    {answeredCount} of {quiz.questions.length} answered
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-5 gap-2">
                    {quiz.questions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => goToQuestion(index)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                          index === currentQuestionIndex
                            ? 'bg-[#1a1209] text-white'
                            : answers[question.id] !== null && answers[question.id] !== undefined
                            ? 'bg-[#3f8e1b] text-white'
                            : 'text-[#6b5e4e] bg-[#f3ede4] hover:bg-[#eadfce]'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#1a1209] rounded"></div>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#3f8e1b] rounded"></div>
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#f3ede4] rounded"></div>
                      <span>Not answered</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card
                className="p-6 sm:p-7 rounded-[24px] border bg-white"
                style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 24px rgba(26,18,9,0.08)' }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-[#1a1209] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {currentQuestionIndex + 1}
                    </span>
                    <span className="text-sm" style={{ color: '#6b5e4e' }}>
                      Question {currentQuestionIndex + 1} of {quiz.questions.length}
                    </span>
                  </div>
                </div>

                <div className="mb-8">
                  <h2 className="text-xl font-semibold leading-relaxed" style={{ color: '#1a1209' }}>
                    {currentQuestion.question_text}
                  </h2>
                </div>

                <div className="space-y-3 mb-8">
                  {currentQuestion.options
                    .sort((a, b) => a.option_order - b.option_order)
                    .map((option) => (
                    <label
                      key={option.id}
                      className={`block p-4 border rounded-xl cursor-pointer transition-all ${
                        answers[currentQuestion.id] === option.option_order
                          ? 'border-[#f7953f]'
                          : 'hover:border-[#eadfce]'
                      }`}
                      style={{
                        background: answers[currentQuestion.id] === option.option_order ? '#fff5ea' : '#ffffff',
                        borderColor: answers[currentQuestion.id] === option.option_order ? '#f7953f' : '#e8e0d4',
                      }}
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
                        <span style={{ color: '#3d3228' }}>{option.option_text}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={goToPreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="rounded-full"
                  >
                    Previous
                  </Button>

                  <div className="flex gap-3">
                    {!isLastQuestion ? (
                      <Button
                        onClick={goToNextQuestion}
                        className="bg-[#1a1209] hover:bg-[#f7953f] rounded-full"
                      >
                        Next Question
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmitClick}
                        disabled={submitting || !allAnswered}
                        className="bg-[#3f8e1b] hover:bg-[#5aa125] rounded-full"
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

                {isLastQuestion && !allAnswered && (
                  <div className="mt-4 rounded-xl p-3" style={{ background: '#fff7eb', border: '1px solid #f6dec1' }}>
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
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full mx-4 p-6 rounded-[24px] border" style={{ borderColor: '#e8e0d4', boxShadow: '0 18px 40px rgba(26,18,9,0.2)' }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#fff3e8' }}>
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Submit Quiz?</h3>
              <p className="mb-6" style={{ color: '#6b5e4e' }}>
                Are you sure you want to submit your quiz? You won't be able to change your answers after submission.
              </p>
              
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                  disabled={submitting}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="bg-[#3f8e1b] hover:bg-[#5aa125] rounded-full"
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