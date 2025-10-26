// src/components/ui/TeamCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Copy, RefreshCw, Check, Crown, UserCheck, Megaphone } from 'lucide-react';

const TeamCard = ({ team, onRegenerateCode, loading }) => {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const isManager = team.role_in_team === 'manager';

    const handleCopyCode = async (e) => {
        e.stopPropagation(); // Prevent card click
        try {
            await navigator.clipboard.writeText(team.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleRegenerateCode = async (e) => {
        e.stopPropagation(); // Prevent card click
        setRegenerating(true);
        await onRegenerateCode(team.team_id);
        setRegenerating(false);
    };

    // Navigate to announcements when card is clicked
    const handleCardClick = () => {
        navigate(`/employee/team/${team.team_id}/announcements`);
    };

    return (
        <div
            onClick={handleCardClick}
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:scale-105 cursor-pointer"
        >
            {/* Gradient background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50 opacity-0 transition-opacity group-hover:opacity-100"></div>

            <div className="relative z-10">
                {/* Team Icon & Name */}
                <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]">
                            <Users size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#333333] group-hover:text-[#F58220] transition-colors">
                                {team.team_name}
                            </h3>
                            <div className="flex items-center gap-1 mt-1">
                                {isManager ? (
                                    <>
                                        <Crown size={14} className="text-amber-500" />
                                        <span className="text-xs font-medium text-amber-600">Manager</span>
                                    </>
                                ) : (
                                    <>
                                        <UserCheck size={14} className="text-blue-500" />
                                        <span className="text-xs font-medium text-blue-600">Member</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <Megaphone size={20} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>

                {/* Team Code Section - Only show for managers */}
                {isManager && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-medium text-gray-600">Team Join Code</p>
                        <div className="flex items-center justify-between gap-2">
                            <code className="rounded bg-white px-3 py-1 font-mono text-sm font-bold text-[#F58220]">
                                {team.join_code}
                            </code>
                            <div className="flex gap-1">
                                <button
                                    onClick={handleCopyCode}
                                    disabled={loading}
                                    className="rounded-lg p-2 text-gray-600 transition-all hover:bg-white hover:text-[#F58220] disabled:opacity-50"
                                    title="Copy code"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                </button>
                                <button
                                    onClick={handleRegenerateCode}
                                    disabled={loading || regenerating}
                                    className="rounded-lg p-2 text-gray-600 transition-all hover:bg-white hover:text-[#F58220] disabled:opacity-50"
                                    title="Regenerate code"
                                >
                                    <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Announcements CTA */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600 group-hover:text-indigo-600 transition-colors">
                        <span className="font-medium">View Announcements</span>
                        <svg
                            className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamCard;