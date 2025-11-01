import { useEffect, useState } from 'react'; // ADD useState
import { useLocation } from 'react-router-dom'; // ADD useLocation
import { useCourses } from '../../hooks/useCourses';
import CourseCard from '../../components/ui/CourseCard';
import Sidebar from '../../components/ui/Sidebar'; // ADD THIS
import { BookOpen, Loader2, Menu, Home, GraduationCap, User, Settings } from 'lucide-react'; // ADD Menu, Home, GraduationCap, User, Settings

const MyCourses = () => {
    const location = useLocation(); // ADD THIS
    const {
        courses,
        loading,
        error,
        fetchCourses,
        fetchActualCourseProgress,
        getCourseProgress,
    } = useCourses();

    // ADD SIDEBAR STATE
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // ADD NAV ITEMS
    const navItems = [
        { icon: GraduationCap, label: 'My Courses', path: '/employee/mycourses' },
        { icon: User, label: 'My Teams', path: '/employee/myteams' },
        { icon: Settings, label: 'Chatbot', path: '/employee/chatbot' },
    ];

    // Fetch progress for courses when they are loaded
    useEffect(() => {
        const fetchProgressForCourses = async () => {
            if (courses.length > 0) {
                // Only fetch progress for courses that don't already have progress data
                const coursesNeedingProgress = courses.filter(course => !course.progressData);
                if (coursesNeedingProgress.length > 0) {
                    console.log('Fetching progress for courses:', coursesNeedingProgress.map(c => c.id));
                    const progressPromises = coursesNeedingProgress.map(course =>
                        fetchActualCourseProgress(course.id)
                    );
                    await Promise.allSettled(progressPromises);
                }
            }
        };
        fetchProgressForCourses();
    }, [courses.length, fetchActualCourseProgress]);

    // Loading State - WRAP WITH SIDEBAR
    if (loading && courses.length === 0) {
        return (
            <>
                <Sidebar
                    isOpen={isSidebarOpen}
                    isCollapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    navItems={navItems}
                    currentPath={location.pathname}
                />
                <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="fixed left-4 top-4 z-10 rounded-lg bg-white p-2 shadow-lg lg:hidden">
                        <Menu size={24} className="text-gray-700" />
                    </button>
                    {/* YOUR ORIGINAL LOADING CONTENT */}
                    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">My Courses</h1>
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
            </>
        );
    }

    // Error State - WRAP WITH SIDEBAR
    if (error && courses.length === 0) {
        return (
            <>
                <Sidebar
                    isOpen={isSidebarOpen}
                    isCollapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    navItems={navItems}
                    currentPath={location.pathname}
                />
                <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="fixed left-4 top-4 z-10 rounded-lg bg-white p-2 shadow-lg lg:hidden">
                        <Menu size={24} className="text-gray-700" />
                    </button>
                    {/* YOUR ORIGINAL ERROR CONTENT */}
                    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                        <div className="mx-auto max-w-7xl">
                            <div className="rounded-lg bg-red-100 p-6 text-center">
                                <p className="text-lg font-semibold text-red-800">{error}</p>
                                <button
                                    onClick={fetchCourses}
                                    className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Main Content - WRAP WITH SIDEBAR
    return (
        <>
            <Sidebar
                isOpen={isSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                navItems={navItems}
                currentPath={location.pathname}
            />
            <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="fixed left-4 top-4 z-10 rounded-lg bg-white p-2 shadow-lg lg:hidden">
                    <Menu size={24} className="text-gray-700" />
                </button>
                {/* YOUR ORIGINAL MAIN CONTENT - EXACTLY AS IT WAS */}
                <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">My Courses</h1>
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
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {courses.map((course) => {
                                    const progress = course.progressData
                                        ? {
                                            completed: course.progressData.completed_items,
                                            total: course.progressData.total_items,
                                            percentage: Math.round(course.progressData.percent)
                                        }
                                        : null;
                                    return (
                                        <CourseCard
                                            key={course.id}
                                            course={course}
                                            progress={progress}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MyCourses;