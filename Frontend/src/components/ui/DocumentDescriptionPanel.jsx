import { useState, useEffect } from 'react';
import { FileText, Save, Loader, Sparkles } from 'lucide-react';
import {
  getDocumentDescription,
  updateDocumentDescription,
  generateDocumentDescription,
} from '../../services/adminApi';
import toast from 'react-hot-toast';

const DocumentDescriptionPanel = ({ documentId, documentStatus }) => {
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isProcessed = documentStatus === 'PROCESSED';

  useEffect(() => {
    setLoading(true);
    getDocumentDescription(documentId)
      .then(res => {
        const val = res?.data?.description || '';
        setDescription(val);
        setSaved(val);
      })
      .catch(() => toast.error('Could not load description'))
      .finally(() => setLoading(false));
  }, [documentId]);

  const dirty = description !== saved;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDocumentDescription(documentId, description);
      setSaved(description);
      toast.success('Description saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateDocumentDescription(documentId);
      const val = res?.data?.description || '';
      setDescription(val);
      setSaved(val);
      toast.success('Description generated');
    } catch {
      toast.error('Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border p-5" style={{ background: '#fff', borderColor: '#e8e0d4' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f7ff' }}>
            <FileText size={15} style={{ color: '#00ADEF' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#1a1209' }}>Document Description</p>
            <p className="text-xs" style={{ color: 'rgba(65,50,24,0.45)' }}>
              Sent to AI as context — helps prevent hallucination
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
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
            title={!isProcessed ? 'Document must be processed first' : 'Auto-generate from section titles'}
          >
            {generating ? <Loader size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Textarea */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader size={18} className="animate-spin" style={{ color: '#00ADEF' }} />
        </div>
      ) : (
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. This is Uzain Ahmed's CV containing his skills, education at FAST NUCES, and work experience."
          rows={4}
          className="w-full text-xs px-3 py-2.5 rounded-xl outline-none resize-y"
          style={{
            background: '#faf6ef',
            border: '1px solid #e8dfd2',
            color: '#1a1209',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }}
        />
      )}

      {!loading && !description && (
        <p className="text-xs mt-2" style={{ color: 'rgba(65,50,24,0.4)' }}>
          No description set. Click Generate to auto-create one from the document's section titles.
        </p>
      )}
    </div>
  );
};

export default DocumentDescriptionPanel;
