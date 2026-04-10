import { Check, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateContentProgress } from '../../services/courseApi';
import { employeeKeys } from '../../hooks/useEmployeeQueries';

const MarkAsDoneButton = ({ 
  itemId, 
  courseId,
  itemType = 'document', 
  isCompleted = false, 
  progress = 0,
  disabled = false
}) => {
  const qc = useQueryClient();
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
    try {
      const res = await updateContentProgress(itemId, { progress: 100.0, completed: true });
      if (res.success) {
        // Update React Query cache immediately — no refetch needed
        qc.setQueryData(employeeKeys.course(courseId), (old) => {
          if (!old) return old;
          const updatedItems = (old.items_progress?.items || []).map(p =>
            p.content_id === itemId
              ? { ...p, progress: 100, completed_at: new Date().toISOString() }
              : p
          );
          // If item wasn't in the list yet, add it
          const exists = updatedItems.some(p => p.content_id === itemId);
          if (!exists) updatedItems.push({ content_id: itemId, progress: 100, completed_at: new Date().toISOString() });
          return { ...old, items_progress: { ...old.items_progress, items: updatedItems } };
        });
        // Refresh quiz unlock status in background
        qc.invalidateQueries({ queryKey: employeeKeys.courseQuizzes(courseId) });
        // Update courses list cache in place so the card shows updated progress
        qc.setQueryData(employeeKeys.courses(), (oldCourses) => {
          if (!oldCourses) return oldCourses;
          return oldCourses.map(c => {
            if (c.id !== courseId || !c.progress) return c;
            const newCompleted = (c.progress.completed_items || 0) + 1;
            const total = (c.progress.total_items || 0) + (c.progress.total_quizzes || 0);
            const totalCompleted = newCompleted + (c.progress.completed_quizzes || 0);
            const percent = total > 0 ? Math.min(100, Math.round((totalCompleted / total) * 100)) : 0;
            return { ...c, progress: { ...c.progress, completed_items: newCompleted, percent } };
          });
        });
        // If course completed, refresh courses list fully
        if (res.data?.course_completed) {
          qc.invalidateQueries({ queryKey: employeeKeys.courses() });
          qc.invalidateQueries({ queryKey: employeeKeys.coursesOverview() });
        }
      } else {
        alert(res.message || 'Failed to mark as complete');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to mark as complete');
    } finally {
      setIsMarking(false);
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