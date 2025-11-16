// ============================================
// FILE: src/context/TeamContext.jsx
// ============================================
import { createContext, useState } from 'react';
import * as teamapi from '../services/teamApi'; // Import the API functions directly

export const TeamContext = createContext(null);

export const TeamProvider = ({ children }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);



  // ✅ Load teams (was fetchTeams)
  const loadTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teamapi.getMyTeams();
      setTeams(response.data || []);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch teams';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // ✅ Join team with code
  const joinTeam = async (code) => {
    setLoading(true);
    setError(null);
    try {
      const response = await teamapi.joinTeam(code);
      await loadTeams(); // Refresh teams after joining
      return { success: true, data: response.data, message: response.message };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to join team';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const regerenateTeamCode = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Regenerating team code for team ID:', teamId);
      const response = await teamapi.regenerateTeamCode(teamId);
      await loadTeams();
      return { success: true, data: response.data, message: response.message };
    } catch (err) {
      console.error('Error regenerating team code:', err);
      const errorMessage = err.response?.data?.message || 'Failed to regenerate team code';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };


  const value = {
    teams,
    loading,
    error,
    loadTeams,
    fetchTeams: loadTeams, // Expose loadTeams as fetchTeams for backward compatibility
    joinTeam,
    regerenateTeamCode,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};