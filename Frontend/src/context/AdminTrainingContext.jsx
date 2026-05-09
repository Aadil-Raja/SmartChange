import { createContext, useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';
import {
  getCourses,
  createCourse,
  getCourseDetails,
  updateCourse,
  setCourseDeadline,
  setCourseThumbnail,
  deleteCourseThumbnail,
  activateCourse,
  deactivateCourse,
  deleteCourse,
  addContentItem,
  updateContentItem,
  deleteContentItem,
  reorderContentItems,
  createExternalLink,
  getExternalLinks,
  getExternalLink,
  updateExternalLink,
  deleteExternalLink,
  uploadVideo,
  getVideos,
  getVideo,
  deleteVideo,
  getProcessedDocuments,
  getAvailableEmployees,
} from "../services/trainingApi";

export const AdminTrainingContext = createContext(null);

export const AdminTrainingProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [externalLinks, setExternalLinks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const lastSuccessRef = useRef(null);
  const lastErrorRef = useRef(null);

  useEffect(() => {
    if (success && success !== lastSuccessRef.current) {
      toast.success(success);
      lastSuccessRef.current = success;
      // Auto-clear after 3 seconds
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }

    if (!success) {
      lastSuccessRef.current = null;
    }
  }, [success]);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      toast.error(error);
      lastErrorRef.current = error;
    }

    if (!error) lastErrorRef.current = null;
  }, [error]);

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
        setQuizzes(res.data?.quizzes || []);
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

  // Set / remove course deadline
  const setCourseDeadlineWeeks = async (courseId, deadline_weeks) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await setCourseDeadline(courseId, deadline_weeks);
      if (res?.success) {
        setSuccess(deadline_weeks ? "Deadline updated" : "Deadline removed");
        if (currentCourse?.id === courseId) {
          setCurrentCourse(prev => ({ ...prev, deadline_weeks: deadline_weeks ?? null }));
        }
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to update deadline");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
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

  // Reorder content items
  const reorderContent = async (courseId, items) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await reorderContentItems(courseId, items);
      if (res?.success) {
        setSuccess("Content reordered successfully");
        // Refresh course details to get updated order
        await fetchCourseDetails(courseId);
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to reorder content");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete course thumbnail
  const deleteThumbnail = async (courseId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteCourseThumbnail(courseId);
      if (res?.success) {
        setSuccess("Thumbnail deleted successfully");
        // Update current course
        if (currentCourse?.id === courseId) {
          setCurrentCourse(prev => ({ ...prev, thumbnail_url: null }));
        }
        await fetchCourses(); // Refresh list
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete thumbnail");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Activate course
  const activateExistingCourse = async (courseId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await activateCourse(courseId);
      if (res?.success) {
        setSuccess("Course activated successfully");
        await fetchCourses(); // Refresh list
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to activate course");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Deactivate course
  const deactivateExistingCourse = async (courseId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deactivateCourse(courseId);
      if (res?.success) {
        setSuccess("Course deactivated successfully");
        await fetchCourses(); // Refresh list
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to deactivate course");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete course permanently
  const deleteExistingCourse = async (courseId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteCourse(courseId);
      if (res?.success) {
        setSuccess("Course deleted successfully");
        setCourses(prev => prev.filter(course => course.id !== courseId));
        if (currentCourse?.id === courseId) {
          setCurrentCourse(null);
          setContentItems([]);
        }
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete course");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== EXTERNAL LINKS ====================

  // Fetch all external links
  const fetchExternalLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getExternalLinks();
      if (res?.success) {
        // Backend returns array directly in data field
        setExternalLinks(res.data || []);
        return { success: true, data: { links: res.data || [] } };
      } else {
        throw new Error(res.message || "Failed to fetch external links");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Create external link
  const createNewExternalLink = async (linkData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      console.log('AdminTrainingContext: Creating external link...', linkData);
      const res = await createExternalLink(linkData);
      console.log('AdminTrainingContext: Create link response:', res);
      
      if (res?.success) {
        setSuccess("External link created successfully");
        await fetchExternalLinks(); // Refresh list
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to create external link");
      }
    } catch (err) {
      console.error('AdminTrainingContext: Create link error:', err);
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Update external link
  const updateExistingExternalLink = async (linkId, linkData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateExternalLink(linkId, linkData);
      if (res?.success) {
        setSuccess("External link updated successfully");
        await fetchExternalLinks(); // Refresh list
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to update external link");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete external link
  const deleteExistingExternalLink = async (linkId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteExternalLink(linkId);
      if (res?.success) {
        setSuccess("External link deleted successfully");
        setExternalLinks(prev => prev.filter(link => link.id !== linkId));
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete external link");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // ==================== VIDEOS ====================

  // Fetch all videos
  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVideos();
      if (res?.success) {
        // Backend returns array directly in data field
        setVideos(res.data || []);
        return { success: true, data: { videos: res.data || [] } };
      } else {
        throw new Error(res.message || "Failed to fetch videos");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Upload video
  const uploadNewVideo = async (title, file) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      console.log('AdminTrainingContext: Uploading video...', { title, fileSize: file.size });
      const res = await uploadVideo(title, file);
      console.log('AdminTrainingContext: Upload response:', res);
      
      if (res?.success) {
        setSuccess("Video uploaded successfully");
        await fetchVideos(); // Refresh list
        return { success: true, data: res.data };
      } else {
        throw new Error(res.message || "Failed to upload video");
      }
    } catch (err) {
      console.error('AdminTrainingContext: Upload error:', err);
      const errorMsg = err.response?.data?.message || err.message;
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Delete video
  const deleteExistingVideo = async (videoId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteVideo(videoId);
      if (res?.success) {
        setSuccess("Video deleted successfully");
        setVideos(prev => prev.filter(video => video.id !== videoId));
        return { success: true };
      } else {
        throw new Error(res.message || "Failed to delete video");
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
        quizzes,
        externalLinks,
        videos,
        loading,
        error,
        success,
        
        // Course functions
        fetchCourses,
        createNewCourse,
        fetchCourseDetails,
        updateExistingCourse,
        setCourseDeadlineWeeks,
        uploadThumbnail,
        deleteThumbnail,
        activateExistingCourse,
        deactivateExistingCourse,
        deleteExistingCourse,
        
        // Content functions
        addContent,
        updateContent,
        deleteContent,
        reorderContent,
        
        // External Link functions
        fetchExternalLinks,
        createNewExternalLink,
        updateExistingExternalLink,
        deleteExistingExternalLink,
        
        // Video functions
        fetchVideos,
        uploadNewVideo,
        deleteExistingVideo,
        
        // Utility
        clearMessages,
        setCurrentCourse,
        
        // Additional utility functions
        fetchProcessedDocuments: async () => {
          try {
            const res = await getProcessedDocuments();
            return { success: res?.success || true, data: res?.data || res };
          } catch (err) {
            return { success: false, message: err.message };
          }
        },
        
        fetchAvailableEmployees: async () => {
          try {
            const res = await getAvailableEmployees();
            return { success: res?.success || true, data: res?.data || res };
          } catch (err) {
            return { success: false, message: err.message };
          }
        },
      }}
    >
      {children}
    </AdminTrainingContext.Provider>
  );
};