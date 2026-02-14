// src/components/announcements/CreateAnnouncementModal.jsx
import { useState } from "react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { X, Send, Sparkles, Type, MessageSquare, BookOpen } from "lucide-react";
import Button from "../ui/Button";
import Input2 from "../ui/Input2";
import TextArea2 from "../ui/TextArea2";
import LoadingSpinner from "../ui/LoadingSpinner";
import Alert from "../ui/Alert";

const CreateAnnouncementModal = ({ teamId, onClose, onSuccess, courses = [] }) => {
  const { createNewAnnouncement, loading, error, clearMessages } = useAnnouncements();

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    related_course_id: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user starts typing
    if (validationError) setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Frontend validation
    const trimmedTitle = formData.title.trim();
    const trimmedBody = formData.body.trim();

    if (!trimmedTitle && !trimmedBody) {
      setValidationError('Please enter both a title and message before publishing');
      return;
    }
    
    if (!trimmedTitle) {
      setValidationError('Please enter a title for your announcement');
      return;
    }

    if (!trimmedBody) {
      setValidationError('Please enter a message for your announcement');
      return;
    }

    setSubmitting(true);
    setValidationError('');
    clearMessages();

    const result = await createNewAnnouncement(teamId, {
      title: trimmedTitle,
      body: trimmedBody,
      related_course_id: formData.related_course_id || null,
    });

    setSubmitting(false);

    if (result.success) {
      setTimeout(() => {
        onSuccess();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#FDB913] to-[#F58220] rounded-lg">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#333333]">Create Announcement</h2>
              <p className="text-gray-600 text-sm mt-1">Share important updates with your team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-[#F58220] hover:bg-gray-100 rounded-lg transition-colors"
            disabled={submitting}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Alerts */}
        {(error || validationError) && (
          <div className="p-6 pb-0">
            {validationError && (
              <Alert variant="error" onClose={() => setValidationError('')}>
                {validationError}
              </Alert>
            )}
            {error && (
              <Alert variant="error" onClose={clearMessages}>
                {error}
              </Alert>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Title */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#333333] mb-2">
              <Type size={18} className="text-[#F58220]" />
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
            <label className="flex items-center gap-2 text-sm font-semibold text-[#333333] mb-2">
              <MessageSquare size={18} className="text-[#F58220]" />
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

          {/* Related Course (Optional) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#333333] mb-2">
              <BookOpen size={18} className="text-[#F58220]" />
              Related Course (Optional)
            </label>
            <select
              name="related_course_id"
              value={formData.related_course_id}
              onChange={handleChange}
              disabled={submitting}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:border-transparent bg-white text-gray-900"
            >
              <option value="">None - General announcement</option>
              {Array.isArray(courses) && courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Link this announcement to a specific course</p>
          </div>

          {/* Preview Box */}
          {formData.title && formData.body && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-[#F58220] mb-2 flex items-center gap-1">
                <Sparkles size={14} />
                PREVIEW
              </p>
              <h3 className="font-bold text-[#333333] mb-2">{formData.title}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{formData.body}</p>
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            type="button"
            variant="primary"
            disabled={submitting || !formData.title.trim() || !formData.body.trim()}
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