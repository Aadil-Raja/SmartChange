import React, { useEffect, useState } from 'react';
import { Menu, Home, Users, Settings, Plus, UserPlus, X, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Sidebar from '../../components/ui/Sidebar';
import { useAdmin } from '../../hooks/useAdmin';

const TeamsPage = () => {
  const { teams, employees, teamRoles, loading, loadTeams, loadEmployees, loadTeamRoles, createTeam, addMemberToTeam, removeMemberFromTeam, updateTeamMemberRole } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
    const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    loadTeams();
    loadEmployees();
    loadTeamRoles();
  }, []);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Teams', path: '/admin/teams' },
    { icon: Settings, label: 'Training', path: '/admin/training' },
  ];

  // Group employees by ID to get unique list
  const groupedEmployees = React.useMemo(() => {
    const grouped = {};
    employees.forEach(emp => {
      if (!grouped[emp.id]) {
        grouped[emp.id] = {
          id: emp.id,
          email: emp.email,
          name: emp.name,
          teams: []
        };
      }
      if (emp.team_id) {
        grouped[emp.id].teams.push({
          team_id: emp.team_id,
          team_name: emp.team_name,
          team_member_id: emp.team_member_id,
          team_role: emp.team_role
        });
      }
    });
    return Object.values(grouped);
  }, [employees]);

  // Get employees available for the selected team (not already in that specific team)
  const availableEmployeesForTeam = React.useMemo(() => {
    if (!selectedTeam) return groupedEmployees;
    
    // Get team member user IDs from employees data for this team
    const teamMemberIds = employees
      .filter(emp => emp.team_id === selectedTeam.id)
      .map(emp => emp.id);
    
    return groupedEmployees.filter(emp => !teamMemberIds.includes(emp.id));
  }, [groupedEmployees, selectedTeam, employees]);

  // Get team members with their details
  const getTeamMembers = (teamId) => {
    const members = employees.filter(emp => emp.team_id === teamId);
    
    // Group by user_id to avoid duplicates
    const uniqueMembers = {};
    members.forEach(member => {
      if (!uniqueMembers[member.id]) {
        uniqueMembers[member.id] = {
          id: member.id,
          user_id: member.id,
          name: member.name,
          email: member.email,
          role_in_team: member.team_role,
          team_member_id: member.team_member_id
        };
      }
    });
    
    return Object.values(uniqueMembers);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      alert('Please enter a team name');
      return;
    }
    const result = await createTeam(newTeamName);
    if (result.success) {
      setShowCreateModal(false);
      setNewTeamName('');
    } else {
      alert(result.message || 'Failed to create team');
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedRole) {
      alert('Please select both employee and role');
      return;
    }
    const result = await addMemberToTeam(selectedTeam.id, parseInt(selectedUserId), selectedRole);
    if (result.success) {
      setShowAddMemberModal(false);
      setSelectedUserId('');
      setSelectedRole('');
      setSelectedTeam(null);
    } else {
      alert(result.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (window.confirm('Remove this member from the team?')) {
      const result = await removeMemberFromTeam(teamId, userId);
      if (!result.success) {
        alert(result.message || 'Failed to remove member');
      }
    }
  };

  const handleUpdateMemberRole = async (teamId,userId, newRole) => {
    // Validate inputs
    console.log(userId);
    if (!userId) {
      
      alert('Invalid team member ID');
      return;
    }
        if (!teamId) {
          console.log(teamId);
      alert('Invalid team ID');
      return;
    }

    if (!newRole) {
      alert('Please select a role');
      return;
    }

    // Call the API to update the role
    const result = await updateTeamMemberRole(teamId,userId, newRole);

    if (result.success) {
      setEditingRole(null);
      // Optionally show a success message
      // alert('Role updated successfully');
    } else {
      alert(result.message || 'Failed to update role');
    }
  };

  const toggleTeamExpanded = (teamId) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white">
      <Sidebar 
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        navItems={navItems}
        currentPath="/admin/teams"
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333333] lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">Team Management</h1>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 text-white hover:from-[#F58220] hover:to-[#FDB913]">
            <Plus size={18} />
            Create Team
          </button>
        </header>

        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Stats Card */}
            <div className="mb-6 rounded-lg bg-white p-6 shadow text-center">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Teams</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-[#FDB913] to-[#F58220] bg-clip-text text-transparent">{teams.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Available Employees</p>
                  <p className="text-3xl font-bold text-[#FDB913]">{groupedEmployees.length}</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <Users size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="mb-2 text-xl font-semibold text-gray-700">No Teams Yet</h3>
                <p className="mb-6 text-gray-500">Create your first team to get started</p>
                <button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-6 py-2 text-white">Create Team</button>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => {
                  const isExpanded = expandedTeams.has(team.id);
                  const teamMembers = getTeamMembers(team.id);
                  const memberCount = teamMembers.length;

                  return (
                    <div key={team.id} className="overflow-hidden rounded-lg bg-white shadow">
                      {/* Team Header */}
                      <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white p-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] text-white">
                            <Users size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-[#333333]">{team.name}</h3>
                            <p className="text-sm text-gray-500">
                              {memberCount} {memberCount === 1 ? 'member' : 'members'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTeam(team);
                              setShowAddMemberModal(true);
                            }}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 text-sm font-medium text-white transition-all hover:from-[#F58220] hover:to-[#FDB913]"
                          >
                            <UserPlus size={16} />
                            Add Member
                          </button>
                          
                          {memberCount > 0 && (
                            <button
                              onClick={() => toggleTeamExpanded(team.id)}
                              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                            >
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Team Members */}
                      {isExpanded && memberCount > 0 && (
                        <div className="border-t border-gray-200 bg-white p-6">
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-700">Team Members</h4>
                          </div>
                          <div className="space-y-3">
                            {teamMembers.map((member) => (
                              <div 
                                key={`${team.id}-${member.user_id}-${member.team_member_id}`}
                                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all hover:border-[#FDB913] hover:shadow-sm"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white">
                                      {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-[#333333]">
                                        {member.name || member.email}
                                      </p>
                                      <p className="text-xs text-gray-500">{member.email}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Role Editor */}
                                  {editingMemberId === member.id ? (
                                    <select
  
                                      defaultValue={member.role_in_team}
                                      onChange={(e) => handleUpdateMemberRole(team.id,member.id, e.target.value)}
                                      onBlur={() => setEditingMemberId(null)}
                                      className="rounded-md border border-[#FDB913] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FDB913]"
                                      autoFocus
                                    >
                                      {teamRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      onClick={() => setEditingMemberId(member.id)}
                                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white"
                                    >
                                      <span className="text-[#F58220]">{member.role_in_team}</span>
                                      <Edit2 size={14} className="text-gray-400" />
                                    </button>
                                  )}

                                  {/* Remove Button */}
                                  <button
                                    onClick={() => handleRemoveMember(team.id, member.user_id)}
                                    className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50"
                                    title="Remove from team"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty State for Team with No Members */}
                      {memberCount === 0 && (
                        <div className="border-t border-gray-200 bg-gray-50 p-8 text-center">
                          <UserPlus size={48} className="mx-auto mb-3 text-gray-300" />
                          <p className="mb-4 text-sm text-gray-500">No members in this team yet</p>
                          <button
                            onClick={() => {
                              setSelectedTeam(team);
                              setShowAddMemberModal(true);
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                          >
                            Add First Member
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-[#333333]">Create New Team</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Team Name</label>
                <input
                  type="text"
                  placeholder="Enter team name (e.g., Marketing, Engineering)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
                  className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleCreateTeam} className="flex-1 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 text-white" disabled={!newTeamName.trim()}>
                  Create Team
                </button>
                <button onClick={() => {
                  setShowCreateModal(false);
                  setNewTeamName('');
                }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-[#333333]">Add Member to {selectedTeam?.name || 'Team'}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Select Employee</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                >
                  <option value="">Choose an employee...</option>
                  {availableEmployeesForTeam.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email} {emp.teams.length > 0 ? `(In ${emp.teams.length} team${emp.teams.length > 1 ? 's' : ''})` : ''}
                    </option>
                  ))}
                </select>
                {availableEmployeesForTeam.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">All employees are already in this team</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Select Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                >
                  <option value="">Choose a role...</option>
                  {teamRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleAddMember} 
                  className="flex-1 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 text-white" 
                  disabled={!selectedUserId || !selectedRole || availableEmployeesForTeam.length === 0}
                >
                  Add Member
                </button>
                <button onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUserId('');
                  setSelectedRole('');
                  setSelectedTeam(null);
                }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;