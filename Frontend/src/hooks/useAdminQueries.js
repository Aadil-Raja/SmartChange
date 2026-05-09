/**
 * React Query hooks for the admin portal.
 * Read-only queries with caching — mutations still go through context functions.
 *
 * Pattern mirrors useEmployeeQueries.js on the employee side.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDocuments, fetchEmployees, fetchTeamRoles, fetchTeams, fetchDocumentSections, getSuggestedQuestions } from '../services/adminApi';
import { getCourses, getCourseDetails } from '../services/trainingApi';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const adminKeys = {
  documents:         ()         => ['admin', 'documents'],
  documentSections:  (docId)    => ['admin', 'document-sections', docId],
  suggestedQuestions:(docId)    => ['admin', 'suggested-questions', docId],
  employees:         ()         => ['admin', 'employees'],
  teams:             ()         => ['admin', 'teams'],
  teamRoles:         ()         => ['admin', 'team-roles'],
  courses:           ()         => ['admin', 'courses'],
  course:            (id)       => ['admin', 'course', id],
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * All admin documents (dashboard).
 * Stale after 2 min — documents change infrequently but processing status can update.
 */
export const useAdminDocuments = () =>
  useQuery({
    queryKey: adminKeys.documents(),
    queryFn: async () => {
      const res = await fetchDocuments();
      if (!res.success) throw new Error(res.message || 'Failed to fetch documents');
      return res.data?.documents || [];
    },
    staleTime: 2 * 60_000,
  });

/**
 * All employees with their team memberships (EmployeeList, TeamsPage).
 * Stale after 3 min — changes only when admin adds/removes team members.
 */
export const useAdminEmployees = () =>
  useQuery({
    queryKey: adminKeys.employees(),
    queryFn: async () => {
      const res = await fetchEmployees();
      if (!res.success) throw new Error(res.message || 'Failed to fetch employees');
      return res.data?.employees || res.data || [];
    },
    staleTime: 3 * 60_000,
  });

/**
 * All teams (TeamsPage).
 * Stale after 3 min — changes when admin creates/deletes teams or adds/removes members.
 */
export const useAdminTeams = () =>
  useQuery({
    queryKey: adminKeys.teams(),
    queryFn: async () => {
      const res = await fetchTeams();
      if (!res.success) throw new Error(res.message || 'Failed to fetch teams');
      return res.data?.teams || res.data || [];
    },
    staleTime: 3 * 60_000,
  });

/**
 * Team roles list — essentially static, long stale time.
 */
export const useAdminTeamRoles = () =>
  useQuery({
    queryKey: adminKeys.teamRoles(),
    queryFn: async () => {
      const res = await fetchTeamRoles();
      if (!res.success) throw new Error(res.message || 'Failed to fetch team roles');
      const raw = res.data?.roles || res.data || [];
      // Normalise: API may return strings or objects
      return Array.isArray(raw)
        ? raw.map(r => (typeof r === 'object' && r !== null ? r.value || r.name || String(r) : String(r)))
        : [];
    },
    staleTime: 30 * 60_000, // 30 min — roles almost never change
  });

/**
 * All admin courses (training list).
 * Stale after 5 min — course list changes only when admin creates/deletes/toggles.
 */
export const useAdminCourses = () =>
  useQuery({
    queryKey: adminKeys.courses(),
    queryFn: async () => {
      const res = await getCourses();
      if (!res.success) throw new Error(res.message || 'Failed to fetch courses');
      return res.data?.courses || [];
    },
    staleTime: 5 * 60_000,
  });

/**
 * Single course detail — content items + quizzes (AdminCourseDetails).
 * Stale after 2 min. Invalidated after any mutation on that course.
 */
export const useAdminCourse = (courseId) =>
  useQuery({
    queryKey: adminKeys.course(courseId),
    queryFn: async () => {
      const res = await getCourseDetails(courseId);
      if (!res.success) throw new Error(res.message || 'Failed to fetch course details');
      return {
        course:       res.data?.course   || null,
        contentItems: res.data?.items    || [],
        quizzes:      res.data?.quizzes  || [],
      };
    },
    enabled: !!courseId,
    staleTime: 2 * 60_000,
  });

/**
 * Document sections with chunk previews + page numbers.
 * Only fetches when a docId is provided. Stale after 10 min — sections don't change after processing.
 */
export const useDocumentSections = (docId) =>
  useQuery({
    queryKey: adminKeys.documentSections(docId),
    queryFn: async () => {
      const res = await fetchDocumentSections(docId);
      if (!res.success) throw new Error(res.message || 'Failed to fetch sections');
      return res.data?.sections || [];
    },
    enabled: !!docId,
    staleTime: 10 * 60_000,
  });

/**
 * Suggested questions for a document.
 * Stale after 5 min. Invalidated after generate/save mutations.
 */
export const useDocumentSuggestedQuestions = (docId) =>
  useQuery({
    queryKey: adminKeys.suggestedQuestions(docId),
    queryFn: async () => {
      const res = await getSuggestedQuestions(docId);
      return res?.data?.questions || [];
    },
    enabled: !!docId,
    staleTime: 5 * 60_000,
  });

// ─── Invalidation helpers (call these after mutations) ────────────────────────

/**
 * Returns a set of invalidation helpers scoped to the query client.
 * Import and call inside context mutation functions or directly in page handlers.
 *
 * Usage:
 *   const { invalidateCourse, invalidateCourses } = useAdminInvalidations();
 *   await someContextMutation(...);
 *   invalidateCourse(courseId);
 */
export const useAdminInvalidations = () => {
  const qc = useQueryClient();
  return {
    invalidateDocuments:        ()         => qc.invalidateQueries({ queryKey: adminKeys.documents() }),
    invalidateDocumentSections: (docId)    => qc.invalidateQueries({ queryKey: adminKeys.documentSections(docId) }),
    invalidateSuggestedQuestions:(docId)   => qc.invalidateQueries({ queryKey: adminKeys.suggestedQuestions(docId) }),
    invalidateEmployees:        ()         => qc.invalidateQueries({ queryKey: adminKeys.employees() }),
    invalidateTeams:            ()         => qc.invalidateQueries({ queryKey: adminKeys.teams() }),
    // Convenience: teams and employees share membership data — invalidate both together
    invalidateTeamsAndEmployees: () => {
      qc.invalidateQueries({ queryKey: adminKeys.teams() });
      qc.invalidateQueries({ queryKey: adminKeys.employees() });
    },
    invalidateCourses:   ()         => qc.invalidateQueries({ queryKey: adminKeys.courses() }),
    invalidateCourse:    (courseId) => qc.invalidateQueries({ queryKey: adminKeys.course(courseId) }),
    // Convenience: invalidate both list and detail together (e.g. after publish/unpublish)
    invalidateCourseAll: (courseId) => {
      qc.invalidateQueries({ queryKey: adminKeys.courses() });
      qc.invalidateQueries({ queryKey: adminKeys.course(courseId) });
    },
  };
};
