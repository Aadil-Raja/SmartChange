// src/pages/admin/training/AdminContentForm.jsx
import { useState, useEffect } from "react";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { X, Save } from "lucide-react";
import Button from "../../components/ui/Button";
import Input2 from "../../components/ui/Input2";
import TextArea2 from "../../components/ui/TextArea2";
import Select2 from "../../components/ui/Select2";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";

const AdminContentForm = ({ courseId, editingContent, onClose, onSuccess }) => {
  const { addContent, updateContent, loading, error, clearMessages } = useAdminTraining();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "document",
    document_id: "",
    video_id: "",
    external_link_id: "",
  });

  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [availableLinks, setAvailableLinks] = useState([]);

  const [submitting, setSubmitting] = useState(false);

  // Load available resources and populate form if editing
  useEffect(() => {
    loadAvailableResources();

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

  const {
    fetchProcessedDocuments,
    fetchVideos,
    fetchExternalLinks
  } = useAdminTraining();

  const loadAvailableResources = async () => {
    try {
      const docsResult = await fetchProcessedDocuments();
      if (docsResult.success) {
        setAvailableDocuments(docsResult.data?.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }

    try {
      const videosResult = await fetchVideos();
      if (videosResult.success) {
        setAvailableVideos(videosResult.data?.videos || []);
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
    }

    try {
      const linksResult = await fetchExternalLinks();
      if (linksResult.success) {
        setAvailableLinks(linksResult.data?.links || []);
      }
    } catch (err) {
      console.error('Failed to load links:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ADD THIS CHECK
    if (!courseId) {
      console.error('courseId is missing!');
      alert('Course ID is required');
      return;
    }

    setSubmitting(true);
    clearMessages();

    // Prepare data based on content type
    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
    };

    // Add type-specific fields
    if (!editingContent) {
      submitData.type = formData.type;
    }

    if (formData.type === "document") {
      submitData.document_id = formData.document_id ? parseInt(formData.document_id) : null;
    } else if (formData.type === "video") {
      submitData.video_id = formData.video_id ? parseInt(formData.video_id) : null;
    } else if (formData.type === "link") {
      submitData.external_link_id = formData.external_link_id ? parseInt(formData.external_link_id) : null;
    }

    console.log('Submitting to courseId:', courseId); // DEBUG
    console.log('Submit data:', submitData); // DEBUG

    let result;
    if (editingContent) {
      result = await updateContent(editingContent.id, submitData);
    } else {
      result = await addContent(courseId, submitData);
    }

    setSubmitting(false);

    if (result.success) {
      setTimeout(() => {
        onSuccess();
      }, 1000);
    }
  };

  // ADD THIS HANDLER
  const handleClose = () => {
    if (!submitting) {
      clearMessages();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingContent ? "Edit Content" : "Add New Content"}
          </h2>
          <button
            type="button"  // ADD THIS
            onClick={handleClose}  // CHANGE THIS
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={submitting}
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-6 pb-0">
            <Alert variant="error" onClose={clearMessages}>
              {error}
            </Alert>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <Input2
            label="Content Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Introduction to React Hooks"
            required
            disabled={submitting}
          />

          {/* Description */}
          <TextArea2
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe this content item..."
            rows={3}
            disabled={submitting}
          />

          {/* Content Type (only for new content) */}
          {!editingContent && (
            <Select2
              label="Content Type"
              name="type"  // ADD THIS - CRITICAL!
              value={formData.type}
              onChange={handleChange}
              required
              disabled={submitting}
              options={[
                { label: "Document", value: "document" },
                { label: "Video", value: "video" },
                { label: "External Link", value: "link" }
              ]}
            />
          )}

          {/* Type-specific fields */}
          {formData.type === "document" && (
            <Select2
              label="Select Document"
              name="document_id"
              value={formData.document_id}
              onChange={handleChange}
              required
              disabled={submitting}
              options={[
                { label: "Select a document...", value: "" },
                ...availableDocuments.map(doc => ({
                  label: doc.title || doc.filename,
                  value: doc.id.toString()
                }))
              ]}
              helpText="Choose from uploaded and processed documents"
            />
          )}

          {formData.type === "video" && (
            <Select2
              label="Select Video"
              name="video_id"
              value={formData.video_id}
              onChange={handleChange}
              required
              disabled={submitting}
              options={[
                { label: "Select a video...", value: "" },
                ...availableVideos.map(video => ({
                  label: video.title,
                  value: video.id.toString()
                }))
              ]}
              helpText="Choose from uploaded videos"
            />
          )}

          {formData.type === "link" && (
            <Select2
              label="Select External Link"
              name="external_link_id"
              value={formData.external_link_id}
              onChange={handleChange}
              required
              disabled={submitting}
              options={[
                { label: "Select a link...", value: "" },
                ...availableLinks.map(link => ({
                  label: `${link.title} (${link.url})`,
                  value: link.id.toString()
                }))
              ]}
              helpText="Choose from created external links"
            />
          )}

          {/* Quick Actions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-3">Need to add new content?</p>
            <div className="flex gap-2">
              {formData.type === "video" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/admin/training/library', '_blank')}
                >
                  Upload New Video
                </Button>
              )}
              {formData.type === "link" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/admin/training/library', '_blank')}
                >
                  Create New Link
                </Button>
              )}
              {formData.type === "document" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/admin')}
                >
                  Upload New Document
                </Button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}  // CHANGE THIS
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="small" />
                  {editingContent ? "Updating..." : "Adding..."}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {editingContent ? "Update Content" : "Add Content"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminContentForm;