import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Eye, EyeOff, Save, Loader } from 'lucide-react';
import { getSuggestedQuestions, generateSuggestedQuestions, updateSuggestedQuestions } from '../../services/adminApi';

const MAX = 5;

const SuggestedQuestionsPanel = ({ documentId, documentStatus }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newText, setNewText] = useState('');
  const [dirty, setDirty] = useState(false);

  const isProcessed = documentStatus === 'PROCESSED';

  useEffect(() => {
    if (!documentId) return;
    setLoading(true);
    getSuggestedQuestions(documentId)
      .then(res => setQuestions(res?.data?.questions || []))
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false));
  }, [documentId]);

  const flash = (type, msg) => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
    else { setError(msg); setTimeout(() => setError(null), 4000); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await generateSuggestedQuestions(documentId);
      setQuestions(res?.data?.questions || []);
      setDirty(false);
      flash('success', `Generated ${res?.data?.questions?.length || 0} questions`);
    } catch {
      flash('error', 'Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = (id) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_active: !q.is_active } : q));
    setDirty(true);
  };

  const handleDelete = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    setDirty(true);
  };

  const handleAdd = () => {
    if (!newText.trim() || questions.length >= MAX) return;
    setQuestions(prev => [...prev, { id: crypto.randomUUID(), text: newText.trim(), is_active: true }]);
    setNewText('');
    setDirty(true);
  };

  const handleEditText = (id, text) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, text } : q));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSuggestedQuestions(documentId, questions);
      setDirty(false);
      flash('success', 'Saved');
    } catch {
      flash('error', 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border p-5" style={{ background: '#fff', borderColor: '#e8e0d4' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fff3e8' }}>
            <Sparkles size={15} style={{ color: '#f7953f' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#1a1209' }}>Suggested Questions</p>
            <p className="text-xs" style={{ color: 'rgba(65,50,24,0.45)' }}>
              {questions.length}/{MAX} · shown as chips in chatbot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: '#1a1209', color: '#fff9ef' }}
            >
              {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !isProcessed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: generating || !isProcessed ? '#f3ede4' : '#fff3e8',
              color: generating || !isProcessed ? '#b0a090' : '#c2620a',
              border: '1px solid',
              borderColor: generating || !isProcessed ? '#e8dfd2' : '#f6dec1',
            }}
            title={!isProcessed ? 'Document must be processed first' : 'Auto-generate questions'}
          >
            {generating ? <Loader size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {(error || success) && (
        <div
          className="text-xs px-3 py-2 rounded-lg mb-3"
          style={{
            background: error ? '#fff1f2' : '#f0fdf4',
            color: error ? '#dc2626' : '#15803d',
            border: `1px solid ${error ? '#fecdd3' : '#bbf7d0'}`,
          }}
        >
          {error || success}
        </div>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader size={18} className="animate-spin" style={{ color: '#f7953f' }} />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'rgba(65,50,24,0.4)' }}>
          No questions yet. Click Generate or add manually below.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-2 p-2.5 rounded-xl"
              style={{
                background: q.is_active ? '#faf6ef' : '#f5f5f5',
                border: '1px solid',
                borderColor: q.is_active ? '#e8dfd2' : '#e0e0e0',
                opacity: q.is_active ? 1 : 0.6,
              }}
            >
              <input
                value={q.text}
                onChange={e => handleEditText(q.id, e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none"
                style={{ color: '#1a1209', minHeight: 20 }}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleToggle(q.id)} title={q.is_active ? 'Hide' : 'Show'}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ color: q.is_active ? '#f7953f' : '#b0a090' }}>
                  {q.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button onClick={() => handleDelete(q.id)}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ color: '#dc2626' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add manually */}
      {questions.length < MAX && (
        <div className="flex gap-2">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a question manually…"
            className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
            style={{ background: '#faf6ef', border: '1px solid #e8dfd2', color: '#1a1209' }}
          />
          <button onClick={handleAdd} disabled={!newText.trim()}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: newText.trim() ? '#1a1209' : '#e8dfd2', color: newText.trim() ? '#fff9ef' : '#b0a090' }}>
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestedQuestionsPanel;
