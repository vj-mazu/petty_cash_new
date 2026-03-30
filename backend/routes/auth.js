const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole
} = require('../controllers/authController');
const { authenticate, authorize, authorizeAdminOnly } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiting');
const { handleValidation } = require('../middleware/errorHandler');
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateId,
  validatePagination
} = require('../validators');

// Public routes
router.post('/login', authLimiter, validateLogin, handleValidation, login);

// Protected routes
router.use(authenticate); // All routes below require authentication

// Admin only routes - registration
router.post('/register', authorizeAdminOnly(), validateRegister, handleValidation, register);

router.get('/profile', getProfile);
router.put('/profile', validateUpdateProfile, handleValidation, updateProfile);
router.put('/change-password', validateChangePassword, handleValidation, changePassword);

// Admin only routes - user management
router.get('/users',
  authorizeAdminOnly(), // Only admins can view all users
  validatePagination,
  handleValidation,
  getAllUsers
);

router.put('/users/:id/role',
  authorizeAdminOnly(), // Only admin can change user roles
  validateId,
  handleValidation,
  updateUserRole
);

module.exports = router;