import { useState } from 'react';
import { useLocation } from 'react-router-dom'; // ADD THIS
import TeamCard from '../../components/ui/TeamCard';
import JoinTeamModal from '../../components/ui/JoinTeamModal';
import Sidebar from '../../components/ui/Sidebar'; // ADD THIS
import { Users, Plus, Loader2, Menu, Home, GraduationCap, User, Settings } from 'lucide-react'; // ADD Menu, Home, GraduationCap, User, Settings
import { useTeams } from '../../hooks/useTeams';

const MyTeams = () => {
    const location = useLocation(); // ADD THIS
    const { teams, loading, error, joinTeam, regerenateTeamCode } = useTeams();
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // ADD SIDEBAR STATE
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // ADD NAV ITEMS
    const navItems = [
        { icon: GraduationCap, label: 'My Courses', path: '/employee/mycourses' },
        { icon: Users, label: 'My Teams', path: '/employee/myteams' },
        { icon: Settings, label: 'Chatbot', path: '/employee/chatbot' },
    ];

    // YOUR ORIGINAL HANDLERS - DON'T TOUCH
    const handleJoinTeam = async (code) => {
        console.log('Joining team with code:', code);
        const result = await joinTeam(code);
        console.log('Join team result:', result);
        if (result.success) {
            setSuccessMessage('Successfully joined the team!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }
        return result;
    };

    const handleRegenerateCode = async (teamId) => {
        console.log('Regenerating code for team ID:', teamId);
        const result = await regerenateTeamCode(teamId);
        console.log('Regenerate code result:', result);
        if (result.success) {
            setSuccessMessage(`Join code regenerated successfully! New code: ${result.data.join_code}`);
            setTimeout(() => setSuccessMessage(''), 5000);
        }
        return result;
    };

    // Loading State - WRAP WITH SIDEBAR
    if (loading && teams.length === 0) {
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
                    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                        <div className="mx-auto max-w-7xl">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">My Teams</h1>
                                <p className="mt-2 text-gray-600 font-medium">Loading your teams...</p>
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
                                        <div className="mb-4 h-6 w-3/4 rounded bg-gray-200"></div>
                                        <div className="mb-2 h-4 w-1/2 rounded bg-gray-200"></div>
                                        <div className="h-4 w-1/4 rounded bg-gray-200"></div>
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
    if (error && teams.length === 0) {
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
                    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                        <div className="mx-auto max-w-7xl">
                            <div className="rounded-lg bg-red-100 p-6 text-center">
                                <p className="text-lg font-semibold text-red-800">{error}</p>
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
                <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-6 pt-20 lg:pt-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">My Teams</h1>
                                <p className="mt-2 text-gray-600 font-medium">
                                    {teams.length === 0
                                        ? 'You are not part of any team yet'
                                        : `You are part of ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsJoinModalOpen(true)}
                                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-6 py-3 font-medium text-white transition-all hover:shadow-lg"
                            >
                                <Plus size={20} />
                                Join Team
                            </button>
                        </div>

                        {successMessage && (
                            <div className="mb-6 rounded-lg bg-green-100 p-4 text-center text-green-800">
                                {successMessage}
                            </div>
                        )}

                        {teams.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                                    <Users size={40} className="text-gray-400" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold text-gray-700">No Teams Yet</h3>
                                <p className="mb-6 text-gray-600">
                                    Join a team using a join code or wait for an invitation
                                </p>
                                <button
                                    onClick={() => setIsJoinModalOpen(true)}
                                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-6 py-3 font-medium text-white transition-all hover:shadow-lg"
                                >
                                    <Plus size={20} />
                                    Join Your First Team
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {teams.map((team) => (
                                    <TeamCard
                                        key={team.team_id}
                                        team={team}
                                        onRegenerateCode={handleRegenerateCode}
                                        loading={loading}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <JoinTeamModal
                isOpen={isJoinModalOpen}
                onClose={() => setIsJoinModalOpen(false)}
                onJoin={handleJoinTeam}
                loading={loading}
            />
        </>
    );
};

export default MyTeams;