import { useEffect, useState, useRef } from 'react';
import { Plus, UserPlus, X, ChevronDown, ChevronUp, Users, Trash2 } from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAdmin } from '../../hooks/useAdmin';
import { useAdminTeams, useAdminEmployees, useAdminInvalidations } from '../../hooks/useAdminQueries';

const AVATAR_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-violet-400', 'bg-pink-400', 'bg-amber-400', 'bg-teal-400'];
const TEAM_ROLES = ['member', 'manager'];

const TeamsPage = () => {
  const { createTeam, addMemberToTeam, removeMemberFromTeam, updateTeamMemberRole, deleteTeam } = useAdmin();
  const { invalidateTeamsAndEmployees } = useAdminInvalidations();

  // React Query — teams + employees with caching
  const { data: teams = [],     isLoading: teamsLoading    } = useAdminTeams();
  const { data: employees = [], isLoading: employeesLoading } = useAdminEmployees();
  const loading = teamsLoading || employeesLoading;
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // React Query handles fetching — no manual useEffect needed

  const groupedEmployees = (() => {
    const grouped = {};
    employees.forEach(emp => {
      if (!grouped[emp.id]) grouped[emp.id] = { id: emp.id, email: emp.email, name: emp.name, teams: [] };
      if (emp.team_id) grouped[emp.id].teams.push({ team_id: emp.team_id, team_name: emp.team_name, team_member_id: emp.team_member_id, team_role: emp.team_role });
    });
    return Object.values(grouped);
  })();

  const availableEmployeesForTeam = (() => {
    if (!selectedTeam) return groupedEmployees;
    const inTeam = employees.filter(e => e.team_id === selectedTeam.id).map(e => e.id);
    return groupedEmployees.filter(e => !inTeam.includes(e.id));
  })();

  const getTeamMembers = (teamId) => {
    const unique = {};
    employees.filter(e => e.team_id === teamId).forEach(m => {
      if (!unique[m.id]) unique[m.id] = { id: m.id, user_id: m.id, name: m.name, email: m.email, role_in_team: m.team_role, team_member_id: m.team_member_id };
    });
    return Object.values(unique);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    const result = await createTeam(newTeamName);
    setIsCreating(false);
    if (result.success) {
      setShowCreateModal(false);
      setNewTeamName('');
      invalidateTeamsAndEmployees();
    }
    else alert(result.message || 'Failed to create team');
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedRole) return;
    const result = await addMemberToTeam(selectedTeam.id, parseInt(selectedUserId), selectedRole);
    if (result.success) {
      setShowAddMemberModal(false);
      setSelectedUserId('');
      setSelectedRole('');
      setSelectedTeam(null);
      invalidateTeamsAndEmployees();
    }
    else alert(result.message || 'Failed to add member');
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (window.confirm('Remove this member from the team?')) {
      const result = await removeMemberFromTeam(teamId, userId);
      if (result.success) invalidateTeamsAndEmployees();
      else alert(result.message || 'Failed to remove member');
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    const result = await deleteTeam(deleteConfirm.id);
    setIsDeleting(false);
    if (result.success) {
      setDeleteConfirm(null);
      setDeleteError(null);
      invalidateTeamsAndEmployees();
    } else {
      setDeleteError(result.message || 'Failed to delete team');
    }
  };

  const handleUpdateMemberRole = async (teamId, userId, newRole) => {
    if (!userId || !teamId || !newRole) return;
    const result = await updateTeamMemberRole(teamId, userId, newRole);
    if (result.success) {
      setEditingMemberId(null);
      invalidateTeamsAndEmployees();
    }
    else alert(result.message || 'Failed to update role');
  };

  const toggleTeamExpanded = (teamId) => {
    const next = new Set(expandedTeams);
    if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
    setExpandedTeams(next);
  };

  const totalMembers = teams.reduce((sum, t) => sum + getTeamMembers(t.id).length, 0);

  const stats = [
    { label: 'Total Teams',   value: teams.length,           dot: '#1a1918' },
    { label: 'Total Members', value: totalMembers,            dot: '#4ade80' },
    { label: 'Employees',     value: groupedEmployees.length, dot: '#c084fc' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Hero Banner ── */}
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
              Team Management
            </h1>
            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
              Organize teams, memberships, and role access
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                {s.label}: <span className="font-bold ml-0.5">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-6 max-w-7xl mx-auto space-y-5">

            {/* Create Team CTA */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="group w-full rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-5 flex items-center gap-4 transition-all hover:border-[#f7953f] hover:shadow-md text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: '#f3ede4' }}>
                <Plus size={20} className="text-gray-500 group-hover:text-[#f7953f] transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a1209] group-hover:text-[#f7953f] transition-colors">Create New Team</p>
                <p className="text-xs text-gray-400">Add a new team and organize your employees</p>
              </div>
            </button>

            {/* Teams List Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-extrabold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>All Teams</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Manage team members and roles</p>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">
                  {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4 animate-pulse">
                    <Users size={40} className="text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400">Loading teams...</p>
                </div>
              ) : teams.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    <Users size={48} className="text-gray-200" />
                  </div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: '#1a1209' }}>No teams yet</h3>
                  <p className="text-sm text-gray-400 mb-5">Create your first team to get started</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-colors"
                    style={{ background: '#1a1209' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f7953f'}
                    onMouseLeave={e => e.currentTarget.style.background = '#1a1209'}
                  >
                    <Plus size={15} /> Create First Team
                  </button>
                </div>
              ) : (
                <div>
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="col-span-5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Team</div>
                    <div className="col-span-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Members</div>
                    <div className="col-span-4 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-right">Actions</div>
                  </div>

                  {teams.map(team => {
                    const isExpanded = expandedTeams.has(team.id);
                    const teamMembers = getTeamMembers(team.id);
                    const memberCount = teamMembers.length;

                    return (
                      <div key={team.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Team row */}
                        <div
                          className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-[#faf6ef]"
                          onClick={() => toggleTeamExpanded(team.id)}
                        >
                          {/* Team name */}
                          <div className="col-span-5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1a1209' }}>
                              <Users size={16} className="text-white" />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: '#1a1209' }}>{team.name}</p>
                          </div>

                          {/* Member count */}
                          <div className="col-span-3 flex items-center">
                            {memberCount === 0
                              ? <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">Empty</span>
                              : <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                                  {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                                </span>
                            }
                          </div>

                          {/* Actions */}
                          <div className="col-span-4 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => { setSelectedTeam(team); setShowAddMemberModal(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-[#1a1209] hover:border-[#f7953f] hover:text-[#f7953f] transition-colors bg-white"
                            >
                              <UserPlus size={13} /> Add Member
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(team)}
                              className="p-1.5 rounded-lg text-red-600 border border-transparent hover:bg-[#fff0f0] hover:border-red-200 transition-all"
                              title="Delete team"
                            >
                              <Trash2 size={15} />
                            </button>
                            {isExpanded
                              ? <ChevronUp size={15} className="text-gray-400" />
                              : <ChevronDown size={15} className="text-gray-400" />
                            }
                          </div>
                        </div>

                        {/* Expanded members */}
                        {isExpanded && (
                          <div className="border-t border-gray-100" style={{ background: '#faf6ef' }}>
                            {memberCount === 0 ? (
                              <div className="px-6 py-4">
                                <span className="text-xs text-gray-400">No members yet. Add someone to get started.</span>
                              </div>
                            ) : (
                              <div>
                                {teamMembers.map((member, idx) => {
                                  const colorClass = AVATAR_COLORS[member.id % AVATAR_COLORS.length];
                                  const initials = member.name
                                    ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                    : (member.email?.[0] ?? '?').toUpperCase();

                                  return (
                                    <div
                                      key={`${team.id}-${member.user_id}`}
                                      className="flex items-center justify-between px-6 py-3"
                                      style={{ borderBottom: idx < teamMembers.length - 1 ? '1px solid #f0ebe3' : 'none' }}
                                    >
                                      {/* Avatar + name */}
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                          <span className="text-white text-xs font-bold">{initials}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate" style={{ color: '#1a1209' }}>{member.name || member.email}</p>
                                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
                                        </div>
                                      </div>

                                      {/* Role + remove */}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {editingMemberId === `${team.id}-${member.id}` ? (
                                          <RoleDropdown
                                            value={member.role_in_team}
                                            roles={TEAM_ROLES}
                                            onChange={newRole => handleUpdateMemberRole(team.id, member.id, newRole)}
                                            onClose={() => setEditingMemberId(null)}
                                          />
                                        ) : (
                                          <button
                                            onClick={() => setEditingMemberId(`${team.id}-${member.id}`)}
                                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                                            style={{
                                              background: 'rgba(247,149,63,0.10)',
                                              color: '#c2620a',
                                              border: '1px solid rgba(247,149,63,0.25)',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,149,63,0.20)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(247,149,63,0.10)'}
                                          >
                                            {member.role_in_team}
                                            <ChevronDown size={11} />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleRemoveMember(team.id, member.user_id)}
                                          className="p-1.5 rounded-lg transition-all"
                                          style={{ color: '#dc2626' }}
                                          onMouseEnter={e => { e.currentTarget.style.background = '#fff0f0'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                          title="Remove from team"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Create Team Modal ── */}
      {showCreateModal && (
        <ModalOverlay onClose={() => { setShowCreateModal(false); setNewTeamName(''); }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#1a1209' }}>Create New Team</h2>
          <p className="text-xs text-gray-400 mb-5">Give your team a clear, descriptive name</p>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Team Name</label>
          <input
            type="text"
            placeholder="e.g. Marketing, Engineering..."
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all mb-5"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || isCreating}
              className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: '#1a1209' }}
              onMouseEnter={e => { if (newTeamName.trim() && !isCreating) e.currentTarget.style.background = '#f7953f'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1209'}
            >
              {isCreating ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating…</>
              ) : 'Create Team'}
            </button>
            <button
              onClick={() => { setShowCreateModal(false); setNewTeamName(''); }}
              disabled={isCreating}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-[#f7953f] text-[#f7953f] hover:bg-orange-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Add Member Modal ── */}
      {showAddMemberModal && (
        <ModalOverlay onClose={() => { setShowAddMemberModal(false); setSelectedUserId(''); setSelectedRole(''); setSelectedTeam(null); }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#1a1209' }}>Add Member</h2>
          <p className="text-xs text-gray-400 mb-5">Adding to <span className="font-semibold text-[#1a1209]">{selectedTeam?.name}</span></p>

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Employee</label>
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all mb-4"
          >
            <option value="">Choose an employee...</option>
            {availableEmployeesForTeam.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name || emp.email}{emp.teams.length > 0 ? ` (${emp.teams.length} team${emp.teams.length > 1 ? 's' : ''})` : ''}
              </option>
            ))}
          </select>
          {availableEmployeesForTeam.length === 0 && (
            <p className="text-xs text-amber-600 mb-4">All employees are already in this team.</p>
          )}

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all mb-5"
          >
            <option value="">Choose a role...</option>
            {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <div className="flex gap-3">
            <button
              onClick={handleAddMember}
              disabled={!selectedUserId || !selectedRole || availableEmployeesForTeam.length === 0}
              className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-40"
              style={{ background: '#1a1209' }}
              onMouseEnter={e => { if (selectedUserId && selectedRole) e.currentTarget.style.background = '#f7953f'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1209'}
            >
              Add Member
            </button>
            <button
              onClick={() => { setShowAddMemberModal(false); setSelectedUserId(''); setSelectedRole(''); setSelectedTeam(null); }}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border border-[#f7953f] text-[#f7953f] hover:bg-orange-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <>
          {deleteError && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto max-w-sm w-full mx-4 px-4 py-3 rounded-xl flex items-start gap-3 shadow-lg"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '220px' }}
              >
                <span className="text-red-500 text-lg leading-none flex-shrink-0">⚠</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Cannot delete team</p>
                  <p className="text-xs text-red-600 mt-0.5">{deleteError}</p>
                </div>
                <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">×</button>
              </div>
            </div>
          )}
          <ConfirmDialog
            title="Delete Team"
            message={`Are you sure you want to delete "${deleteConfirm.name}"? This will remove all team members and cannot be undone.`}
            confirmText={isDeleting ? "Deleting…" : "Delete Team"}
            cancelText="Cancel"
            onConfirm={handleDeleteTeam}
            onCancel={() => { setDeleteConfirm(null); setDeleteError(null); }}
            variant="danger"
            isLoading={isDeleting}
          />
        </>
      )}
    </div>
  );
};

// ── Modal Overlay ──────────────────────────────────────────────────────────────
const ModalOverlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative" style={{ border: '1px solid #f0ebe3' }}>
      <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
        <X size={16} />
      </button>
      {children}
    </div>
  </div>
);

// ── Role Dropdown ──────────────────────────────────────────────────────────────
const RoleDropdown = ({ value, roles, onChange, onClose }) => {
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSelect = role => {
    setSelected(role);
    setOpen(false);
    onChange(role);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setOpen(v => !v); }}
        className="text-xs font-semibold border border-[#f7953f] text-[#f7953f] px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-orange-50"
      >
        {selected}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-2xl overflow-hidden"
          style={{ minWidth: '150px', boxShadow: '0 8px 32px rgba(26,18,9,0.14)', border: '1px solid #f0ebe3' }}
        >
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Role</p>
          </div>
          <div className="pb-2">
            {roles.map(role => (
              <button
                key={role}
                onClick={e => { e.stopPropagation(); handleSelect(role); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                style={role === selected ? { background: '#f7953f', color: '#fff', fontWeight: 600 } : { color: '#1a1209' }}
                onMouseEnter={e => { if (role !== selected) e.currentTarget.style.background = '#faf6ef'; }}
                onMouseLeave={e => { if (role !== selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{role}</span>
                {role === selected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
