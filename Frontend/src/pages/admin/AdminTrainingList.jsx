// src/pages/admin/training/AdminTrainingList.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { useAdminCourses, useAdminInvalidations } from "../../hooks/useAdminQueries";
import { getCourseEnrollmentStats } from "../../services/trainingApi";
import { Plus, Search, Edit, Trash2, Power, PowerOff, ClipboardList, FileText, BookOpen, ArrowUpRight, AlertTriangle } from "lucide-react";
import AdminSidebar from "../../components/ui/AdminSidebar";
import Alert from "../../components/ui/Alert";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { useRef } from "react";
// Emoji pool for courses without thumbnails
const COURSE_EMOJIS = ["📚", "🎯", "💡", "🔬", "🛠️", "📊", "🌐", "🧠", "⚡", "🚀"];
const getEmoji = (id) => COURSE_EMOJIS[id % COURSE_EMOJIS.length];

const AdminTrainingList = () => {
  const navigate = useNavigate();
  const {
    error: ctxError,
    success,
    activateExistingCourse,
    deactivateExistingCourse,
    deleteExistingCourse,
    clearMessages,
  } = useAdminTraining();

  // React Query — courses list with caching
  const { data: courses = [], isLoading: loading, error: queryError } = useAdminCourses();
  const { invalidateCourses } = useAdminInvalidations();
  const error = ctxError || queryError?.message || null;

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteStats, setDeleteStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    return () => clearMessages();
  }, []);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.description &&
        course.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (course.department &&
        course.department.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter =
      filter === "all" ||
      (filter === "published" && course.is_active) ||
      (filter === "draft" && !course.is_active);
    return matchesSearch && matchesFilter;
  });

  const handleToggleStatus = async (course) => {
    if (course.is_active) {
      await deactivateExistingCourse(course.id);
    } else {
      await activateExistingCourse(course.id);
    }
    invalidateCourses(); // refresh cache after toggle
  };

  const handleDeleteCourse = async (courseId) => {
    const result = await deleteExistingCourse(courseId);
    if (result.success) {
      setShowDeleteConfirm(null);
      setDeleteStats(null);
      invalidateCourses();
    }
  };

  const handleRequestDelete = async (course) => {
    setShowDeleteConfirm(course);
    setDeleteStats(null);
    setLoadingStats(true);
    try {
      const res = await getCourseEnrollmentStats(course.id);
      setDeleteStats(res.success ? res.data : null);
    } catch {
      setDeleteStats(null);
    } finally {
      setLoadingStats(false);
    }
  };



  const totalCount = courses.length;
  const activeCount = courses.filter((c) => c.is_active).length;
  const inactiveCount = courses.filter((c) => !c.is_active).length;

  if (loading && courses.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
        <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }






  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 overflow-auto">
        {/* Hero Banner */}
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}
            >
              Training Dashboard
            </h1>
            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
              Manage course catalog and training availability
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <StatPill label="Total" count={totalCount} dotColor="#1a1918" />
            <StatPill label="Published" count={activeCount} dotColor="#4ade80" />
            <StatPill label="Draft" count={inactiveCount} dotColor="#9ca3af" />
          </div>
        </div>

        <div className="px-8 py-6 max-w-7xl mx-auto">
          {/* Alerts */}
          {success && (
            <Alert variant="success" className="mb-5" onClose={clearMessages}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert variant="error" className="mb-5" onClose={clearMessages}>
              {error}
            </Alert>
          )}

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-7">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Segmented Filter */}
              <div
                className="flex rounded-full p-1 gap-1"
                style={{ background: "#e8e0d4" }}
              >
                {["all", "published", "draft"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200"
                    style={
                      filter === f
                        ? { background: "#705536", color: "#faf6ef" }
                        : { color: "#6b5e4e", background: "transparent" }
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => navigate("/admin/quiz")}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600 transition-all"
              >
                <ClipboardList size={15} />
                Quizzes
              </button>
              <button
                onClick={() => navigate("/admin/training/library")}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600 transition-all"
              >
                <FileText size={15} />
                Library
              </button>
              <button
                onClick={() => navigate("/admin/training/create")}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-all"
                style={{ background: "#1a1209" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f7953f")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1209")}
              >
                <Plus size={15} />
                New Course
              </button>
            </div>
          </div>

          {/* Course Grid */}
          {filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
              <BookOpen size={56} className="text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-1">
                {courses.length === 0 ? "No courses yet" : "No courses match your filters"}
              </h3>
              <p className="text-gray-400 text-sm">
                {courses.length === 0
                  ? "Create your first training course to get started"
                  : "Try adjusting your search or filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <CourseCardNew
                  key={course.id}
                  course={course}
                  onNavigate={() => navigate(`/admin/training/course/${course.id}`)}
                  onEdit={() => navigate(`/admin/training/edit/${course.id}`)}
                  onToggle={() => handleToggleStatus(course)}
                  onDelete={() => handleRequestDelete(course)}
                  formatDate={formatDate}
                />
              ))}

              {/* New Course Dashed Card */}
              <button
                onClick={() => navigate("/admin/training/create")}
                className="group rounded-[20px] border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[280px] transition-all duration-200 cursor-pointer"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fff0e8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-200"
                  style={{ background: "#f3ede4" }}
                >
                  <Plus size={22} className="text-gray-500 group-hover:text-orange-500 transition-colors" />
                </div>
                <span className="text-sm font-semibold text-gray-500 group-hover:text-orange-500 transition-colors">
                  New Course
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" style={{ border: '1px solid #f0ebe3' }}>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#1a1209' }}>Delete Course</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  "{showDeleteConfirm.title}"
                </p>
              </div>
            </div>

            {/* Enrollment impact */}
            {loadingStats ? (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-4 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Checking enrollment data…</span>
              </div>
            ) : deleteStats && deleteStats.total > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-700">This will permanently erase employee records</span>
                </div>
                <div className="flex gap-4 mt-1">
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-700">{deleteStats.total}</p>
                    <p className="text-xs text-red-500">enrolled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-600">{deleteStats.in_progress}</p>
                    <p className="text-xs text-amber-500">in progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{deleteStats.completed}</p>
                    <p className="text-xs text-green-500">completed</p>
                  </div>
                </div>
                <p className="text-xs text-red-500 mt-2">
                  All progress, quiz attempts, and completion records will be lost.
                  Consider <span className="font-semibold">unpublishing</span> instead.
                </p>
              </div>
            ) : deleteStats && deleteStats.total === 0 ? (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-4">
                <p className="text-sm text-gray-500">No employees are enrolled — safe to delete.</p>
              </div>
            ) : null}

            <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteCourse(showDeleteConfirm.id)}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete Permanently
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(null); setDeleteStats(null); }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Stat Pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ label, count, dotColor }) => (
  <div
    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
    style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}
  >
    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
    {label}: <span className="font-bold ml-0.5">{count}</span>
  </div>
);

// ── Course Card ────────────────────────────────────────────────────────────────
const CourseCardNew = ({ course, onNavigate, onEdit, onToggle, onDelete, formatDate }) => {
  const [hovered, setHovered] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);

  return (
    <div
      className="rounded-[20px] border border-gray-200 bg-white overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        boxShadow: hovered
          ? "0 12px 32px rgba(26,18,9,0.13)"
          : "0 2px 8px rgba(26,18,9,0.06)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNavigate}
    >
      {/* Cover Area */}
      <div
        className="relative h-44 flex items-center justify-center overflow-hidden"
        style={{ background: "#fff0e8" }}
      >
        {/* Decorative faded circles */}
        <div
          className="absolute -top-6 -left-6 w-24 h-24 rounded-full"
          style={{ background: "rgba(245,130,32,0.08)" }}
        />
        <div
          className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full"
          style={{ background: "rgba(245,130,32,0.06)" }}
        />

        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl select-none z-10">{getEmoji(course.id)}</span>
        )}

        {/* Context menu top-right */}
        <div
          className="absolute top-3 right-3 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <CardMenu
            onEdit={onEdit}
            onToggle={onToggle}
            onDelete={onDelete}
            isActive={course.is_active}
          />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5">
        {/* Status pill */}
        <div className="mb-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={
              course.is_active
                ? { background: "#e6f4f1", color: "#0d9488" }
                : { background: "#fff4e8", color: "#b45309" }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: course.is_active ? "#0d9488" : "#f59e0b" }}
            />
            {course.is_active ? "Published" : "Draft"}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-xl font-bold leading-snug mb-4 line-clamp-2"
          style={{ color: "#1a1209", fontFamily: "Georgia, serif" }}
        >
          {course.title}
        </h3>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(course.created_at)}</span>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: arrowHovered ? "#f7953f" : "#1a1209",
              transform: "rotate(0deg)",
            }}
            onMouseEnter={() => setArrowHovered(true)}
            onMouseLeave={() => setArrowHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            title="View course"
          >
            <ArrowUpRight size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Card Context Menu ──────────────────────────────────────────────────────────
const CardMenu = ({ onEdit, onToggle, onDelete, isActive }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm transition-all"
      >
        <span className="flex flex-col gap-[3px] items-center">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-gray-500" />
          ))}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30">
          {!isActive && <MenuItem onClick={() => { onEdit(); setOpen(false); }} icon={<Edit size={13} />} label="Edit Course" />}
          <MenuItem
            onClick={() => { onToggle(); setOpen(false); }}
            icon={isActive ? <PowerOff size={13} /> : <Power size={13} />}
            label={isActive ? "Unpublish" : "Publish"}
          />
          <hr className="my-1 border-gray-100" />
          <MenuItem
            onClick={() => { onDelete(); setOpen(false); }}
            icon={<Trash2 size={13} />}
            label="Delete"
            danger
          />
        </div>
      )}
    </div>
  );
};

const MenuItem = ({ onClick, icon, label, danger }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${danger ? "text-red-500 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
      }`}
  >
    {icon}
    {label}
  </button>
);

export default AdminTrainingList;
