// src/pages/admin/training/AdminTrainingList.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { Plus, Search, Edit, Trash2, Power, PowerOff, ClipboardList, FileText, BookOpen, ArrowUpRight } from "lucide-react";
import AdminSidebar from "../../components/ui/AdminSidebar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Alert from "../../components/ui/Alert";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

// Emoji pool for courses without thumbnails
const COURSE_EMOJIS = ["📚", "🎯", "💡", "🔬", "🛠️", "📊", "🌐", "🧠", "⚡", "🚀"];
const getEmoji = (id) => COURSE_EMOJIS[id % COURSE_EMOJIS.length];

const AdminTrainingList = () => {
  const navigate = useNavigate();
  const {
    courses,
    loading,
    error,
    success,
    fetchCourses,
    activateExistingCourse,
    deactivateExistingCourse,
    deleteExistingCourse,
    clearMessages,
  } = useAdminTraining();

  const [navCollapsed, setNavCollapsed] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchCourses();
    }
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
      (filter === "active" && course.is_active) ||
      (filter === "inactive" && !course.is_active);
    return matchesSearch && matchesFilter;
  });

  const handleToggleStatus = async (course) => {
    if (course.is_active) {
      await deactivateExistingCourse(course.id);
    } else {
      await activateExistingCourse(course.id);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    const result = await deleteExistingCourse(courseId);
    if (result.success) setShowDeleteConfirm(null);
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
        <div
          className="w-full px-8 py-7 flex items-center justify-between"
          style={{ background: "#1a1209" }}
        >
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: "#faf6ef", fontFamily: "Georgia, serif" }}
          >
            Your Courses
          </h1>
          <div className="flex items-center gap-3">
            <StatPill label="Total" count={totalCount} dotColor="#faf6ef" />
            <StatPill label="Active" count={activeCount} dotColor="#4ade80" />
            <StatPill label="Inactive" count={inactiveCount} dotColor="#9ca3af" />
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
                {["all", "active", "inactive"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200"
                    style={
                      filter === f
                        ? { background: "#1a1209", color: "#faf6ef" }
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
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F58220")}
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
                  onDelete={() => setShowDeleteConfirm(course)}
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
        <ConfirmDialog
          title="Delete Course"
          message={`Are you sure you want to delete "${showDeleteConfirm.title}"? This action cannot be undone.`}
          confirmText="Delete Course"
          cancelText="Cancel"
          onConfirm={() => handleDeleteCourse(showDeleteConfirm.id)}
          onCancel={() => setShowDeleteConfirm(null)}
          variant="danger"
        />
      )}
    </div>
  );
};

// ── Stat Pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ label, count, dotColor }) => (
  <div
    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
    style={{ background: "rgba(255,255,255,0.08)", color: "#faf6ef" }}
  >
    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
    {label}: {count}
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
                : { background: "#f0ede8", color: "#78716c" }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: course.is_active ? "#0d9488" : "#9ca3af" }}
            />
            {course.is_active ? "Active" : "Inactive"}
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
              background: arrowHovered ? "#F58220" : "#1a1209",
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
          <MenuItem onClick={() => { onEdit(); setOpen(false); }} icon={<Edit size={13} />} label="Edit Course" />
          <MenuItem
            onClick={() => { onToggle(); setOpen(false); }}
            icon={isActive ? <PowerOff size={13} /> : <Power size={13} />}
            label={isActive ? "Deactivate" : "Activate"}
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
    className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
      danger ? "text-red-500 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
    }`}
  >
    {icon}
    {label}
  </button>
);

export default AdminTrainingList;
