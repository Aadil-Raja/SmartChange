
import api from './api'; 

// Get all teams for logged-in employee
export const getMyTeams = async () => {
  const response = await api.get('/employee/my-teams');
  return response.data;
};

// Join team with code
export const joinTeam = async (code) => {
  const response = await api.post('/employee/join', { code });
  return response.data;
};

export const regenerateTeamCode = async (teamId) => {
  const response = await api.post(`/employee/${teamId}/regenerate-code`);
  return response.data;
}
