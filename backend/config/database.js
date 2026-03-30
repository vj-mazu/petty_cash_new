const { Sequelize } = require('sequelize');
const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Force IPv4 DNS resolution to avoid IPv6 connection timeouts
dns.setDefaultResultOrder('ipv4first');

// PostgreSQL configuration with optimized performance settings
const sequelizeOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,

  // Optimized connection pool for high transaction volume
  // Connection pool optimized for high throughput
  pool: {
    max: 25,           // Increased for concurrent queries
    min: 5,            // Keep minimum connections warm
    acquire: 30000,    // 30 seconds to acquire (fail fast)
    idle: 10000,       // 10 seconds idle before release
    evict: 1000,       // Check for idle connections every second
    handleDisconnects: true
  },

  // Performance optimizations
  dialectOptions: {
    ...(process.env.DB_SSL === 'true' && {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }),

    // Force IPv4 to avoid IPv6 timeout issues
    family: 4,

    // PostgreSQL performance settings for 10M+ records
    application_name: 'petty_cash_prod',
    statement_timeout: 10000,     // 10s query timeout (fast-fail)
    idle_in_transaction_session_timeout: 5000, // 5s (prevent connection leaks)
    keepAlive: true,               // TCP keep-alive for connection stability
    keepAliveInitialDelayMillis: 10000,
  },

  // Query optimization settings
  benchmark: process.env.NODE_ENV === 'development',
  omitNull: false,
  native: false,
  define: {
    underscored: false,
    freezeTableName: true,
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    },
    timestamps: true
  },

  // Retry configuration for connection failures
  retry: {
    match: [
      /ConnectionError/,
      /ConnectionTimedOutError/,
      /TimeoutError/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
};

let sequelize;

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    
    // Helper to safely decode URI components (handles raw % characters)
    const safeDecode = (str) => {
      try {
        return decodeURIComponent(str);
      } catch (e) {
        return str;
      }
    };
    
    // Safety check for empty path (missing database name)
    const databaseName = dbUrl.pathname.length > 1 ? dbUrl.pathname.substring(1) : (process.env.DB_NAME || 'cash_management');

    sequelize = new Sequelize({
      database: databaseName,
      username: safeDecode(dbUrl.username) || process.env.DB_USER,
      password: safeDecode(dbUrl.password) || process.env.DB_PASSWORD,
      host: dbUrl.hostname || process.env.DB_HOST,
      port: parseInt(dbUrl.port || process.env.DB_PORT || '5432'),
      ...sequelizeOptions,
      // Ensure family is set even if not in sequelizeOptions
      dialectOptions: {
        ...sequelizeOptions.dialectOptions,
        family: 4
      }
    });
    
    console.log('✅ DATABASE_URL parsed successfully for database:', databaseName);
  } catch (error) {
    console.error('❌ Modern URL parsing failed, falling back to string initialization:', error.message);
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      ...sequelizeOptions,
      dialectOptions: {
        ...sequelizeOptions.dialectOptions,
        family: 4
      }
    });
  }
} else {
  sequelize = new Sequelize({
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || ''),
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    ...sequelizeOptions
  });
  console.warn('⚠️  DATABASE_URL is missing. Falling back to individual parameters.');
}

console.log('🐘 Using PostgreSQL database');

module.exports = sequelize;