const express = require('express');
const router = express.Router();
const { getSetting, setSetting, getAllSettings } = require('../controllers/systemSettingsController');
const { authenticate, authorizeAdminOnly } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all system settings
router.get('/', getAllSettings);

// Get specific setting by key
router.get('/:key', getSetting);

// Set or update setting (admin/owner only)
router.put('/:key', authorizeAdminOnly(), setSetting);

module.exports = router;