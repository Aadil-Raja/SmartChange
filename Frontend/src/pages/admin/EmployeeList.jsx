import { useState } from 'react';
import { Users, Search, ChevronDown, ChevronUp } from 'lucide-react';
import AdminSidebar from '../../components/ui/AdminSidebar';
import { useAdmin } from '../../hooks/useAdmin';
import { useAdminEmployees, useAdminTeamRoles, useAdminInvalidations } from '../../hooks/useAdminQueries';

const EmployeeList = () => {
  const { updateTeamMemberRole } = useAdmin();
  const { invalidateEmployees } = useAdminInvalidations();

  // React Query — employees + roles with caching
  const { data: employees = [], isLoading: empLoading } = useAdminEmployees();
  const { data: teamRoles = [] }                        = useAdminTeamRoles();
  const loading = empLoading;
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  // React Query handles fetching — no manual useEffect needed

  const groupedEmployees = (() => {
    const grouped = {};
    employees.forEach(emp => {
      if (!grouped[emp.id]) {
        grouped[emp.id] = {
          id: emp.id,
          email: emp.email,
          name: emp.name,
          role: emp.role,
          created_at: emp.created_at,
          profile_picture_url: emp.profile_picture_url,
          teams: []
        };
      }
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
  })();

  const uniqueTeams = [...new Set(employees.filter(e => e.team_name).map(e => e.team_name))];

  const filteredEmployees = groupedEmployees.filter(emp => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !filterRole || emp.teams.some(t => t.team_role === filterRole);
    const matchesTeam = !filterTeam || emp.teams.some(t => t.team_name === filterTeam);
    return matchesSearch && matchesRole && matchesTeam;
  });

  const handleRoleChange = async (teamId, userId, newRole) => {
    if (!userId || !teamId || !newRole) return;
    const result = await updateTeamMemberRole(teamId, userId, newRole);
    if (result.success) {
      setEditingRole(null);
      invalidateEmployees(); // refresh cache after role update
    }
    else alert(result.message || 'Failed to update role');
  };

  const toggleExpanded = (employeeId) => {
    const next = new Set(expandedEmployees);
    if (next.has(employeeId)) next.delete(employeeId);
    else next.add(employeeId);
    setExpandedEmployees(next);
  };

  const AVATAR_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-violet-400', 'bg-pink-400', 'bg-amber-400', 'bg-teal-400'];

  const stats = [
    { label: 'Total Employees', value: groupedEmployees.length,                                    dot: '#1a1918' },
    { label: 'In Teams',        value: groupedEmployees.filter(e => e.teams.length > 0).length,    dot: '#4ade80' },
    { label: 'Unassigned',      value: groupedEmployees.filter(e => e.teams.length === 0).length,  dot: '#fb923c' },
    { label: 'Active Teams',    value: uniqueTeams.length,                                          dot: '#c084fc' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Hero Banner (matches course list) ── */}
        <div className="w-full px-8 py-7 flex items-center justify-between flex-shrink-0" style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
              Employee Management
            </h1>
            <p style={{ color: 'rgba(65, 50, 24, 0.45)', fontSize: 13, marginTop: 4 }}>
              Review employee directory and team role assignments
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"  style={{ background: 'rgba(134, 78, 25, 0.08)', color: '#111111' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                {s.label}: <span className="font-bold ml-0.5">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-6 max-w-7xl mx-auto space-y-5">

            {/* Search & Filter */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <Search size={15} className="text-gray-400" />
                <span className="text-sm font-semibold" style={{ color: '#1a1209' }}>Search & Filter Employees</span>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={15} />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all min-w-[140px]"
                >
                  <option value="">All Roles</option>
                  {teamRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={filterTeam}
                  onChange={e => setFilterTeam(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 transition-all min-w-[140px]"
                >
                  <option value="">All Teams</option>
                  {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {(searchQuery || filterRole || filterTeam) && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-4 py-2">
                  <p className="text-xs text-gray-600">
                    Showing <span className="font-semibold">{filteredEmployees.length}</span> of <span className="font-semibold">{groupedEmployees.length}</span> employees
                  </p>
                  <button onClick={() => { setSearchQuery(''); setFilterRole(''); setFilterTeam(''); }} className="text-xs font-semibold text-[#f7953f] hover:text-[#E0741C] transition-colors">
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {/* Employee Directory */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-extrabold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Employee Directory</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Manage employee roles and team assignments</p>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4 animate-pulse">
                    <Users size={40} className="text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400">Loading employees...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
                    <Users size={48} className="text-gray-200" />
                  </div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: '#1a1209' }}>No employees found</h3>
                  <p className="text-sm text-gray-400">
                    {searchQuery || filterRole || filterTeam ? 'Try adjusting your search filters' : 'No employees in the system yet'}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="col-span-6 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Employee</div>
                    <div className="col-span-4 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Teams</div>
                    <div className="col-span-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-right">Details</div>
                  </div>

                  {filteredEmployees.map(employee => {
                    const isExpanded = expandedEmployees.has(employee.id);
                    const initials = employee.name
                      ? employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : (employee.email?.[0] ?? '?').toUpperCase();
                    const colorClass = AVATAR_COLORS[employee.id % AVATAR_COLORS.length];

                    return (
                      <div key={employee.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Row */}
                        <div
                          className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-[#faf6ef]"
                          onClick={() => toggleExpanded(employee.id)}
                        >
                          <div className="col-span-6 flex items-center gap-3">
                            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden ${employee.profile_picture_url ? '' : colorClass}`}>
                              {employee.profile_picture_url
                                ? <img src={employee.profile_picture_url} alt={employee.name} className="w-full h-full object-cover" />
                                : <span className="text-white text-xs font-bold">{initials}</span>
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: '#1a1209' }}>{employee.name || employee.email}</p>
                              <p className="text-xs text-gray-400 truncate">{employee.email}</p>
                            </div>
                          </div>

                          <div className="col-span-4 flex items-center">
                            {employee.teams.length === 0
                              ? <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">No Teams</span>
                              : <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                                  {employee.teams.length} {employee.teams.length === 1 ? 'Team' : 'Teams'}
                                </span>
                            }
                          </div>

                          <div className="col-span-2 flex items-center justify-end">
                            {isExpanded
                              ? <ChevronUp size={16} className="text-gray-400" />
                              : <ChevronDown size={16} className="text-gray-400" />
                            }
                          </div>
                        </div>

                        {/* Expanded */}
                        {isExpanded && (
                          <div className="px-6 py-4 border-t border-gray-100" style={{ background: '#faf6ef' }}>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Team Assignments</p>
                            {employee.teams.length === 0 ? (
                              <p className="text-xs text-gray-400">Not assigned to any team.</p>
                            ) : (
                              <div className="space-y-2">
                                {employee.teams.map((team, idx) => (
                                  <div
                                    key={`${employee.id}-${team.team_id}-${idx}`}
                                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3"
                                  >
                                    {/* Team name pill */}
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                                      {team.team_name}
                                    </span>

                                    {/* Role pill / dropdown */}
                                    {editingRole === `${employee.id}-${team.team_id}` ? (
                                      <RoleDropdown
                                        value={team.team_role}
                                        roles={teamRoles}
                                        onChange={newRole => handleRoleChange(team.team_id, employee.id, newRole)}
                                        onClose={() => setEditingRole(null)}
                                      />
                                    ) : (
                                      <button
                                        onClick={e => { e.stopPropagation(); setEditingRole(`${employee.id}-${team.team_id}`); }}
                                        className="text-xs font-medium border border-gray-200 px-3 py-1.5 rounded-full transition-colors hover:border-[#f7953f] hover:text-[#f7953f]"
                                        style={{ color: '#1a1209' }}
                                      >
                                        {team.team_role}
                                      </button>
                                    )}
                                  </div>
                                ))}
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
    </div>
  );
};

// ── Role Dropdown ──────────────────────────────────────────────────────────────
const RoleDropdown = ({ value, roles, onChange, onClose }) => {
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        onClose?.();
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
      {/* Trigger */}
      <button
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setOpen(v => !v); }}
        className="text-xs font-semibold border border-[#f7953f] text-[#f7953f] px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-orange-50"
      >
        {selected}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-30 bg-white rounded-2xl overflow-hidden"
          style={{ minWidth: '160px', boxShadow: '0 8px 32px rgba(26,18,9,0.14)', border: '1px solid #f0ebe3' }}
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
                style={role === selected
                  ? { background: '#f7953f', color: '#fff', fontWeight: 600 }
                  : { color: '#1a1209', fontWeight: 400 }
                }
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

export default EmployeeList;
