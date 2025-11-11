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
    { icon: Settings, label: 'Training', path: '/admin/training' },
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
    <div className="flex min-h-screen bg-gray-50">
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
            {/* Page Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users size={24} className="text-[#00ADEF]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Employees</p>
                    <p className="text-2xl font-bold text-[#333333]">{groupedEmployees.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Users size={24} className="text-[#78BE20]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">In Teams</p>
                    <p className="text-2xl font-bold text-[#78BE20]">
                      {groupedEmployees.filter(e => e.teams.length > 0).length}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Users size={24} className="text-[#F58220]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Unassigned</p>
                    <p className="text-2xl font-bold text-[#F58220]">
                      {groupedEmployees.filter(e => e.teams.length === 0).length}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Users size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Teams</p>
                    <p className="text-2xl font-bold text-purple-600">{uniqueTeams.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Search & Filter Card */}
            <Card className="p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Search size={20} className="text-[#333333]" />
                </div>
                <h2 className="text-xl font-bold text-[#333333]">Search & Filter Employees</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 transition-all"
                  />
                </div>

                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 transition-all"
                >
                  <option value="">All Roles</option>
                  {teamRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 transition-all"
                >
                  <option value="">All Teams</option>
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {(searchQuery || filterRole || filterTeam) && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-sm text-gray-700 font-medium">
                    Showing {filteredEmployees.length} of {groupedEmployees.length} employees
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterRole('');
                      setFilterTeam('');
                    }}
                    className="text-sm font-semibold text-[#00ADEF] hover:text-[#0095CC] transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </Card>

            {/* Employees List Card */}
            <Card className="p-6 border border-gray-200">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users size={20} className="text-[#333333]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#333333]">Employee Directory</h2>
                    <p className="text-sm text-gray-600">Manage employee roles and team assignments</p>
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 border border-gray-300 px-4 py-2 text-sm font-semibold text-[#333333]">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4 animate-pulse">
                    <Users size={48} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500">Loading employees...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    <Users size={64} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#333333] mb-2">No employees found</h3>
                  <p className="text-gray-600">
                    {searchQuery || filterRole || filterTeam 
                      ? 'Try adjusting your search filters' 
                      : 'No employees in the system yet'}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase">ID</div>

                    <div className="col-span-4 text-xs font-semibold text-gray-600 uppercase">Email</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Teams</div>
                    <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase text-center">Details</div>
                  </div>

                  {/* Table Body */}
                  {filteredEmployees.map((employee) => {
                    const isExpanded = expandedEmployees.has(employee.id);

                    return (
                      <div key={employee.id} className="border-b border-gray-200 last:border-b-0">
                        {/* Employee Row */}
                        <div 
                          className="grid grid-cols-12 gap-4 px-6 py-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggleExpanded(employee.id)}
                        >
                          <div className="col-span-1 flex items-center">
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {employee.id}
                            </span>
                          </div>

                          <div className="col-span-4 flex items-center">
                            <span className="text-sm text-gray-600">{employee.email}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            {employee.teams.length === 0 ? (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                No Teams
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[#00ADEF] bg-[#00ADEF]/10 px-2 py-1 rounded">
                                {employee.teams.length} {employee.teams.length === 1 ? 'Team' : 'Teams'}
                              </span>
                            )}
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                              {isExpanded ? (
                                <ChevronUp size={18} className="text-gray-600" />
                              ) : (
                                <ChevronDown size={18} className="text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Team Details */}
                        {isExpanded && employee.teams.length > 0 && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-[#333333] mb-3">Team Assignments</h4>
                              {employee.teams.map((team, idx) => (
                                <div
                                  key={`${employee.id}-${team.team_id}-${idx}`}
                                  className="flex items-center justify-between rounded-lg bg-white p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="inline-flex items-center rounded-lg bg-[#00ADEF]/10 px-4 py-2 text-sm font-semibold text-[#0095CC] border border-[#00ADEF]/30">
                                      {team.team_name}
                                    </span>

                                    {editingRole === `${employee.id}-${team.team_id}` ? (
                                      <select
                                        defaultValue={team.team_role}
                                        onChange={(e) => handleRoleChange(team.team_id, employee.id, e.target.value)}
                                        onBlur={() => setEditingRole(null)}
                                        className="rounded-lg border border-[#00ADEF] px-4 py-2 text-sm font-medium focus:border-[#00ADEF] focus:outline-none focus:ring-2 focus:ring-[#00ADEF]/20"
                                        autoFocus
                                      >
                                        {teamRoles.map(role => (
                                          <option key={role} value={role}>{role}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingRole(`${employee.id}-${team.team_id}`);
                                        }}
                                        className="rounded-lg px-4 py-2 text-sm font-medium text-[#333333] bg-gray-100 border border-gray-300 transition-all hover:bg-gray-200 hover:border-gray-400"
                                      >
                                        Role: <span className="font-semibold">{team.team_role}</span>
                                      </button>
                                    )}
                                  </div>

                                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                    Team ID: {team.team_id}
                                  </span>
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