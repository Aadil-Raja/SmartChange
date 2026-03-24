import { useState, useEffect, useRef } from 'react';
import TeamCard from '../../components/ui/TeamCard';
import JoinTeamModal from '../../components/ui/JoinTeamModal';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import { Users, Plus } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';

const MyTeams = () => {
  const { teams, loading, error, joinTeam, regerenateTeamCode, loadTeams } = useTeams();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      loadTeams();
    }
  }, []);

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

  const Hero = () => (
    <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
          My Teams
        </h1>
        <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
          Collaborate with your team members and manage projects
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <StatPill label="Teams" count={teams.length} dotColor="#1a1918" />
      </div>
    </div>
  );

  if (loading && teams.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
        <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 overflow-auto">
          <Hero />
          <div className="px-8 py-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-[20px] border border-gray-200 bg-white p-5" style={{ boxShadow: '0 2px 8px rgba(26,18,9,0.06)' }}>
                  <div className="mb-4 h-6 w-3/4 rounded bg-gray-200" />
                  <div className="mb-2 h-4 w-1/2 rounded bg-gray-200" />
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && teams.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
        <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 overflow-auto">
          <Hero />
          <div className="px-8 py-6">
            <div className="rounded-xl border p-6 text-center" style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
              <p className="text-lg font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
      <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
      <div className="flex-1 overflow-auto">
        <Hero />

        <div className="px-8 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-7">
            <p style={{ color: '#6b5e4e', fontSize: 14 }}>
              {teams.length === 0
                ? 'You are not part of any team yet'
                : `You are part of ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
            </p>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all"
              style={{ background: '#1a1209' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f7953f')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1209')}
            >
              <Plus size={16} />
              Join Team
            </button>
          </div>

          {successMessage && (
            <div className="mb-6 rounded-xl border p-4 text-center" style={{ background: '#e6f4f1', borderColor: '#99e6da' }}>
              <p style={{ color: '#0d9488', fontWeight: 600 }}>{successMessage}</p>
            </div>
          )}

          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: '#f3ede4' }}>
                <Users size={40} className="text-[#9c8e80]" />
              </div>
              <h3 className="mb-2 text-xl font-semibold" style={{ color: '#1a1209' }}>No Teams Yet</h3>
              <p className="mb-6" style={{ color: '#6b5e4e' }}>
                Join a team using a join code or wait for an invitation
              </p>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                style={{ background: '#f7953f' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#d96e10')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f7953f')}
              >
                <Plus size={16} />
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

const StatPill = ({ label, count, dotColor }) => (
  <div
    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
    style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}
  >
    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
    {label}: <span className="font-bold ml-0.5">{count}</span>
  </div>
);

export default MyTeams;
