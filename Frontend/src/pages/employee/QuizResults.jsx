import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { employeeKeys } from '../../hooks/useEmployeeQueries';
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
  const qc = useQueryClient();
  
  // Get results from navigation state
  const resultsData = location.state?.results;
  const courseId = location.state?.courseId;
  
  useEffect(() => {
    // If no results data, redirect back
    if (!resultsData) {
      navigate(`/employee/quiz/${quizId}`, { replace: true });
    }
  }, [resultsData, navigate, quizId]);

  // Invalidate course cache so best score, prereqs, and progress are fresh on nav back
  useEffect(() => {
    if (!resultsData || !courseId) return;
    qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
    qc.invalidateQueries({ queryKey: employeeKeys.courseQuizzes(courseId) });
    qc.invalidateQueries({ queryKey: employeeKeys.courses() });
  }, []);

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

          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all mb-4"
                style={{ color: '#f6d5b8', background: 'rgba(255,255,255,0.12)' }}
              >
                <ArrowLeft size={17} />
                Back to Course
              </button>

              <h1 className="text-3xl font-bold leading-tight" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>
                Quiz Results
              </h1>
              <p className="text-sm mt-1" style={{ color: '#f6d5b8' }}>
                {attempts_remaining} attempt{attempts_remaining !== 1 ? 's' : ''} remaining
              </p>
            </div>

            <div className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Final Score</p>
              <p className="text-xl font-bold" style={{ color: '#fffaf0' }}>{scorePercentage}%</p>
            </div>
          </div>
        </section>

        <Card
          className="mb-8 text-center p-8 sm:p-10 rounded-[24px] border bg-white"
          style={{ borderColor: '#e8e0d4', boxShadow: '0 12px 30px rgba(26,18,9,0.08)' }}
        >
          <div className="max-w-md mx-auto">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: passed ? '#edf8ea' : '#fff1f2' }}
            >
              {passed ? (
                <Trophy size={40} className="text-[#3f8e1b]" />
              ) : (
                <AlertCircle size={40} className="text-[#dc2626]" />
              )}
            </div>

            <h2
              className="text-4xl font-bold mb-2"
              style={{ color: passed ? '#3f8e1b' : '#dc2626' }}
            >
              {scorePercentage}%
            </h2>

            <p
              className="text-lg font-semibold mb-5"
              style={{ color: passed ? '#26401b' : '#9f1239' }}
            >
              {passed ? 'Congratulations! You passed!' : 'Keep trying! You can do better!'}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl p-3 border" style={{ background: '#edf8ea', borderColor: '#d6ebc8' }}>
                <p className="text-2xl font-bold" style={{ color: '#26401b' }}>{score}</p>
                <p className="text-sm" style={{ color: '#5f7b4a' }}>Correct</p>
              </div>
              <div className="rounded-2xl p-3 border" style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
                <p className="text-2xl font-bold" style={{ color: '#9f1239' }}>{total_questions - score}</p>
                <p className="text-sm" style={{ color: '#be123c' }}>Incorrect</p>
              </div>
              <div className="rounded-2xl p-3 border" style={{ background: '#f3ede4', borderColor: '#eadfce' }}>
                <p className="text-2xl font-bold" style={{ color: '#1a1209' }}>70%</p>
                <p className="text-sm" style={{ color: '#6b5e4e' }}>Required</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="flex items-center gap-2 rounded-full"
              >
                <BookOpen size={18} />
                Back to Course
              </Button>
              
              {can_retake && attempts_remaining > 0 && (
                <Button
                  onClick={() => navigate(`/employee/quiz/${quizId}`)}
                  className="bg-[#1a1209] hover:bg-[#f7953f] rounded-full flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Retake Quiz
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card
          className="p-6 sm:p-7 rounded-[24px] border bg-white"
          style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 24px rgba(26,18,9,0.08)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#fff3e8' }}>
              <BookOpen size={18} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Question Review</h2>
          </div>
          
          <div className="space-y-6">
            {results.map((questionResult, index) => {
              const isCorrect = questionResult.is_correct;
              
              return (
                <div
                  key={questionResult.question_id}
                  className="border rounded-2xl p-5"
                  style={{ borderColor: '#e8e0d4', background: '#fffdfa' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: isCorrect ? '#edf8ea' : '#fff1f2' }}
                    >
                      {isCorrect ? (
                        <CheckCircle size={16} className="text-[#3f8e1b]" />
                      ) : (
                        <XCircle size={16} className="text-[#dc2626]" />
                      )}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#6b5e4e' }}>
                      Question {index + 1}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isCorrect ? '#3f8e1b' : '#dc2626' }}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1209' }}>
                    {questionResult.question_text}
                  </h3>

                  <div className="space-y-3 mb-4">
                    <div
                      className="p-3 border rounded-xl"
                      style={{
                        borderColor: isCorrect ? '#86d59f' : '#f9a8ba',
                        background: isCorrect ? '#edf8ea' : '#fff1f2',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {isCorrect ? (
                          <CheckCircle size={16} className="text-[#3f8e1b]" />
                        ) : (
                          <XCircle size={16} className="text-[#dc2626]" />
                        )}
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#1a1209' }}>Your Answer:</p>
                          <p className="text-sm" style={{ color: isCorrect ? '#26401b' : '#9f1239' }}>
                            {questionResult.user_answer}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {!isCorrect && (
                      <div className="p-3 border rounded-xl" style={{ borderColor: '#86d59f', background: '#edf8ea' }}>
                        <div className="flex items-center gap-3">
                          <CheckCircle size={16} className="text-[#3f8e1b]" />
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#26401b' }}>Correct Answer:</p>
                            <p className="text-sm" style={{ color: '#26401b' }}>{questionResult.correct_answer}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {questionResult.explanation && (
                    <div className="mt-4 p-3 rounded-xl" style={{ background: '#fff7eb', border: '1px solid #f6dec1' }}>
                      <p className="text-sm font-medium mb-1" style={{ color: '#9a5800' }}>Explanation:</p>
                      <p className="text-sm" style={{ color: '#8a5a2d' }}>{questionResult.explanation}</p>
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