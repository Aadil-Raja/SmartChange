// src/pages/admin/training/AdminContentForm.jsx
import { useState, useEffect, useRef } from "react";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { X, Plus, Save, Upload } from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";

// ── Shared styled primitives ───────────────────────────────────────────────────
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

const focusOn  = (e) => { e.target.style.borderColor = "#F58220"; e.target.style.boxShadow = "0 0 0 3px rgba(245,130,32,0.12)"; };
const focusOff = (e) => { e.target.style.borderColor = "#e0d8ce"; e.target.style.boxShadow = "none"; };

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#3d3228" }}>
      {label}{required && <span className="text-[#F58220] ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const AdminContentForm = ({ courseId, editingContent, onClose, onSuccess }) => {
  const { addContent, updateContent, error, clearMessages,
          fetchProcessedDocuments, fetchVideos, fetchExternalLinks } = useAdminTraining();

  const [formData, setFormData] = useState({
    title: "", description: "", type: "document",
    document_id: "", video_id: "", external_link_id: "",
  });
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [availableVideos, setAvailableVideos]       = useState([]);
  const [availableLinks, setAvailableLinks]         = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const hasFetchedResources = useRef(false);

  useEffect(() => {
    if (!hasFetchedResources.current) {
      hasFetchedResources.current = true;
      loadAvailableResources();
    }
    if (editingContent) {
      setFormData({
        title: editingContent.title || "",
        description: editingContent.description || "",
        type: editingContent.type || "document",
        document_id: editingContent.document_id?.toString() || "",
        video_id: editingContent.video_id?.toString() || "",
        external_link_id: editingContent.external_link_id?.toString() || "",
      });
    }
  }, [editingContent]);

  const loadAvailableResources = async () => {
    try { const r = await fetchProcessedDocuments(); if (r.success) setAvailableDocuments(r.data?.documents || []); } catch {}
    try { const r = await fetchVideos();              if (r.success) setAvailableVideos(r.data?.videos || []);       } catch {}
    try { const r = await fetchExternalLinks();       if (r.success) setAvailableLinks(r.data?.links || []);         } catch {}
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courseId) { alert("Course ID is required"); return; }
    setSubmitting(true);
    clearMessages();

    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
    };
    if (!editingContent) submitData.type = formData.type;
    if (formData.type === "document") submitData.document_id = formData.document_id ? parseInt(formData.document_id) : null;
    else if (formData.type === "video") submitData.video_id = formData.video_id ? parseInt(formData.video_id) : null;
    else if (formData.type === "link")  submitData.external_link_id = formData.external_link_id ? parseInt(formData.external_link_id) : null;

    const result = editingContent
      ? await updateContent(editingContent.id, submitData)
      : await addContent(courseId, submitData);

    setSubmitting(false);
    if (result.success) setTimeout(() => onSuccess(), 1000);
  };

  const handleClose = () => { if (!submitting) { clearMessages(); onClose(); } };

  const uploadHintLabel = formData.type === "video" ? "Upload New Video"
    : formData.type === "link" ? "Create New Link"
    : "Upload New Document";

  const uploadHintTarget = formData.type === "document" ? "/admin" : "/admin/training/library";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(26,18,9,0.55)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="bg-white w-full overflow-y-auto"
        style={{
          maxWidth: "520px",
          maxHeight: "90vh",
          borderRadius: "20px",
          boxShadow: "0 24px 64px rgba(26,18,9,0.22)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5" style={{ borderBottom: "1px solid #f0ebe3" }}>
          <h2 className="text-xl font-extrabold" style={{ color: "#1a1209", fontFamily: "Georgia, serif" }}>
            {editingContent ? "Edit Content" : "Add New Content"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: "#f3ede4", color: "#6b5e4e" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#fee2c8"; e.currentTarget.style.color = "#F58220"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f3ede4"; e.currentTarget.style.color = "#6b5e4e"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-7 pt-5">
            <Alert variant="error" onClose={clearMessages}>{error}</Alert>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

          <Field label="Content Title" required>
            <input
              name="title" value={formData.title} onChange={handleChange}
              placeholder="e.g., Introduction to React Hooks"
              required disabled={submitting}
              style={inputBase} onFocus={focusOn} onBlur={focusOff}
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description" value={formData.description} onChange={handleChange}
              placeholder="Describe this content item…"
              rows={3} disabled={submitting}
              style={{ ...inputBase, resize: "vertical", minHeight: "90px" }}
              onFocus={focusOn} onBlur={focusOff}
            />
          </Field>

          {!editingContent && (
            <Field label="Content Type" required>
              <select
                name="type" value={formData.type} onChange={handleChange}
                required disabled={submitting}
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              >
                <option value="document">Document</option>
                <option value="video">Video</option>
                <option value="link">External Link</option>
              </select>
            </Field>
          )}

          {formData.type === "document" && (
            <Field label="Select Document" required>
              <select
                name="document_id" value={formData.document_id} onChange={handleChange}
                required disabled={submitting}
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              >
                <option value="">Select a document…</option>
                {availableDocuments.map(doc => (
                  <option key={doc.id} value={doc.id.toString()}>{doc.title || doc.filename}</option>
                ))}
              </select>
            </Field>
          )}

          {formData.type === "video" && (
            <Field label="Select Video" required>
              <select
                name="video_id" value={formData.video_id} onChange={handleChange}
                required disabled={submitting}
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              >
                <option value="">Select a video…</option>
                {availableVideos.map(v => (
                  <option key={v.id} value={v.id.toString()}>{v.title}</option>
                ))}
              </select>
            </Field>
          )}

          {formData.type === "link" && (
            <Field label="Select External Link" required>
              <select
                name="external_link_id" value={formData.external_link_id} onChange={handleChange}
                required disabled={submitting}
                style={inputBase} onFocus={focusOn} onBlur={focusOff}
              >
                <option value="">Select a link…</option>
                {availableLinks.map(l => (
                  <option key={l.id} value={l.id.toString()}>{l.title} ({l.url})</option>
                ))}
              </select>
            </Field>
          )}

          {/* Upload hint box */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "#fff8f2", border: "1.5px solid #fcd9b8" }}
          >
            <p className="text-sm" style={{ color: "#9c6a3a" }}>Need to add new content?</p>
            <button
              type="button"
              onClick={() => window.open(uploadHintTarget)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ border: "1.5px solid #F58220", color: "#F58220", background: "white" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F58220"; e.currentTarget.style.color = "white"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#F58220"; }}
            >
              <Upload size={12} /> {uploadHintLabel}
            </button>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid #f0ebe3", marginTop: "8px", paddingTop: "20px" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-50"
              style={{ borderColor: "#d0c8be", color: "#6b5e4e", background: "white" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#F58220"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#d0c8be"}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "#F58220" }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "#d96e10"; }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = "#F58220"; }}
            >
              {submitting ? (
                <><LoadingSpinner size="small" />{editingContent ? "Updating…" : "Adding…"}</>
              ) : (
                <>{editingContent ? <Save size={14} /> : <Plus size={14} />}{editingContent ? "Update Content" : "Add Content"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminContentForm;
