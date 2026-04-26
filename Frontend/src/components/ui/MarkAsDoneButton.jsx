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
        title="Cannot track progress"
      >
        <Check size={13} />
        Unavailable
      </button>
    );
  }

  const applyOptimisticUpdate = () => {
    const completedAt = new Date().toISOString();

    // Snapshot current cache for rollback
    const prevCourse = qc.getQueryData(employeeKeys.course(courseId));
    const prevQuizzes = qc.getQueryData(employeeKeys.courseQuizzes(courseId));

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

    // 2. Optimistically unlock any quizzes whose prerequisites are now all met
    qc.setQueryData(employeeKeys.courseQuizzes(courseId), (oldQuizzes) => {
      if (!Array.isArray(oldQuizzes)) return oldQuizzes;

      // Build the set of completed content IDs after this completion
      const courseCache = qc.getQueryData(employeeKeys.course(courseId));
      const alreadyCompleted = new Set(
        (courseCache?.items_progress?.items || [])
          .filter(p => p.completed_at)
          .map(p => p.content_id)
      );
      alreadyCompleted.add(itemId); // include the one just completed

      return oldQuizzes.map(quiz => {
        if (quiz.status !== 'locked') return quiz;
        const prereqs = quiz.prerequisite_content_ids || [];
        if (prereqs.length === 0) return quiz;
        const stillMissing = prereqs.filter(id => !alreadyCompleted.has(id));
        if (stillMissing.length === 0) {
          // All prerequisites now met — unlock optimistically
          return { ...quiz, status: 'can_take', missing_prerequisites: [] };
        }
        // Update missing list to remove the just-completed item
        return { ...quiz, missing_prerequisites: stillMissing };
      });
    });

    // 3. Update courses list cache in place so progress card is correct immediately on nav back
    const prevCourses = qc.getQueryData(employeeKeys.courses());
    qc.setQueryData(employeeKeys.courses(), (oldCourses) => {
      if (!Array.isArray(oldCourses)) return oldCourses;
      return oldCourses.map(c => {
        if (c.id !== courseId || !c.progress) return c;
        const newCompleted = (c.progress.completed_items || 0) + 1;
        const total = (c.progress.total_items || 0) + (c.progress.total_quizzes || 0);
        const totalCompleted = newCompleted + (c.progress.completed_quizzes || 0);
        const percent = total > 0 ? Math.min(100, Math.round((totalCompleted / total) * 100)) : 0;
        return { ...c, progress: { ...c.progress, completed_items: newCompleted, percent } };
      });
    });

    return { prevCourse, prevQuizzes, prevCourses };
  };

  const rollback = ({ prevCourse, prevQuizzes, prevCourses }) => {
    if (prevCourse !== undefined) qc.setQueryData(employeeKeys.course(courseId), prevCourse);
    if (prevQuizzes !== undefined) qc.setQueryData(employeeKeys.courseQuizzes(courseId), prevQuizzes);
    if (prevCourses !== undefined) qc.setQueryData(employeeKeys.courses(), prevCourses);
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
          <Check size={13} /> Watched
        </button>
      );
    }
    if (progress > 0 && progress < 100) {
      return (
        <div className="space-y-1 w-full">
          <button onClick={handleMarkAsDone}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
            style={{ background: isFailed ? '#ef4444' : 'linear-gradient(to right, #FDB913, #f7953f)' }}>
            <Check size={13} />{isFailed ? 'Failed — Retry' : 'Mark as Watched'}
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
        <Check size={13} /> Got It!
      </button>
    );
  }

  return (
    <button onClick={handleMarkAsDone}
      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
      style={{ background: isFailed ? '#ef4444' : 'linear-gradient(to right, #FDB913, #f7953f)' }}>
      <Check size={13} />{isFailed ? 'Failed — Retry' : 'Got It!'}
    </button>
  );
};

export default MarkAsDoneButton;
