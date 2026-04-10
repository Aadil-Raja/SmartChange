import { createContext, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { employeeKeys } from "../hooks/useEmployeeQueries";
import {
    getEmployeeCoursesOverview,
    getEmployeeCourses,
    getCourseById,
    updateContentProgress,
    getCourseProgress,
    getCourseItemsProgress,
    getProcessedDocuments,
    starCourse,
    unstarCourse,
    enrollCourse,
    unenrollCourse
} from "../services/courseApi";

export const CourseContext = createContext(null);

export const CourseProvider = ({ children }) => {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [completedItems, setCompletedItems] = useState(new Set());
    const [courseItemsProgress, setCourseItemsProgress] = useState({});
    const [processedDocuments, setProcessedDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progressLoading, setProgressLoading] = useState(false);
    const fetchingProgress = useRef(new Set());
    const qc = useQueryClient();


    // Fetch all courses with enrollment status and progress (single API call)
    const fetchCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getEmployeeCourses();

            if (response.success) {
                const courses = response.data.courses || [];
                setCourses(courses);
                return { success: true, data: courses };
            } else {
                throw new Error(response.message || 'Failed to fetch courses');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch courses';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Mark content as complete or update progress
    const markModuleDone = async (itemId, itemType = 'document') => {
        setProgressLoading(true);
        setError(null);
        try {
            console.log('Marking module as done:', { itemId, itemType });
            
            // Prepare payload - backend expects progress as float and completed as optional boolean
            const payload = {
                progress: 100.0,  // Always set to 100 when marking as done
                completed: true   // Explicitly mark as completed
            };

            console.log('Sending payload:', payload);
            const res = await updateContentProgress(itemId, payload);
            console.log('API response:', res);

            if (res.success) {
                // Update local completed items state
                setCompletedItems(prev => new Set([...prev, itemId]));

                if (selectedCourse) {
                    // Update the course detail cache directly — no extra network calls
                    qc.setQueryData(employeeKeys.course(selectedCourse.id), (old) => {
                        if (!old) return old;
                        const updatedProgress = (old.items_progress?.items || []).map(p =>
                            p.content_id === itemId
                                ? { ...p, progress: 100, completed_at: new Date().toISOString() }
                                : p
                        );
                        return {
                            ...old,
                            items_progress: { ...old.items_progress, items: updatedProgress },
                        };
                    });

                    // Invalidate quiz status (unlock may have changed) and courses list
                    qc.invalidateQueries({ queryKey: employeeKeys.courseQuizzes(selectedCourse.id) });
                    // Only invalidate courses list if course just completed
                    if (res.data?.course_completed) {
                        qc.invalidateQueries({ queryKey: employeeKeys.courses() });
                        qc.invalidateQueries({ queryKey: employeeKeys.coursesOverview() });
                    }
                }

                return { success: true, data: res.data };
            } else {
                throw new Error(res.message || 'Failed to mark module as complete');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to mark module as complete';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setProgressLoading(false);
        }
    };

    // Update video progress (for video content with progress tracking)
    const updateVideoProgress = async (itemId, progressPercent) => {
        try {
            const payload = {
                progress: Math.min(Math.max(progressPercent, 0), 100),
                completed: progressPercent >= 100
            };

            const res = await updateContentProgress(itemId, payload);

            if (res.success && selectedCourse) {
                // Refresh course items progress to show updated progress
                await fetchCourseItemsProgress(selectedCourse.id);

                // If completed, also refresh overall course progress
                if (progressPercent >= 100) {
                    await fetchActualCourseProgress(selectedCourse.id);
                    setCompletedItems(prev => new Set([...prev, itemId]));
                }
            }

            return res;
        } catch (err) {
            console.error('Failed to update video progress:', err);
            return { success: false, message: err.message };
        }
    };

    // ADD this new function after markModuleDone:
    const fetchActualCourseProgress = async (courseId) => {
        // Prevent duplicate fetches
        if (fetchingProgress.current.has(courseId)) {

            return { success: false, message: 'Already fetching' };
        }

        fetchingProgress.current.add(courseId);

        try {

            const res = await getCourseProgress(courseId);


            if (res.success && res.data) {

                const progressData = res.data;

                setCourses(prevCourses =>
                    prevCourses.map(course =>
                        course.id === courseId
                            ? { ...course, progressData }
                            : course
                    )
                );

                setSelectedCourse(prev =>
                    prev?.id === courseId
                        ? { ...prev, progressData }
                        : prev
                );

                return { success: true, data: progressData };
            } else {
                console.warn('⚠️ Progress API returned success=false');
                return { success: false };
            }
        } catch (err) {
            console.error('❌ Failed to fetch course progress:', err);
            return { success: false, error: err.message };
        } finally {
            // Remove from tracking after a short delay to prevent rapid re-fetches
            setTimeout(() => {
                fetchingProgress.current.delete(courseId);
            }, 1000);
        }
    };

    // Fetch detailed progress for all items in a course
    const fetchCourseItemsProgress = async (courseId) => {
        try {
            const res = await getCourseItemsProgress(courseId);
            if (res.success && res.data) {
                const itemsProgressData = res.data;

                // Update course items progress state
                setCourseItemsProgress(prev => ({
                    ...prev,
                    [courseId]: itemsProgressData
                }));

                // Update completed items set based on backend data
                const completedItemIds = itemsProgressData.items
                    ?.filter(item => item.completed_at || item.progress >= 100)
                    ?.map(item => item.content_id) || [];

                setCompletedItems(prev => {
                    const newSet = new Set(prev);
                    completedItemIds.forEach(id => newSet.add(id));
                    return newSet;
                });

                return { success: true, data: itemsProgressData };
            }
            return { success: false };
        } catch (err) {
            console.error('Failed to fetch course items progress:', err);
            return { success: false, error: err.message };
        }
    };

    // Fetch course details with items and progress
    const fetchCourseDetails = async (courseId) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getCourseById(courseId);
            if (res.success) {
                const courseData = {
                    ...res.data.course,
                    items: res.data.items || [],
                    quizzes: res.data.quizzes || []
                };

                setSelectedCourse(courseData);

                // Use bundled progress data if available, otherwise fall back to separate calls
                if (res.data.items_progress) {
                    const itemsProgressData = res.data.items_progress;
                    setCourseItemsProgress(prev => ({ ...prev, [courseId]: itemsProgressData }));
                    const completedItemIds = itemsProgressData.items
                        ?.filter(item => item.completed_at || item.progress >= 100)
                        ?.map(item => item.content_id) || [];
                    setCompletedItems(prev => {
                        const newSet = new Set(prev);
                        completedItemIds.forEach(id => newSet.add(id));
                        return newSet;
                    });
                } else {
                    await fetchCourseItemsProgress(courseId);
                }

                return { success: true, data: res.data };
            } else {
                throw new Error(res.message || 'Failed to fetch course details');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch course details';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };
    // Fetch processed documents for chatbot/viewing
    const fetchProcessedDocuments = async () => {
        try {
            const res = await getProcessedDocuments();
            if (res.success) {
                setProcessedDocuments(res.data.documents || []);
                return { success: true, data: res.data };
            }
            return { success: false, message: res.message };
        } catch (err) {
            console.error('Failed to fetch processed documents:', err);
            return { success: false, error: err.message };
        }
    };

    // Check if all items in a course are completed
    const isCourseCompleted = (courseItems) => {
        if (!courseItems || courseItems.length === 0) return false;
        return courseItems.every(item => completedItems.has(item.id));
    };

    // Get local progress calculation for a course (fallback)
    const getLocalCourseProgress = (courseItems) => {
        if (!courseItems || courseItems.length === 0) return { completed: 0, total: 0, percentage: 0 };
        const completed = courseItems.filter(item => completedItems.has(item.id)).length;
        const total = courseItems.length;
        const percentage = Math.round((completed / total) * 100);
        return { completed, total, percentage };
    };

    // Get progress for a specific item
    const getItemProgress = (courseId, itemId) => {
        const courseProgress = courseItemsProgress[courseId];
        if (!courseProgress || !courseProgress.items) return null;

        return courseProgress.items.find(item => item.content_id === itemId) || null;
    };

    // Check if an item is completed
    const isItemCompleted = (itemId) => {
        return completedItems.has(itemId);
    };

    // Star/Unstar course
    const toggleCourseStar = async (courseId) => {
        try {
            const course = courses.find(c => c.id === courseId);
            if (!course) return { success: false, message: 'Course not found' };

            let result;
            if (course.is_starred) {
                result = await unstarCourse(courseId);
            } else {
                result = await starCourse(courseId);
            }

            if (result.success) {
                setCourses(prevCourses =>
                    prevCourses.map(c =>
                        c.id === courseId
                            ? { ...c, is_starred: !c.is_starred }
                            : c
                    )
                );
                qc.invalidateQueries({ queryKey: employeeKeys.courses() });
                return { success: true, starred: !course.is_starred };
            }
            return result;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to update star status';
            return { success: false, message: errorMsg };
        }
    };

    // Enroll in a course
    const enrollInCourse = async (courseId) => {
        try {
            const result = await enrollCourse(courseId);
            if (result.success) {
                await fetchCourses();
                qc.invalidateQueries({ queryKey: employeeKeys.courses() });
                qc.invalidateQueries({ queryKey: employeeKeys.course(courseId) });
                return result;
            }
            return result;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to enroll in course';
            return { success: false, message: errorMsg };
        }
    };

    // Unenroll from a course
    const unenrollFromCourse = async (courseId) => {
        try {
            const result = await unenrollCourse(courseId);
            if (result.success) {
                setCourseItemsProgress(prev => { const next = { ...prev }; delete next[courseId]; return next; });
                setCompletedItems(new Set());
                setSelectedCourse(null);
                await fetchCourses();
                qc.invalidateQueries({ queryKey: employeeKeys.courses() });
                qc.removeQueries({ queryKey: employeeKeys.course(courseId) });
                return result;
            }
            return result;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to unenroll from course';
            return { success: false, message: errorMsg };
        }
    };

    return (
        <CourseContext.Provider
            value={{
                // State
                courses,
                selectedCourse,
                completedItems,
                courseItemsProgress,
                processedDocuments,
                loading,
                progressLoading,
                error,

                // Course functions
                fetchCourses,
                fetchCourseDetails,
                enrollInCourse,
                unenrollFromCourse,

                // Progress functions
                markModuleDone,
                updateVideoProgress,
                fetchActualCourseProgress,
                fetchCourseItemsProgress,

                // Document functions
                fetchProcessedDocuments,

                // Utility functions
                isCourseCompleted,
                getCourseProgress: getLocalCourseProgress,  // Local calculation fallback
                getItemProgress,
                isItemCompleted,
                toggleCourseStar,
            }}
        >
            {children}
        </CourseContext.Provider>
    );
};