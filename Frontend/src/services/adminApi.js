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

export const updateTeamMemberRole = async (teamId, userId, newRole) => {
  const res = await api.patch(`/admin/teams/${teamId}/members/${userId}`, {
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

// ============ DOCUMENTS ============
// In your frontend API call file
export const uploadDocument = async (file, title = null) => {
  const formData = new FormData();
  // ---- FIX IS HERE ----
  formData.append('f', file); // Changed 'file' to 'f' to match the backend
  
  if (title) {
    formData.append('title', title);
  }
  
  console.log("Uploading file with form data...");
  const res = await api.post("/admin/documents/upload", formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  console.log("Upload response:", res.data);
  return res.data;
};

// Changed from /admin/documents to /admin/documents/list
export const fetchDocuments = async () => {
  const res = await api.get("/admin/documents/list");
  return res.data;
};

export const getDocument = async (documentId) => {
  const res = await api.get(`/admin/documents/${documentId}`);
  return res.data;
};

export const queueDocument = async (documentId) => {
  const res = await api.post(`/admin/documents/${documentId}/queue`);
  return res.data;
};

export const getJobStatus = async (jobId) => {
  const res = await api.get(`/admin/jobs/${jobId}`);
  return res.data;
};

export const downloadDocument = async (documentId) => {
  const res = await api.get(`/admin/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  return res.data;
};

export const deleteDocument = async (documentId) => {
  const res = await api.delete(`/admin/documents/${documentId}`);
  return res.data;
};