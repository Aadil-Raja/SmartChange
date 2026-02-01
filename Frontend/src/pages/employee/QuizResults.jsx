import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  BookOpen,
  AlertCircle
} from 'lucide-react';

const QuizResults = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get results from navigation state
  const resultsData = location.state?.results;
  
  useEffect(() => {
    // If no results data, redirect back
    if (!resultsData) {
      navigate(`/employee/quiz/${quizId}`, { replace: true });
    }
  }, [resultsData, navigate, quizId]);

  if (!resultsData) {
    return null;
  }

  const {
    score,
    total_questions,
    percentage,
    passed,
    can_retake,
    results,
    quiz_status
  } = resultsData;

  const {
    attempts_remaining
  } = quiz_status || {};

  const scorePercentage = Math.round(percentage || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-[#F58220] transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">Back to Course</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#333333]">Quiz Results</h1>
                <p className="text-sm text-gray-600">
                  {attempts_remaining} attempt{attempts_remaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Results Summary */}
        <Card className="mb-8 text-center p-8">
          <div className="max-w-md mx-auto">
            {/* Score Circle */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              passed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {passed ? (
                <Trophy size={40} className="text-green-600" />
              ) : (
                <AlertCircle size={40} className="text-red-600" />
              )}
            </div>
            
            <h2 className={`text-3xl font-bold mb-2 ${
              passed ? 'text-green-600' : 'text-red-600'
            }`}>
              {scorePercentage}%
            </h2>
            
            <p className={`text-lg font-semibold mb-4 ${
              passed ? 'text-green-800' : 'text-red-800'
            }`}>
              {passed ? 'Congratulations! You passed!' : 'Keep trying! You can do better!'}
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-900">{score}</p>
                <p className="text-sm text-blue-700">Correct</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-900">{total_questions - score}</p>
                <p className="text-sm text-red-700">Incorrect</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">70%</p>
                <p className="text-sm text-gray-700">Required</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <BookOpen size={18} />
                Back to Course
              </Button>
              
              {can_retake && attempts_remaining > 0 && (
                <Button
                  onClick={() => navigate(`/employee/quiz/${quizId}`)}
                  className="bg-[#F58220] hover:bg-[#E0741C] flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Retake Quiz
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Question Review */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#00ADEF] flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#333333]">Question Review</h2>
          </div>
          
          <div className="space-y-6">
            {results.map((questionResult, index) => {
              const isCorrect = questionResult.is_correct;
              
              return (
                <div key={questionResult.question_id} className="border border-gray-200 rounded-lg p-4">
                  {/* Question Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCorrect ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isCorrect ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-red-600" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      Question {index + 1}
                    </span>
                    <span className={`text-sm font-semibold ${
                      isCorrect ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-lg font-semibold text-[#333333] mb-4">
                    {questionResult.question_text}
                  </h3>

                  {/* Answer Display */}
                  <div className="space-y-3 mb-4">
                    <div className={`p-3 border rounded-lg ${
                      isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        {isCorrect ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <XCircle size={16} className="text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">Your Answer:</p>
                          <p className={`text-sm ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {questionResult.user_answer}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {!isCorrect && (
                      <div className="p-3 border border-green-500 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle size={16} className="text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-900">Correct Answer:</p>
                            <p className="text-sm text-green-800">{questionResult.correct_answer}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Explanation */}
                  {questionResult.explanation && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Explanation:</p>
                      <p className="text-sm text-blue-800">{questionResult.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default QuizResults;