const jwt = require('jsonwebtoken');
const { User } = require('../models');
const performanceCache = require('../services/performanceCache');

// Role hierarchy for access control - higher numbers = more privileges
const ROLE_HIERARCHY = {
  staff: 1,      // Can create, edit, view
  manager: 2,    // Can create, edit, view, delete, approve debit only
  owner: 3,      // Can create, edit, view, delete, approve all, manage users (except admin)
  admin: 4       // Full admin access (highest level)
};

// Helper function to check if user has admin privileges
const isAdmin = (role) => {
  return role === 'admin';
};

// Helper function to check if user has owner privileges
const isOwner = (role) => {
  return role === 'owner';
};

// Helper function to check if user has manager privileges
const isManager = (role) => {
  return role === 'manager';
};

// Helper function to check if user can perform admin actions
const canPerformAdminActions = (role) => {
  return isAdmin(role);
};

// Helper function to check if user is staff only
const isStaffOnly = (role) => {
  return role === 'staff';
};

// Helper function to check if user can create resources
const canCreate = (role) => {
  return isAdmin(role) || isOwner(role) || isManager(role) || role === 'staff';
};

// Helper function to check if user can edit resources
const canEdit = (role) => {
  return isAdmin(role) || isOwner(role) || isManager(role) || role === 'staff';
};

// Helper function to check if user can delete resources (Admin + Owner)
const canDelete = (role) => {
  return isAdmin(role) || isOwner(role);
};

// Helper function to check if user can view/read resources
const canView = (role) => {
  return isAdmin(role) || isOwner(role) || isManager(role) || role === 'staff';
};

// Helper function to check if user can download exports
const canExport = (role) => {
  return isAdmin(role) || isOwner(role) || isManager(role) || role === 'staff';
};

// Authentication middleware with user caching
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check cache first to avoid DB lookup on every request
    const cacheKey = `auth_user_${decoded.id}`;
    let user = performanceCache.getUser(cacheKey);

    if (!user) {
      // Cache miss — fetch from DB
      user = await User.findByPk(decoded.id);
      if (user) {
        performanceCache.setUser(cacheKey, user, 10); // Cache for 10 seconds (keep short for permission changes)
      }
    }

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user inactive.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Authorization middleware - check role permissions
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role;

    const hasPermission = allowedRoles.includes(userRole) ||
      (allowedRoles.includes('admin') && isAdmin(userRole)) ||
      (allowedRoles.includes('owner') && isOwner(userRole));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`
      });
    }

    next();
  };
};

// Staff-only authorization
const authorizeStaffActions = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const allowedMethods = ['GET', 'POST'];
    if (!allowedMethods.includes(req.method)) {
      return res.status(403).json({
        success: false,
        message: 'Staff can only view and create records, not modify or delete them.'
      });
    }

    next();
  };
};

// Admin-only authorization (includes owner)
const authorizeAdminOnly = () => {
  return authorize('admin', 'owner');
};

// Create operation authorization (Staff + Manager + Admin)
const authorizeCreate = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (canCreate(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to create resources.'
    });
  };
};

// Edit operation authorization
const authorizeEdit = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (canEdit(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Only administrators and managers can edit resources.'
    });
  };
};

// Delete operation authorization (Admin + Manager)
const authorizeDelete = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (canDelete(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Only administrators and managers can delete resources.'
    });
  };
};

// View operation authorization (Staff + Manager + Admin)
const authorizeView = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (canView(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to view resources.'
    });
  };
};

// Export operation authorization (Staff + Manager + Admin)
const authorizeExport = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (canExport(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to export data.'
    });
  };
};

// Check if user can access specific resource (own or admin)
const checkResourceAccess = (resourceUserId) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const isOwnResource = req.user.id === resourceUserId;
    const hasAdminAccess = isAdmin(userRole) || isOwner(userRole) || isManager(userRole);

    if (!isOwnResource && !hasAdminAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources or need admin/manager privileges.'
      });
    }

    next();
  };
};

// Opening Balance authorization (admin only)
const authorizeOpeningBalanceAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = req.user.role;
    if (userRole === 'admin' || userRole === 'owner') {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admin can manage opening balances.'
    });
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeStaffActions,
  authorizeAdminOnly,
  authorizeCreate,
  authorizeEdit,
  authorizeDelete,
  authorizeView,
  authorizeExport,
  authorizeOpeningBalanceAccess,
  checkResourceAccess,
  ROLE_HIERARCHY,
  isAdmin,
  isOwner,
  isManager,
  canPerformAdminActions,
  isStaffOnly,
  canCreate,
  canEdit,
  canDelete,
  canView,
  canExport
};