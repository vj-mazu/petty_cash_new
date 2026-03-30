'use strict';
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('./config/database');
const path = require('path');
const fs = require('fs');

const migrationPattern = path.join(__dirname, 'migrations', '*.{js,sql}').replace(/\\/g, '/');
console.log(`[DEBUG] Globbing for migrations in: ${migrationPattern}`);

const umzug = new Umzug({
  migrations: {
    glob: migrationPattern,
    resolve: ({ name, path: migrationPath, context }) => {
      const isSql = migrationPath.endsWith('.sql');
      if (isSql) {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        return {
          name,
          up: async () => {
            // Run raw SQL via the sequelize instance (not the context) to support multi-statement SQL files
            if (!sequelize || typeof sequelize.query !== 'function') {
              throw new Error('Sequelize instance unavailable to run SQL migration');
            }
            return sequelize.query(sql);
          },
          down: async () => Promise.resolve(), // SQL migrations often don't have a down
        };
      } else {
        const migration = require(migrationPath);
        return {
          name,
          // Provide queryInterface and sequelize to JS migrations
          up: async () => migration.up(sequelize.getQueryInterface(), sequelize),
          down: async () => (migration.down ? migration.down(sequelize.getQueryInterface(), sequelize) : Promise.resolve()),
        };
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

// Export a function that can be called from server.js
async function runMigration() {
  try {
    // Ensure uuid-ossp extension is enabled before running migrations when possible
    console.log('Ensuring "uuid-ossp" extension is enabled (if permitted)...');
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      console.log('✅ "uuid-ossp" extension is enabled or already present.');
    } catch (extErr) {
      // Not all DB users have permission to create extensions (common on managed DBs). Log and continue.
      console.warn('⚠️ Could not create uuid-ossp extension (permission or unsupported). Continuing migrations.', extErr.message);
    }

    console.log('🔄 Checking for pending database migrations...');
    const pending = await umzug.pending();
    if (pending.length === 0) {
      console.log('✅ No pending migrations found.');
      return;
    }

    console.log(`🚀 Found ${pending.length} pending migration(s). Applying...`);
    await umzug.up();
    console.log('✅ All pending migrations have been applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigration().then(() => {
    console.log('Migration script finished.');
  });
}

module.exports = { runMigration, umzug };