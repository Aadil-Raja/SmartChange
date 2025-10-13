import React, { createContext, useState,useCallback } from 'react';
import * as adminApi from '../services/adminApi';

export const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobStatuses, setJobStatuses] = useState({}); // Track job statuses

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

  const updateTeamMemberRole = async (teamId,userId, newRole) => {
    try {
      setLoading(true);
      const data = await adminApi.updateTeamMemberRole(teamId, userId, newRole);
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

// ============ DOCUMENTS ============
const loadDocuments = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    const data = await adminApi.fetchDocuments();
    console.log('Documents API Response:', data);

    if (data.success) {
      // The response has data.data.documents structure
      const docsList = data.data?.documents || [];
      setDocuments(docsList);
    } else {
      setError(data.message || 'Failed to load documents');
    }
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to load documents';
    setError(errorMsg);
    console.error('Load documents error:', err);
  } finally {
    setLoading(false);
  }
}, []);

const uploadDoc = useCallback(async (file, title = null) => {
  try {
    setError(null);
    const data = await adminApi.uploadDocument(file, title);
    console.log('Upload API Response:', data);

    if (data.success) {
      // The response has data.data.document structure
      const newDoc = data.data?.document;
      if (newDoc) {
        setDocuments(prev => [...prev, newDoc]);
      }
      return { success: true, document: newDoc };
    } else {
      const msg = data.message || 'Failed to upload document';
      setError(msg);
      return { success: false, message: msg };
    }
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to upload document';
    setError(errorMsg);
    console.error('Upload error:', err);
    return { success: false, message: errorMsg };
  }
}, []);

const queueDoc = useCallback(async (documentId) => {
  try {
    setError(null);
    const data = await adminApi.queueDocument(documentId);
    console.log('Queue API Response:', data);

    if (data.success) {
      // The response has data.data.job_id structure
      const jobId = data.data?.job_id;
      const status = data.data?.status;

      // Update document status
      setDocuments(prev => prev.map(doc =>
        doc.id === documentId
          ? { ...doc, status: status || 'QUEUED' }
          : doc
      ));

      // Store job ID for tracking
      if (jobId) {
        setJobStatuses(prev => ({
          ...prev,
          [jobId]: {
            documentId,
            status: 'queued',
            createdAt: new Date(),
          }
        }));
      }

      return { success: true, jobId, message: data.message };
    } else {
      const msg = data.message || 'Failed to queue document';
      setError(msg);
      return { success: false, message: msg };
    }
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to queue document';
    setError(errorMsg);
    console.error('Queue error:', err);
    return { success: false, message: errorMsg };
  }
}, []);

const checkJobStatus = useCallback(async (jobId) => {
  try {
    const data = await adminApi.getJobStatus(jobId);
    console.log('Job Status API Response:', data);

    if (data.success) {
      const jobStatus = data.data;

      // Update job status store
      setJobStatuses(prev => ({
        ...prev,
        [jobId]: jobStatus
      }));

      // If job is complete, update document status
      if (jobStatus.status === 'finished' && jobStatus.result?.document_id) {
        setDocuments(prev => prev.map(doc =>
          doc.id === jobStatus.result.document_id
            ? { ...doc, status: 'PROCESSED' }
            : doc
        ));
      }

      return { success: true, jobStatus };
    } else {
      return { success: false, message: data.message };
    }
  } catch (err) {
    console.error('Check job status error:', err);
    return { success: false, message: err.message };
  }
}, []);

const deleteDoc = useCallback(async (documentId) => {
  try {
    setError(null);
    const data = await adminApi.deleteDocument(documentId);
    console.log('Delete API Response:', data);

    if (data.success) {
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      return { success: true };
    } else {
      const msg = data.message || 'Failed to delete document';
      setError(msg);
      return { success: false, message: msg };
    }
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to delete document';
    setError(errorMsg);
    console.error('Delete error:', err);
    return { success: false, message: errorMsg };
  }
}, []);

const downloadDoc = useCallback(async (documentId, filename) => {
  try {
    setError(null);
    const blob = await adminApi.downloadDocument(documentId);

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);

    return { success: true };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || 'Failed to download document';
    setError(errorMsg);
    console.error('Download error:', err);
    return { success: false, message: errorMsg };
  }
}, []);

// Clear error
const clearError = useCallback(() => {
  setError(null);
}, []);

  // ============ CONTEXT VALUE ============
  const value = {
    // State
    employees,
    teams,
    teamRoles,
    documents,
    loading,
    error,
    jobStatuses,

    // Employee functions
    loadEmployees,
    deleteEmployee,

    // Team functions
    loadTeams,
    createTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    updateTeamMemberRole,

    // Team role functions
    loadTeamRoles,

    // Document functions
    loadDocuments,
    uploadDoc,
    queueDoc,
    checkJobStatus,
    deleteDoc,
    downloadDoc,

    // Utility functions
    clearError,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};