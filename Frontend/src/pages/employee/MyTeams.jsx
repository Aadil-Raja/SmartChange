import { useState, useEffect, useRef } from 'react';
import TeamCard from '../../components/ui/TeamCard';
import JoinTeamModal from '../../components/ui/JoinTeamModal';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import Button from '../../components/ui/Button';
import { Users, Plus } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';

const MyTeams = () => {
    const { teams, loading, error, joinTeam, regerenateTeamCode, loadTeams } = useTeams();
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [navCollapsed, setNavCollapsed] = useState(true);
    const hasFetched = useRef(false);

    // Load teams when component mounts (only once)
    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            loadTeams();
        }
    }, []);

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

    // Loading State
    if (loading && teams.length === 0) {
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
                            <h1 className="text-2xl font-bold text-[#333333]">My Teams</h1>
                            <p className="text-gray-600 mt-1">Collaborate with your team members and manage projects</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-[#333333]">Current Teams</h1>
                            <p className="mt-2 text-gray-600">Loading your teams...</p>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-md">
                                    <div className="mb-4 h-6 w-3/4 rounded bg-gray-200"></div>
                                    <div className="mb-2 h-4 w-1/2 rounded bg-gray-200"></div>
                                    <div className="h-4 w-1/4 rounded bg-gray-200"></div>
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
    if (error && teams.length === 0) {
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
                            <h1 className="text-2xl font-bold text-[#333333]">My Teams</h1>
                            <p className="text-gray-600 mt-1">Collaborate with your team members and manage projects</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="rounded-md bg-red-50 border border-red-200 p-6 text-center shadow-md">
                            <p className="text-lg font-semibold text-red-800">{error}</p>
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
                        <h1 className="text-2xl font-bold text-[#333333]">My Teams</h1>
                        <p className="text-gray-600 mt-1">Collaborate with your team members and manage projects</p>
                    </div>
                </div>
                
                <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-[#333333]">Current Teams</h1>
                                <p className="mt-2 text-gray-600">
                                    {teams.length === 0
                                        ? 'You are not part of any team yet'
                                        : `You are part of ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
                                </p>
                            </div>
                            <Button
                                onClick={() => setIsJoinModalOpen(true)}
                                variant="primary"
                                size="md"
                                fullWidth={false}
                            >
                                <Plus size={20} />
                                Join Team
                            </Button>
                        </div>

                        {successMessage && (
                            <div className="mb-6 rounded-md bg-[#78BE20]/10 border border-[#78BE20]/30 p-4 text-center shadow-md">
                                <p className="text-[#6AAD1C] font-medium">{successMessage}</p>
                            </div>
                        )}

                        {teams.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-md">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                                    <Users size={40} className="text-gray-400" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold text-[#333333]">No Teams Yet</h3>
                                <p className="mb-6 text-gray-600">
                                    Join a team using a join code or wait for an invitation
                                </p>
                                <Button
                                    onClick={() => setIsJoinModalOpen(true)}
                                    variant="primary"
                                    size="md"
                                    fullWidth={false}
                                >
                                    <Plus size={20} />
                                    Join Your First Team
                                </Button>
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

                <JoinTeamModal
                    isOpen={isJoinModalOpen}
                    onClose={() => setIsJoinModalOpen(false)}
                    onJoin={handleJoinTeam}
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default MyTeams;