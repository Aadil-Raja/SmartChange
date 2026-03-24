// src/pages/admin/AdminPromptQuizManagement.jsx
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, X, Loader, CheckCircle, FileText, Sparkles } from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import * as quizApi from "../../services/quizApi";

const C = {
  bg: "#faf6ef", ink: "#1a1209", orange: "#f7953f",
  muted: "#9c8e80", border: "#e8e0d5", card: "#ffffff",
};

const inputBase = {
  width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`,
  borderRadius: 10, fontSize: 14, outline: "none", background: "#fff",
  color: C.ink, transition: "border-color 0.15s, box-shadow 0.15s",
};
const focusOn  = (e) => { e.target.style.borderColor = C.orange; e.target.style.boxShadow = "0 0 0 3px rgba(247,149,63,0.12)"; };
const focusOff = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; };

const StatusBadge = ({ status }) => {
  if (status === "DRAFT") return null;
  const map = {
    GENERATING: { bg: "#eff6ff", color: "#1d4ed8", Icon: Loader,       text: "Generating" },
    PUBLISHED:  { bg: "#f0fdf4", color: "#15803d", Icon: CheckCircle,  text: "Published" },
    ARCHIVED:   { bg: "#f9fafb", color: "#6b7280", Icon: FileText,     text: "Archived" },
  };
  const cfg = map[status];
  if (!cfg) return null;
  const { Icon } = cfg;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={11} /> {cfg.text}
    </span>
  );
};

const AdminPromptQuizManagement = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [quizDetails, setQuizDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", prompt_text: "", num_questions: 10, description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await quizApi.listPromptQuizzes();
      setQuizzes(res.quizzes || []);
    } catch {
      setError("Failed to load prompt quizzes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (quizId) => {
    const next = new Set(expanded);
    if (next.has(quizId)) {
      next.delete(quizId);
    } else {
      next.add(quizId);
      if (!quizDetails[quizId]) {
        setLoadingDetails(p => ({ ...p, [quizId]: true }));
        try {
          const res = await quizApi.getPromptQuiz(quizId);
          setQuizDetails(p => ({ ...p, [quizId]: res }));
        } catch {
          setError("Failed to load quiz questions");
        } finally {
          setLoadingDetails(p => ({ ...p, [quizId]: false }));
        }
      }
    }
    setExpanded(next);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await quizApi.generatePromptQuiz(form);
      setSuccess("Quiz generation started! It will appear as Draft when ready.");
      setShowModal(false);
      setForm({ title: "", prompt_text: "", num_questions: 10, description: "" });
      setTimeout(load, 2500);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to generate");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await quizApi.deletePromptQuiz(deleteConfirm.id);
      setSuccess("Prompt quiz deleted");
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to delete");
      setDeleteConfirm(null);
    }
  };

  const promptLen = form.prompt_text.length;

  return (
    <div>
      {/* Alerts */}
      {error && (
        <div style={{ background: "#fff1f0", border: "1px solid #fca5a5", borderRadius: 12,
          padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#b91c1c", fontSize: 13 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={15} color="#b91c1c" /></button>
        </div>
      )}
      {success && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12,
          padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#15803d", fontSize: 13 }}>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={15} color="#15803d" /></button>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: C.muted }}>
          Generate question banks from any topic — then reference them in course quizzes.
        </p>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 999,
            padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} /> Generate from Prompt
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><LoadingSpinner size="lg" /></div>
      ) : quizzes.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
          padding: "48px 24px", textAlign: "center" }}>
          <Sparkles size={40} color={C.border} style={{ margin: "0 auto 12px" }} />
          <p style={{ color: C.muted, fontSize: 14 }}>No prompt quizzes yet. Generate one above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quizzes.map((quiz) => (
            <div key={quiz.id} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {/* Row */}
              <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 10 }}>
                <button onClick={() => toggleExpand(quiz.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex" }}>
                  {expanded.has(quiz.id) ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{quiz.title}</span>
                  {quiz.prompt_text && (
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                      "{quiz.prompt_text}"
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 12, color: C.muted, marginRight: 4 }}>
                  {quiz.total_questions} Q
                </span>
                <StatusBadge status={quiz.status} />
                <button onClick={() => setDeleteConfirm(quiz)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626",
                    display: "flex", alignItems: "center", marginLeft: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Expanded questions */}
              {expanded.has(quiz.id) && (
                <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`,
                  padding: "10px 18px 10px 48px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {loadingDetails[quiz.id] ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                      <LoadingSpinner size="sm" /><span style={{ fontSize: 13, color: C.muted }}>Loading questions...</span>
                    </div>
                  ) : quizDetails[quiz.id]?.questions?.length > 0 ? (
                    quizDetails[quiz.id].questions.map((q, idx) => (
                      <div key={q.id} style={{ background: "#fff", borderRadius: 10,
                        border: `1px solid ${C.border}`, padding: "10px 14px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                          {idx + 1}. {q.question_text}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {q.options.map((opt) => (
                            <span key={opt.id} style={{
                              fontSize: 12, padding: "3px 10px", borderRadius: 999,
                              background: opt.option_order === q.correct_answer_index ? "#f0fdf4" : "#f5f0ea",
                              color: opt.option_order === q.correct_answer_index ? "#15803d" : C.muted,
                              border: `1px solid ${opt.option_order === q.correct_answer_index ? "#86efac" : C.border}`,
                              fontWeight: opt.option_order === q.correct_answer_index ? 600 : 400,
                            }}>
                              {opt.option_text}
                            </span>
                          ))}
                        </div>
                        {q.explanation && (
                          <p style={{ fontSize: 11, color: C.muted, marginTop: 6, fontStyle: "italic" }}>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No questions yet</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,9,0.55)",
          backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
            padding: "32px 36px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
                Generate from Prompt
              </h2>
              <button onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.orange }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 5 }}>
                  Quiz Title
                </label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Email Security Basics" required disabled={submitting}
                  style={inputBase} onFocus={focusOn} onBlur={focusOff} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 5 }}>
                  Prompt
                  <span style={{ fontWeight: 400, color: C.muted, marginLeft: 6 }}>
                    ({promptLen}/500 chars)
                  </span>
                </label>
                <textarea
                  value={form.prompt_text}
                  onChange={e => setForm({ ...form, prompt_text: e.target.value })}
                  placeholder="e.g., Generate questions about phishing attacks, password hygiene, and two-factor authentication"
                  required disabled={submitting} rows={4} maxLength={500}
                  style={{ ...inputBase, resize: "vertical", minHeight: 90 }}
                  onFocus={focusOn} onBlur={focusOff}
                />
                <p style={{ fontSize: 11, color: promptLen < 20 ? "#dc2626" : C.muted, marginTop: 3 }}>
                  {promptLen < 20 ? `At least 20 characters required (${20 - promptLen} more)` : "Describe the topic or specific concepts to test"}
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 5 }}>
                  Number of Questions
                </label>
                <input type="number" value={form.num_questions}
                  onChange={e => setForm({ ...form, num_questions: parseInt(e.target.value) })}
                  min="1" max="20" required disabled={submitting}
                  style={{ ...inputBase, width: 100 }} onFocus={focusOn} onBlur={focusOff} />
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>1 – 20 questions</span>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 5 }}>
                  Description <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span>
                </label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description" disabled={submitting}
                  style={inputBase} onFocus={focusOn} onBlur={focusOff} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setShowModal(false)} disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: `1.5px solid ${C.border}`,
                    background: "transparent", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || promptLen < 20}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none",
                    background: C.orange, color: "#fff", fontSize: 14, fontWeight: 600,
                    cursor: submitting || promptLen < 20 ? "not-allowed" : "pointer",
                    opacity: submitting || promptLen < 20 ? 0.65 : 1 }}>
                  {submitting ? "Generating..." : "Generate Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Prompt Quiz"
          message={`Delete "${deleteConfirm.title}"? Questions referenced in course quizzes cannot be deleted.`}
          confirmText="Delete" variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

export default AdminPromptQuizManagement;
