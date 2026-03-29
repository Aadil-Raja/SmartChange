// src/components/ui/TeamMembersModal.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Users, Crown, UserCheck, Mail, Calendar, Loader2, ChevronRight, MessageSquare } from 'lucide-react';
import { getTeamMembers } from '../../services/teamApi';
import { getEmployeeCourses } from '../../services/courseApi';
import SendMessageModal from './SendMessageModal';

const TeamMembersModal = ({ isOpen, onClose, team }) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [courses, setCourses] = useState([]);
  const hasFetchedMember = useRef(false);

  useEffect(() => {
    if (isOpen && team && !hasFetchedMember.current) {
      hasFetchedMember.current = true;
      fetchTeamMembers();
      fetchCourses();
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

  const fetchCourses = async () => {
    try {
      // Fetch all active courses for the course dropdown
      const response = await getEmployeeCourses();
      if (response.success) {
        setCourses(response.data.courses || []);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      // Don't show error, just leave courses empty
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
    onClose();
    navigate(`/employee/team/${team?.team_id}/member/${member.user_id}`, {
      state: {
        team,
        member
      }
    });
  };

  const handleSendMessage = (e, member) => {
    e.stopPropagation(); // Prevent opening progress panel
    setMessageRecipient(member);
    setShowMessageModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl mx-4 rounded-[26px] max-h-[90vh] overflow-hidden border"
        style={{ background: '#fffdf8', borderColor: '#e8e0d4', boxShadow: '0 24px 60px rgba(26,18,9,0.28)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{
            borderColor: '#3f2f1f',
            background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)',
          }}
        >

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(247,149,63,0.22)' }}>
              <Users size={20} className="text-white" />
            </div>
            <div className="relative">
              <h2 className="text-2xl font-bold" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>Team Members</h2>
              <p className="text-sm" style={{ color: '#f6d5b8' }}>{team?.team_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#f6d5b8', background: 'rgba(255,255,255,0.12)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center rounded-2xl p-6 border" style={{ borderColor: '#eee4d7', background: '#ffffff' }}>
                <Loader2 size={32} className="animate-spin text-[#f7953f] mx-auto mb-4" />
                <p style={{ color: '#6b5e4e' }}>Loading team members...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-2xl mb-4" style={{ background: '#fff1f2' }}>
                <Users size={32} className="text-[#dc2626]" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#1a1209' }}>Error Loading Members</h3>
              <p className="mb-4" style={{ color: '#b91c1c' }}>{error}</p>
              <button
                onClick={fetchTeamMembers}
                className="px-5 py-2.5 rounded-full text-white font-semibold"
                style={{ background: '#dc2626' }}
              >
                Try Again
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-2xl mb-4" style={{ background: '#f3ede4' }}>
                <Users size={32} style={{ color: '#a09181' }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#1a1209' }}>No Members Found</h3>
              <p style={{ color: '#6b5e4e' }}>This team doesn't have any members yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: '#1a1209' }}>
                    {members.length} {members.length === 1 ? 'Member' : 'Members'}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#7c6f61' }}>Click on any member to view their progress</p>
                </div>
              </div>

              <div className="grid gap-4">
                {members.map((member) => (
                  <div
                    key={member.id || member.user_id}
                    onClick={() => handleMemberClick(member)}
                    className="flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group"
                    style={{
                      background: '#ffffff',
                      borderColor: '#e8e0d4',
                      boxShadow: '0 6px 14px rgba(26,18,9,0.05)',
                    }}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#f7953f] to-[#E0741C] rounded-full flex items-center justify-center overflow-hidden">
                        {member.user_profile_picture ? (
                          <img
                            src={member.user_profile_picture}
                            alt={member.user_name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-semibold text-lg">
                            {member.user_name?.charAt(0)?.toUpperCase() || 
                             member.user_email?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate" style={{ color: '#1a1209' }}>
                          {member.user_name || member.user_email}
                        </h4>
                        {member.role_in_team === 'manager' ? (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: '#fff3e8' }}>
                            <Crown size={12} className="text-[#b45309]" />
                            <span className="text-xs font-medium text-[#b45309]">Manager</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: '#e8f4fd' }}>
                            <UserCheck size={12} className="text-[#0369a1]" />
                            <span className="text-xs font-medium text-[#0369a1]">Member</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm" style={{ color: '#6b5e4e' }}>
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

                    {/* Click indicator and Send Message button */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={(e) => handleSendMessage(e, member)}
                        className="p-2 rounded-xl transition-colors"
                        style={{ color: '#0369a1', background: '#e8f4fd' }}
                        title="Send Message"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <ChevronRight size={20} style={{ color: '#bcae9f' }} className="group-hover:text-[#f7953f] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t" style={{ borderColor: '#eee4d7', background: '#fffdfa' }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full font-semibold transition-colors"
            style={{ color: '#6b5e4e', border: '1px solid #dfd5c8', background: '#fff' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Send Message Modal */}
      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        teamId={team?.team_id}
        recipient={messageRecipient}
        courses={courses}
      />
    </div>
  );
};

export default TeamMembersModal;