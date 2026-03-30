/**
 * Advanced Critical Indexes for 10M+ Records
 * These covering indexes eliminate the need for PostgreSQL to combine multiple indexes
 */

const sequelize = require('../config/database');

async function applyCriticalIndexes() {
  try {
    // Check if advanced indexes already exist
    const [existingIndexes] = await sequelize.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_critical_%' OR indexname LIKE 'idx_10m_%'
    `);

    const existingNames = existingIndexes.map(i => i.indexname);
    let created = 0;

    const indexes = [
      // Core date-based pagination index (partial — excludes suspended)
      {
        name: 'idx_critical_transactions_date',
        sql: `CREATE INDEX IF NOT EXISTS idx_critical_transactions_date 
              ON transactions(date DESC, "createdAt" DESC) 
              WHERE is_suspended = false`
      },
      // Ledger + date composite (for ledger-filtered views)
      {
        name: 'idx_critical_transactions_ledger',
        sql: `CREATE INDEX IF NOT EXISTS idx_critical_transactions_ledger 
              ON transactions("ledgerId", date DESC) 
              WHERE is_suspended = false`
      },
      // Transaction number lookup
      {
        name: 'idx_critical_transactions_number',
        sql: `CREATE INDEX IF NOT EXISTS idx_critical_transactions_number 
              ON transactions(transaction_number DESC) 
              WHERE transaction_number IS NOT NULL`
      },
      // *** 10M-SCALE INDEXES ***
      // Covering index for cursor-based pagination (THE most critical index)
      {
        name: 'idx_10m_cursor_pagination',
        sql: `CREATE INDEX IF NOT EXISTS idx_10m_cursor_pagination 
              ON transactions(date DESC, id DESC) 
              WHERE is_suspended = false`
      },
      // Covering index for ledger-scoped cursor pagination
      {
        name: 'idx_10m_ledger_cursor',
        sql: `CREATE INDEX IF NOT EXISTS idx_10m_ledger_cursor 
              ON transactions("ledgerId", date DESC, id DESC) 
              WHERE is_suspended = false`
      },
      // Anamath entries — date-based index
      {
        name: 'idx_10m_anamath_date',
        sql: `CREATE INDEX IF NOT EXISTS idx_10m_anamath_date 
              ON anamath_entries(date DESC, id DESC) 
              WHERE is_closed = false`
      }
    ];

    for (const idx of indexes) {
      if (!existingNames.includes(idx.name)) {
        try {
          await sequelize.query(idx.sql);
          created++;
        } catch (err) {
          // Index might already exist under Sequelize's auto-naming
          if (!err.message.includes('already exists')) {
            console.warn(`   Index ${idx.name}:`, err.message);
          }
        }
      }
    }

    // Update query planner statistics
    try {
      await sequelize.query('ANALYZE transactions');
      await sequelize.query('ANALYZE anamath_entries');
    } catch (err) {
      // Non-critical
    }

    if (created > 0) {
      console.log(`✅ Created ${created} performance indexes for 10M-scale`);
    }

    return { success: true, created };

  } catch (error) {
    console.error('Index creation failed:', error.message);
    return { success: false, error: error.message, created: 0 };
  }
}

module.exports = { applyCriticalIndexes };
