import React, { useEffect, useState } from 'react';
import { Menu, Home, Users, Settings, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import Sidebar from '../../components/ui/Sidebar';
import Card from '../../components/ui/Card';
import { useAdmin } from '../../hooks/useAdmin';

const EmployeeList = () => {
  const { teams,employees, teamRoles, loading, loadEmployees,loadTeams, loadTeamRoles, updateTeamMemberRole, deleteEmployee } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());

  useEffect(() => {
    loadEmployees();
    loadTeamRoles();
  }, []);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Teams', path: '/admin/teams' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' }
  ];

  // Group employees by user ID to consolidate multiple team entries
  const groupedEmployees = React.useMemo(() => {
    const grouped = {};

    employees.forEach(emp => {
      if (!grouped[emp.id]) {
        grouped[emp.id] = {
          id: emp.id,
          email: emp.email,
          name: emp.name,
          role: emp.role,
          created_at: emp.created_at,
          teams: []
        };
      }

      // Add team info if employee is in a team
      if (emp.team_id) {
        grouped[emp.id].teams.push({
          team_id: emp.team_id,
          team_name: emp.team_name,
          team_role: emp.team_role,
          team_member_id: emp.team_member_id
        });
      }
    });

    return Object.values(grouped);
  }, [employees]);

  const filteredEmployees = groupedEmployees.filter(emp => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = !filterRole || emp.teams.some(t => t.team_role === filterRole);
    const matchesTeam = !filterTeam || emp.teams.some(t => t.team_name === filterTeam);

    return matchesSearch && matchesRole && matchesTeam;
  });

  const uniqueTeams = [...new Set(employees.filter(e => e.team_name).map(e => e.team_name))];

  const handleRoleChange = async (teamId,userId, newRole) => {
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

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this employee? This will remove them from all teams.')) {
      const result = await deleteEmployee(userId);
      if (!result.success) {
        alert(result.message || 'Failed to delete employee');
      }
    }
  };

  const toggleExpanded = (employeeId) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        navItems={navItems}
        currentPath="/admin/employees"
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333333] lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-[#333333]">Employee Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]" />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#333333]">Search & Filter</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-4 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                  />
                </div>

                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none"
                >
                  <option value="">All Roles</option>
                  {teamRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#FDB913] focus:outline-none"
                >
                  <option value="">All Teams</option>
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {(searchQuery || filterRole || filterTeam) && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-600">
                    Showing {filteredEmployees.length} of {groupedEmployees.length} employees
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterRole('');
                      setFilterTeam('');
                    }}
                    className="text-sm font-medium text-[#F58220] hover:text-[#FDB913]"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#333333]">All Employees</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-12 text-center">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No employees found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEmployees.map((employee) => {
                    const isExpanded = expandedEmployees.has(employee.id);
                    const hasMultipleTeams = employee.teams.length > 1;

                    return (
                      <div
                        key={employee.id}
                        className="rounded-lg border border-gray-200 bg-white transition-all hover:shadow-md"
                      >
                        {/* Main Employee Row */}
                        <div className="flex items-center justify-between p-4">
                          <div className="flex flex-1 items-center gap-6">
                            {/* Employee Info */}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-500">ID: {employee.id}</span>
                                <span className="text-base font-semibold text-[#333333]">
                                  {employee.name || employee.email}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{employee.email}</p>
                            </div>

                            {/* Teams Summary */}
                            <div className="flex-1">
                              {employee.teams.length === 0 ? (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
                                  No Teams
                                </span>
                              ) : employee.teams.length === 1 ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                                    {employee.teams[0].team_name}
                                  </span>
                                  <span className="text-sm text-gray-600">as {employee.teams[0].team_role}</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => toggleExpanded(employee.id)}
                                  className="flex items-center gap-2 text-sm font-medium text-[#F58220] hover:text-[#FDB913]"
                                >
                                  {employee.teams.length} Teams
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(employee.id)}
                                className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50"
                                title="Delete Employee"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Team Details */}
                        {(isExpanded || employee.teams.length === 1) && employee.teams.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4">
                            <div className="space-y-3">
                              {employee.teams.map((team, idx) => (
                                <div
                                  key={`${employee.id}-${team.team_id}-${idx}`}
                                  className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                                      {team.team_name}
                                    </span>

                                    {editingRole === `${employee.id}-${team.team_id}` ? (
                                      <select
                                        defaultValue={team.team_role}
                                        onChange={(e) => handleRoleChange(team.team_id,employee.id, e.target.value)}
                                        onBlur={() => setEditingRole(null)}
                                        className="rounded border border-[#FDB913] px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#FDB913]"
                                        autoFocus
                                      >
                                        {teamRoles.map(role => (
                                          <option key={role} value={role}>{role}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <button
                                        onClick={() => setEditingRole(`${employee.id}-${team.team_id}`)}
                                        className="rounded-md px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                      >
                                        Role: <span className="text-[#F58220]">{team.team_role}</span>
                                      </button>
                                    )}
                                  </div>

                                  <span className="text-xs text-gray-500">Team ID: {team.team_id}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeList;