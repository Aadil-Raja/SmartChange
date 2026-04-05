// src/pages/admin/AdminQuizManagement.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  FileText,
  BookOpen,
  Trash2,
  Search,
  CheckCircle,
  Clock,
  Loader,
  ChevronDown,
  ChevronRight,
  X
} from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AdminSidebar from "../../components/ui/AdminSidebar";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import * as quizApi from "../../services/quizApi";
import AdminPromptQuizManagement from "./AdminPromptQuizManagement";

const C = {
  bg: "#faf6ef",
  ink: "#1a1209",
 orange: '#f7953f',
  teal: "#0d9488",
  muted: "#9c8e80",
  border: "#e8e0d5",
  card: "#ffffff",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: C.ink,
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const focusStyle = {
  borderColor: C.orange,
  boxShadow: "0 0 0 3px rgba(245,130,32,0.12)",
};

function FocusInput({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...(focused ? focusStyle : {}), ...style }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

const AdminQuizManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProcessedDocuments, fetchCourses, courses, loading: coursesLoading, clearMessages } = useAdminTraining();

  const [documents, setDocuments] = useState([]);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "document";
  });

  const [quizzes, setQuizzes] = useState({});
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  const [loadingQuizzes, setLoadingQuizzes] = useState({});

  const [courseQuizzes, setCourseQuizzes] = useState({});
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [loadingCourseQuizzes, setLoadingCourseQuizzes] = useState({});
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [docQuizCounts, setDocQuizCounts] = useState({});
  const [courseQuizCounts, setCourseQuizCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [generateForm, setGenerateForm] = useState({ title: "", description: "", num_questions: 10 });
  const [submitting, setSubmitting] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      Promise.all([loadDocuments(), fetchCourses()]);
    }
    return () => clearMessages();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const result = await fetchProcessedDocuments();
      if (result.success) {
        const docs = result.data?.documents || [];
        const processed = docs.filter((d) => d.status === "PROCESSED");
        setDocuments(processed);
        // Pre-fetch quiz counts for all documents
        processed.forEach((doc) => {
          quizApi.getQuizzesByDocument(doc.id)
            .then((response) => {
              const list = response.quizzes || [];
              setDocQuizCounts((p) => ({ ...p, [doc.id]: response.total ?? list.length }));
            })
            .catch(() => {});
        });
      }
    } catch {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzesForDocument = async (documentId, forceReload = false) => {
    if (quizzes[documentId] && !forceReload) return;
    setLoadingQuizzes((p) => ({ ...p, [documentId]: true }));
    try {
      const response = await quizApi.getQuizzesByDocument(documentId);
      const list = response.quizzes || [];
      setQuizzes((p) => ({ ...p, [documentId]: list }));
      setDocQuizCounts((p) => ({ ...p, [documentId]: response.total ?? list.length }));
    } catch {
      setQuizzes((p) => ({ ...p, [documentId]: [] }));
    } finally {
      setLoadingQuizzes((p) => ({ ...p, [documentId]: false }));
    }
  };

  const toggleDocumentExpand = (documentId) => {
    const next = new Set(expandedDocs);
    if (next.has(documentId)) { next.delete(documentId); } else { next.add(documentId); loadQuizzesForDocument(documentId); }
    setExpandedDocs(next);
  };

  const loadQuizzesForCourse = async (courseId, forceReload = false) => {
    if (courseQuizzes[courseId] && !forceReload) return;
    setLoadingCourseQuizzes((p) => ({ ...p, [courseId]: true }));
    try {
      const response = await quizApi.listCourseQuizzes(courseId);
      const list = response.quizzes || [];
      setCourseQuizzes((p) => ({ ...p, [courseId]: list }));
      setCourseQuizCounts((p) => ({ ...p, [courseId]: response.total ?? list.length }));
    } catch {
      setCourseQuizzes((p) => ({ ...p, [courseId]: [] }));
    } finally {
      setLoadingCourseQuizzes((p) => ({ ...p, [courseId]: false }));
    }
  };

  const toggleCourseExpand = (courseId) => {
    const next = new Set(expandedCourses);
    if (next.has(courseId)) { next.delete(courseId); } else { next.add(courseId); loadQuizzesForCourse(courseId); }
    setExpandedCourses(next);
  };

  const handleGenerateQuiz = (doc) => {
    setSelectedDocument(doc);
    setSelectedCourse(null);
    setGenerateForm({ title: `${doc.title} - Quiz`, description: "", num_questions: 10 });
    setShowGenerateModal(true);
  };

  const handleCreateCourseQuiz = (course) => {
    setSelectedCourse(course);
    setSelectedDocument(null);
    setGenerateForm({ title: `${course.title} - Quiz`, description: "", num_questions: 10 });
    setShowGenerateModal(true);
  };

  const submitGenerateQuiz = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (activeTab === "document" && selectedDocument) {
        const response = await quizApi.generateQuiz(selectedDocument.id, generateForm);
        setSuccess(`Quiz generation started! Quiz ID: ${response.quiz_id}`);
        setShowGenerateModal(false);
        setTimeout(() => { loadQuizzesForDocument(selectedDocument.id, true); }, 2000);
      } else if (activeTab === "course" && selectedCourse) {
        await quizApi.createCourseQuiz(selectedCourse.id, { title: generateForm.title, description: generateForm.description });
        setSuccess("Course quiz created successfully!");
        setShowGenerateModal(false);
        loadQuizzesForCourse(selectedCourse.id, true);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to generate quiz";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuiz = async (quizId, documentId = null, courseId = null) => {
    try {
      if (documentId) { await quizApi.deleteQuiz(quizId); loadQuizzesForDocument(documentId, true); }
      else if (courseId) { await quizApi.deleteCourseQuiz(quizId); loadQuizzesForCourse(courseId, true); }
      setSuccess("Quiz deleted successfully");
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to delete quiz");
      setDeleteConfirm(null);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      GENERATING: { bg: "#eff6ff", color: "#1d4ed8", icon: Loader, text: "Generating" },
      DRAFT: { bg: "#fffbeb", color: "#b45309", icon: Clock, text: "Draft" },
      PUBLISHED: { bg: "#f0fdf4", color: "#15803d", icon: CheckCircle, text: "Published" },
      ARCHIVED: { bg: "#f9fafb", color: "#6b7280", icon: FileText, text: "Archived" },
    };
    const cfg = map[status] || map.DRAFT;
    const Icon = cfg.icon;
    return (
      <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Icon size={11} /> {cfg.text}
      </span>
    );
  };

  const filteredDocuments = documents.filter((d) => d.title?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCourses = (courses || []).filter((c) => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));
  const isInitialPageLoading = (loading || coursesLoading) && documents.length === 0 && (courses || []).length === 0;

  if (isInitialPageLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner size="large" text="Loading quiz management..." />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, overflow: "hidden" }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Page Header */}
       <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF',borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 700, color: "#3D2C1C", margin: 0 }}>Quiz Management</h1>
            <p style={{ color: "#b8a898", fontSize: 13, marginTop: 4 }}>Generate and manage quizzes from documents and courses</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {[
              { label: "Documents",     value: documents.length,                                          dot: "#faf6ef" },
              { label: "Doc Quizzes",   value: Object.values(docQuizCounts).reduce((a, b) => a + b, 0),  dot: "#4ade80" },
              { label: "Courses",       value: (courses || []).length,                                    dot: "#c084fc" },
              { label: "Course Quizzes",value: Object.values(courseQuizCounts).reduce((a, b) => a + b, 0),dot: "#fc801b" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, background: "#e8e0d4", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#3D2C1C" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                {s.label}: {s.value}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "28px 36px" }}>

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

          {/* Tab Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["document", "course", "prompt"].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
                style={{
                  padding: "8px 22px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  background: activeTab === tab ? C.orange : "transparent",
                  color: activeTab === tab ? "#fff" : C.muted,
                  border: activeTab === tab ? `1.5px solid ${C.orange}` : `1.5px solid ${C.border}`,
                }}
              >
                {tab === "document" ? "Document Quizzes" : tab === "course" ? "Course Quizzes" : "Prompt Quizzes"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
            <FocusInput
              type="text"
              placeholder={activeTab === "document" ? "Search documents..." : "Search courses..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 44, borderRadius: 999, fontSize: 14 }}
            />
          </div>

          {/* Document Tab */}
          {activeTab === "document" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loading && documents.length === 0 ? (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
                  <LoadingSpinner size="small" text="Loading documents..." />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
                  <FileText size={40} color={C.border} style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: C.muted, fontSize: 14 }}>No processed documents found</p>
                </div>
              ) : filteredDocuments.map((doc) => (
                <div key={doc.id} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 12 }}>
                    <button
                      onClick={() => toggleDocumentExpand(doc.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.muted, display: "flex", alignItems: "center" }}
                    >
                      {expandedDocs.has(doc.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: C.ink }}>
                      <span
                        onClick={() => doc.cloudinary_url && window.open(doc.cloudinary_url, '_blank')}
                        style={{ cursor: doc.cloudinary_url ? "pointer" : "default" }}
                        onMouseEnter={e => { if (doc.cloudinary_url) e.currentTarget.style.color = C.orange; }}
                        onMouseLeave={e => { e.currentTarget.style.color = C.ink; }}
                      >
                        {doc.title}
                      </span>
                      {docQuizCounts[doc.id] > 0 && (
                        <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: C.orange, background: "#fff7ed", padding: "2px 8px", borderRadius: 999 }}>
                          {docQuizCounts[doc.id]} {docQuizCounts[doc.id] === 1 ? "quiz" : "quizzes"}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleGenerateQuiz(doc)}
                      style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 999, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Plus size={14} /> Generate Quiz
                    </button>
                  </div>
                  {expandedDocs.has(doc.id) && (
                    <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "12px 20px 12px 52px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {loadingQuizzes[doc.id] ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                          
                        </div>
                      ) : quizzes[doc.id]?.length > 0 ? quizzes[doc.id].map((quiz) => (
                        <div key={quiz.id} style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 16px", gap: 12 }}>
                          <span
                            style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink, cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.color = C.orange}
                            onMouseLeave={e => e.currentTarget.style.color = C.ink}
                            onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                          >{quiz.title}</span>
                          {getStatusBadge(quiz.status || "DRAFT")}
                          <button
                            onClick={() => setDeleteConfirm({ quizId: quiz.id, documentId: doc.id })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )) : (
                        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No quizzes generated yet</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Course Tab */}
          {activeTab === "course" && (            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {coursesLoading && !courses?.length ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><LoadingSpinner size="large" text="Loading courses..." /></div>
              ) : filteredCourses.length === 0 ? (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
                  <BookOpen size={40} color={C.border} style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: C.muted, fontSize: 14 }}>No courses found</p>
                </div>
              ) : filteredCourses.map((course) => (
                <div key={course.id} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 12 }}>
                    <button
                      onClick={() => toggleCourseExpand(course.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.muted, display: "flex", alignItems: "center" }}
                    >
                      {expandedCourses.has(course.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: C.ink }}>
                      <span
                        onClick={() => navigate(`/admin/training/course/${course.id}`)}
                        style={{ cursor: "pointer", color: C.ink, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.color = C.orange}
                        onMouseLeave={e => e.currentTarget.style.color = C.ink}
                      >
                        {course.title}
                      </span>
                      {courseQuizCounts[course.id] > 0 && (
                        <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: C.orange, background: "#fff7ed", padding: "2px 8px", borderRadius: 999 }}>
                          {courseQuizCounts[course.id]} {courseQuizCounts[course.id] === 1 ? "quiz" : "quizzes"}
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                      background: course.is_active ? "#f0fdf4" : "#f9fafb",
                      color: course.is_active ? "#15803d" : "#6b7280",
                      marginRight: 8
                    }}>
                      {course.is_active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => handleCreateCourseQuiz(course)}
                      style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 999, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Plus size={14} /> Create Quiz
                    </button>
                  </div>
                  {expandedCourses.has(course.id) && (
                    <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "12px 20px 12px 52px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {loadingCourseQuizzes[course.id] ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                        
                        </div>
                      ) : courseQuizzes[course.id]?.length > 0 ? courseQuizzes[course.id].map((quiz) => (
                        <div key={quiz.id} style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 16px", gap: 12 }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink }}>{quiz.title}</span>
                          {getStatusBadge(quiz.status || "DRAFT")}
                          <button
                            onClick={() => navigate(`/admin/quiz/${quiz.id}?type=course`)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", fontSize: 13, fontWeight: 600 }}
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ quizId: quiz.id, courseId: course.id })}
                            disabled={quiz.status === "PUBLISHED"}
                            style={{ background: "none", border: "none", cursor: quiz.status === "PUBLISHED" ? "not-allowed" : "pointer", color: quiz.status === "PUBLISHED" ? C.border : "#dc2626", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )) : (
                        <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>No quizzes created yet</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prompt Quizzes Tab */}
          {activeTab === "prompt" && <AdminPromptQuizManagement />}
        </div>
      </div>

      {/* Generate / Create Quiz Modal */}
      {showGenerateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,9,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, padding: "32px 36px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
                {activeTab === "document" ? "Generate Quiz" : "Create Course Quiz"}
              </h2>
              <button onClick={() => setShowGenerateModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.orange }}><X size={20} /></button>
            </div>
            <form onSubmit={submitGenerateQuiz} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Quiz Title</label>
                <FocusInput
                  type="text"
                  value={generateForm.title}
                  onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
                  required
                  disabled={submitting}
                  placeholder="Enter quiz title"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Description (Optional)</label>
                <FocusInput
                  type="text"
                  value={generateForm.description}
                  onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
                  disabled={submitting}
                  placeholder="Brief description"
                />
              </div>
              {activeTab === "document" && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 6 }}>Number of Questions</label>
                  <FocusInput
                    type="number"
                    value={generateForm.num_questions}
                    onChange={(e) => setGenerateForm({ ...generateForm, num_questions: parseInt(e.target.value) })}
                    min="5" max="20" required disabled={submitting}
                  />
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Choose between 5 and 20 questions</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: C.orange, color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Processing..." : activeTab === "document" ? "Generate Quiz" : "Create Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => { if (deleteConfirm?.quizId) handleDeleteQuiz(deleteConfirm.quizId, deleteConfirm.documentId, deleteConfirm.courseId); }}
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
