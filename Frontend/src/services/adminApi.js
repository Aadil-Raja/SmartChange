import api from "./api"; // your axios instance with baseURL & interceptors

// Teams
export const fetchTeams = async () => {
  const res = await api.get("/admin/teams");
  return res.data;
};

export const createTeam = async (name) => {
  const res = await api.post("/admin/teams", { name });
  return res.data;
};

export const getTeamDetails = async (teamId) => {
  const res = await api.get(`/admin/teams/${teamId}`);
  return res.data;
};

export const addTeamMember = async (teamId, userId, roleInTeam) => {
  const res = await api.post(`/admin/teams/${teamId}/members`, {
    user_id: userId,
    role_in_team: roleInTeam
  });
  return res.data;
};

export const removeTeamMember = async (teamId, userId) => {
  const res = await api.delete(`/admin/teams/${teamId}/members/${userId}`);
  return res.data;
};

export const updateTeamMemberRole = async (teamMemberId, newRole) => {
  const res = await api.patch(`/admin/team-members/${teamMemberId}`, {
    role_in_team: newRole
  });
  return res.data;
};

// Employees
export const fetchEmployees = async () => {
  const res = await api.get("/admin/employees");
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await api.delete(`/admin/users/${userId}`);
  return res.data;
};

// Team Roles
export const fetchTeamRoles = async () => {
  const res = await api.get("/admin/team-roles");
  return res.data;
};

// Admin Login
export const adminLogin = async (email, password) => {
  const res = await api.post("/admin/login", { email, password });
  return res.data;
};
