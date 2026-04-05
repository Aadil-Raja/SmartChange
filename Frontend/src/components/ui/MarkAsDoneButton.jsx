import { Check, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useCourses } from '../../hooks/useCourses';

const MarkAsDoneButton = ({ 
  itemId, 
  itemType = 'document', 
  isCompleted = false, 
  progress = 0,
  disabled = false
}) => {
  const { markModuleDone, updateVideoProgress } = useCourses();
  const [isMarking, setIsMarking] = useState(false);

  if (disabled) {
    return (
      <button
        disabled
        className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-not-allowed"
        style={{ background: '#f5f0ea', color: '#9c8e80', border: '1.5px dashed #e0d8ce' }}
        title="Enroll in this course to track progress"
      >
        <Check size={13} />
        Enroll to track progress
      </button>
    );
  }

  const handleMarkAsDone = async () => {
    if (isCompleted) return;
    
    setIsMarking(true);
    const result = await markModuleDone(itemId, itemType);
    setIsMarking(false);

    if (!result.success) {
      alert(result.message || 'Failed to mark as complete');
    }
  };

  // For videos, show different states based on progress
  if (itemType === 'video') {
    if (isCompleted) {
      return (
        <button disabled className="flex items-center justify-center gap-1.5 rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
          <Check size={13} /> Video Completed
        </button>
      );
    }
    if (progress > 0 && progress < 100) {
      return (
        <div className="space-y-1 w-full">
          <button onClick={handleMarkAsDone} disabled={isMarking}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #FDB913, #f7953f)' }}>
            {isMarking ? <><Loader2 size={13} className="animate-spin" />Marking...</> : <><Check size={13} />Mark as Complete</>}
          </button>
          <p className="text-xs text-center" style={{ color: '#9c8e80' }}>{Math.round(progress)}% watched</p>
        </div>
      );
    }
    return (
      <button onClick={handleMarkAsDone} disabled={isMarking}
        className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-50"
        style={{ background: 'linear-gradient(to right, #60a5fa, #3b82f6)' }}>
        {isMarking ? <><Loader2 size={13} className="animate-spin" />Starting...</> : <><Play size={13} />Start Video</>}
      </button>
    );
  }

  // For documents and links
  if (isCompleted) {
    return (
      <button disabled className="flex items-center justify-center gap-1.5 rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
        <Check size={13} /> Completed
      </button>
    );
  }

  return (
    <button onClick={handleMarkAsDone} disabled={isMarking}
      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-50"
      style={{ background: 'linear-gradient(to right, #FDB913, #f7953f)' }}>
      {isMarking ? <><Loader2 size={13} className="animate-spin" />Marking...</> : <><Check size={13} />Mark as Done</>}
    </button>
  );
};

export default MarkAsDoneButton;