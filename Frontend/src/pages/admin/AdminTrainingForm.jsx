// src/pages/admin/training/AdminTrainingForm.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { ArrowLeft, Save } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input2 from "../../components/ui/Input2";
import TextArea2 from "../../components/ui/TextArea2";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";

const AdminTrainingForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const {
    currentCourse,
    loading,
    error,
    success,
    createNewCourse,
    updateExistingCourse,
    fetchCourseDetails,
    clearMessages,
  } = useAdminTraining();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
  });

  const [submitting, setSubmitting] = useState(false);
  
  const hasFetchedCourse = useRef(false);

  // Load course data if editing
  useEffect(() => {
    if (isEditMode && id && !hasFetchedCourse.current) {
      fetchCourseDetails(id);
      hasFetchedCourse.current = true;
    }
    return () => clearMessages();
  }, [id, isEditMode]);

  // Populate form when course is loaded
  useEffect(() => {
    if (isEditMode && currentCourse) {
      setFormData({
        title: currentCourse.title || "",
        description: currentCourse.description || "",
        department: currentCourse.department || "",
      });
    }
  }, [currentCourse, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    clearMessages();

    // Prepare data (remove empty strings)
    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      department: formData.department.trim() || undefined,
    };

    let result;
    if (isEditMode) {
      result = await updateExistingCourse(id, submitData);
    } else {
      result = await createNewCourse(submitData);
    }

    setSubmitting(false);

    if (result.success) {
      setTimeout(() => {
        if (isEditMode) {
          navigate(`/admin/training/course/${id}`);
        } else {
          navigate("/admin/training");
        }
      }, 1500);
    }
  };

  if (loading && isEditMode && !currentCourse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/training")}
          className="mb-4 flex items-center gap-2"
          fullWidth={false}
        >
          <ArrowLeft size={20} />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-[#333333]">
          {isEditMode ? "Edit Course" : "Create New Course"}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditMode
            ? "Update course information"
            : "Fill in the details to create a new training course"}
        </p>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert variant="success" className="mb-6" onClose={clearMessages}>
          {success}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6" onClose={clearMessages}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <Input2
            label="Course Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Introduction to React"
            required
            disabled={submitting}
          />

          {/* Description */}
          <TextArea2
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what this course covers..."
            rows={5}
            disabled={submitting}
          />

          {/* Department */}
          <Input2
            label="Department (Optional)"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="e.g., Engineering, Marketing"
            disabled={submitting}
          />

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/admin/training")}
              disabled={submitting}
              fullWidth={false}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={submitting} 
              fullWidth={false}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="small" />
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {isEditMode ? "Update Course" : "Create Course"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminTrainingForm;