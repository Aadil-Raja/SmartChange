/**
 * React Query hooks for the employee portal.
 * Centralizes all server state — cache keys, stale times, and invalidation.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmployeeCourses,
  getEmployeeCoursesOverview,
  getCourseById,
  getCourseQuizzes,
  updateContentProgress,
  enrollCourse,
  unenrollCourse,
  getCourseProgress,
  getCourseItemsProgress,
  getUserProfile,
  getTeamLeaderboard,
  getTeamEngagement,
} from '../services/courseApi';
import { submitQuizAttempt } from '../services/courseApi';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const employeeKeys = {
  courses: () => ['employee', 'courses'],
  coursesOverview: () => ['employee', 'courses-overview'],
  course: (id) => ['employee', 'course', id],
  courseQuizzes: (id) => ['employee', 'course', id, 'quizzes'],
  courseProgress: (id) => ['employee', 'course', id, 'progress'],
  courseItemsProgress: (id) => ['employee', 'course', id, 'items-progress'],
  profile: () => ['employee', 'profile'],
  leaderboard: (teamId, period) => ['employee', 'leaderboard', teamId, period],
  engagement: (teamId, period) => ['employee', 'engagement', teamId, period],
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useEmployeeCourses = () =>
  useQuery({
    queryKey: employeeKeys.courses(),
    queryFn: async () => {
      const res = await getEmployeeCourses();
      if (!res.success) throw new Error(res.message || 'Failed to fetch courses');
      return res.data.courses || [];
    },
    staleTime: 5 * 60_000, // 5 min
  });

export const useEmployeeCoursesOverview = () =>
  useQuery({
    queryKey: employeeKeys.coursesOverview(),
    queryFn: async () => {
      const res = await getEmployeeCoursesOverview();
      if (!res.success) throw new Error(res.message || 'Failed to fetch overview');
      return res.data;
    },
    staleTime: 5 * 60_000, // 5 min
  });

export const useEmployeeCourse = (courseId) =>
  useQuery({
    queryKey: employeeKeys.course(courseId),
    queryFn: async () => {
      const res = await getCourseById(courseId);
      if (!res.success) throw new Error(res.message || 'Failed to fetch course');
      return {
        ...res.data.course,
        items: res.data.items || [],
        items_progress: res.data.items_progress || null,
      };
    },
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });

// Separate query for quizzes — fired after content is shown
export const useEmployeeCourseQuizzes = (courseId) =>
  useQuery({
    queryKey: employeeKeys.courseQuizzes(courseId),
    queryFn: async () => {
      const res = await getCourseQuizzes(courseId);
      if (!res.success) throw new Error(res.message || 'Failed to fetch quizzes');
      return res.data.quizzes || [];
    },
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });

export const useEmployeeCourseProgress = (courseId) =>
  useQuery({
    queryKey: employeeKeys.courseProgress(courseId),
    queryFn: async () => {
      const res = await getCourseProgress(courseId);
      if (!res.success) throw new Error('Failed to fetch progress');
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });

export const useEmployeeCourseItemsProgress = (courseId) =>
  useQuery({
    queryKey: employeeKeys.courseItemsProgress(courseId),
    queryFn: async () => {
      const res = await getCourseItemsProgress(courseId);
      if (!res.success) throw new Error('Failed to fetch items progress');
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });

export const useEmployeeProfile = () =>
  useQuery({
    queryKey: employeeKeys.profile(),
    queryFn: async () => {
      const res = await getUserProfile();
      if (!res.success) throw new Error('Failed to fetch profile');
      return res.data;
    },
    staleTime: 10 * 60_000, // 10 min
  });

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useMarkContentDone = (courseId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contentId }) =>
      updateContentProgress(contentId, { progress: 100.0, completed: true }),
    onSuccess: (data, { contentId }) => {
      // Update course detail cache in place — no refetch needed
      qc.setQueryData(employeeKeys.course(courseId), (old) => {
        if (!old) return old;
        const updatedProgress = (old.items_progress?.items || []).map(p =>
          p.content_id === contentId
            ? { ...p, progress: 100, completed_at: new Date().toISOString() }
            : p
        );
        return { ...old, items_progress: { ...old.items_progress, items: updatedProgress } };
      });
      // Quiz unlock status may have changed — refetch quizzes only
      qc.invalidateQueries({ queryKey: employeeKeys.courseQuizzes(courseId) });
      // Only invalidate courses list if backend says course is now completed
      if (data?.data?.course_completed) {
        qc.invalidateQueries({ queryKey: employeeKeys.courses() });
        qc.invalidateQueries({ queryKey: employeeKeys.coursesOverview() });
      }
    },
  });
};

export const useUpdateVideoProgress = (courseId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contentId, progress }) =>
      updateContentProgress(contentId, { progress, completed: progress >= 100 }),
    onSuccess: (_, { progress }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.courseItemsProgress(courseId) });
      if (progress >= 100) {
        qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
        qc.invalidateQueries({ queryKey: employeeKeys.courseProgress(courseId) });
        qc.invalidateQueries({ queryKey: employeeKeys.courses() });
        qc.invalidateQueries({ queryKey: employeeKeys.profile() });
      }
    },
  });
};

export const useEnrollCourse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => enrollCourse(courseId),
    onSuccess: (_, courseId) => {
      qc.invalidateQueries({ queryKey: employeeKeys.courses() });
      qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
    },
  });
};

export const useUnenrollCourse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => unenrollCourse(courseId),
    onSuccess: (_, courseId) => {
      qc.removeQueries({ queryKey: employeeKeys.course(courseId) });
      qc.removeQueries({ queryKey: employeeKeys.courseProgress(courseId) });
      qc.removeQueries({ queryKey: employeeKeys.courseItemsProgress(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courses() });
      qc.invalidateQueries({ queryKey: employeeKeys.profile() });
    },
  });
};

export const useSubmitQuiz = (courseId) => {  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, answers }) => submitQuizAttempt(quizId, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courseProgress(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courses() });
      qc.invalidateQueries({ queryKey: employeeKeys.profile() });
    },
  });
};

export const useTeamLeaderboard = (teamId, period = '7d') =>
  useQuery({
    queryKey: employeeKeys.leaderboard(teamId, period),
    queryFn: async () => {
      const res = await getTeamLeaderboard(teamId, period);
      if (!res.success) throw new Error(res.message || 'Failed to fetch leaderboard');
      return res.data;
    },
    enabled: !!teamId,
    staleTime: 5 * 60_000, // 5 min — matches backend cache TTL
  });

export const useTeamEngagement = (teamId, period = '7d') =>
  useQuery({
    queryKey: employeeKeys.engagement(teamId, period),
    queryFn: async () => {
      const res = await getTeamEngagement(teamId, period);
      if (!res.success) throw new Error(res.message || 'Failed to fetch engagement');
      return res.data;
    },
    enabled: !!teamId,
    staleTime: 5 * 60_000,
  });
