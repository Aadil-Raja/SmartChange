// src/pages/admin/training/AdminTrainingList.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { Plus, BookOpen, Calendar, Menu, Home, Users, Settings, FileText } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import Sidebar from "../../components/ui/Sidebar";

const AdminTrainingList = () => {
  const navigate = useNavigate();
  const { courses, loading, error, fetchCourses, clearMessages } = useAdminTraining();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: FileText, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Teams', path: '/admin/teams' },
    { icon: Settings, label: 'Training', path: '/admin/training' },
  ];

  useEffect(() => {
    fetchCourses();
    return () => clearMessages();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading && courses.length === 0) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          navItems={navItems}
          currentPath="/admin/training"
        />
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="large" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        navItems={navItems}
        currentPath="/admin/training"
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333333] lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Training Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]" />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Training Courses</h1>
          <p className="text-gray-600 mt-1 font-medium">Manage all training courses and content</p>
        </div>
        <Button
          onClick={() => navigate("/admin/training/create")}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Course
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6" onClose={clearMessages}>
          {error}
        </Alert>
      )}

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No courses yet
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first training course
          </p>
          <Button onClick={() => navigate("/admin/training/create")}>
            Create First Course
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/admin/training/course/${course.id}`)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 rounded-t-lg overflow-hidden mb-4">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onClick={() => navigate(`/admin/training/course/${course.id}`)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <BookOpen size={48} className="text-indigo-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-4 pb-4"
              onClick={() => navigate(`/admin/training/course/${course.id}`)}>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {course.title}
                </h3>
                
                {course.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {course.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{formatDate(course.created_at)}</span>
                  </div>
                  {course.department && (
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                      {course.department}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      course.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {course.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminTrainingList;