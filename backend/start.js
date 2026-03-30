#!/usr/bin/env node
/**
 * Complete backend setup and startup script
 * This script will:
 * 1. Create database if not exists
 * 2. Run all migrations
 * 3. Create default users if they don't exist
 * 4. Start the server
 */

require('dotenv').config();
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Cash Management Backend Setup...\n');

const runCommand = (command, description) => {
  try {
    console.log(`⏳ ${description}...`);
    const result = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} completed`);
    if (result.trim()) {
      console.log(`   Output: ${result.trim()}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    console.error(`   Error: ${error.message}`);
    if (error.stdout) {
      console.error(`   Stdout: ${error.stdout}`);
    }
    if (error.stderr) {
      console.error(`   Stderr: ${error.stderr}`);
    }
    return false;
  }
};

const checkFileExists = (filePath) => {
  return fs.existsSync(filePath);
};

const runSetup = async () => {
  try {
    // Step 1: Check if required files exist
    console.log('📋 Checking required files...');
    const requiredFiles = [
      'package.json',
      'server.js'
    ];

    for (const file of requiredFiles) {
      if (!checkFileExists(file)) {
        console.error(`❌ Required file missing: ${file}`);
        process.exit(1);
      }
    }
    console.log('✅ All required files present\n');

    // Step 2: Install dependencies (if node_modules doesn't exist)
    if (!checkFileExists('node_modules')) {
      if (!runCommand('npm install', 'Installing dependencies')) {
        console.error('❌ Failed to install dependencies');
        process.exit(1);
      }
    } else {
      console.log('✅ Dependencies already installed\n');
    }

    // Step 3: Setup database
    if (checkFileExists('setup-database.js')) {
      if (!runCommand('node setup-database.js', 'Setting up database')) {
        console.error('❌ Failed to setup database');
        process.exit(1);
      }
    } else {
      console.log('⚠️  setup-database.js not found, skipping database setup\n');
    }

    // Step 4: Run migrations
    console.log('⏳ Running database migrations...');
    if (!runCommand('node migrate.js', 'Running database migrations')) {
      console.log('⚠️  Migrations failed, but continuing (tables might already exist)');
    }

    // Step 5: Seed initial data (users, etc.)
    if (checkFileExists('seed.js')) {
      if (!runCommand('node seed.js', 'Creating initial users and data')) {
        console.log('⚠️  Seeding failed, but continuing (users might already exist)');
      }
    } else {
      console.log('ℹ️  seed.js not found, skipping initial data creation\n');
    }

    // Step 6: Start the server
    console.log('🎯 Setup complete! Starting server...\n');
    console.log('='.repeat(50));
    console.log('🚀 Cash Management Backend is starting...');
    console.log('📊 Server will be available at: http://localhost:5000');
    console.log('📖 API Documentation: http://localhost:5000/api');
    console.log('='.repeat(50));
    console.log('');

    // Start the server with proper output streaming
    const serverProcess = spawn('node', ['server.js'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    serverProcess.on('close', (code) => {
      console.log(`\n🛑 Server process exited with code ${code}`);
    });

    serverProcess.on('error', (error) => {
      console.error(`❌ Failed to start server: ${error.message}`);
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server gracefully...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down server...');
      serverProcess.kill('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
};

// Run the setup
runSetup().catch(error => {
  console.error('❌ Unexpected error during setup:', error);
  process.exit(1);
});