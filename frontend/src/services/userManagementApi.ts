// frontend/src/services/userManagementApi.ts
// NEW FILE: TypeScript API client for user management endpoints
import api from './api';

// Types for user management
export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'owner' | 'manager' | 'staff';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  managedBy: string | null;
  managerUsername: string | null;
  staffCount?: number;
}

export interface UserManagementStats {
  totalOwners?: number;
  totalManagers?: number;
  totalStaff?: number;
  activeOwners?: number;
  inactiveOwners?: number;
  activeManagers?: number;
  inactiveManagers?: number;
  activeStaff?: number;
  inactiveStaff?: number;
}

export interface ManagerOption {
  id: string;
  username: string;
}

export interface OwnerOption {
  id: string;
  username: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  role: 'owner' | 'manager' | 'staff';
  managedBy?: string;
  assignManagers?: string[];
}

export interface UnassignedManager {
  id: string;
  username: string;
  staffCount: number;
}

// User Management API
export const userManagementApi = {
  getStats: async (): Promise<{ success: boolean; data: { stats: UserManagementStats } }> => {
    const response = await api.get('/user-management/stats');
    return response.data;
  },

  getUsers: async (): Promise<{ success: boolean; data: { users: ManagedUser[] } }> => {
    const response = await api.get('/user-management/users');
    return response.data;
  },

  getManagers: async (): Promise<{ success: boolean; data: { managers: ManagerOption[] } }> => {
    const response = await api.get('/user-management/managers');
    return response.data;
  },

  getOwners: async (): Promise<{ success: boolean; data: { owners: OwnerOption[] } }> => {
    const response = await api.get('/user-management/owners');
    return response.data;
  },

  getUnassignedManagers: async (): Promise<{ success: boolean; data: { managers: UnassignedManager[] } }> => {
    const response = await api.get('/user-management/unassigned-managers');
    return response.data;
  },

  createUser: async (data: CreateUserData): Promise<{ success: boolean; message: string; data: { user: ManagedUser } }> => {
    const response = await api.post('/user-management/users', data);
    return response.data;
  },

  disableUser: async (id: string): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await api.post(`/user-management/users/${id}/disable`);
    return response.data;
  },

  enableUser: async (id: string): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await api.post(`/user-management/users/${id}/enable`);
    return response.data;
  },

  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/user-management/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, data: { username?: string; password?: string; managedBy?: string | null }): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await api.put(`/user-management/users/${id}`, data);
    return response.data;
  }
};
