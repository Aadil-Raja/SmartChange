import React, { createContext, useState } from 'react';
import * as adminApi from '../services/adminApi';

export const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.fetchEmployees();
      console.log('Employees API Response:', data);
      if (data.success) {
        // Handle nested response structure: data.data.employees
        const employeesList = data.data?.employees || data.data || [];
        setEmployees(employeesList);
      } else {
        setError(data.message || 'Failed to load employees');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees');
      console.error('Load employees error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.fetchTeams();
      console.log('Teams API Response:', data);
      if (data.success) {
        // Handle nested response structure: data.data.teams or data.data
        const teamsList = data.data?.teams || data.data || [];
        setTeams(teamsList);
      } else {
        setError(data.message || 'Failed to load teams');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teams');
      console.error('Load teams error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamRoles = async () => {
    try {
      const data = await adminApi.fetchTeamRoles();
      console.log('Team Roles API Response:', data);
      if (data.success) {
        // Handle nested response structure
        const rolesList = data.data?.roles || data.data || [];
        
        // CRITICAL FIX: Ensure we're storing an array of strings, not objects
        // If the API returns objects like [{value: 'member', name: 'Member'}], extract just the values
        const rolesArray = Array.isArray(rolesList) 
          ? rolesList.map(role => {
              // If role is an object with value/name properties, extract the value
              if (typeof role === 'object' && role !== null) {
                return role.value || role.name || role.role || String(role);
              }
              // If it's already a string, use it as is
              return String(role);
            })
          : [];
        
        console.log('Processed roles array:', rolesArray);
        setTeamRoles(rolesArray);
      } else {
        setError(data.message || 'Failed to load team roles');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load team roles');
      console.error('Load team roles error:', err);
    }
  };

  const createTeam = async (name) => {
    try {
      setLoading(true);
      const data = await adminApi.createTeam(name);
      if (data.success) {
        await loadTeams();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to create team' 
      };
    } finally {
      setLoading(false);
    }
  };

  const addMemberToTeam = async (teamId, userId, roleInTeam) => {
    try {
      setLoading(true);
      const data = await adminApi.addTeamMember(teamId, userId, roleInTeam);
      if (data.success) {
        await loadTeams();
        await loadEmployees();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to add member' 
      };
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromTeam = async (teamId, userId) => {
    try {
      setLoading(true);
      const data = await adminApi.removeTeamMember(teamId, userId);
      if (data.success) {
        await loadTeams();
        await loadEmployees();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to remove member' 
      };
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (teamMemberId, newRole) => {
    try {
      setLoading(true);
      const data = await adminApi.updateTeamMemberRole(teamMemberId, newRole);
      if (data.success) {
        await loadEmployees();
        await loadTeams();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to update role' 
      };
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (userId) => {
    try {
      setLoading(true);
      const data = await adminApi.deleteUser(userId);
      if (data.success) {
        await loadEmployees();
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to delete user' 
      };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    employees,
    teams,
    teamRoles,
    loading,
    error,
    loadEmployees,
    loadTeams,
    loadTeamRoles,
    createTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    updateMemberRole,
    deleteEmployee
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};