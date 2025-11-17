import { useEffect, useState } from 'react';
import { Plus, UserPlus, X, Edit2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAdmin } from '../../hooks/useAdmin';

const TeamsPage = () => {
  const { teams, employees, teamRoles, loading, loadTeams, loadEmployees, loadTeamRoles, createTeam, addMemberToTeam, removeMemberFromTeam, updateTeamMemberRole } = useAdmin();
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null); // Format: "teamId-userId"
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    loadTeams();
    loadEmployees();
    loadTeamRoles();
  }, []);



  // Group employees by ID to get unique list
  const groupedEmployees = (() => {
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
  })();

  // Get employees available for the selected team (not already in that specific team)
  const availableEmployeesForTeam = (() => {
    if (!selectedTeam) return groupedEmployees;
    
    // Get team member user IDs from employees data for this team
    const teamMemberIds = employees
      .filter(emp => emp.team_id === selectedTeam.id)
      .map(emp => emp.id);
    
    return groupedEmployees.filter(emp => !teamMemberIds.includes(emp.id));
  })();

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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar 
        collapsed={navCollapsed} 
        onToggle={() => setNavCollapsed(!navCollapsed)} 
      />
      
      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-[#333333]">Team Management</h1>
            <p className="text-gray-600 mt-1">Create and manage teams and their members</p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users size={24} className="text-[#00ADEF]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Teams</p>
                    <p className="text-2xl font-bold text-[#333333]">{teams.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Users size={24} className="text-[#78BE20]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Members</p>
                    <p className="text-2xl font-bold text-[#78BE20]">
                      {teams.reduce((sum, team) => sum + getTeamMembers(team.id).length, 0)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users size={24} className="text-[#333333]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Available Employees</p>
                    <p className="text-2xl font-bold text-[#333333]">{groupedEmployees.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Create Team Section */}
            <Card className="p-8 border border-gray-200 text-center">
              <div className="inline-flex p-3 bg-gray-100 rounded-full mb-4">
                <Plus size={32} className="text-[#333333]" />
              </div>
              <h2 className="text-2xl font-bold text-[#333333] mb-2">Create New Team</h2>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                Add a new team to organize your employees and manage their roles effectively
              </p>
              <Button onClick={() => setShowCreateModal(true)} variant="primary" size="md" className="inline-flex">
                <Plus size={18} />
                Create Team
              </Button>
            </Card>

            {/* Teams List */}
            <Card className="p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users size={20} className="text-[#333333]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#333333]">All Teams</h2>
                  <p className="text-sm text-gray-600">Manage team members and roles</p>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4 animate-pulse">
                    <Users size={48} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500">Loading teams...</p>
                </div>
              ) : teams.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    <Users size={64} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#333333] mb-2">No Teams Yet</h3>
                  <p className="text-gray-600 mb-6">Create your first team to get started</p>
                  <Button onClick={() => setShowCreateModal(true)} variant="primary" size="md">
                    <Plus size={18} />
                    Create First Team
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teams.map((team) => {
                    const isExpanded = expandedTeams.has(team.id);
                    const teamMembers = getTeamMembers(team.id);
                    const memberCount = teamMembers.length;

                    return (
                      <div key={team.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                        {/* Team Header - Clickable Row */}
                        <div 
                          className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => memberCount > 0 && toggleTeamExpanded(team.id)}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div>
                              <h3 className="text-lg font-bold text-[#333333]">{team.name}</h3>
                              <p className="text-sm text-gray-600">
                                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTeam(team);
                                setShowAddMemberModal(true);
                              }}
                              variant="primary"
                              size="sm"
                            >
                              <UserPlus size={16} />
                              Add Member
                            </Button>
                            
                            {memberCount > 0 && (
                              <button
                                className="p-2 hover:bg-gray-200 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTeamExpanded(team.id);
                                }}
                              >
                                {isExpanded ? <ChevronUp size={18} className="text-gray-600" /> : <ChevronDown size={18} className="text-gray-600" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Team Members */}
                        {isExpanded && memberCount > 0 && (
                          <div className="border-t border-gray-200 bg-gray-50 p-5">
                            <h4 className="text-sm font-semibold text-[#333333] mb-3">Team Members</h4>
                            <div className="space-y-2">
                              {teamMembers.map((member) => (
                                <div 
                                  key={`${team.id}-${member.user_id}-${member.team_member_id}`}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <div>
                                        <p className="font-semibold text-[#333333]">
                                          {member.name || member.email}
                                        </p>
                                        <p className="text-xs text-gray-600">{member.email}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {/* Role Editor */}
                                    {editingMemberId === `${team.id}-${member.id}` ? (
                                      <select
                                        defaultValue={member.role_in_team}
                                        onChange={(e) => handleUpdateMemberRole(team.id, member.id, e.target.value)}
                                        onBlur={() => setEditingMemberId(null)}
                                        className="rounded-lg border border-[#00ADEF] px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00ADEF]/20"
                                        autoFocus
                                      >
                                        {teamRoles.map(role => (
                                          <option key={role} value={role}>{role}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <button
                                        onClick={() => setEditingMemberId(`${team.id}-${member.id}`)}
                                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 border border-gray-300 transition-colors hover:bg-gray-200 hover:border-gray-400"
                                      >
                                        <span className="text-[#333333] font-semibold">{member.role_in_team}</span>
                                        <Edit2 size={14} className="text-gray-500" />
                                      </button>
                                    )}

                                    {/* Remove Button */}
                                    <button
                                      onClick={() => handleRemoveMember(team.id, member.user_id)}
                                      className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 border border-transparent hover:border-red-200"
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
                            <div className="inline-flex p-4 bg-white rounded-full mb-3">
                              <UserPlus size={48} className="text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-600 mb-4">No members in this team yet</p>
                            <Button
                              onClick={() => {
                                setSelectedTeam(team);
                                setShowAddMemberModal(true);
                              }}
                              variant="secondary"
                              size="sm"
                            >
                              <UserPlus size={16} />
                              Add First Member
                            </Button>
                          </div>
                        )}
                      </div>
                  );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Card className="w-full max-w-md" padding="lg" shadow="xl">
            <h2 className="mb-4 text-xl font-bold text-[#333333]">Create New Team</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">Team Name</label>
                <input
                  type="text"
                  placeholder="Enter team name (e.g., Marketing, Engineering)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCreateTeam} variant="primary" size="md" className="flex-1" disabled={!newTeamName.trim()}>
                  Create Team
                </Button>
                <Button onClick={() => {
                  setShowCreateModal(false);
                  setNewTeamName('');
                }} variant="secondary" size="md">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Card className="w-full max-w-md" padding="lg" shadow="xl">
            <h2 className="mb-4 text-xl font-bold text-[#333333]">Add Member to {selectedTeam?.name || 'Team'}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">Select Employee</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20"
                >
                  <option value="">Choose an employee...</option>
                  {availableEmployeesForTeam.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email} {emp.teams.length > 0 ? `(In ${emp.teams.length} team${emp.teams.length > 1 ? 's' : ''})` : ''}
                    </option>
                  ))}
                </select>
                {availableEmployeesForTeam.length === 0 && (
                  <p className="mt-2 text-sm text-gray-600">All employees are already in this team</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">Select Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20"
                >
                  <option value="">Choose a role...</option>
                  {teamRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAddMember} 
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={!selectedUserId || !selectedRole || availableEmployeesForTeam.length === 0}
                >
                  Add Member
                </Button>
                <Button onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUserId('');
                  setSelectedRole('');
                  setSelectedTeam(null);
                }} variant="secondary" size="md">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;