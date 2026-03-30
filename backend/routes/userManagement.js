// backend/routes/userManagement.js
// NEW FILE: Routes for /api/user-management/* endpoints
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/userManagementController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Stats - admin, owner and manager
router.get('/stats', authorize('admin', 'owner', 'manager'), getStats);

// List users - admin/owner sees all, manager sees their staff
router.get('/users', authorize('admin', 'owner', 'manager'), getUsers);

// List active managers - admin/owner (for assigning staff to managers)
router.get('/managers', authorize('admin', 'owner'), getManagers);

// List active owners - admin (for assigning managers to owners)
router.get('/owners', authorize('admin'), getOwners);

// List unassigned managers - admin (for assigning to new owner)
router.get('/unassigned-managers', authorize('admin'), getUnassignedManagers);

// Create user - admin/owner can create manager/staff, manager can create staff
router.post('/users', authorize('admin', 'owner', 'manager'), createUser);

// Update user - edit username/password with hierarchy permissions
router.put('/users/:id', authorize('admin', 'owner', 'manager'), updateUser);

// Disable user - admin/owner (cascade for managers)
router.post('/users/:id/disable', authorize('admin', 'owner'), disableUser);

// Enable user - admin/owner (cascade for managers)
router.post('/users/:id/enable', authorize('admin', 'owner'), enableUser);

// Delete user - admin/owner can delete anyone, manager can delete their staff
router.delete('/users/:id', authorize('admin', 'owner', 'manager'), deleteUser);

module.exports = router;
