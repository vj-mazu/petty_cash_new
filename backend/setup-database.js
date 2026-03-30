// Database setup utility
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();
const { Sequelize } = require('sequelize');

const createDatabaseIfNotExists = async () => {
  // Connect to postgres database (default) to create our database
  const sequelizeDefault = new Sequelize({
    database: 'postgres', // Connect to default postgres database
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ...(process.env.DB_SSL === 'true' && {
        ssl: { require: true, rejectUnauthorized: false }
      }),
      family: 4
    }
  });

  try {
    // Test connection to PostgreSQL
    await sequelizeDefault.authenticate();
    console.log('✅ Connected to PostgreSQL server');
    
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'cash_management';
    // Use raw query with proper PostgreSQL syntax
    await sequelizeDefault.query(`SELECT 'CREATE DATABASE "${dbName}"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}')`);
    // If the database doesn't exist, we need to disconnect and create it
    try {
      await sequelizeDefault.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully`);
    } catch (createError) {
      if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
        console.log(`✅ Database "${dbName}" already exists`);
      } else {
        throw createError;
      }
    }
    
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('✅ Database already exists');
    } else {
      console.error('❌ Database setup error:', error.message);
      throw error;
    }
  } finally {
    await sequelizeDefault.close();
  }
  
  // Now test connection to our target database
  const sequelize = new Sequelize({
    database: process.env.DB_NAME || 'cash_management',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ...(process.env.DB_SSL === 'true' && {
        ssl: { require: true, rejectUnauthorized: false }
      }),
      family: 4
    }
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Successfully connected to cash_management database');
    return sequelize;
  } catch (error) {
    console.error('❌ Unable to connect to cash_management database:', error.message);
    throw error;
  }
};

module.exports = { createDatabaseIfNotExists };