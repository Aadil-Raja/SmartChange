import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Copy, RefreshCw, Check, Crown, UserCheck, Megaphone, ArrowUpRight, Trophy } from 'lucide-react';

const TeamCard = ({ team, onRegenerateCode, loading }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [arrowHovered, setArrowHovered] = useState(false);

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
    <div
      className="rounded-[20px] border border-gray-200 bg-white overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        boxShadow: hovered ? '0 12px 32px rgba(26,18,9,0.13)' : '0 2px 8px rgba(26,18,9,0.06)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
    >
      <div className="relative h-36 flex items-center justify-center overflow-hidden" style={{ background: '#fff0e8' }}>
        <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full" style={{ background: 'rgba(245,130,32,0.08)' }} />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'rgba(245,130,32,0.06)' }} />
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center z-10" style={{ background: '#1a1209' }}>
          <Users size={30} className="text-[#faf6ef]" />
        </div>
      </div>

      <div className="px-5 pt-4 pb-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold leading-snug line-clamp-2" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>
            {team.team_name}
          </h3>
          <Megaphone size={18} style={{ color: '#9c8e80' }} className="flex-shrink-0 mt-1" />
        </div>

        <div className="mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={
              isManager
                ? { background: '#fff0e8', color: '#E0741C' }
                : { background: '#e8f4fd', color: '#0ea5e9' }
            }
          >
            {isManager ? <Crown size={12} /> : <UserCheck size={12} />}
            {isManager ? 'Manager' : 'Member'}
          </span>
        </div>

        {isManager && (
          <div className="mb-4 rounded-xl p-3" style={{ background: '#faf6ef', border: '1px solid #ede8e0' }}>
            <p className="mb-2 text-xs font-semibold" style={{ color: '#6b5e4e' }}>Team Join Code</p>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded-lg px-3 py-1.5 font-mono text-sm font-bold" style={{ background: 'white', color: '#f7953f', border: '1px solid #e8e0d4' }}>
                {team.join_code}
              </code>
              <div className="flex gap-1">
                <button
                  onClick={handleCopyCode}
                  disabled={loading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'white', color: '#6b5e4e', border: '1px solid #e8e0d4' }}
                  title="Copy code"
                >
                  {copied ? <Check size={14} className="text-[#0d9488]" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={handleRegenerateCode}
                  disabled={loading || regenerating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'white', color: '#6b5e4e', border: '1px solid #e8e0d4' }}
                  title="Regenerate code"
                >
                  <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: '#9c8e80' }}>View Announcements</span>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: '#fff0e8', color: '#E0741C', border: '1px solid #fde0c8' }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/employee/team/${team.team_id}/leaderboard`);
              }}
              title="View leaderboard"
            >
              <Trophy size={12} /> Leaderboard
            </button>
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
              style={{ background: arrowHovered ? '#f7953f' : '#1a1209' }}
              onMouseEnter={() => setArrowHovered(true)}
              onMouseLeave={() => setArrowHovered(false)}
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              title="Open team"
            >
              <ArrowUpRight size={14} color="#fff" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCard;
