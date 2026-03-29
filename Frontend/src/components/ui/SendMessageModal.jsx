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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg mx-4 rounded-[24px] overflow-hidden border"
        style={{ background: '#fffdf8', borderColor: '#e8e0d4', boxShadow: '0 22px 56px rgba(26,18,9,0.28)' }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between p-6 border-b"
          style={{ background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)', borderColor: '#3f2f1f' }}
        >
          <div className="absolute -top-8 -right-10 w-32 h-32 rounded-full" style={{ background: 'rgba(247,149,63,0.12)' }} />
          <div className="relative">
            <h2 className="text-2xl font-bold" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>Send Message</h2>
            <p className="text-sm mt-1" style={{ color: '#f6d5b8' }}>
              To: {recipient?.user_name || 'Team Member'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: '#f6d5b8', background: 'rgba(255,255,255,0.12)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239' }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#3d3228' }}>
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
            <label className="block text-sm font-medium mb-2" style={{ color: '#3d3228' }}>
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
              className="w-full px-3 py-2 border rounded-xl resize-none focus:outline-none"
              style={{ borderColor: '#d7ccbe', color: '#3d3228' }}
            />
            <p className="text-xs mt-1" style={{ color: '#8f8172' }}>
              {message.length}/1000 characters
            </p>
          </div>

          {/* Related Course (Optional) */}
          {courses.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#3d3228' }}>
                Related Course (Optional)
              </label>
              <select
                value={relatedCourseId}
                onChange={(e) => setRelatedCourseId(e.target.value)}
                disabled={sending}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none"
                style={{ borderColor: '#d7ccbe', color: '#3d3228' }}
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#eee4d7' }}>
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={sending}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={sending || !title.trim() || !message.trim()}
              className="rounded-full"
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
