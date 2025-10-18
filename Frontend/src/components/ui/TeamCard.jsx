import { Users, Key, Copy, Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const TeamCard = ({ team, onRegenerateCode, loading }) => {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const isManager = team.role_in_team === 'manager';
  const memberCount = team.members?.length || 0;

  const handleCopyCode = () => {
    if (team.join_code) {
      navigator.clipboard.writeText(team.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateCode = async () => {
    if (window.confirm('Are you sure you want to regenerate the join code? The old code will no longer work.')) {
      setRegenerating(true);
      await onRegenerateCode(team.team_id);
      setRegenerating(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      {/* Manager Badge */}
      {isManager && (
        <div className="absolute right-4 top-4">
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FDB913] to-[#F58220] px-3 py-1 text-xs font-semibold text-white">
            Manager
          </span>
        </div>
      )}

      {/* Team Info */}
      <div className="mb-4">
        <h3 className="mb-2 text-xl font-bold text-[#333333]">{team.team_name}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users size={16} />
          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
        </div>
      </div>

      {/* Join Code (Only for Managers) */}
      {isManager && team.join_code && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Key size={16} />
            <span>Join Code</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <code className="text-2xl font-bold tracking-wider text-[#F58220]">
              {team.join_code}
            </code>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          {/* Regenerate Button */}
          <button
            onClick={handleRegenerateCode}
            disabled={regenerating || loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
            <span>{regenerating ? 'Regenerating...' : 'Regenerate Code'}</span>
          </button>
        </div>
      )}

      {/* Role Badge */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Role: {team.role_in_team}
        </span>
      </div>
    </div>
  );
};

export default TeamCard;