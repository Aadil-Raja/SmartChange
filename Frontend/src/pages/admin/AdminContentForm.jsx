// src/pages/admin/training/AdminContentForm.jsx
import { useState, useEffect } from "react";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { X, Save } from "lucide-react";
import Button from "../../components/ui/Button";
import Input2 from "../../components/ui/Input2";
import TextArea2 from "../../components/ui/TextArea2";
import Select2 from "../../components/ui/Select2";  // CHANGE TO Select2
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";

const AdminContentForm = ({ courseId, editingContent, onClose, onSuccess }) => {
  const { addContent, updateContent, loading, error, clearMessages } = useAdminTraining();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "document",
    document_id: "",
    storage_url: "",
    external_url: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Populate form if editing
  useEffect(() => {
    if (editingContent) {
      setFormData({
        title: editingContent.title || "",
        description: editingContent.description || "",
        type: editingContent.type || "document",
        document_id: editingContent.document_id?.toString() || "",
        storage_url: editingContent.storage_url || "",
        external_url: editingContent.external_url || "",
      });
    }
  }, [editingContent]);

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
      submitData.storage_url = formData.storage_url.trim() || null;
    } else if (formData.type === "link") {
      submitData.external_url = formData.external_url.trim() || null;
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
            <Input2
              label="Document ID"
              name="document_id"
              type="number"
              value={formData.document_id}
              onChange={handleChange}
              placeholder="Enter document ID"
              required
              disabled={submitting}
              helpText="The ID of the uploaded document"
            />
          )}

          {formData.type === "video" && (
            <Input2
              label="Video URL"
              name="storage_url"
              type="url"
              value={formData.storage_url}
              onChange={handleChange}
              placeholder="https://example.com/video.mp4"
              required
              disabled={submitting}
              helpText="URL to the video file"
            />
          )}

          {formData.type === "link" && (
            <Input2
              label="External URL"
              name="external_url"
              type="url"
              value={formData.external_url}
              onChange={handleChange}
              placeholder="https://example.com"
              required
              disabled={submitting}
              helpText="External link or resource URL"
            />
          )}

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