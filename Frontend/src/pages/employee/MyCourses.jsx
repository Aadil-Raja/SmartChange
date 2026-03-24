import { useEffect, useState, useRef } from 'react';
import { useCourses } from '../../hooks/useCourses';
import CourseCard from '../../components/ui/CourseCard';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
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
    const [statusFilter, setStatusFilter] = useState('all');
    const hasFetched = useRef(false);

    // Load courses when component mounts (only once)
    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchCourses();
        }
    }, []);

    // Loading State
    if (loading && courses.length === 0) {
        return (
            <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
                <EmployeeSidebar 
                    collapsed={navCollapsed} 
                    onToggle={() => setNavCollapsed(!navCollapsed)} 
                />
                <div className="flex-1 overflow-auto">
                    {/* Hero Banner */}
                    <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
                    <div>
                            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
                                My Courses
                            </h1>
                            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
                                Track your progress and access course materials
                            </p>
                    </div>
                    <div className="flex items-center gap-3">
                                <StatPill label="Courses" count={0} dotColor="#1a1918" />
                        </div>
                    </div>
                    
                    <div className="px-8 py-6">
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
        );
    }

    // Error State
    if (error && courses.length === 0) {
        return (
            <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
                <EmployeeSidebar 
                    collapsed={navCollapsed} 
                    onToggle={() => setNavCollapsed(!navCollapsed)} 
                />
                <div className="flex-1 overflow-auto">
                    {/* Hero Banner */}
                    <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
                                My Courses
                            </h1>
                            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
                                Track your progress and access course materials
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatPill label="Courses" count={courses.length} dotColor="#1a1918" />
                        </div>
                    </div>
                    
                    <div className="px-8 py-6">
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
        );
    }

    // Main Content
    return (
        <div className="flex h-screen overflow-hidden" style={{ background: "#faf6ef" }}>
            <EmployeeSidebar 
                collapsed={navCollapsed} 
                onToggle={() => setNavCollapsed(!navCollapsed)} 
            />
            <div className="flex-1 overflow-auto">
                {/* Hero Banner */}
                <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
                                My Courses
                            </h1>
                            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
                                Track your progress and access course materials
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatPill label="Courses" count={courses.length} dotColor="#1a1918" />
                        </div>
                </div>
                
                <div className="px-8 py-6 max-w-7xl mx-auto">
                    {courses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                                    <BookOpen size={40} className="text-gray-400" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold text-gray-700">No Courses Yet</h3>
                                <p className="text-gray-600">Courses assigned to you will appear here</p>
                            </div>
                        ) : (
                            <>
                                {/* Toolbar */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-7">
                                    {/* Search */}
                                    <div className="relative flex-1 max-w-sm">
                                        <Search
                                            size={16}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search courses..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all"
                                        />
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <div className="flex rounded-full p-1 gap-1" style={{ background: "#e8e0d4" }}>
                                            {["all", "in-progress", "completed"].map((f) => (
                                                <button
                                                    key={f}
                                                    onClick={() => setStatusFilter(f)}
                                                    className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200"
                                                    style={
                                                        statusFilter === f
                                                            ? { background: "#705536", color: "#faf6ef" }
                                                            : { color: "#6b5e4e", background: "transparent" }
                                                    }
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
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
                                            if (statusFilter === 'in-progress') return matchesSearch && course.category === 'in_progress';
                                            if (statusFilter === 'completed') return matchesSearch && course.category === 'completed';
                                            
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
                            </>
                        )}
                </div>
            </div>
        </div>
    );
};

// ── Stat Pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ label, count, dotColor }) => (
    <div
        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
        style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}
    >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
        {label}: <span className="font-bold ml-0.5">{count}</span>
    </div>
);

export default MyCourses;

