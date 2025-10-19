import { createContext, useState, useEffect, useRef } from "react";
import {
    getEmployeeCourses,
    getCourseById,
    updateContentProgress,  // ADD THIS
    getCourseProgress       // ADD THIS
} from "../services/courseApi";

export const CourseContext = createContext(null);

export const CourseProvider = ({ children }) => {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [completedItems, setCompletedItems] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progressLoading, setProgressLoading] = useState(false);
    const fetchingProgress = useRef(new Set());
    // Load courses on mount if employee is logged in
    useEffect(() => {
        const token = localStorage.getItem('employeeToken');
        if (token) {
            fetchCourses();
        }
    }, []);

    // Fetch all courses
    const fetchCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getEmployeeCourses();
            if (res.success) {
                setCourses(res.data.courses || []);
                return { success: true, data: res.data.courses };
            } else {
                throw new Error(res.message || 'Failed to fetch courses');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch courses';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    const markModuleDone = async (itemId, itemType = 'document') => {
        setLoading(true);
        setError(null);
        try {
            // Prepare payload based on item type
            const payload = itemType === 'video'
                ? { progress: 100, completed: true }  // For videos, send progress 100
                : { completed: true };                // For docs/links, just completed

            const res = await updateContentProgress(itemId, payload);

            if (res.success) {
                // Update local state
                setCompletedItems(prev => new Set([...prev, itemId]));

                // If we have a selected course, refresh its progress
                if (selectedCourse) {
                    await fetchActualCourseProgress(selectedCourse.id);
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
            setLoading(false);
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
    
    // UPDATE the fetchCourseDetails function to fetch progress:
    const fetchCourseDetails = async (courseId) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getCourseById(courseId);
            if (res.success) {
                setSelectedCourse({
                    ...res.data.course,
                    items: res.data.items || []
                });

                // Fetch actual progress from backend
                await fetchActualCourseProgress(courseId);

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
    // Check if all items in a course are completed
    const isCourseCompleted = (courseItems) => {
        if (!courseItems || courseItems.length === 0) return false;
        return courseItems.every(item => completedItems.has(item.id));
    };

    // Get progress for a course
    // UPDATE the getCourseProgress function (rename to getLocalCourseProgress):
    const getLocalCourseProgress = (courseItems) => {
        if (!courseItems || courseItems.length === 0) return { completed: 0, total: 0, percentage: 0 };
        const completed = courseItems.filter(item => completedItems.has(item.id)).length;
        const total = courseItems.length;
        const percentage = Math.round((completed / total) * 100);
        return { completed, total, percentage };
    };

    return (
        <CourseContext.Provider
            value={{
                courses,
                selectedCourse,
                completedItems,
                progressLoading,
                loading,
                error,
                fetchCourses,
                fetchCourseDetails,
                markModuleDone,
                isCourseCompleted,
                getCourseProgress: getLocalCourseProgress,  // Keep local calc for fallback
                fetchActualCourseProgress,
                // ADD THIS - fetch from API
            }}
        >
            {children}
        </CourseContext.Provider>
    );
};