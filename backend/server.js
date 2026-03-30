// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { sequelize } = require('./models');
const { runMigration } = require('./migrate'); // Import the migration runner
const { errorHandler, notFound } = require('./middleware/errorHandler');
const balanceScheduler = require('./services/balanceScheduler'); // Import balance scheduler
const performanceCache = require('./services/performanceCache'); // Import performance cache
const systemMonitor = require('./services/systemMonitor'); // Import system monitor
const logger = require('./services/logger'); // Import logger
const { apiLimiter } = require('./middleware/rateLimiting');

// Import routes
const authRoutes = require('./routes/auth');
const ledgerRoutes = require('./routes/ledgers');
const transactionRoutes = require('./routes/transactions');
const systemSettingsRoutes = require('./routes/systemSettings');
const openingBalanceRoutes = require('./routes/openingBalances');
const anamathEntryRoutes = require('./routes/anamathEntries');
const combinedTransactionRoutes = require('./routes/combinedTransactions');
const exportRoutes = require('./routes/exports');
const userManagementRoutes = require('./routes/userManagement');

const app = express();

// =====================================
// PERFORMANCE MIDDLEWARE
// =====================================

// Enable gzip compression for all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Security middleware with optimized settings
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// Optimized CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://petty-cash-one.vercel.app',
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, ''))
    : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin (without trailing slash) is in allowedOrigins
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.indexOf(normalizedOrigin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));



// Rate limiting — 200 requests per minute per IP
app.use('/api', apiLimiter);

// Optimized logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400 // Only log errors in production
  }));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware with optimized limits
app.use(express.json({
  limit: '10mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000
}));

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Set security headers and response time tracking
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// =====================================
// HEALTH CHECK AND MONITORING
// =====================================

// Enhanced health check with DB ping
app.get('/health', async (req, res) => {
  const start = Date.now();
  let dbStatus = { connected: false, latencyMs: 0 };

  try {
    await sequelize.query('SELECT 1');
    dbStatus = { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    dbStatus = { connected: false, error: err.message };
  }

  const mem = process.memoryUsage();
  const healthData = {
    success: dbStatus.connected,
    status: dbStatus.connected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  };

  // Only expose internals in non-production
  if (process.env.NODE_ENV !== 'production') {
    healthData.environment = process.env.NODE_ENV;
    healthData.uptime = Math.floor(process.uptime());
    healthData.database = dbStatus;
    healthData.memory = {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
    };
    healthData.cache = performanceCache.getCacheStats();
  }

  res.status(dbStatus.connected ? 200 : 503).json(healthData);
});

// Performance monitoring endpoint
app.get('/performance', async (req, res) => {
  try {
    const systemReport = await systemMonitor.getSystemReport();
    res.json({
      success: true,
      ...systemReport
    });
  } catch (error) {
    logger.error('Performance monitoring failed', error);
    res.status(500).json({
      success: false,
      message: 'Performance monitoring unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// System logs endpoint (admin only — requires auth)
app.get('/api/admin/logs', async (req, res) => {
  try {
    // Verify authentication inline since this is defined before route middleware
    const jwt = require('jsonwebtoken');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { User } = require('./models');
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive || (user.role !== 'admin' && user.role !== 'owner')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { type = 'application', lines = 100 } = req.query;
    const parsedLines = Math.min(parseInt(lines) || 100, 1000);
    const logs = logger.getRecentLogs(type, parsedLines);
    const stats = logger.getLogStats();

    res.json({
      success: true,
      logs,
      stats,
      available_types: ['application', 'error', 'security', 'performance', 'audit', 'database']
    });
  } catch (error) {
    logger.error('Log retrieval failed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs'
    });
  }
});

// API response caching headers for GET requests
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, max-age=30');
  }
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/opening-balances', openingBalanceRoutes);
app.use('/api/anamath-entries', anamathEntryRoutes);
app.use('/api/combined-transactions', combinedTransactionRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/balance-recalculation', require('./routes/balanceRecalculation'));

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Auto-setup database with default users if needed
const autoSetupDatabase = async () => {
  try {
    const { User, SystemSettings } = require('./models');

    // Check if any users exist
    const userCount = await User.count();

    if (userCount === 0) {
      console.log('🔧 No users found. Setting up default users...');

      // Create only the admin user
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const adminUser = await User.create({
        username: 'admin',
        email: 'admin@cashmanagement.com',
        password: tempPassword,
        role: 'admin',
        isActive: true
      });
      console.log(`✅ Admin user created successfully`);
      // Log temp password to file only, not stdout in production
      if (process.env.NODE_ENV === 'production') {
        logger.info(`Admin temporary password generated. Check secure logs.`);
        logger.info(`Admin temp password: ${tempPassword}`, { security: true });
      } else {
        console.log(`🔑 Admin temporary password: ${tempPassword}`);
      }
      console.log(`⚠️  IMPORTANT: Change this password immediately after first login!`);





      // Create default system settings if they don't exist
      const settingsCount = await SystemSettings.count();
      if (settingsCount === 0) {
        console.log('⚙️  Creating default system settings...');

        const defaultSettings = [
          {
            settingKey: 'global_opening_balance',
            settingValue: '0',
            description: 'Global opening balance for the system',
            createdBy: adminUser.id
          },
          {
            settingKey: 'company_name',
            settingValue: 'Cash Management System',
            description: 'Company name for reports',
            createdBy: adminUser.id
          },
          {
            settingKey: 'currency_symbol',
            settingValue: '₹',
            description: 'Currency symbol for display',
            createdBy: adminUser.id
          },
          {
            settingKey: 'date_format',
            settingValue: 'DD/MM/YYYY',
            description: 'Default date format',
            createdBy: adminUser.id
          }
        ];

        for (const setting of defaultSettings) {
          await SystemSettings.create(setting);
        }
        console.log('✅ Default system settings created');
      }

      console.log(`\n🎉 Auto-setup completed successfully!`);
      console.log(`\n🌐 Database is ready for use!`);

    } else {
      console.log(`✅ Database already has ${userCount} users. Skipping auto-setup.`);
    }

  } catch (error) {
    console.error('❌ Auto-setup failed:', error);
    // Don't exit - let the server continue even if auto-setup fails
  }
};

// Database connection and server startup
const startServer = async () => {
  try {
    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      console.error('❌ FATAL: JWT_SECRET environment variable is not set.');
      process.exit(1);
    }

    logger.info('Starting Cash Management System server...');

    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    console.log('✅ Database connection established successfully.');

    // Sync database (alter mode for production safety)
    await sequelize.sync({ alter: true });

    // Run pending migrations (guarded by AUTO_MIGRATE env var)
    const autoMigrate = process.env.AUTO_MIGRATE !== 'false';
    if (autoMigrate) {
      console.log('🔄 Running database migrations (AUTO_MIGRATE enabled)...');
      try {
        await runMigration();
        logger.info('Database migrations completed');
        console.log('✅ Database migrations completed.');
      } catch (migrationErr) {
        // If migrations fail, log and continue startup (so server can still run for debugging),
        // but surface the error in logs.
        logger.error('Database migrations failed during startup', migrationErr);
        console.error('⚠️  Database migrations failed during startup:', migrationErr.message);
      }
    } else {
      console.log('ℹ️  AUTO_MIGRATE is disabled. Skipping running migrations at startup.');
    }

    // CRITICAL PERFORMANCE INDEXES - Essential for fast transaction loading
    console.log('⚡ Applying Critical Performance Indexes...');
    try {
      const { applyCriticalIndexes } = require('./services/criticalIndexes');
      const indexResult = await applyCriticalIndexes();
      if (indexResult.success) {
        logger.info('Critical performance indexes applied', { created: indexResult.created });
      }
    } catch (error) {
      console.warn('⚠️  Critical indexes failed (will continue):', error.message);
      logger.warn('Critical indexes failed', { error: error.message });
    }

    // PostgreSQL SEQUENCES for O(1) transaction numbering at 10M+ scale
    try {
      const { addSequences } = require('./migrations/add-sequences');
      await addSequences();
    } catch (error) {
      console.warn('⚠️  Sequence migration skipped:', error.message);
    }

    // HIGH-LEVEL PERFORMANCE OPTIMIZATION - Database Indexing & Vectorization
    console.log('🚀 Applying High-Level Performance Optimizations...');
    try {
      const performanceOptimizer = require('./services/performanceOptimizer');
      const result = await performanceOptimizer.applyAll();

      if (result.success) {
        logger.info('High-level performance optimization completed successfully');
        console.log('✅ Database Performance: OPTIMIZED');
        console.log(`⚡ Applied ${result.optimizations?.length || 0} optimizations`);
      } else {
        console.warn('⚠️  Some optimizations were skipped:', result.message);
      }
    } catch (error) {
      console.warn('⚠️  Performance optimization failed (will continue):', error.message);
      logger.warn('Performance optimization failed', { error: error.message });
    }

    // Auto-setup database with default users if needed
    await autoSetupDatabase();
    logger.info('Database auto-setup completed');

    // Start balance rollover scheduler
    try {
      balanceScheduler.start();
      logger.info('Balance rollover scheduler started');
      console.log('⏰ Balance rollover scheduler started');
    } catch (schedulerError) {
      logger.error('Failed to start balance scheduler', schedulerError);
      console.error('⚠️  Failed to start balance scheduler:', schedulerError.message);
      console.log('🟨 Server will continue without automatic balance rollover');
    }

    // Pre-warm cache so first request after startup is fast
    try {
      const { Ledger, Transaction } = require('./models');
      const ledgers = await Ledger.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'ledgerType'] });
      performanceCache.setLedger('warm_ledgers', ledgers, 300);
      const txCount = await Transaction.count({ where: { isSuspended: false } });
      performanceCache.setTransactionStats('warm_txcount', txCount, 60);
      logger.info(`Cache warmed: ${ledgers.length} ledgers, ~${txCount} transactions`);
    } catch (warmErr) {
      logger.warn('Cache warm-up failed (non-critical):', warmErr.message);
    }

    // Start server (bind to all interfaces for LAN access)
    app.listen(PORT, '0.0.0.0', () => {
      const startupMessage = `Cash Management System started successfully on port ${PORT}`;
      logger.info(startupMessage, {
        port: PORT,
        environment: process.env.NODE_ENV,
        node_version: process.version,
        memory_limit: process.env.NODE_OPTIONS || 'default'
      });

      console.log(`🚀 Server is running successfully on http://localhost:${PORT}`);
      console.log(`🌐 LAN Access: Server accessible from other devices at http://[YOUR-IP]:${PORT}`);
      console.log(`🔗 API Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Performance Monitor: http://localhost:${PORT}/performance`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🎯 System optimized for high-performance transaction processing`);
      console.log(`💾 Memory caching enabled with connection pooling`);
      console.log(`🗄️  Advanced database indexing active`);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection', err, { promise: promise.toString() });
  console.error('❌ Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  console.log('👋 SIGTERM received. Shutting down gracefully...');

  // Stop balance scheduler
  try {
    balanceScheduler.stop();
    logger.info('Balance scheduler stopped');
    console.log('⏰ Balance scheduler stopped');
  } catch (error) {
    logger.error('Error stopping scheduler', error);
    console.error('⚠️  Error stopping scheduler:', error.message);
  }

  // Close performance cache
  try {
    performanceCache.close();
    logger.info('Performance cache closed');
  } catch (error) {
    logger.error('Error closing cache', error);
  }

  await sequelize.close();
  logger.info('Database connections closed. Server shutdown complete.');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  console.log('👋 SIGINT received. Shutting down gracefully...');

  // Stop balance scheduler
  try {
    balanceScheduler.stop();
    logger.info('Balance scheduler stopped');
    console.log('⏰ Balance scheduler stopped');
  } catch (error) {
    logger.error('Error stopping scheduler', error);
    console.error('⚠️  Error stopping scheduler:', error.message);
  }

  // Close performance cache
  try {
    performanceCache.close();
    logger.info('Performance cache closed');
  } catch (error) {
    logger.error('Error closing cache', error);
  }

  await sequelize.close();
  logger.info('Database connections closed. Server shutdown complete.');
  process.exit(0);
});

startServer();

module.exports = app;