import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from './Card';
import { Users, Copy, RefreshCw, Check, Crown, UserCheck, Megaphone, ChevronRight } from 'lucide-react';

const TeamCard = ({ team, onRegenerateCode, loading }) => {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const isManager = team.role_in_team === 'manager';

    const handleCopyCode = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(team.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleRegenerateCode = async (e) => {
        e.stopPropagation();
        setRegenerating(true);
        await onRegenerateCode(team.team_id);
        setRegenerating(false);
    };

    const handleCardClick = () => {
        navigate(`/employee/team/${team.team_id}/announcements`);
    };

    return (
        <>
        <Card
            variant="default"
            padding="lg"
            shadow="md"
            hover={true}
            onClick={handleCardClick}
            className="group"
        >
            {/* Team Icon & Name */}
            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-md">
                        <Users size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#333333] group-hover:text-[#F58220] transition-colors">
                            {team.team_name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1">
                            {isManager ? (
                                <>
                                    <Crown size={14} className="text-[#FDB913]" />
                                    <span className="text-xs font-medium text-[#FDB913]">Manager</span>
                                </>
                            ) : (
                                <>
                                    <UserCheck size={14} className="text-[#00ADEF]" />
                                    <span className="text-xs font-medium text-[#00ADEF]">Member</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <Megaphone size={20} className="text-gray-400 group-hover:text-[#F58220] transition-colors" />
            </div>

            {/* Manager Actions Section - Only show for managers */}
            {isManager && (
                <div className="mb-4 space-y-3">
                    {/* Team Join Code */}
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-[#333333]">Team Join Code</p>
                        <div className="flex items-center justify-between gap-2">
                            <code className="rounded-md bg-white px-3 py-1.5 font-mono text-sm font-bold text-[#F58220] border border-gray-200">
                                {team.join_code}
                            </code>
                            <div className="flex gap-1">
                                <button
                                    onClick={handleCopyCode}
                                    disabled={loading}
                                    className="rounded-md p-2 text-gray-600 transition-all hover:bg-white hover:text-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy code"
                                >
                                    {copied ? <Check size={16} className="text-[#78BE20]" /> : <Copy size={16} />}
                                </button>
                                <button
                                    onClick={handleRegenerateCode}
                                    disabled={loading || regenerating}
                                    className="rounded-md p-2 text-gray-600 transition-all hover:bg-white hover:text-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Regenerate code"
                                >
                                    <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* View Announcements CTA */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600 group-hover:text-[#F58220] transition-colors">
                    <span className="font-medium">View Announcements</span>
                    <ChevronRight size={20} className="transform group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </Card>
        </>
    );
};

export default TeamCard;