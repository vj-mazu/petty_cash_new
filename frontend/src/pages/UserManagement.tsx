// frontend/src/pages/UserManagement.tsx
// NEW FILE: User Management page with hierarchy view (admin/manager)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  userManagementApi,
  ManagedUser,
  UserManagementStats,
  ManagerOption,
  OwnerOption,
  CreateUserData,
  UnassignedManager
} from '../services/userManagementApi';
import {
  Users as UsersIcon,
  Plus,
  Shield,
  X,
  UserPlus,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  UserCheck,
  UserX,
  Pencil
} from 'lucide-react';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<UserManagementStats>({});
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    type: 'disable' | 'enable' | 'delete';
    user: ManagedUser;
  } | null>(null);
  const [newUser, setNewUser] = useState<CreateUserData>({
    username: '',
    password: '',
    role: 'staff',
    managedBy: undefined
  });
  const [availableManagers, setAvailableManagers] = useState<UnassignedManager[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', managedBy: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser?.role === 'owner';
  const isManager = currentUser?.role === 'manager';
  const canManageAll = isAdmin || isOwner; // Admin and Owner can manage users

  const fetchData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const promises: Promise<any>[] = [
        userManagementApi.getUsers(),
        userManagementApi.getStats()
      ];

      // Include managers in parallel fetch for admin/owner
      if (canManageAll) {
        promises.push(userManagementApi.getManagers());
      }
      // Include owners for admin (to assign managers to owners)
      if (isAdmin) {
        promises.push(userManagementApi.getOwners());
      }

      const results = await Promise.all(promises);
      const [usersRes, statsRes, managersRes] = results;

      if (usersRes.success) setUsers(usersRes.data.users || []);
      if (statsRes.success) setStats(statsRes.data.stats || {});
      if (canManageAll && managersRes?.success) setManagers(managersRes.data.managers || []);
      if (isAdmin && results[3]?.success) setOwners(results[3].data.owners || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [canManageAll, isAdmin]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  // Fetch unassigned managers when creating an owner
  useEffect(() => {
    if (isAdmin && newUser.role === 'owner' && showCreateForm) {
      userManagementApi.getUnassignedManagers().then(res => {
        if (res.success) setAvailableManagers(res.data.managers || []);
      }).catch(() => {});
    }
  }, [isAdmin, newUser.role, showCreateForm]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password are required');
      return;
    }
    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(newUser.password)) {
      toast.error('Password must contain at least one uppercase, one lowercase, and one number');
      return;
    }

    try {
      setCreating(true);
      const payload: CreateUserData = {
        username: newUser.username,
        password: newUser.password,
        role: newUser.role
      };
      // Admin assigning manager to an owner
      if (isAdmin && newUser.role === 'manager' && newUser.managedBy) {
        payload.managedBy = newUser.managedBy;
      }
      // Admin/owner assigning staff to a manager
      if (canManageAll && newUser.role === 'staff' && newUser.managedBy) {
        payload.managedBy = newUser.managedBy;
      }
      // Admin creating owner with managers to inherit
      if (isAdmin && newUser.role === 'owner' && selectedManagers.length > 0) {
        payload.assignManagers = selectedManagers;
      }

      const response = await userManagementApi.createUser(payload);
      if (response.success) {
        toast.success(response.message);
        setShowCreateForm(false);
        setNewUser({ username: '', password: '', role: 'staff', managedBy: undefined });
        setSelectedManagers([]);
        setShowPassword(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // Refresh only stats (not the user list) after mutations
  const refreshStats = useCallback(async () => {
    try {
      const statsRes = await userManagementApi.getStats();
      if (statsRes.success) setStats(statsRes.data.stats || {});
      if (canManageAll) {
        const managersRes = await userManagementApi.getManagers();
        if (managersRes.success) setManagers(managersRes.data.managers || []);
      }
      if (isAdmin) {
        const ownersRes = await userManagementApi.getOwners();
        if (ownersRes.success) setOwners(ownersRes.data.owners || []);
      }
    } catch {}
  }, [canManageAll, isAdmin]);

  const handleDisableUser = async (user: ManagedUser) => {
    try {
      const response = await userManagementApi.disableUser(user.id);
      if (response.success) {
        toast.success(response.message);
        // Optimistic update: mark user (and subordinates) as disabled immediately
        setUsers(prev => prev.map(u => {
          if (u.id === user.id) return { ...u, isActive: false };
          // Owner cascade: disable managers and staff under owner
          if (user.role === 'owner' && u.managedBy === user.id) return { ...u, isActive: false };
          if (user.role === 'manager' && u.managedBy === user.id) return { ...u, isActive: false };
          // Owner cascade: disable staff under owner's managers
          if (user.role === 'owner') {
            const ownerManagerIds = prev.filter(m => m.managedBy === user.id && m.role === 'manager').map(m => m.id);
            if (ownerManagerIds.includes(u.managedBy || '')) return { ...u, isActive: false };
          }
          return u;
        }));
        refreshStats();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to disable user');
    }
    setConfirmAction(null);
  };

  const handleEnableUser = async (user: ManagedUser) => {
    try {
      const response = await userManagementApi.enableUser(user.id);
      if (response.success) {
        toast.success(response.message);
        // Optimistic update: mark user (and subordinates) as enabled immediately
        setUsers(prev => prev.map(u => {
          if (u.id === user.id) return { ...u, isActive: true };
          if (user.role === 'owner' && u.managedBy === user.id) return { ...u, isActive: true };
          if (user.role === 'manager' && u.managedBy === user.id) return { ...u, isActive: true };
          if (user.role === 'owner') {
            const ownerManagerIds = prev.filter(m => m.managedBy === user.id && m.role === 'manager').map(m => m.id);
            if (ownerManagerIds.includes(u.managedBy || '')) return { ...u, isActive: true };
          }
          return u;
        }));
        refreshStats();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to enable user');
    }
    setConfirmAction(null);
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    try {
      const response = await userManagementApi.deleteUser(user.id);
      if (response.success) {
        toast.success(response.message);
        // Remove deleted user and all subordinates from local state
        setUsers(prev => {
          // Collect IDs to remove
          const idsToRemove = new Set<string>([user.id]);
          if (user.role === 'owner') {
            prev.filter(u => u.managedBy === user.id && u.role === 'manager').forEach(m => {
              idsToRemove.add(m.id);
              // Also remove staff under those managers
              prev.filter(s => s.managedBy === m.id).forEach(s => idsToRemove.add(s.id));
            });
            // Staff directly under owner
            prev.filter(u => u.managedBy === user.id && u.role === 'staff').forEach(s => idsToRemove.add(s.id));
          } else if (user.role === 'manager') {
            prev.filter(u => u.managedBy === user.id).forEach(s => idsToRemove.add(s.id));
          }
          return prev.filter(u => !idsToRemove.has(u.id));
        });
        refreshStats();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
    setConfirmAction(null);
  };

  const canEditUser = (user: ManagedUser) => {
    if (user.role === 'admin') return isAdmin; // only admin can edit admin
    if (isAdmin) return true;
    if (isOwner && (user.role === 'manager' || user.role === 'staff')) return true;
    if (isManager && user.role === 'staff' && user.managedBy === currentUser?.id) return true;
    return false;
  };

  const handleEditUser = (user: ManagedUser) => {
    setEditingUser(user);
    setEditForm({ username: user.username, password: '', managedBy: user.managedBy || '' });
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const payload: { username?: string; password?: string; managedBy?: string | null } = {};
    if (editForm.username && editForm.username !== editingUser.username) {
      if (editForm.username.length < 3 || editForm.username.length > 30) {
        toast.error('Username must be between 3 and 30 characters');
        return;
      }
      payload.username = editForm.username;
    }
    if (editForm.password) {
      if (editForm.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(editForm.password)) {
        toast.error('Password must contain uppercase, lowercase, and number');
        return;
      }
      payload.password = editForm.password;
    }
    // Check if managedBy changed (for staff transfer)
    if (editingUser.role === 'staff') {
      const currentManagedBy = editingUser.managedBy || '';
      if (editForm.managedBy !== currentManagedBy) {
        payload.managedBy = editForm.managedBy || null;
      }
    }

    if (!payload.username && !payload.password && payload.managedBy === undefined) {
      toast.info('No changes to save');
      return;
    }

    try {
      setEditSaving(true);
      const response = await userManagementApi.updateUser(editingUser.id, payload);
      if (response.success) {
        toast.success(response.message);
        // Refresh full data for hierarchy changes
        if (payload.managedBy !== undefined) {
          fetchData();
        } else if (payload.username) {
          setUsers(prev => prev.map(u =>
            u.id === editingUser.id ? { ...u, username: payload.username! } : u
          ));
        }
        setEditingUser(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleManagerExpand = (managerId: string) => {
    setExpandedManagers(prev => {
      const next = new Set(prev);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return next;
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Organize users into hierarchy for admin/owner view
  const organizeHierarchy = () => {
    const ownerUsers = users.filter(u => u.role === 'owner');
    const managerUsers = users.filter(u => u.role === 'manager');
    const staffByManager = new Map<string, ManagedUser[]>();
    const managersByOwner = new Map<string, ManagedUser[]>();
    const unassignedManagers: ManagedUser[] = [];
    const unassignedStaff: ManagedUser[] = [];

    // Group managers by owner
    managerUsers.forEach(manager => {
      if (manager.managedBy) {
        const existing = managersByOwner.get(manager.managedBy) || [];
        existing.push(manager);
        managersByOwner.set(manager.managedBy, existing);
      } else {
        unassignedManagers.push(manager);
      }
    });

    // Group staff by manager
    users.filter(u => u.role === 'staff').forEach(staff => {
      if (staff.managedBy) {
        const existing = staffByManager.get(staff.managedBy) || [];
        existing.push(staff);
        staffByManager.set(staff.managedBy, existing);
      } else {
        unassignedStaff.push(staff);
      }
    });

    return { ownerUsers, managerUsers, managersByOwner, staffByManager, unassignedManagers, unassignedStaff };
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return '';
    const { type, user } = confirmAction;
    if (type === 'disable' && user.role === 'owner') {
      const managersUnder = users.filter(u => u.managedBy === user.id && u.role === 'manager');
      const staffUnderManagers = users.filter(u => managersUnder.some(m => m.id === u.managedBy));
      return `Disabling owner "${user.username}" will also disable ${managersUnder.length} manager(s) and ${staffUnderManagers.length} staff account(s) under them. Continue?`;
    }
    if (type === 'disable' && user.role === 'manager') {
      const staffUnder = users.filter(u => u.managedBy === user.id && u.isActive);
      return `Disabling manager "${user.username}" will also disable ${staffUnder.length} staff account(s) under them. They will not be able to log in. Continue?`;
    }
    if (type === 'enable' && user.role === 'manager') {
      const staffUnder = users.filter(u => u.managedBy === user.id && !u.isActive);
      return `Enabling manager "${user.username}" will also re-enable ${staffUnder.length} staff account(s) under them. Continue?`;
    }
    if (type === 'disable') return `Disable user "${user.username}"? They will not be able to log in.`;
    if (type === 'enable') return `Enable user "${user.username}"? They will be able to log in again.`;
    if (type === 'delete') return `Permanently delete user "${user.username}"? This action cannot be undone.`;
    return '';
  };

  if (loading) return <LoadingSpinner message="Loading user management..." />;

  if (!isAdmin && !isOwner && !isManager) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Only Admin, Owner, and Manager can access user management.</p>
        </div>
      </div>
    );
  }

  const { ownerUsers, managerUsers, managersByOwner, staffByManager, unassignedManagers, unassignedStaff } = organizeHierarchy();

  const renderUserRow = (user: ManagedUser, index: number, indent: number = 0) => (
    <tr
      key={user.id}
      className={`hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors ${!user.isActive ? 'bg-red-50 dark:bg-red-900/20 opacity-75' : index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'}`}
    >
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs dark:text-gray-300">{index + 1}</td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium dark:text-gray-200">
        <div className="flex items-center">
          {indent > 0 && <span className="text-gray-400 dark:text-gray-500 mr-1.5" style={{ paddingLeft: `${(indent - 1) * 16}px` }}>└</span>}
          {(user.role === 'owner' || user.role === 'manager') && canManageAll && (
            <button
              onClick={() => toggleManagerExpand(user.id)}
              className="mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            >
              {expandedManagers.has(user.id) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <span className={!user.isActive ? 'line-through text-gray-400 dark:text-gray-500' : ''}>
            {user.username}
          </span>
          {user.role === 'owner' && (
            <span className="ml-1.5 text-[10px] text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1 rounded">
              {(managersByOwner.get(user.id) || []).length} managers
            </span>
          )}
          {user.role === 'manager' && user.staffCount !== undefined && (
            <span className="ml-1.5 text-[10px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">
              {user.staffCount} staff
            </span>
          )}
        </div>
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRoleBadgeColor(user.role)}`}>
          <Shield className="w-2.5 h-2.5 mr-0.5" />
          {user.role}
        </span>
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
          {user.isActive ? (
            <><UserCheck className="w-2.5 h-2.5 mr-0.5" /> Active</>
          ) : (
            <><UserX className="w-2.5 h-2.5 mr-0.5" /> Disabled</>
          )}
        </span>
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400">
        {user.managerUsername || (user.managedBy ? '—' : canManageAll ? 'Admin' : '—')}
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
        {user.lastLogin ? format(new Date(user.lastLogin), 'dd/MM/yy HH:mm') : 'Never'}
      </td>
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs">
        <div className="flex items-center justify-center gap-1">
          {user.role !== 'admin' && (
            <>
              {/* Edit button */}
              {canEditUser(user) && (
                <button
                  onClick={() => handleEditUser(user)}
                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  title="Edit user"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Disable / Enable toggle */}
              {canManageAll && (
                user.isActive ? (
                  <button
                    onClick={() => setConfirmAction({ type: 'disable', user })}
                    className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                    title="Disable user"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmAction({ type: 'enable', user })}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Enable user"
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                )
              )}
              {/* Delete - admin/owner can delete anyone, manager can delete their staff */}
              {(canManageAll || (isManager && user.role === 'staff')) && (
                <button
                  onClick={() => setConfirmAction({ type: 'delete', user })}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete user"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );

  // Build flat rows for admin/owner view with hierarchy
  const buildAdminRows = () => {
    const rows: React.ReactNode[] = [];
    let idx = 0;

    if (isOwner) {
      // Owner view: show all managers with their staff
      managerUsers.forEach(manager => {
        rows.push(renderUserRow(manager, idx++));
        if (expandedManagers.has(manager.id)) {
          const staffUnder = staffByManager.get(manager.id) || [];
          staffUnder.forEach(staff => {
            rows.push(renderUserRow(staff, idx++, 1));
          });
        }
      });

      // Staff not under any manager
      if (unassignedStaff.length > 0) {
        rows.push(
          <tr key="divider-unassigned" className="bg-gray-200 dark:bg-gray-700">
            <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 text-center">
              Staff (Direct / Unassigned)
            </td>
          </tr>
        );
        unassignedStaff.forEach(staff => {
          rows.push(renderUserRow(staff, idx++));
        });
      }
    } else {
      // Admin view: Owners → their managers → staff hierarchy
      ownerUsers.forEach(owner => {
        rows.push(renderUserRow(owner, idx++));
        if (expandedManagers.has(owner.id)) {
          const managersUnder = managersByOwner.get(owner.id) || [];
          managersUnder.forEach(manager => {
            rows.push(renderUserRow(manager, idx++, 1));
            if (expandedManagers.has(manager.id)) {
              const staffUnder = staffByManager.get(manager.id) || [];
              staffUnder.forEach(staff => {
                rows.push(renderUserRow(staff, idx++, 2));
              });
            }
          });
        }
      });

      // Unassigned managers (not under any owner) and their staff
      if (unassignedManagers.length > 0) {
        unassignedManagers.forEach(manager => {
          rows.push(renderUserRow(manager, idx++));
          if (expandedManagers.has(manager.id)) {
            const staffUnder = staffByManager.get(manager.id) || [];
            staffUnder.forEach(staff => {
              rows.push(renderUserRow(staff, idx++, 1));
            });
          }
        });
      }

      // Unassigned staff (not under any manager)
      if (unassignedStaff.length > 0) {
        rows.push(
          <tr key="divider-unassigned" className="bg-gray-200 dark:bg-gray-700">
            <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 text-center">
              Staff (Direct / Unassigned)
            </td>
          </tr>
        );
        unassignedStaff.forEach(staff => {
          rows.push(renderUserRow(staff, idx++));
        });
      }
    }

    return rows;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-800 dark:to-purple-900 text-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <UsersIcon className="w-5 h-5 mr-2" />
            <h1 className="text-xl font-bold">User Management</h1>
            <span className="ml-3 text-xs text-indigo-200">
              {currentUser?.role === 'admin' ? 'Super Admin' : currentUser?.role === 'owner' ? 'Owner' : 'Manager'}
            </span>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center px-4 py-2 bg-white/90 dark:bg-white/10 text-indigo-700 dark:text-white rounded-lg font-semibold hover:bg-white dark:hover:bg-white/20 transition-all text-sm shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            {showCreateForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showCreateForm ? 'Cancel' : canManageAll ? 'Create User' : 'Create Staff'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`grid gap-3 ${canManageAll ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2'}`}>
        {canManageAll && (
          <>
            {isAdmin && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-purple-100 dark:border-purple-900/50 p-4 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Owners</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.activeOwners || 0}</p>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {stats.inactiveOwners ? `${stats.inactiveOwners} disabled` : ''}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-blue-100 dark:border-blue-900/50 p-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Managers</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.activeManagers || 0}</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {stats.inactiveManagers ? `${stats.inactiveManagers} disabled` : ''}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-green-100 dark:border-green-900/50 p-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Staff</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.activeStaff || 0}</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {stats.inactiveStaff ? `${stats.inactiveStaff} disabled` : ''}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-purple-100 dark:border-purple-900/50 p-4 transition-colors">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {(stats.totalOwners || 0) + (stats.totalManagers || 0) + (stats.totalStaff || 0)}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-orange-100 dark:border-orange-900/50 p-4 transition-colors">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Disabled</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                  {(stats.inactiveOwners || 0) + (stats.inactiveManagers || 0) + (stats.inactiveStaff || 0)}
                </p>
              </div>
            </div>
          </>
        )}
        {isManager && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-green-100 dark:border-green-900/50 p-4 transition-colors">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">My Staff</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.activeStaff || 0}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-orange-100 dark:border-orange-900/50 p-4 transition-colors">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Disabled Staff</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.inactiveStaff || 0}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-w-md mx-auto transition-colors">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800 p-4">
            <h3 className="text-white font-semibold flex items-center">
              <UserPlus className="w-5 h-5 mr-2" />
              {canManageAll ? 'Create New User' : 'Create New Staff'}
            </h3>
            <p className="text-indigo-100 text-xs mt-1">
              {canManageAll ? 'Create a manager or staff account' : 'Create a staff account under your management'}
            </p>
          </div>
          <form onSubmit={handleCreateUser} className="p-5 space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                required
                minLength={3}
                maxLength={30}
                placeholder="Enter username"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                Must contain <span className="text-indigo-600 dark:text-indigo-400 font-bold">Uppercase</span>,
                <span className="text-indigo-600 dark:text-indigo-400 font-bold"> Lowercase</span>, and
                <span className="text-indigo-600 dark:text-indigo-400 font-bold"> Number</span> (Min 6 chars).
              </p>
            </div>

            {/* Role - Admin sees owner/manager/staff, Owner sees manager/staff, Manager sees only staff */}
            {canManageAll && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <div className={`grid gap-2 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {(isAdmin ? ['owner', 'manager', 'staff'] : ['manager', 'staff']).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => { setNewUser({ ...newUser, role: role as CreateUserData['role'], managedBy: undefined }); setSelectedManagers([]); }}                      className={`py-2.5 px-3 rounded-lg text-sm font-semibold border-2 transition-all capitalize ${
                        newUser.role === role
                          ? role === 'owner'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : role === 'manager'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assign Managers to Owner (only for admin creating owner) */}
            {isAdmin && newUser.role === 'owner' && availableManagers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inherit Managers <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1 bg-white dark:bg-gray-700">
                  {availableManagers.map(m => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedManagers.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedManagers(prev => [...prev, m.id]);
                          } else {
                            setSelectedManagers(prev => prev.filter(id => id !== m.id));
                          }
                        }}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{m.username}</span>
                      {m.staffCount > 0 && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">({m.staffCount} staff)</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Selected managers and their staff will be placed under this owner.
                </p>
              </div>
            )}

            {/* Assign Manager to Owner (only for admin creating manager) */}
            {isAdmin && newUser.role === 'manager' && owners.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Owner
                </label>
                <select
                  value={newUser.managedBy || ''}
                  onChange={(e) => setNewUser({ ...newUser, managedBy: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Unassigned (direct under Admin)</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>{o.username}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-400">
                  Manager and all their staff will be under this owner.
                </p>
              </div>
            )}

            {/* Assign to Manager (only for admin/owner creating staff) */}
            {canManageAll && newUser.role === 'staff' && managers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Manager <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <select
                  value={newUser.managedBy || ''}
                  onChange={(e) => setNewUser({ ...newUser, managedBy: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Direct (under {isAdmin ? 'Admin' : 'Owner'})</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.username}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-400">
                  If assigned to a manager, disabling the manager will also disable this staff.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={creating || !newUser.username || !newUser.password}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {creating ? 'Creating...' : `Create ${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)}`}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="w-full py-2.5 mt-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm border border-gray-300 dark:border-gray-600"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-10 bg-gray-100 dark:bg-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300">SL</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-left bg-indigo-50 dark:bg-indigo-900/30 font-bold text-xs text-indigo-800 dark:text-indigo-300">USERNAME</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-24 bg-blue-50 dark:bg-blue-900/30 font-bold text-xs text-blue-800 dark:text-blue-300">ROLE</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-24 bg-green-50 dark:bg-green-900/30 font-bold text-xs text-green-800 dark:text-green-300">STATUS</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-24 bg-yellow-50 dark:bg-yellow-900/20 font-bold text-xs text-yellow-800 dark:text-yellow-300">UNDER</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-28 bg-orange-50 dark:bg-orange-900/20 font-bold text-xs text-orange-800 dark:text-orange-300">LAST LOGIN</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-center w-24 bg-red-50 dark:bg-red-900/20 font-bold text-xs text-red-800 dark:text-red-300">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {canManageAll ? (
              users.length > 0 ? (
                <>
                  {/* Admin account row */}
                  {users.filter(u => u.role === 'admin').map((adminUser, i) => (
                    <tr key={adminUser.id} className="bg-red-50 dark:bg-red-900/20">
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs dark:text-gray-300">—</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400">
                        {adminUser.username} <span className="text-[10px] font-normal dark:text-red-300">(Super Admin)</span>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700">
                          <Shield className="w-2.5 h-2.5 mr-0.5" /> Admin
                        </span>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                          <UserCheck className="w-2.5 h-2.5 mr-0.5" /> Active
                        </span>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs text-gray-400 dark:text-gray-500">—</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                        {adminUser.lastLogin ? format(new Date(adminUser.lastLogin), 'dd/MM/yy HH:mm') : 'Never'}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs text-gray-400 dark:text-gray-500">—</td>
                    </tr>
                  ))}
                  {/* Hierarchy rows */}
                  {buildAdminRows()}
                </>
              ) : (
                <tr>
                  <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No users found. Create your first manager or staff account.
                  </td>
                </tr>
              )
            ) : (
              /* Manager view: just their staff */
              users.length > 0 ? (
                users.map((user, index) => renderUserRow(user, index))
              ) : (
                <tr>
                  <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No staff accounts yet. Create your first staff account.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 transition-colors">
        <div className="flex items-start">
          <AlertTriangle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
            {canManageAll ? (
              <>
                <p><strong>Admin/Owner privileges:</strong> Create managers & staff, disable/enable users, delete accounts.</p>
                <p><strong>Hierarchy:</strong> Owner → Managers → Staff. Managers created by an owner are under that owner.</p>
                <p><strong>Cascade rule:</strong> Disabling an owner/manager automatically disables all users under them.</p>
              </>
            ) : (
              <>
                <p><strong>Manager privileges:</strong> Create and delete staff accounts under your management.</p>
                <p><strong>Note:</strong> If the admin disables your account, all your staff will also be disabled.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center">
                <Pencil className="w-5 h-5 mr-2" />
                Edit {editingUser.role.charAt(0).toUpperCase() + editingUser.role.slice(1)}: {editingUser.username}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  minLength={3}
                  maxLength={30}
                  placeholder="Enter new username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password <span className="text-gray-400 dark:text-gray-500 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    minLength={6}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  Must contain <span className="text-blue-600 dark:text-blue-400 font-bold">Uppercase</span>,
                  <span className="text-blue-600 dark:text-blue-400 font-bold"> Lowercase</span>, and
                  <span className="text-blue-600 dark:text-blue-400 font-bold"> Number</span>.
                </p>
              </div>
              {/* Transfer Staff to Manager (only for staff, only admin/owner) */}
              {editingUser.role === 'staff' && canManageAll && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assigned to Manager
                  </label>
                  <select
                    value={editForm.managedBy}
                    onChange={(e) => setEditForm({ ...editForm, managedBy: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Direct (under {isAdmin ? 'Admin' : 'Owner'})</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.username}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    Transfer this staff to a different manager.
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm border border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === 'disable') handleDisableUser(confirmAction.user);
            else if (confirmAction.type === 'enable') handleEnableUser(confirmAction.user);
            else if (confirmAction.type === 'delete') handleDeleteUser(confirmAction.user);
          }}
          title={
            confirmAction.type === 'disable' ? 'Disable User' :
            confirmAction.type === 'enable' ? 'Enable User' : 'Delete User'
          }
          message={getConfirmMessage()}
          confirmButtonText={
            confirmAction.type === 'disable' ? 'Disable' :
            confirmAction.type === 'enable' ? 'Enable' : 'Delete'
          }
          confirmButtonColor={confirmAction.type === 'enable' ? 'green' : 'red'}
        />
      )}
    </div>
  );
};

export default UserManagement;
