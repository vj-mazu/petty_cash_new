// backend/services/userManagementService.js
// NEW FILE: Service layer for user management hierarchy (admin -> manager -> staff)
const { User, sequelize } = require('../models');
const { Op } = require('sequelize');
const performanceCache = require('./performanceCache');

class UserManagementService {

  /**
   * Create a user (manager or staff) with proper hierarchy.
   * - Admin can create managers and staff
   * - Manager can only create staff (auto-linked via managedBy)
   * - Staff cannot create anyone
   * - Nobody can create another admin
   */
  async createUser(creator, { username, email, password, role, managedBy, assignManagers }) {
    if (creator.role === 'staff') {
      const err = new Error('Staff cannot create user accounts');
      err.status = 403;
      throw err;
    }

    if (creator.role === 'manager' && role !== 'staff') {
      const err = new Error('Managers can only create staff accounts');
      err.status = 403;
      throw err;
    }

    if (creator.role === 'owner' && !['manager', 'staff'].includes(role)) {
      const err = new Error('Owners can only create manager and staff accounts');
      err.status = 403;
      throw err;
    }

    if (role === 'admin') {
      const err = new Error('Cannot create additional admin accounts');
      err.status = 403;
      throw err;
    }

    if (!['owner', 'manager', 'staff'].includes(role)) {
      const err = new Error('Role must be owner, manager, or staff');
      err.status = 400;
      throw err;
    }

    // Check for existing user with same username or email
    const autoEmail = email || `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@pettycash.local`;
    const existing = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email: autoEmail }]
      }
    });
    if (existing) {
      const err = new Error('A user with this username or email already exists');
      err.status = 409;
      throw err;
    }

    // Determine managedBy value
    let effectiveManagedBy = null;

    if (creator.role === 'manager') {
      // Staff created by manager is automatically under that manager
      effectiveManagedBy = creator.id;
    } else if (creator.role === 'owner') {
      if (role === 'manager') {
        // Manager created by owner is automatically under that owner
        effectiveManagedBy = creator.id;
      } else if (role === 'staff' && managedBy) {
        // Owner assigning staff to a specific manager (must be a manager under this owner)
        const [managers] = await sequelize.query(
          `SELECT id FROM users WHERE id = :managedBy AND role = 'manager' AND "isActive" = true AND "managedBy" = :ownerId`,
          { replacements: { managedBy, ownerId: creator.id } }
        );
        if (managers.length === 0) {
          const err = new Error('Selected manager not found, is inactive, or is not under your management');
          err.status = 400;
          throw err;
        }
        effectiveManagedBy = managedBy;
      } else if (role === 'staff') {
        // Staff created by owner without a manager goes directly under the owner
        effectiveManagedBy = creator.id;
      }
    } else if (creator.role === 'admin') {
      if (role === 'manager' && managedBy) {
        // Admin assigning manager to a specific owner
        const [owners] = await sequelize.query(
          `SELECT id FROM users WHERE id = :managedBy AND role = 'owner' AND "isActive" = true`,
          { replacements: { managedBy } }
        );
        if (owners.length === 0) {
          const err = new Error('Selected owner not found or is inactive');
          err.status = 400;
          throw err;
        }
        effectiveManagedBy = managedBy;
      } else if (role === 'staff' && managedBy) {
        // Admin assigning staff to a specific manager
        const [managers] = await sequelize.query(
          `SELECT id FROM users WHERE id = :managedBy AND role = 'manager' AND "isActive" = true`,
          { replacements: { managedBy } }
        );
        if (managers.length === 0) {
          const err = new Error('Selected manager not found or is inactive');
          err.status = 400;
          throw err;
        }
        effectiveManagedBy = managedBy;
      } else if (role === 'staff') {
        // Staff created by admin without a manager goes directly under admin
        effectiveManagedBy = creator.id;
      }
    }

    // Create the user via Sequelize model (handles password hashing)
    const user = await User.create({
      username,
      email: autoEmail,
      password,
      role,
      isActive: true,
      createdBy: creator.id,
      managedBy: effectiveManagedBy
    });

    // If creating an owner and assignManagers provided, reassign those managers (and their staff) to this owner
    if (role === 'owner' && Array.isArray(assignManagers) && assignManagers.length > 0) {
      // Reassign selected managers to this owner
      await sequelize.query(
        `UPDATE users SET "managedBy" = :ownerId WHERE id IN (:managerIds) AND role = 'manager'`,
        { replacements: { ownerId: user.id, managerIds: assignManagers } }
      );
      // Reassign staff under those managers to also be under the owner's hierarchy
      // (staff already have managedBy pointing to their manager, which is correct)
    }

    // Return user with hierarchy info
    const [rows] = await sequelize.query(
      `SELECT u.id, u.username, u.email, u.role, u."isActive", u."createdAt", u."managedBy",
              m.username as "managerUsername"
       FROM users u
       LEFT JOIN users m ON u."managedBy" = m.id
       WHERE u.id = :userId`,
      { replacements: { userId: user.id } }
    );

    return rows[0];
  }

  /**
   * Update a user's username and/or password.
   * Permission hierarchy:
   *   Admin can edit owner, manager, staff
   *   Owner can edit manager, staff (under them)
   *   Manager can edit staff (under them)
   */
  async updateUser(requestor, userId, { username, password, managedBy }) {
    if (requestor.id === userId && requestor.role !== 'admin') {
      // Non-admin users can't edit themselves through this endpoint
    }

    const t = await sequelize.transaction();
    try {
      const [users] = await sequelize.query(
        `SELECT id, role, username, "managedBy" FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      if (users.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const targetUser = users[0];

      if (targetUser.role === 'admin' && requestor.role !== 'admin') {
        const err = new Error('Cannot edit admin account');
        err.status = 403;
        throw err;
      }

      // Permission checks
      if (requestor.role === 'owner') {
        // Owner can only edit users under them
        if (targetUser.role === 'owner' && targetUser.id !== requestor.id) {
          const err = new Error('Owners cannot edit other owners');
          err.status = 403;
          throw err;
        }
        if (targetUser.role === 'manager' && targetUser.managedBy !== requestor.id) {
          const err = new Error('You can only edit managers under your management');
          err.status = 403;
          throw err;
        }
        if (targetUser.role === 'staff') {
          // Check if the staff is under this owner or under a manager under this owner
          const [validStaff] = await sequelize.query(
            `SELECT id FROM users WHERE id = :userId AND (
              "managedBy" = :ownerId
              OR "managedBy" IN (SELECT id FROM users WHERE "managedBy" = :ownerId AND role = 'manager')
            )`,
            { replacements: { userId, ownerId: requestor.id }, transaction: t }
          );
          if (validStaff.length === 0) {
            const err = new Error('You can only edit staff under your management');
            err.status = 403;
            throw err;
          }
        }
      } else if (requestor.role === 'manager') {
        if (targetUser.role !== 'staff' || targetUser.managedBy !== requestor.id) {
          const err = new Error('You can only edit staff under your management');
          err.status = 403;
          throw err;
        }
      }

      // Build update fields
      const updates = [];
      const replacements = { userId };

      if (username && username !== targetUser.username) {
        // Check for duplicate username
        const [existing] = await sequelize.query(
          `SELECT id FROM users WHERE username = :username AND id != :userId`,
          { replacements: { username, userId }, transaction: t }
        );
        if (existing.length > 0) {
          const err = new Error('Username already taken');
          err.status = 409;
          throw err;
        }
        updates.push(`username = :username`);
        replacements.username = username;
        // Also update auto-email
        const newEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@pettycash.local`;
        updates.push(`email = :email`);
        replacements.email = newEmail;
      }

      if (password) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);
        updates.push(`password = :password`);
        replacements.password = hashedPassword;
      }

      // Handle managedBy (staff transfer to different manager)
      if (managedBy !== undefined && targetUser.role === 'staff') {
        const newManagerId = managedBy || requestor.id; // null/empty means "direct under me"
        if (newManagerId) {
          // Verify the target manager exists and is a manager (or owner for direct assignment)
          const [targetManager] = await sequelize.query(
            `SELECT id, role, "managedBy" FROM users WHERE id = :managerId AND role IN ('manager', 'owner', 'admin')`,
            { replacements: { managerId: newManagerId }, transaction: t }
          );
          if (targetManager.length === 0) {
            const err = new Error('Target manager not found');
            err.status = 404;
            throw err;
          }
          // Permission: owner can only transfer to managers under them or to themselves
          if (requestor.role === 'owner') {
            const tm = targetManager[0];
            if (tm.id !== requestor.id && (tm.role !== 'manager' || tm.managedBy !== requestor.id)) {
              const err = new Error('You can only transfer staff to managers under your management');
              err.status = 403;
              throw err;
            }
          }
          // Permission: manager cannot transfer staff (only admin/owner can)
          if (requestor.role === 'manager') {
            const err = new Error('Managers cannot transfer staff to other managers');
            err.status = 403;
            throw err;
          }
        }
        updates.push(`"managedBy" = :managedBy`);
        replacements.managedBy = newManagerId;
      }

      if (updates.length === 0) {
        await t.rollback();
        return { username: targetUser.username, message: 'No changes to apply' };
      }

      await sequelize.query(
        `UPDATE users SET ${updates.join(', ')}, "updatedAt" = NOW() WHERE id = :userId`,
        { replacements, transaction: t }
      );

      await t.commit();

      return {
        userId,
        username: username || targetUser.username,
        message: `User "${username || targetUser.username}" updated successfully`
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Get all users with hierarchy info.
   * - Admin sees all managers and staff (with hierarchy)
   * - Manager sees only their own staff
   * - Staff sees nothing
   */
  async getUsers(requestingUser) {
    if (requestingUser.role === 'admin') {
      const [users] = await sequelize.query(`
        SELECT u.id, u.username, u.email, u.role, u."isActive",
               u."lastLogin", u."createdAt", u."managedBy",
               m.username as "managerUsername",
               COALESCE(
                 (SELECT COUNT(*)::int FROM users s WHERE s."managedBy" = u.id),
                 0
               ) as "staffCount"
        FROM users u
        LEFT JOIN users m ON u."managedBy" = m.id
        ORDER BY
          CASE u.role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'staff' THEN 3 END,
          u."createdAt" DESC
      `);
      return users;
    }

    if (requestingUser.role === 'owner') {
      // Owner sees all managers and staff
      const [users] = await sequelize.query(`
        SELECT u.id, u.username, u.email, u.role, u."isActive",
               u."lastLogin", u."createdAt", u."managedBy",
               m.username as "managerUsername",
               COALESCE(
                 (SELECT COUNT(*)::int FROM users s WHERE s."managedBy" = u.id),
                 0
               ) as "staffCount"
        FROM users u
        LEFT JOIN users m ON u."managedBy" = m.id
        WHERE u.role IN ('manager', 'staff')
        ORDER BY
          CASE u.role WHEN 'manager' THEN 0 WHEN 'staff' THEN 1 END,
          u."createdAt" DESC
      `);
      return users;
    }

    if (requestingUser.role === 'manager') {
      const [users] = await sequelize.query(`
        SELECT u.id, u.username, u.email, u.role, u."isActive",
               u."lastLogin", u."createdAt", u."managedBy"
        FROM users u
        WHERE u."managedBy" = :managerId
        ORDER BY u."createdAt" DESC
      `, { replacements: { managerId: requestingUser.id } });
      return users;
    }

    return [];
  }

  /**
   * Disable a user. Cascade: owner disables managers+staff, manager disables staff.
   */
  async disableUser(adminId, userId) {
    const t = await sequelize.transaction();
    try {
      const [users] = await sequelize.query(
        `SELECT id, role, "isActive" FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      if (users.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const user = users[0];

      if (user.role === 'admin') {
        const err = new Error('Cannot disable the admin account');
        err.status = 403;
        throw err;
      }

      if (!user.isActive) {
        const err = new Error('User is already disabled');
        err.status = 400;
        throw err;
      }

      // Disable the user
      await sequelize.query(
        `UPDATE users SET "isActive" = false WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      let disabledManagerCount = 0;
      let disabledStaffCount = 0;

      if (user.role === 'owner') {
        // Cascade: disable all managers under this owner
        const [disabledManagers] = await sequelize.query(
          `UPDATE users SET "isActive" = false WHERE "managedBy" = :userId AND role = 'manager' AND "isActive" = true RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        disabledManagerCount = disabledManagers.length;

        // Cascade: disable all staff under those managers (and any staff directly under this owner)
        const [disabledStaff] = await sequelize.query(
          `UPDATE users SET "isActive" = false
           WHERE "isActive" = true AND (
             "managedBy" = :userId
             OR "managedBy" IN (SELECT id FROM users WHERE "managedBy" = :userId AND role = 'manager')
           ) AND role = 'staff'
           RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        disabledStaffCount = disabledStaff.length;
      } else if (user.role === 'manager') {
        // Cascade: disable all staff under this manager
        const [result] = await sequelize.query(
          `UPDATE users SET "isActive" = false WHERE "managedBy" = :userId AND "isActive" = true RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        disabledStaffCount = result.length;
      }

      await t.commit();

      // Clear auth cache for affected users
      performanceCache.deleteUser(`auth_user_${userId}`);

      return {
        userId,
        role: user.role,
        disabledManagerCount,
        disabledStaffCount,
        message: user.role === 'owner'
          ? `Owner disabled along with ${disabledManagerCount} manager(s) and ${disabledStaffCount} staff account(s)`
          : user.role === 'manager'
            ? `Manager disabled along with ${disabledStaffCount} staff account(s)`
            : 'User disabled successfully'
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Enable a user. Cascade: owner enables managers+staff, manager enables staff.
   */
  async enableUser(adminId, userId) {
    const t = await sequelize.transaction();
    try {
      const [users] = await sequelize.query(
        `SELECT id, role, "isActive" FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      if (users.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const user = users[0];

      if (user.isActive) {
        const err = new Error('User is already active');
        err.status = 400;
        throw err;
      }

      // Enable the user
      await sequelize.query(
        `UPDATE users SET "isActive" = true WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      let enabledManagerCount = 0;
      let enabledStaffCount = 0;

      if (user.role === 'owner') {
        // Cascade: enable all managers under this owner
        const [enabledManagers] = await sequelize.query(
          `UPDATE users SET "isActive" = true WHERE "managedBy" = :userId AND role = 'manager' AND "isActive" = false RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        enabledManagerCount = enabledManagers.length;

        // Cascade: enable all staff under those managers
        const [enabledStaff] = await sequelize.query(
          `UPDATE users SET "isActive" = true
           WHERE "isActive" = false AND (
             "managedBy" = :userId
             OR "managedBy" IN (SELECT id FROM users WHERE "managedBy" = :userId AND role = 'manager')
           ) AND role = 'staff'
           RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        enabledStaffCount = enabledStaff.length;
      } else if (user.role === 'manager') {
        const [result] = await sequelize.query(
          `UPDATE users SET "isActive" = true WHERE "managedBy" = :userId AND "isActive" = false RETURNING id`,
          { replacements: { userId }, transaction: t }
        );
        enabledStaffCount = result.length;
      }

      await t.commit();

      return {
        userId,
        role: user.role,
        enabledManagerCount,
        enabledStaffCount,
        message: user.role === 'owner'
          ? `Owner enabled along with ${enabledManagerCount} manager(s) and ${enabledStaffCount} staff account(s)`
          : user.role === 'manager'
            ? `Manager enabled along with ${enabledStaffCount} staff account(s)`
            : 'User enabled successfully'
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Delete a user (hard delete).
   * - Admin can delete owners, managers, and staff (not admin)
   * - Owner can delete managers and staff
   * - Manager can only delete their own staff
   * - Hard-deletes the user and cascades to subordinates
   * - Deleting an owner also deletes their managers and staff
   * - Deleting a manager also deletes their staff
   */
  async deleteUser(requestor, userId) {
    if (requestor.id === userId) {
      const err = new Error('Cannot delete your own account');
      err.status = 400;
      throw err;
    }

    const t = await sequelize.transaction();
    try {
      const [users] = await sequelize.query(
        `SELECT id, role, username, "managedBy", "isActive" FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      if (users.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const user = users[0];

      if (user.role === 'admin') {
        const err = new Error('Cannot delete the admin account');
        err.status = 403;
        throw err;
      }

      // Manager can only delete their own staff
      if (requestor.role === 'manager') {
        if (user.role !== 'staff' || user.managedBy !== requestor.id) {
          const err = new Error('You can only delete staff accounts that you manage');
          err.status = 403;
          throw err;
        }
      }

      // Cascade hard-delete for owners and managers
      let deletedManagerCount = 0;
      let deletedStaffCount = 0;

      // Collect all user IDs to be deleted (for FK cleanup)
      let allUserIdsToDelete = [userId];

      if (user.role === 'owner') {
        const [managerRows] = await sequelize.query(
          `SELECT id FROM users WHERE "managedBy" = :userId AND role = 'manager'`,
          { replacements: { userId }, transaction: t }
        );
        const managerIds = managerRows.map(m => m.id);

        const [staffRows] = await sequelize.query(
          `SELECT id FROM users
           WHERE (
             "managedBy" = :userId
             OR "managedBy" IN (SELECT id FROM users WHERE "managedBy" = :userId AND role = 'manager')
           ) AND role = 'staff'`,
          { replacements: { userId }, transaction: t }
        );
        const staffIds = staffRows.map(s => s.id);

        allUserIdsToDelete = [...allUserIdsToDelete, ...managerIds, ...staffIds];
        deletedManagerCount = managerIds.length;
        deletedStaffCount = staffIds.length;
      } else if (user.role === 'manager') {
        const [staffRows] = await sequelize.query(
          `SELECT id FROM users WHERE "managedBy" = :userId`,
          { replacements: { userId }, transaction: t }
        );
        const staffIds = staffRows.map(s => s.id);
        allUserIdsToDelete = [...allUserIdsToDelete, ...staffIds];
        deletedStaffCount = staffIds.length;
      }

      // Nullify FK references in transactions and anamath_entries before deleting
      // Use SAVEPOINTs so failed ALTERs don't abort the transaction
      const safeQuery = async (sql, opts = {}) => {
        const spName = 'sp_' + Math.random().toString(36).slice(2, 10);
        await sequelize.query(`SAVEPOINT ${spName}`, { transaction: t });
        try {
          await sequelize.query(sql, { ...opts, transaction: t });
        } catch {
          await sequelize.query(`ROLLBACK TO SAVEPOINT ${spName}`, { transaction: t });
        }
      };

      // Make columns nullable if needed
      await safeQuery(`ALTER TABLE transactions ALTER COLUMN created_by DROP NOT NULL`);
      await safeQuery(`ALTER TABLE anamath_entries ALTER COLUMN created_by DROP NOT NULL`);
      await safeQuery(`ALTER TABLE opening_balances ALTER COLUMN created_by DROP NOT NULL`);

      // Nullify references
      await safeQuery(`UPDATE transactions SET created_by = NULL WHERE created_by IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });
      await safeQuery(`UPDATE transactions SET suspended_by = NULL WHERE suspended_by IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });
      await safeQuery(`UPDATE anamath_entries SET created_by = NULL WHERE created_by IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });
      await safeQuery(`UPDATE anamath_entries SET closed_by = NULL WHERE closed_by IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });
      await safeQuery(`UPDATE opening_balances SET created_by = NULL WHERE created_by IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });
      // Nullify managedBy references from other users not being deleted
      await safeQuery(`UPDATE users SET "managedBy" = NULL WHERE "managedBy" IN (:ids) AND id NOT IN (:ids)`, { replacements: { ids: allUserIdsToDelete } });

      // Now delete: staff first, then managers, then the user
      if (deletedStaffCount > 0 || deletedManagerCount > 0) {
        // Delete staff
        const staffToDelete = allUserIdsToDelete.filter(id => id !== userId);
        if (staffToDelete.length > 0) {
          await sequelize.query(
            `DELETE FROM users WHERE id IN (:ids) AND role = 'staff'`,
            { replacements: { ids: staffToDelete }, transaction: t }
          );
          await sequelize.query(
            `DELETE FROM users WHERE id IN (:ids) AND role = 'manager'`,
            { replacements: { ids: staffToDelete }, transaction: t }
          );
        }
      }

      // Delete the user itself
      await sequelize.query(
        `DELETE FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t }
      );

      await t.commit();

      // Clear auth cache
      performanceCache.deleteUser(`auth_user_${userId}`);

      return {
        deleted: true,
        username: user.username,
        deletedManagerCount,
        deletedStaffCount,
        message: user.role === 'owner' && (deletedManagerCount > 0 || deletedStaffCount > 0)
          ? `User "${user.username}" permanently deleted along with ${deletedManagerCount} manager(s) and ${deletedStaffCount} staff account(s).`
          : user.role === 'manager' && deletedStaffCount > 0
            ? `User "${user.username}" permanently deleted along with ${deletedStaffCount} staff account(s).`
            : `User "${user.username}" permanently deleted.`
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Get list of active managers (for assigning staff to).
   * Admin sees all managers. Owner sees only their managers.
   */
  async getActiveManagers(requestingUser) {
    if (requestingUser.role === 'owner') {
      const [managers] = await sequelize.query(`
        SELECT id, username FROM users
        WHERE role = 'manager' AND "isActive" = true AND "managedBy" = :ownerId
        ORDER BY username
      `, { replacements: { ownerId: requestingUser.id } });
      return managers;
    }
    const [managers] = await sequelize.query(`
      SELECT id, username FROM users
      WHERE role = 'manager' AND "isActive" = true
      ORDER BY username
    `);
    return managers;
  }

  /**
   * Get unassigned managers (not under any owner) for assigning to a new owner.
   */
  async getUnassignedManagers() {
    const [managers] = await sequelize.query(`
      SELECT u.id, u.username,
        COALESCE((SELECT COUNT(*)::int FROM users s WHERE s."managedBy" = u.id AND s.role = 'staff'), 0) as "staffCount"
      FROM users u
      WHERE u.role = 'manager' AND u."isActive" = true
        AND (u."managedBy" IS NULL
          OR u."managedBy" IN (SELECT id FROM users WHERE role = 'admin'))
      ORDER BY u.username
    `);
    return managers;
  }

  /**
   * Get list of active owners (for admin to assign managers to).
   */
  async getActiveOwners() {
    const [owners] = await sequelize.query(`
      SELECT id, username FROM users
      WHERE role = 'owner' AND "isActive" = true
      ORDER BY username
    `);
    return owners;
  }

  /**
   * Get hierarchy summary stats.
   */
  async getStats(requestingUser) {
    if (requestingUser.role === 'admin') {
      const [stats] = await sequelize.query(`
        SELECT
          COUNT(*) FILTER (WHERE role = 'owner')::int as "totalOwners",
          COUNT(*) FILTER (WHERE role = 'manager')::int as "totalManagers",
          COUNT(*) FILTER (WHERE role = 'staff')::int as "totalStaff",
          COUNT(*) FILTER (WHERE role = 'owner' AND "isActive" = true)::int as "activeOwners",
          COUNT(*) FILTER (WHERE role = 'owner' AND "isActive" = false)::int as "inactiveOwners",
          COUNT(*) FILTER (WHERE role = 'manager' AND "isActive" = true)::int as "activeManagers",
          COUNT(*) FILTER (WHERE role = 'manager' AND "isActive" = false)::int as "inactiveManagers",
          COUNT(*) FILTER (WHERE role = 'staff' AND "isActive" = true)::int as "activeStaff",
          COUNT(*) FILTER (WHERE role = 'staff' AND "isActive" = false)::int as "inactiveStaff"
        FROM users
        WHERE role != 'admin'
      `);
      return stats[0];
    }

    if (requestingUser.role === 'owner') {
      const [stats] = await sequelize.query(`
        SELECT
          COUNT(*) FILTER (WHERE role = 'manager')::int as "totalManagers",
          COUNT(*) FILTER (WHERE role = 'staff')::int as "totalStaff",
          COUNT(*) FILTER (WHERE role = 'manager' AND "isActive" = true)::int as "activeManagers",
          COUNT(*) FILTER (WHERE role = 'manager' AND "isActive" = false)::int as "inactiveManagers",
          COUNT(*) FILTER (WHERE role = 'staff' AND "isActive" = true)::int as "activeStaff",
          COUNT(*) FILTER (WHERE role = 'staff' AND "isActive" = false)::int as "inactiveStaff"
        FROM users
        WHERE role IN ('manager', 'staff')
      `);
      return stats[0];
    }

    if (requestingUser.role === 'manager') {
      const [stats] = await sequelize.query(`
        SELECT
          COUNT(*)::int as "totalStaff",
          COUNT(*) FILTER (WHERE "isActive" = true)::int as "activeStaff",
          COUNT(*) FILTER (WHERE "isActive" = false)::int as "inactiveStaff"
        FROM users
        WHERE "managedBy" = :managerId
      `, { replacements: { managerId: requestingUser.id } });
      return stats[0];
    }

    return {};
  }
}

module.exports = new UserManagementService();
