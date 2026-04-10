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
  const [isFailed, setIsFailed] = useState(false);

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

  const applyOptimisticUpdate = () => {
    const completedAt = new Date().toISOString();

    // Snapshot current cache for rollback
    const prevCourse = qc.getQueryData(employeeKeys.course(courseId));

    // 1. Update course detail — mark item as completed instantly
    qc.setQueryData(employeeKeys.course(courseId), (old) => {
      if (!old) return old;
      const items = old.items_progress?.items || [];
      const exists = items.some(p => p.content_id === itemId);
      const updatedItems = exists
        ? items.map(p =>
            p.content_id === itemId
              ? { ...p, progress: 100, completed_at: completedAt }
              : p
          )
        : [...items, { content_id: itemId, progress: 100, completed_at: completedAt }];
      return { ...old, items_progress: { ...old.items_progress, items: updatedItems } };
    });

    // 2. Refetch courses list now in background — ready before user navigates back
    qc.refetchQueries({ queryKey: employeeKeys.courses() });

    return { prevCourse };
  };

  const rollback = ({ prevCourse }) => {
    if (prevCourse !== undefined) qc.setQueryData(employeeKeys.course(courseId), prevCourse);
  };

  const handleMarkAsDone = async () => {
    if (isCompleted) return;
    setIsFailed(false);

    // Optimistic update — UI changes immediately, no waiting
    const snapshot = applyOptimisticUpdate();

    try {
      const res = await updateContentProgress(itemId, { progress: 100.0, completed: true });
      if (res.success) {
        // Refresh quiz unlock status (can't know this client-side)
        qc.invalidateQueries({ queryKey: employeeKeys.courseQuizzes(courseId) });
        if (res.data?.course_completed) {
          qc.invalidateQueries({ queryKey: employeeKeys.coursesOverview() });
        }
      } else {
        rollback(snapshot);
        setIsFailed(true);
      }
    } catch {
      rollback(snapshot);
      setIsFailed(true);
    }
  };

  // Video states
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
          <button onClick={handleMarkAsDone}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
            style={{ background: isFailed ? '#ef4444' : 'linear-gradient(to right, #FDB913, #f7953f)' }}>
            <Check size={13} />{isFailed ? 'Failed — Retry' : 'Mark as Complete'}
          </button>
          <p className="text-xs text-center" style={{ color: '#9c8e80' }}>{Math.round(progress)}% watched</p>
        </div>
      );
    }
    return (
      <button onClick={handleMarkAsDone}
        className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
        style={{ background: isFailed ? '#ef4444' : 'linear-gradient(to right, #60a5fa, #3b82f6)' }}>
        <Play size={13} />{isFailed ? 'Failed — Retry' : 'Start Video'}
      </button>
    );
  }

  // Document / link states
  if (isCompleted) {
    return (
      <button disabled className="flex items-center justify-center gap-1.5 rounded-lg border border-green-400 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
        <Check size={13} /> Completed
      </button>
    );
  }

  return (
    <button onClick={handleMarkAsDone}
      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
      style={{ background: isFailed ? '#ef4444' : 'linear-gradient(to right, #FDB913, #f7953f)' }}>
      <Check size={13} />{isFailed ? 'Failed — Retry' : 'Mark as Done'}
    </button>
  );
};

export default MarkAsDoneButton;
