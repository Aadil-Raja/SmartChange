import { useEffect, useState } from 'react';
import { useCourses } from '../../hooks/useCourses';
import CourseCard from '../../components/ui/CourseCard';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import Input from '../../components/ui/Input';
import { BookOpen, Search } from 'lucide-react';

const MyCourses = () => {
    const {
        courses,
        loading,
        error,
        fetchCourses,
    } = useCourses();

    const [navCollapsed, setNavCollapsed] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, in-progress, completed, not-enrolled, expired

    // Load courses when component mounts
    useEffect(() => {
        fetchCourses();
    }, []);

    // Loading State
    if (loading && courses.length === 0) {
        return (
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <EmployeeSidebar 
                    collapsed={navCollapsed} 
                    onToggle={() => setNavCollapsed(!navCollapsed)} 
                />
                <div className="flex-1 overflow-auto">
                    {/* Page Header */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="max-w-7xl mx-auto">
                            <h1 className="text-2xl font-bold text-[#333333]">My Courses</h1>
                            <p className="text-gray-600 mt-1">Track your learning progress and access course materials</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-[#333333]">Available Courses</h1>
                            <p className="mt-2 text-gray-600 font-medium">Loading your courses...</p>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
                                    <div className="mb-4 h-48 rounded-lg bg-gray-200"></div>
                                    <div className="mb-4 h-6 w-3/4 rounded bg-gray-200"></div>
                                    <div className="mb-2 h-4 w-full rounded bg-gray-200"></div>
                                    <div className="h-4 w-2/3 rounded bg-gray-200"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error State
    if (error && courses.length === 0) {
        return (
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <EmployeeSidebar 
                    collapsed={navCollapsed} 
                    onToggle={() => setNavCollapsed(!navCollapsed)} 
                />
                <div className="flex-1 overflow-auto">
                    {/* Page Header */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="max-w-7xl mx-auto">
                            <h1 className="text-2xl font-bold text-[#333333]">My Courses</h1>
                            <p className="text-gray-600 mt-1">Track your learning progress and access course materials</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="rounded-md bg-red-50 border border-red-200 p-6 text-center shadow-md">
                            <p className="text-lg font-semibold text-red-800">{error}</p>
                            <button
                                onClick={fetchCourses}
                                className="mt-4 h-10 px-6 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-all shadow-md hover:shadow-lg"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main Content
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <EmployeeSidebar 
                collapsed={navCollapsed} 
                onToggle={() => setNavCollapsed(!navCollapsed)} 
            />
            <div className="flex-1 overflow-auto">
                {/* Page Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="max-w-7xl mx-auto">
                        <h1 className="text-2xl font-bold text-[#333333]">My Courses</h1>
                        <p className="text-gray-600 mt-1">Track your learning progress and access course materials</p>
                    </div>
                </div>
                
                <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-[#333333]">Available Courses</h1>
                            <p className="mt-2 text-gray-600 font-medium">
                                {courses.length === 0
                                    ? 'No courses assigned yet'
                                    : `You have ${courses.length} ${courses.length === 1 ? 'course' : 'courses'} available`}
                            </p>
                        </div>
                        {courses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                                    <BookOpen size={40} className="text-gray-400" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold text-gray-700">No Courses Yet</h3>
                                <p className="text-gray-600">Courses assigned to you will appear here</p>
                            </div>
                        ) : (
                            <>
                                {/* Search and Filter Section */}
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex-1 max-w-md">
                                        <Input
                                            type="text"
                                            placeholder="Search courses..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            icon={Search}
                                            size="md"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setStatusFilter('all')}
                                            className={`px-4 h-10 rounded-md text-sm font-medium transition-all ${
                                                statusFilter === 'all'
                                                    ? 'bg-[#F58220] text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                                            }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('not-enrolled')}
                                            className={`px-4 h-10 rounded-md text-sm font-medium transition-all ${
                                                statusFilter === 'not-enrolled'
                                                    ? 'bg-[#F58220] text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                                            }`}
                                        >
                                            Not Enrolled
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('in-progress')}
                                            className={`px-4 h-10 rounded-md text-sm font-medium transition-all ${
                                                statusFilter === 'in-progress'
                                                    ? 'bg-[#F58220] text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                                            }`}
                                        >
                                            In Progress
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('completed')}
                                            className={`px-4 h-10 rounded-md text-sm font-medium transition-all ${
                                                statusFilter === 'completed'
                                                    ? 'bg-[#F58220] text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                                            }`}
                                        >
                                            Completed
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('starred')}
                                            className={`px-4 h-10 rounded-md text-sm font-medium transition-all ${
                                                statusFilter === 'starred'
                                                    ? 'bg-[#F58220] text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#F58220]'
                                            }`}
                                        >
                                            Starred
                                        </button>
                                    </div>
                                </div>

                                {/* Course Grid */}
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {courses
                                        .filter((course) => {
                                            // Search filter
                                            const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                                (course.department && course.department.toLowerCase().includes(searchQuery.toLowerCase()));
                                            
                                            // Status filter using new category field
                                            if (statusFilter === 'all') return matchesSearch;
                                            if (statusFilter === 'not-enrolled') return matchesSearch && course.category === 'not_enrolled';
                                            if (statusFilter === 'in-progress') return matchesSearch && course.category === 'in_progress';
                                            if (statusFilter === 'completed') return matchesSearch && course.category === 'completed';
                                            if (statusFilter === 'starred') return matchesSearch && course.is_starred;
                                            
                                            return matchesSearch;
                                        })
                                        .map((course) => {
                                            // Use progress from API response
                                            const progress = course.progress ? {
                                                completed: course.progress.completed_items,
                                                total: course.progress.total_items,
                                                percentage: Math.round(course.progress.percent)
                                            } : null;
                                            
                                            return (
                                                <CourseCard
                                                    key={course.id}
                                                    course={course}
                                                    progress={progress}
                                                />
                                            );
                                        })}
                                </div>

                                {/* No Results Message */}
                                {courses.filter((course) => {
                                    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                        (course.department && course.department.toLowerCase().includes(searchQuery.toLowerCase()));
                                    
                                    if (statusFilter === 'all') return matchesSearch;
                                    if (statusFilter === 'not-enrolled') return matchesSearch && course.category === 'not_enrolled';
                                    if (statusFilter === 'in-progress') return matchesSearch && course.category === 'in_progress';
                                    if (statusFilter === 'completed') return matchesSearch && course.category === 'completed';
                                    if (statusFilter === 'starred') return matchesSearch && course.is_starred;
                                    
                                    return matchesSearch;
                                }).length === 0 && (
                                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center mt-6">
                                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                                            <Search size={40} className="text-gray-400" />
                                        </div>
                                        <h3 className="mb-2 text-xl font-semibold text-gray-700">No Courses Found</h3>
                                        <p className="text-gray-600">Try adjusting your search or filter criteria</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyCourses;