// src/components/announcements/CreateAnnouncementModal.jsx
import { useState } from "react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { X, Send, Sparkles, Type, MessageSquare } from "lucide-react";
import Button from "../ui/Button";
import Input2 from "../ui/Input2";
import TextArea2 from "../ui/TextArea2";
import LoadingSpinner from "../ui/LoadingSpinner";
import Alert from "../ui/Alert";

const CreateAnnouncementModal = ({ teamId, onClose, onSuccess }) => {
  const { createNewAnnouncement, loading, error, clearMessages } = useAnnouncements();

  const [formData, setFormData] = useState({
    title: "",
    body: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    clearMessages();

    const result = await createNewAnnouncement(teamId, {
      title: formData.title.trim(),
      body: formData.body.trim(),
    });

    setSubmitting(false);

    if (result.success) {
      setTimeout(() => {
        onSuccess();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-yellow-300 to-yellow-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Create Announcement</h2>
                <p className="text-white/80 text-sm mt-1">Share important updates with your team</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              disabled={submitting}
            >
              <X size={24} />
            </button>
          </div>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Title */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Type size={18} className="text-yellow-600" />
              Announcement Title
              <span className="text-red-500">*</span>
            </label>
            <Input2
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Weekly Team Update, New Project Launch..."
              required
              disabled={submitting}
              className="text-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Make it clear and attention-grabbing</p>
          </div>

          {/* Body */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <MessageSquare size={18} className="text-yellow-600" />
              Message
              <span className="text-red-500">*</span>
            </label>
            <TextArea2
              name="body"
              value={formData.body}
              onChange={handleChange}
              placeholder="Write your announcement here. Share updates, recognition, reminders, or any important information..."
              rows={10}
              required
              disabled={submitting}
              className="resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">Be clear and concise</p>
              <p className="text-xs text-gray-400">{formData.body.length} characters</p>
            </div>
          </div>

          {/* Preview Box */}
          {formData.title && formData.body && (
            <div className="bg-gradient-to-br from-yellow-50 to-purple-50 rounded-xl p-4 border-2 border-yellow-200">
              <p className="text-xs font-semibold text-yellow-600 mb-2 flex items-center gap-1">
                <Sparkles size={14} />
                PREVIEW
              </p>
              <h3 className="font-bold text-gray-900 mb-2">{formData.title}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{formData.body}</p>
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
                       type="button"
            variant="outline"
            disabled={submitting}
            className="px-6"
          >
            {submitting ? (
              <>
                <LoadingSpinner size="small" />
                <span className="ml-2">Publishing...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span className="ml-2 font-semibold">Publish Announcement</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateAnnouncementModal;