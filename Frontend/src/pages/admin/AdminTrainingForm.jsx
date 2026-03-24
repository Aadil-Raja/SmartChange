// src/pages/admin/training/AdminTrainingForm.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { ArrowLeft, Plus, Save } from "lucide-react";
import AdminSidebar from "../../components/ui/AdminSidebar";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";

const AdminTrainingForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const {
    currentCourse, loading, error, success,
    createNewCourse, updateExistingCourse, fetchCourseDetails, clearMessages,
  } = useAdminTraining();

  const [formData, setFormData] = useState({ title: "", description: "", department: "" });
  const [submitting, setSubmitting] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const hasFetchedCourse = useRef(false);

  useEffect(() => {
    if (isEditMode && id && !hasFetchedCourse.current) {
      fetchCourseDetails(id);
      hasFetchedCourse.current = true;
    }
    return () => clearMessages();
  }, [id, isEditMode]);

  useEffect(() => {
    if (isEditMode && currentCourse) {
      setFormData({
        title: currentCourse.title || "",
        description: currentCourse.description || "",
        department: currentCourse.department || "",
      });
    }
  }, [currentCourse, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    clearMessages();
    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      department: formData.department.trim() || undefined,
    };
    const result = isEditMode
      ? await updateExistingCourse(id, submitData)
      : await createNewCourse(submitData);
    setSubmitting(false);
    if (result.success) {
      setTimeout(() => navigate(isEditMode ? `/admin/training/course/${id}` : "/admin/training"), 1500);
    }
  };

  if (loading && isEditMode && !currentCourse) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
        <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="large" /></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">

          {/* Back link */}
          <button
            onClick={() => navigate("/admin/training")}
            className="flex items-center gap-1.5 text-sm font-medium mb-8 transition-colors"
            style={{ color: "#9c8e80" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f7953f"}
            onMouseLeave={e => e.currentTarget.style.color = "#9c8e80"}
          >
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border" style={{ borderColor: "#e0d8ce", background: "white" }}>
              <ArrowLeft size={13} /> Back
            </span>
          </button>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold leading-tight" style={{ color: "#1a1209", fontFamily: "Georgia, serif" }}>
              {isEditMode ? "Edit Course" : "Create New Course"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#9c8e80" }}>
              {isEditMode ? "Update course information below" : "Fill in the details to create a new training course"}
            </p>
          </div>

          {/* Alerts */}
          {success && <Alert variant="success" className="mb-5" onClose={clearMessages}>{success}</Alert>}
          {error   && <Alert variant="error"   className="mb-5" onClose={clearMessages}>{error}</Alert>}

          {/* Form card */}
          <div className="bg-white rounded-[20px] border p-8" style={{ borderColor: "#e8e0d4", boxShadow: "0 2px 16px rgba(26,18,9,0.07)" }}>
            <form onSubmit={handleSubmit} className="space-y-6">

              <FormField label="Course Title" required>
                <StyledInput
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Introduction to React"
                  required
                  disabled={submitting}
                />
              </FormField>

              <FormField label="Description">
                <StyledTextarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe what this course covers..."
                  disabled={submitting}
                />
              </FormField>

              <FormField label="Department" hint="Optional">
                <StyledInput
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Engineering, Marketing"
                  disabled={submitting}
                />
              </FormField>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/admin/training")}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-50"
                  style={{ borderColor: "#d0c8be", color: "#6b5e4e", background: "white" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#f7953f"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#d0c8be"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: "#f7953f" }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "#d96e10"; }}
                  onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = "#f7953f"; }}
                >
                  {submitting ? (
                    <><LoadingSpinner size="small" />{isEditMode ? "Updating…" : "Creating…"}</>
                  ) : (
                    <>{isEditMode ? <Save size={15} /> : <Plus size={15} />}{isEditMode ? "Update Course" : "Create Course"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Shared field primitives ────────────────────────────────────────────────────
const FormField = ({ label, hint, required, children }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#3d3228" }}>
      {label}
      {required && <span className="text-[#f7953f] ml-0.5">*</span>}
      {hint && <span className="ml-2 text-xs font-normal" style={{ color: "#9c8e80" }}>{hint}</span>}
    </label>
    {children}
  </div>
);

const inputBase = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1.5px solid #e0d8ce",
  background: "white",
  fontSize: "14px",
  color: "#1a1209",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const StyledInput = (props) => (
  <input
    {...props}
    style={inputBase}
    onFocus={e => { e.target.style.borderColor = "#f7953f"; e.target.style.boxShadow = "0 0 0 3px rgba(245,130,32,0.12)"; }}
    onBlur={e => { e.target.style.borderColor = "#e0d8ce"; e.target.style.boxShadow = "none"; }}
  />
);

const StyledTextarea = (props) => (
  <textarea
    {...props}
    rows={5}
    style={{ ...inputBase, resize: "vertical", minHeight: "120px" }}
    onFocus={e => { e.target.style.borderColor = "#f7953f"; e.target.style.boxShadow = "0 0 0 3px rgba(245,130,32,0.12)"; }}
    onBlur={e => { e.target.style.borderColor = "#e0d8ce"; e.target.style.boxShadow = "none"; }}
  />
);

export default AdminTrainingForm;
