// src/pages/admin/AdminQuizDetail.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle, X, FileText, Search, Settings, Lock } from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import * as quizApi from "../../services/quizApi";

const C = {
  bg: "#faf6ef", ink: "#1a1209", orange: "#f7953f", teal: "#0d9488",
  muted: "#9c8e80", border: "#e8e0d5", card: "#ffffff",
};

const inputStyle = {
  width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`,
  borderRadius: 10, fontSize: 14, outline: "none", background: "#fff",
  color: C.ink, transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box",
};

function FocusInput({ as: Tag = "input", style, ...props }) {
  const [focused, setFocused] = useState(false);
  const focusStyle = focused ? { borderColor: C.orange, boxShadow: "0 0 0 3px rgba(245,130,32,0.12)" } : {};
  return <Tag {...props} style={{ ...inputStyle, ...(Tag === "textarea" ? { resize: "vertical", minHeight: 80 } : {}), ...focusStyle, ...style }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />;
}

const AdminQuizDetail = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const quizType = queryParams.get("type") || "document";
  const isCourseQuiz = quizType === "course";

  const [quiz, setQuiz] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addQuestionTab, setAddQuestionTab] = useState("custom");
  const [referencedSubTab, setReferencedSubTab] = useState("document");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReferencedQuestion, setSelectedReferencedQuestion] = useState(null);
  const [selectedReferencedQuestions, setSelectedReferencedQuestions] = useState(new Set());
  const [selectedBank, setSelectedBank] = useState(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [quizConfig, setQuizConfig] = useState({ max_attempts: 1, passing_score: 80, cooldown_minutes: 0 });
  const [configLoading, setConfigLoading] = useState(false);

  const isGenerating = !isCourseQuiz && (quiz?.status === "GENERATING" || audit?.status === "GENERATING");
  const isPublished = isCourseQuiz && quiz?.status === "PUBLISHED";

  const hasFetchedQuiz = useRef(false);
  const hasFetchedAudit = useRef(false);

  const [questionForm, setQuestionForm] = useState({
    question_text: "", correct_answer_index: 0, explanation: "",
    options: [
      { option_text: "", option_order: 0 }, { option_text: "", option_order: 1 },
      { option_text: "", option_order: 2 }, { option_text: "", option_order: 3 },
    ],
  });

  useEffect(() => {
    if (!hasFetchedQuiz.current) { loadQuiz(); hasFetchedQuiz.current = true; }
  }, [quizId, quizType]);

  useEffect(() => {
    if (!isCourseQuiz && !hasFetchedAudit.current) { loadAudit(); hasFetchedAudit.current = true; }
  }, [quizId, quizType, isCourseQuiz]);

  useEffect(() => {
    if (isCourseQuiz) return;
    const shouldPoll = quiz?.status === "GENERATING" || audit?.status === "GENERATING";
    if (!shouldPoll) return;
    const interval = setInterval(async () => {
      try {
        const auditResponse = await quizApi.getQuizAudit(quizId);
        setAudit(auditResponse);
        if (auditResponse.status === "COMPLETED" || auditResponse.status === "FAILED") loadQuiz();
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [quiz?.status, audit?.status, isCourseQuiz]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const response = isCourseQuiz ? await quizApi.getCourseQuiz(quizId) : await quizApi.getQuiz(quizId);
      setQuiz(response);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      const response = await quizApi.getQuizAudit(quizId);
      setAudit(response);
    } catch {}
  };

  const loadAvailableQuestions = async () => {
    if (!quiz?.course_id) return;
    setLoadingAvailable(true);
    try {
      const result = await quizApi.getAvailableCourseQuestions(quiz.course_id);
      setAvailableQuestions(Array.isArray(result) ? result : result?.questions || []);
    } catch {
      setError("Failed to load available questions");
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestionForm({ question_text: "", correct_answer_index: 0, explanation: "", options: [{ option_text: "", option_order: 0 }, { option_text: "", option_order: 1 }, { option_text: "", option_order: 2 }, { option_text: "", option_order: 3 }] });
    setEditingQuestion(null);
    setAddQuestionTab("custom");
    setReferencedSubTab("document");
    setSelectedReferencedQuestion(null);
    setSelectedReferencedQuestions(new Set());
    setSelectedBank(null);
    setShowAddQuestion(true);
    if (isCourseQuiz) loadAvailableQuestions();
  };

  const handleEditQuestion = (question) => {
    setQuestionForm({ question_text: question.question_text, correct_answer_index: question.correct_answer_index, explanation: question.explanation || "", options: question.options.map((o) => ({ option_text: o.option_text, option_order: o.option_order })) });
    setEditingQuestion(question);
    setAddQuestionTab("custom");
    setShowAddQuestion(true);
  };

  const submitQuestion = async (e) => {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isCourseQuiz) {
        if (editingQuestion) { await quizApi.updateCourseQuizQuestion(editingQuestion.id, questionForm); setSuccess("Question updated"); }
        else if (addQuestionTab === "referenced") {
          if (selectedReferencedQuestions.size === 0) throw new Error("Please select at least one question");
          for (const q of selectedReferencedQuestions) {
            await quizApi.addCourseQuizQuestion(quizId, { question_type: "REFERENCED", source_document_question_id: q.id });
          }
          setSuccess(`${selectedReferencedQuestions.size} question${selectedReferencedQuestions.size > 1 ? 's' : ''} added`);
        } else {
          await quizApi.addCourseQuizQuestion(quizId, { question_type: "COURSE_SPECIFIC", ...questionForm });
          setSuccess("Question added");
        }
      } else {
        if (editingQuestion) { await quizApi.updateQuestion(editingQuestion.id, questionForm); setSuccess("Question updated"); }
        else { await quizApi.addQuestion(quizId, { ...questionForm, question_order: quiz.questions.length }); setSuccess("Question added"); }
      }
      setShowAddQuestion(false);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to save question");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      isCourseQuiz ? await quizApi.deleteCourseQuizQuestion(questionId) : await quizApi.deleteQuestion(questionId);
      setSuccess("Question deleted");
      setDeleteConfirm(null);
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to delete question");
    }
  };

  const handlePublishQuiz = async () => {
    try {
      isCourseQuiz ? await quizApi.publishCourseQuiz(quizId) : await quizApi.publishQuiz(quizId);
      setSuccess("Quiz published successfully");
      loadQuiz();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to publish quiz");
    }
  };

  const loadQuizConfig = async () => {
    if (!isCourseQuiz) return;
    setConfigLoading(true);
    try {
      const config = await quizApi.getQuizConfiguration(quizId);
      if (config) setQuizConfig({ max_attempts: config.max_attempts, passing_score: config.passing_score, cooldown_minutes: config.cooldown_minutes });
    } catch {}
    finally { setConfigLoading(false); }
  };

  const handleOpenConfig = () => { loadQuizConfig(); setShowConfigModal(true); };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    try {
      await quizApi.updateQuizConfiguration(quizId, quizConfig);
      setSuccess("Configuration updated");
      setShowConfigModal(false);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to update configuration");
    } finally { setConfigLoading(false); }
  };

  const handleResetConfig = async () => {
    if (!window.confirm("Reset configuration to defaults?")) return;
    setConfigLoading(true);
    try {
      const defaults = await quizApi.resetQuizConfiguration(quizId);
      setQuizConfig({ max_attempts: defaults.max_attempts, passing_score: defaults.passing_score, cooldown_minutes: defaults.cooldown_minutes });
      setSuccess("Configuration reset to defaults");
    } catch { setError("Failed to reset configuration"); }
    finally { setConfigLoading(false); }
  };

  const updateOptionText = (index, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index].option_text = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const filteredAvailableQuestions = Array.isArray(availableQuestions)
    ? availableQuestions.filter((q) => {
        const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = referencedSubTab === "prompt"
          ? q.source_type === "PROMPT"
          : q.source_type !== "PROMPT";
        const matchesBank = selectedBank ? q.quiz_id === selectedBank.quiz_id : true;
        return matchesSearch && matchesTab && matchesBank;
      })
    : [];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoadingSpinner size="lg" />
    </div>
  );

  if (!quiz) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 40, textAlign: "center" }}>
        <p style={{ color: C.muted, marginBottom: 16 }}>Quiz not found</p>
        <button onClick={() => navigate("/admin/quiz")} style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 999, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}>Back to Quiz Management</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Back strip */}
      <div style={{ background: "#f3ede4", borderBottom: `1px solid ${C.border}`, padding: "10px 36px" }}>
        <button
          onClick={() => navigate("/admin/quiz")}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Quiz Management
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>

        {/* Alerts */}
        {error && (
          <div style={{ background: "#fff1f0", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#b91c1c", fontSize: 13 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}><X size={16} /></button>
          </div>
        )}
        {success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#15803d", fontSize: 13 }}>{success}</span>
            <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}><X size={16} /></button>
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: C.ink, margin: 0 }}>{quiz.title}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{quiz.description || "No description"}</p>
              <span style={{ color: C.muted, fontSize: 13 }}>·</span>
              <span style={{ color: C.muted, fontSize: 13 }}>{quiz.questions?.length || 0} questions</span>
              {isCourseQuiz && (
                <span
                  onClick={() => quiz.course_id && navigate(`/admin/training/course/${quiz.course_id}`)}
                  style={{ background: "#f3e8ff", color: "#7c3aed", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, cursor: quiz.course_id ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                  onMouseEnter={e => { if (quiz.course_id) { e.currentTarget.style.background = "#ede9fe"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#f3e8ff"; }}
                  title="Go to course"
                >
                  Course Quiz
                  {quiz.course_id && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 8.5L8.5 1.5M8.5 1.5H4M8.5 1.5V6" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
              )}
              {isCourseQuiz && (
                <span style={{
                  background: quiz.status === "PUBLISHED" ? "#f0fdf4" : "#fffbeb",
                  color: quiz.status === "PUBLISHED" ? "#15803d" : "#b45309",
                  fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 999
                }}>
                  {quiz.status}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            {isCourseQuiz && (
              <button
                onClick={handleOpenConfig}
                disabled={isPublished}
                style={{ background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: C.ink, cursor: isPublished ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: isPublished ? 0.5 : 1 }}
              >
                <Settings size={15} /> Configuration
              </button>
            )}
            <button
              onClick={handleAddQuestion}
              disabled={isGenerating || isPublished}
              style={{ background: C.orange, border: "none", borderRadius: 999, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: (isGenerating || isPublished) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: (isGenerating || isPublished) ? 0.5 : 1 }}
            >
              <Plus size={15} /> {isGenerating ? "Generating..." : "Add Question"}
            </button>
          </div>
        </div>

        {/* Generating Banner */}
        {isGenerating && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <LoadingSpinner size="sm" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", margin: 0 }}>Quiz is being generated</p>
              <p style={{ fontSize: 12, color: "#3b82f6", margin: 0 }}>Editing is disabled until generation completes.</p>
            </div>
          </div>
        )}

        {/* Published Lock Banner */}
        {isPublished && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <Lock size={18} color="#b45309" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: 0 }}>Quiz is published and locked</p>
              <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>Adding, editing, or deleting questions is disabled for published quizzes.</p>
            </div>
          </div>
        )}

        {/* Generation Audit */}
        {!isCourseQuiz && audit && (
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px", marginBottom: 24 }}>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.ink, margin: "0 0 16px" }}>Generation Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Status", value: audit.status, green: audit.status === "COMPLETED" },
                { label: "Stage", value: audit.current_stage },
                { label: "Chunks Used", value: `${audit.chunks_selected}/${audit.total_chunks}` },
                { label: "Tokens", value: audit.total_tokens?.toLocaleString() || "N/A" },
                ...(audit.duration_seconds ? [{ label: "Duration", value: `${audit.duration_seconds.toFixed(1)}s` }] : []),
              ].map((item, i) => (
                <div key={i}>
                  <p style={{ fontSize: 11, color: C.muted, margin: "0 0 4px" }}>{item.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: item.green ? "#15803d" : C.ink, margin: 0 }}>{item.value}</p>
                </div>
              ))}
              {audit.error_message && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: "0 0 4px" }}>Error</p>
                  <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{audit.error_message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!quiz.questions || quiz.questions.length === 0 ? (
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
              <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>{isGenerating ? "Generating questions..." : "No questions yet"}</p>
              {!isGenerating && (
                <button onClick={handleAddQuestion} disabled={isPublished} style={{ background: C.orange, border: "none", borderRadius: 999, padding: "8px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} style={{ display: "inline", marginRight: 6 }} />Add First Question
                </button>
              )}
            </div>
          ) : quiz.questions.map((question, index) => (
            <div key={question.id} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff0e8", color: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, border: `1.5px solid #fcd9b8` }}>
                    {index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>{question.question_text}</p>
                      {question.question_type === "REFERENCED" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ background: "#f5f0ea", color: C.muted, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>
                            Referenced
                          </span>
                          {question.source_title && (
                            <span
                              onClick={() => {
                                if (!question.source_quiz_id) return;
                                if (question.source_type === "PROMPT") {
                                  navigate(`/admin/quiz?tab=prompt`);
                                } else {
                                  navigate(`/admin/quiz/${question.source_quiz_id}`);
                                }
                              }}
                              title={question.source_title}
                              style={{ background: "#f5f0ea", color: C.muted, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: question.source_quiz_id ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4 }}
                              onMouseEnter={e => { if (question.source_quiz_id) { e.currentTarget.style.background = "#ede9fe"; e.currentTarget.style.color = "#7c3aed"; } }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#f5f0ea"; e.currentTarget.style.color = C.muted; }}
                            >
                              {question.source_type === "PROMPT" ? "✦" : "📄"} {question.source_title}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {question.options.map((option, optIndex) => {
                        const isCorrect = optIndex === question.correct_answer_index;
                        return (
                          <div key={option.id || optIndex} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: isCorrect ? "1.5px solid #16a34a" : `1px solid ${C.border}`, background: isCorrect ? "#f0fdf4" : "#fafafa", borderLeft: isCorrect ? "4px solid #16a34a" : undefined }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: C.muted, width: 20 }}>{String.fromCharCode(65 + optIndex)}.</span>
                            <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{option.option_text}</span>
                            {isCorrect && <CheckCircle size={16} color="#16a34a" />}
                          </div>
                        );
                      })}
                    </div>
                    {question.explanation && (
                      <div style={{ marginTop: 12, padding: "12px 16px", background: "#faf6ef", borderRadius: 10, border: `1px solid ${C.border}` }}>
                        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}><strong style={{ color: C.ink }}>Explanation:</strong> {question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                  <button
                    onClick={() => handleEditQuestion(question)}
                    disabled={isGenerating || isPublished}
                    style={{ background: "#fff7ed", border: "none", borderRadius: 8, padding: "6px 8px", cursor: (isGenerating || isPublished) ? "not-allowed" : "pointer", color: C.orange, opacity: (isGenerating || isPublished) ? 0.4 : 1 }}
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(question.id)}
                    disabled={isGenerating || isPublished}
                    style={{ background: "#fff1f0", border: "none", borderRadius: 8, padding: "6px 8px", cursor: (isGenerating || isPublished) ? "not-allowed" : "pointer", color: "#dc2626", opacity: (isGenerating || isPublished) ? 0.4 : 1 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Question Modal */}
      {showAddQuestion && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,9,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: "32px 36px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h2>
              <button onClick={() => setShowAddQuestion(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.orange }}><X size={20} /></button>
            </div>

            {/* Tab toggle for course quizzes */}
            {isCourseQuiz && !editingQuestion && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {["custom", "referenced"].map((tab) => (
                  <button key={tab} onClick={() => setAddQuestionTab(tab)} style={{ flex: 1, padding: "8px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", background: addQuestionTab === tab ? C.orange : "transparent", color: addQuestionTab === tab ? "#fff" : C.muted, border: addQuestionTab === tab ? `1.5px solid ${C.orange}` : `1.5px solid ${C.border}` }}>
                    {tab === "custom" ? "Create Custom" : "Add from Question Banks"}
                  </button>
                ))}
              </div>
            )}

            {addQuestionTab === "custom" ? (
              <form onSubmit={submitQuestion} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Question</label>
                  <FocusInput as="textarea" value={questionForm.question_text} onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} required disabled={submitting} placeholder="Enter question text" style={{ minHeight: 72 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 8 }}>Options</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {questionForm.options.map((option, index) => (
                      <div key={index} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.muted, width: 20 }}>{String.fromCharCode(65 + index)}.</span>
                        <FocusInput type="text" value={option.option_text} onChange={(e) => updateOptionText(index, e.target.value)} required disabled={submitting} placeholder={`Option ${String.fromCharCode(65 + index)}`} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Correct Answer</label>
                  <select
                    value={questionForm.correct_answer_index}
                    onChange={(e) => setQuestionForm({ ...questionForm, correct_answer_index: parseInt(e.target.value) })}
                    disabled={submitting}
                    style={{ ...inputStyle }}
                  >
                    {questionForm.options.map((_, index) => (
                      <option key={index} value={index}>Option {String.fromCharCode(65 + index)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Explanation (Optional)</label>
                  <FocusInput as="textarea" value={questionForm.explanation} onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} disabled={submitting} placeholder="Explain why this answer is correct" />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowAddQuestion(false)} disabled={submitting} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: C.orange, color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "Saving..." : editingQuestion ? "Update Question" : "Add Question"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Source sub-tabs */}
                <div style={{ display: "flex", gap: 6, background: "#f5f0ea", borderRadius: 999, padding: 4 }}>
                  {[{ key: "document", label: "Documents" }, { key: "prompt", label: "Prompt Quizzes" }].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setReferencedSubTab(key); setSelectedReferencedQuestion(null); setSelectedReferencedQuestions(new Set()); setSelectedBank(null); setSearchTerm(""); }}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: referencedSubTab === key ? "#fff" : "transparent", color: referencedSubTab === key ? C.ink : C.muted, boxShadow: referencedSubTab === key ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {loadingAvailable ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><LoadingSpinner size="sm" /></div>
                ) : !selectedBank ? (
                  /* Level 1 — bank list */
                  (() => {
                    const banks = Object.values(
                      availableQuestions
                        .filter(q => referencedSubTab === "prompt" ? q.source_type === "PROMPT" : q.source_type !== "PROMPT")
                        .reduce((acc, q) => {
                          if (!acc[q.quiz_id]) acc[q.quiz_id] = {
                            quiz_id: q.quiz_id,
                            title: referencedSubTab === "prompt" ? (q.quiz_title || "Prompt Quiz") : (q.document_title || q.quiz_title || "Unknown"),
                            count: 0,
                          };
                          acc[q.quiz_id].count++;
                          return acc;
                        }, {})
                    );
                    return banks.length === 0 ? (
                      <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 24 }}>No question banks available</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {banks.map(bank => (
                          <div key={bank.quiz_id}
                            onClick={() => { setSelectedBank(bank); setSelectedReferencedQuestion(null); setSearchTerm(""); }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", transition: "border-color 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = C.orange}
                            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <FileText size={15} color={C.muted} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{bank.title}</span>
                            </div>
                            <span style={{ fontSize: 12, color: C.muted, background: "#f5f0ea", padding: "2px 10px", borderRadius: 999 }}>{bank.count} questions</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  /* Level 2 — questions inside selected bank */
                  <>
                    <button
                      onClick={() => { setSelectedBank(null); setSelectedReferencedQuestion(null); setSelectedReferencedQuestions(new Set()); setSearchTerm(""); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, fontWeight: 600, padding: 0 }}
                    >
                      <ArrowLeft size={14} /> {selectedBank.title}
                    </button>
                    <div style={{ position: "relative" }}>
                      <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
                      <FocusInput type="text" placeholder="Search questions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 40 }} />
                    </div>
                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, background: C.bg }}>
                      {filteredAvailableQuestions.length === 0 ? (
                        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 24 }}>No questions found</p>
                      ) : filteredAvailableQuestions.map((q) => {
                        const isSelected = selectedReferencedQuestions.has(q);
                        return (
                        <div key={q.id} onClick={() => {
                          setSelectedReferencedQuestions(prev => {
                            const next = new Set(prev);
                            if (next.has(q)) next.delete(q); else next.add(q);
                            return next;
                          });
                        }} style={{ padding: "12px 14px", borderRadius: 10, border: isSelected ? `1.5px solid ${C.orange}` : `1px solid ${C.border}`, background: isSelected ? "#fff7ed" : "#fff", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <input type="checkbox" checked={isSelected} readOnly style={{ marginTop: 2, accentColor: C.orange, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, color: C.ink, margin: "0 0 8px" }}>{q.question_text}</p>
                            <div style={{ paddingLeft: 12, borderLeft: `2px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
                              {q.options?.map((opt, idx) => (
                                <span key={idx} style={{ fontSize: 12, color: idx === q.correct_answer_index ? "#15803d" : C.muted, fontWeight: idx === q.correct_answer_index ? 600 : 400 }}>
                                  {String.fromCharCode(65 + idx)}. {opt.option_text}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setShowAddQuestion(false)} disabled={submitting} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="button" onClick={submitQuestion} disabled={submitting || selectedReferencedQuestions.size === 0} style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: C.orange, color: "#fff", fontSize: 14, fontWeight: 600, cursor: (selectedReferencedQuestions.size === 0 || submitting) ? "not-allowed" : "pointer", opacity: (selectedReferencedQuestions.size === 0 || submitting) ? 0.6 : 1 }}>
                    {submitting ? "Adding..." : selectedReferencedQuestions.size > 0 ? `Add ${selectedReferencedQuestions.size} Question${selectedReferencedQuestions.size > 1 ? 's' : ''}` : "Add Selected Questions"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,9,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, padding: "32px 36px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Quiz Configuration</h2>
              <button onClick={() => setShowConfigModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.orange }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Max Attempts", key: "max_attempts", type: "number", min: 1, hint: "Number of times an employee can take this quiz." },
                { label: "Passing Score (%)", key: "passing_score", type: "number", min: 0, max: 100, step: 0.1, hint: "Minimum percentage required to pass." },
                { label: "Cooldown Minutes", key: "cooldown_minutes", type: "number", min: 0, hint: "Waiting time before retaking after a failure." },
              ].map(({ label, key, hint, ...rest }) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>{label}</label>
                  <FocusInput {...rest} value={quizConfig[key]} onChange={(e) => setQuizConfig({ ...quizConfig, [key]: rest.step ? parseFloat(e.target.value) : parseInt(e.target.value) })} required />
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</p>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <button type="button" onClick={handleResetConfig} disabled={configLoading} style={{ background: "#fff1f0", border: "none", borderRadius: 999, padding: "8px 18px", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Reset to Defaults
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setShowConfigModal(false)} disabled={configLoading} style={{ background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 999, padding: "8px 18px", color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={configLoading} style={{ background: C.orange, border: "none", borderRadius: 999, padding: "8px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: configLoading ? "not-allowed" : "pointer", opacity: configLoading ? 0.7 : 1 }}>
                    {configLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
