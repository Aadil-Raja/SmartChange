import { createContext, useState } from "react";
import {
  getCourses,
  createCourse,
  getCourseDetails,
  updateCourse,
  setCourseThumbnail,
  addContentItem,
  updateContentItem,
  deleteContentItem,
} from "../services/trainingApi";

export const AdminTrainingContext = createContext(null);

export const AdminTrainingProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ==================== COURSES ====================

  // Fetch all courses
  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCourses();
      if (res?.success) {
        setCourses(res.data?.courses || []);
        return { success: true, data: res.data?.courses };
      } else {
        throw new Error(res.message || "Failed to fetch courses");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Create new course
  const createNewCourse = async (courseData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createCourse(courseData);
      if (res?.success) {
        setSuccess("Course created successfully");
        await fetchCourses(); // Refresh list
        return { success: true, data: res.data?.course };
      } else {
        throw new Error(res.message || "Failed to create course");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Fetch course details with content items
  const fetchCourseDetails = async (courseId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCourseDetails(courseId);
      if (res?.success) {
        setCurrentCourse(res.data?.course || null);
        setContentItems(res.data?.items || []);
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to fetch course details");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Update course
  const updateExistingCourse = async (courseId, courseData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateCourse(courseId, courseData);
      if (res?.success) {
        setSuccess("Course updated successfully");
        // Update current course if it's the one being edited
        if (currentCourse?.id === courseId) {
          setCurrentCourse(res.data?.course);
        }
        await fetchCourses(); // Refresh list
        return { success: true, data: res.data?.course };
      } else {
        throw new Error(res.message || "Failed to update course");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Upload course thumbnail
  const uploadThumbnail = async (courseId, file) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await setCourseThumbnail(courseId, file);
      if (res?.success) {
        setSuccess("Thumbnail updated successfully");
        // Update current course thumbnail
        if (currentCourse?.id === courseId) {
          setCurrentCourse(res.data?.course);
        }
        await fetchCourses(); // Refresh list
        return { success: true, data: res.data?.course };
      } else {
        throw new Error(res.message || "Failed to upload thumbnail");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== CONTENT ITEMS ====================

  // Add content item to course
  const addContent = async (courseId, contentData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    console.log('Adding content to course ID:', courseId, 'with data:', contentData);
    try {

      const res = await addContentItem(courseId, contentData);
      if (res?.success) {
        setSuccess("Content added successfully");
        // Refresh course details
        await fetchCourseDetails(courseId);
        return { success: true, data: res.data?.item };
      } else {
        throw new Error(res.message || "Failed to add content");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Update content item
  const updateContent = async (contentId, contentData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateContentItem(contentId, contentData);
      if (res?.success) {
        setSuccess("Content updated successfully");
        // Update content items list
        setContentItems((prev) =>
          prev.map((item) =>
            item.id === contentId ? res.data?.item : item
          )
        );
        return { success: true, data: res.data?.item };
      } else {
        throw new Error(res.message || "Failed to update content");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete content item
  const deleteContent = async (contentId, courseId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteContentItem(contentId);
      if (res?.success) {
        setSuccess("Content deleted successfully");
        // Remove from content items list
        setContentItems((prev) => prev.filter((item) => item.id !== contentId));
        // Or refresh course details
        if (courseId) {
          await fetchCourseDetails(courseId);
        }
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete content");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminTrainingContext.Provider
      value={{
        // State
        courses,
        currentCourse,
        contentItems,
        loading,
        error,
        success,
        // Course functions
        fetchCourses,
        createNewCourse,
        fetchCourseDetails,
        updateExistingCourse,
        uploadThumbnail,
        // Content functions
        addContent,
        updateContent,
        deleteContent,
        // Utility
        clearMessages,
        setCurrentCourse,
      }}
    >
      {children}
    </AdminTrainingContext.Provider>
  );
};