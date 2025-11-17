// src/components/ui/TeamMembersModal.jsx
import { useState, useEffect } from 'react';
import { X, Users, Crown, UserCheck, Mail, Calendar, Loader2, ChevronRight } from 'lucide-react';
import { getTeamMembers } from '../../services/teamApi';
import MemberProgressPanel from './MemberProgressPanel';

const TeamMembersModal = ({ isOpen, onClose, team }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showProgressPanel, setShowProgressPanel] = useState(false);

  useEffect(() => {
    if (isOpen && team) {
      fetchTeamMembers();
    }
  }, [isOpen, team]);

  const fetchTeamMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getTeamMembers(team.team_id);
      if (response.success) {
        setMembers(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch team members');
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError('Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowProgressPanel(true);
  };

  const handleCloseProgressPanel = () => {
    setShowProgressPanel(false);
    setSelectedMember(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#F58220]/5 to-[#E0741C]/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-md">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#333333]">Team Members</h2>
              <p className="text-sm text-gray-600">{team?.team_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-[#F58220] mx-auto mb-4" />
                <p className="text-gray-600">Loading team members...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-red-50 rounded-full mb-4">
                <Users size={32} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Members</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchTeamMembers}
                className="px-4 py-2 bg-[#F58220] text-white rounded-lg hover:bg-[#E0741C] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
                <Users size={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Members Found</h3>
              <p className="text-gray-600">This team doesn't have any members yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#333333]">
                    {members.length} {members.length === 1 ? 'Member' : 'Members'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Click on any member to view their progress</p>
                </div>
              </div>

              <div className="grid gap-4">
                {members.map((member) => (
                  <div
                    key={member.id || member.user_id}
                    onClick={() => handleMemberClick(member)}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#F58220]/30 hover:bg-[#F58220]/5 transition-all cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#F58220] to-[#E0741C] rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {member.user_name?.charAt(0)?.toUpperCase() || 
                           member.user_email?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-[#333333] truncate">
                          {member.user_name || member.user_email}
                        </h4>
                        {member.role_in_team === 'manager' ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-[#FDB913]/10 rounded-full">
                            <Crown size={12} className="text-[#FDB913]" />
                            <span className="text-xs font-medium text-[#FDB913]">Manager</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 bg-[#00ADEF]/10 rounded-full">
                            <UserCheck size={12} className="text-[#00ADEF]" />
                            <span className="text-xs font-medium text-[#00ADEF]">Member</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail size={14} />
                          <span className="truncate">{member.user_email}</span>
                        </div>
                        {member.joined_at && (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>Joined {formatDate(member.joined_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Click indicator */}
                    <div className="flex-shrink-0">
                      <ChevronRight size={20} className="text-gray-400 group-hover:text-[#F58220] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Member Progress Panel */}
      <MemberProgressPanel
        isOpen={showProgressPanel}
        onClose={handleCloseProgressPanel}
        member={selectedMember}
        teamId={team?.team_id}
      />
    </div>
  );
};

export default TeamMembersModal;