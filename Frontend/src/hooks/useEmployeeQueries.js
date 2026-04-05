/**
 * React Query hooks for the employee portal.
 * Centralizes all server state — cache keys, stale times, and invalidation.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmployeeCourses,
  getEmployeeCoursesOverview,
  getCourseById,
  updateContentProgress,
  enrollCourse,
  unenrollCourse,
  getCourseProgress,
  getCourseItemsProgress,
  getUserProfile,
} from '../services/courseApi';
import { submitQuizAttempt } from '../services/courseApi';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const employeeKeys = {
  courses: () => ['employee', 'courses'],
  coursesOverview: () => ['employee', 'courses-overview'],
  course: (id) => ['employee', 'course', id],
  courseProgress: (id) => ['employee', 'course', id, 'progress'],
  courseItemsProgress: (id) => ['employee', 'course', id, 'items-progress'],
  profile: () => ['employee', 'profile'],
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
    staleTime: 60_000,
  });

export const useEmployeeCoursesOverview = () =>
  useQuery({
    queryKey: employeeKeys.coursesOverview(),
    queryFn: async () => {
      const res = await getEmployeeCoursesOverview();
      if (!res.success) throw new Error(res.message || 'Failed to fetch overview');
      return res.data;
    },
    staleTime: 60_000,
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
        quizzes: res.data.quizzes || [],
      };
    },
    enabled: !!courseId,
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
  });

export const useEmployeeProfile = () =>
  useQuery({
    queryKey: employeeKeys.profile(),
    queryFn: async () => {
      const res = await getUserProfile();
      if (!res.success) throw new Error('Failed to fetch profile');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useMarkContentDone = (courseId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contentId }) =>
      updateContentProgress(contentId, { progress: 100.0, completed: true }),
    onSuccess: () => {
      // Invalidate course detail (quiz unlock status) + progress + courses list
      qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courseProgress(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courseItemsProgress(courseId) });
      qc.invalidateQueries({ queryKey: employeeKeys.courses() });
      qc.invalidateQueries({ queryKey: employeeKeys.coursesOverview() });
      qc.invalidateQueries({ queryKey: employeeKeys.profile() });
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

export const useSubmitQuiz = (courseId) => {
  const qc = useQueryClient();
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
