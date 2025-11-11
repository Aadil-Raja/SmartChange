// src/pages/admin/training/AdminTrainingList.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import { Plus, BookOpen, Calendar, Menu, Home, Users, Settings, FileText, Search, Filter, MoreVertical, Edit, Trash2, Power, PowerOff } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import Sidebar from "../../components/ui/Sidebar";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const AdminTrainingList = () => {
  const navigate = useNavigate();
  const { 
    courses, 
    loading, 
    error, 
    success,
    fetchCourses, 
    activateExistingCourse,
    deactivateExistingCourse,
    deleteExistingCourse,
    clearMessages 
  } = useAdminTraining();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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

  // Filter courses based on search and status
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (course.department && course.department.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && course.is_active) ||
                         (filter === 'inactive' && !course.is_active);
    
    return matchesSearch && matchesFilter;
  });

  const handleToggleStatus = async (course) => {
    if (course.is_active) {
      await deactivateExistingCourse(course.id);
    } else {
      await activateExistingCourse(course.id);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    const result = await deleteExistingCourse(courseId);
    if (result.success) {
      setShowDeleteConfirm(null);
    }
  };

  if (loading && courses.length === 0) {
    return (
      <div className="flex min-h-screen bg-gray-50">
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
    <div className="flex min-h-screen bg-gray-50">
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
            <h1 className="text-xl font-bold text-[#333333]">Training Management</h1>
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
          <h1 className="text-3xl font-bold text-[#333333]">Training Courses</h1>
          <p className="text-gray-600 mt-1">Manage all training courses and content</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>Total: {courses.length}</span>
            <span className="text-[#78BE20]">Active: {courses.filter(c => c.is_active).length}</span>
            <span className="text-gray-500">Inactive: {courses.filter(c => !c.is_active).length}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate("/admin/training/library")}
            className="flex items-center gap-2"
          >
            <FileText size={20} />
            Content Library
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/admin/training/create")}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Create Course
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <Alert variant="success" className="mb-6" onClose={clearMessages}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-6" onClose={clearMessages}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] transition-colors"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'active' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              Active
            </Button>
            <Button
              variant={filter === 'inactive' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('inactive')}
            >
              Inactive
            </Button>
          </div>
        </div>
      </Card>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {courses.length === 0 ? "No courses yet" : "No courses match your filters"}
          </h3>
          <p className="text-gray-500 mb-6">
            {courses.length === 0 
              ? "Get started by creating your first training course"
              : "Try adjusting your search or filter criteria"
            }
          </p>
          {courses.length === 0 && (
            <Button onClick={() => navigate("/admin/training/create")}>
              Create First Course
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="hover:shadow-lg transition-all group relative"
            >
              {/* Course Actions Dropdown */}
              <div className="absolute top-4 right-4 z-10">
                <div className="relative group/menu">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical size={16} />
                  </Button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[160px] opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/training/course/${course.id}`);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <BookOpen size={16} />
                      View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/training/edit/${course.id}`);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#F58220] hover:bg-orange-50 flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Edit Course
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(course);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      {course.is_active ? (
                        <>
                          <PowerOff size={16} />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Power size={16} />
                          Activate
                        </>
                      )}
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(course);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Thumbnail */}
              <div 
                className="aspect-video bg-gray-50 rounded-t-xl overflow-hidden mb-4 cursor-pointer border-b border-gray-200"
                onClick={() => navigate(`/admin/training/course/${course.id}`)}
              >
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <BookOpen size={48} className="text-gray-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div 
                className="px-4 pb-4 cursor-pointer"
                onClick={() => navigate(`/admin/training/course/${course.id}`)}
              >
                <h3 className="text-lg font-semibold text-[#333333] mb-2 line-clamp-2 group-hover:text-[#F58220] transition-colors">
                  {course.title}
                </h3>
                
                {course.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {course.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{formatDate(course.created_at)}</span>
                  </div>
                  {course.department && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-300">
                      {course.department}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                      course.is_active
                        ? "bg-[#78BE20]/10 text-[#6AAD1C] border border-[#78BE20]/30"
                        : "bg-gray-100 text-gray-700 border border-gray-300"
                    }`}
                  >
                    {course.is_active ? "Active" : "Inactive"}
                  </span>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/training/edit/${course.id}`);
                      }}
                      className="text-gray-500 hover:text-[#F58220]"
                    >
                      <Edit size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Course"
          message={`Are you sure you want to delete "${showDeleteConfirm.title}"? This action cannot be undone and will remove all course content.`}
          confirmText="Delete Course"
          cancelText="Cancel"
          onConfirm={() => handleDeleteCourse(showDeleteConfirm.id)}
          onCancel={() => setShowDeleteConfirm(null)}
          variant="danger"
        />
      )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminTrainingList;