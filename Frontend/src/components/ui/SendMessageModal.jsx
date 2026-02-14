import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { sendDirectMessage } from '../../services/managerNotificationApi';
import Button from './Button';
import Input from './Input';

const SendMessageModal = ({ isOpen, onClose, teamId, recipient, courses = [] }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [relatedCourseId, setRelatedCourseId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const result = await sendDirectMessage(
        teamId,
        recipient.user_id,
        title,
        message,
        relatedCourseId || null
      );

      if (result.success) {
        // Reset form
        setTitle('');
        setMessage('');
        setRelatedCourseId('');
        onClose();
        alert('Message sent successfully!');
      } else {
        setError(result.message || 'Failed to send message');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Send Message</h2>
            <p className="text-sm text-gray-600 mt-1">
              To: {recipient?.user_name || 'Team Member'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Please complete training"
              required
              maxLength={255}
              disabled={sending}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              required
              maxLength={1000}
              disabled={sending}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length}/1000 characters
            </p>
          </div>

          {/* Related Course (Optional) */}
          {courses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Course (Optional)
              </label>
              <select
                value={relatedCourseId}
                onChange={(e) => setRelatedCourseId(e.target.value)}
                disabled={sending}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">None</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={sending || !title.trim() || !message.trim()}
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendMessageModal;
