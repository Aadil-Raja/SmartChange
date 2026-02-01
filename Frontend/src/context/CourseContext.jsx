import { createContext, useState, useRef } from "react";
import {
    getEmployeeCoursesOverview,
    getEmployeeCourses,
    getCourseById,
    updateContentProgress,
    getCourseProgress,
    getCourseItemsProgress,
    getProcessedDocuments,
    starCourse,
    unstarCourse
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


    // Fetch all courses with enhanced data from overview API
    const fetchCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both all courses and overview data in parallel
            const [allCoursesRes, overviewRes] = await Promise.all([
                getEmployeeCourses(),
                getEmployeeCoursesOverview()
            ]);

            if (allCoursesRes.success) {
                const allCourses = allCoursesRes.data.courses || [];
                
                // Create maps for quick lookup from overview data
                const starredMap = new Map();
                const progressMap = new Map();
                
                if (overviewRes.success) {
                    // Map starred courses
                    (overviewRes.data.starred || []).forEach(course => {
                        starredMap.set(course.id, course);
                    });
                    
                    // Map courses with progress data
                    [...(overviewRes.data.in_progress || []), ...(overviewRes.data.completed || [])].forEach(course => {
                        progressMap.set(course.id, course);
                    });
                }

                // Enhance all courses with starred status and progress data
                const enhancedCourses = allCourses.map(course => {
                    const starredData = starredMap.get(course.id);
                    const progressData = progressMap.get(course.id);
                    
                    return {
                        ...course,
                        is_starred: !!starredData,
                        // Add progress data if available
                        ...(progressData && {
                            progress: progressData.progress,
                            completed_items: progressData.completed_items,
                            total_items: progressData.total_items
                        })
                    };
                });

                setCourses(enhancedCourses);
                return { success: true, data: enhancedCourses };
            } else {
                throw new Error(allCoursesRes.message || 'Failed to fetch courses');
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

                // If we have a selected course, refresh its progress and items progress
                if (selectedCourse) {
                    await Promise.all([
                        fetchActualCourseProgress(selectedCourse.id),
                        fetchCourseItemsProgress(selectedCourse.id)
                    ]);
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

                // Fetch both overall progress and detailed items progress
                await Promise.all([
                    fetchActualCourseProgress(courseId),
                    fetchCourseItemsProgress(courseId)
                ]);

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
                // Update the course in the local state
                setCourses(prevCourses =>
                    prevCourses.map(c =>
                        c.id === courseId
                            ? { ...c, is_starred: !c.is_starred }
                            : c
                    )
                );
                return { success: true, starred: !course.is_starred };
            }
            return result;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to update star status';
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