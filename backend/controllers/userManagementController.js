// backend/controllers/userManagementController.js
// NEW FILE: Controller for user management API endpoints
const userManagementService = require('../services/userManagementService');

// Create a new user (manager or staff)
const createUser = async (req, res) => {
  try {
    const { username, password, role, managedBy, assignManagers } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and role are required'
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    const user = await userManagementService.createUser(req.user, {
      username,
      password,
      role,
      managedBy,
      assignManagers
    });

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      data: { user }
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to create user'
    });
  }
};

// Get all users with hierarchy info
const getUsers = async (req, res) => {
  try {
    const users = await userManagementService.getUsers(req.user);

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users'
    });
  }
};

// Get hierarchy stats
const getStats = async (req, res) => {
  try {
    const stats = await userManagementService.getStats(req.user);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stats'
    });
  }
};

// Get active managers list (for assigning staff)
const getManagers = async (req, res) => {
  try {
    const managers = await userManagementService.getActiveManagers(req.user);

    res.json({
      success: true,
      data: { managers }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch managers'
    });
  }
};

// Get active owners list (for admin to assign managers)
const getOwners = async (req, res) => {
  try {
    const owners = await userManagementService.getActiveOwners();

    res.json({
      success: true,
      data: { owners }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch owners'
    });
  }
};

// Get unassigned managers (for assigning to new owner)
const getUnassignedManagers = async (req, res) => {
  try {
    const managers = await userManagementService.getUnassignedManagers();
    res.json({ success: true, data: { managers } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch unassigned managers' });
  }
};

// Disable a user (cascade for managers)
const disableUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userManagementService.disableUser(req.user.id, id);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to disable user'
    });
  }
};

// Enable a user (cascade for managers)
const enableUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userManagementService.enableUser(req.user.id, id);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to enable user'
    });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userManagementService.deleteUser(req.user, id);

    res.json({
      success: true,
      message: `User "${result.username}" deleted successfully`,
      data: result
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete user'
    });
  }
};

// Update a user (username/password/managedBy)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, managedBy } = req.body;

    if (!username && !password && managedBy === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (username, password, or managedBy) must be provided'
      });
    }

    if (username && (username.length < 3 || username.length > 30)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters'
      });
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        });
      }
    }

    const result = await userManagementService.updateUser(req.user, id, { username, password, managedBy });

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update user'
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getStats,
  getManagers,
  getOwners,
  getUnassignedManagers,
  disableUser,
  enableUser,
  updateUser,
  deleteUser
};
