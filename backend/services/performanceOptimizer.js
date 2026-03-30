/**
 * HIGH-LEVEL PERFORMANCE OPTIMIZER
 * Automatically applies database indexes and optimizations on server startup
 * Safe to run multiple times - checks for existing indexes before creating
 */

const { sequelize } = require('../models');

class PerformanceOptimizer {
  constructor() {
    this.optimizations = [];
  }

  /**
   * Apply all performance optimizations
   */
  async applyAll() {
    console.log('🚀 Starting High-Level Performance Optimization...');
    console.log('================================================');

    try {
      // Check if already optimized
      const isOptimized = await this.checkIfOptimized();
      if (isOptimized) {
        console.log('✅ Database already optimized. Skipping...');
        return { success: true, message: 'Already optimized' };
      }

      // Apply all optimizations
      await this.createTransactionIndexes();
      await this.createAnamathIndexes();
      await this.createLedgerIndexes();
      await this.createUserIndexes();
      await this.optimizePostgres();
      await this.analyzeDatabase();
      await this.markAsOptimized();

      console.log('================================================');
      console.log('✅ All optimizations applied successfully!');
      console.log(`📊 Total optimizations: ${this.optimizations.length}`);
      
      return { success: true, optimizations: this.optimizations };
    } catch (error) {
      console.error('❌ Error applying optimizations:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if database is already optimized
   */
  async checkIfOptimized() {
    try {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = 'idx_transactions_date_ledger_composite'
        ) as exists
      `);
      return results[0]?.exists || false;
    } catch (error) {
      return false; // If check fails, assume not optimized
    }
  }

  /**
   * Mark database as optimized (create marker index)
   */
  async markAsOptimized() {
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_optimization_marker 
        ON transactions(id) WHERE id = id
      `);
      console.log('✅ Optimization marker created');
    } catch (error) {
      console.warn('⚠️  Could not create optimization marker:', error.message);
    }
  }

  /**
   * Create performance indexes for Transactions table
   */
  async createTransactionIndexes() {
    console.log('\n📊 Optimizing Transactions Table...');

    const indexes = [
      {
        name: 'idx_transactions_date_ledger_composite',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_ledger_composite 
              ON transactions(date DESC, "ledgerId") 
              WHERE is_suspended = false`,
        desc: 'Composite index for date + ledger filtering'
      },
      {
        name: 'idx_transactions_transaction_number',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_transaction_number 
              ON transactions(transaction_number DESC) 
              WHERE transaction_number IS NOT NULL`,
        desc: 'Index for transaction number lookups'
      },
      {
        name: 'idx_transactions_credit_amount',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_credit_amount 
              ON transactions("creditAmount") 
              WHERE "creditAmount" > 0`,
        desc: 'Partial index for credit transactions'
      },
      {
        name: 'idx_transactions_debit_amount',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_debit_amount 
              ON transactions("debitAmount") 
              WHERE "debitAmount" > 0`,
        desc: 'Partial index for debit transactions'
      },
      {
        name: 'idx_transactions_transaction_type',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_transaction_type 
              ON transactions(transaction_type, date DESC)`,
        desc: 'Index for transaction type filtering'
      },
      {
        name: 'idx_transactions_created_at',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at 
              ON transactions("createdAt" DESC)`,
        desc: 'Index for chronological queries'
      },
      {
        name: 'idx_transactions_reference',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_reference 
              ON transactions(reference) 
              WHERE reference IS NOT NULL`,
        desc: 'Index for reference lookups'
      }
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(index.sql);
        console.log(`  ✅ ${index.desc}`);
        this.optimizations.push(index.name);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${index.desc} (already exists)`);
        } else {
          console.error(`  ❌ Failed: ${index.desc}`, error.message);
        }
      }
    }
  }

  /**
   * Create performance indexes for Anamath table
   */
  async createAnamathIndexes() {
    console.log('\n📊 Optimizing Anamath Table...');

    const indexes = [
      {
        name: 'idx_anamath_date_ledger',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anamath_date_ledger 
              ON anamath_entries(date DESC, ledger_id)`,
        desc: 'Composite index for date + ledger'
      },
      {
        name: 'idx_anamath_transaction_number',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anamath_transaction_number 
              ON anamath_entries(transaction_number DESC) 
              WHERE transaction_number IS NOT NULL`,
        desc: 'Index for transaction number'
      },
      {
        name: 'idx_anamath_is_closed',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anamath_is_closed 
              ON anamath_entries(is_closed, date DESC)`,
        desc: 'Index for closed status filtering'
      },
      {
        name: 'idx_anamath_amount',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anamath_amount 
              ON anamath_entries(amount DESC)`,
        desc: 'Index for amount-based queries'
      }
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(index.sql);
        console.log(`  ✅ ${index.desc}`);
        this.optimizations.push(index.name);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${index.desc} (already exists)`);
        } else {
          console.error(`  ❌ Failed: ${index.desc}`, error.message);
        }
      }
    }
  }

  /**
   * Create performance indexes for Ledgers table
   */
  async createLedgerIndexes() {
    console.log('\n📊 Optimizing Ledgers Table...');

    const indexes = [
      {
        name: 'idx_ledgers_is_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledgers_is_active 
              ON ledgers("isActive", name)`,
        desc: 'Index for active ledger filtering'
      },
      {
        name: 'idx_ledgers_ledger_type',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledgers_ledger_type 
              ON ledgers("ledgerType", "isActive")`,
        desc: 'Index for ledger type filtering'
      },
      {
        name: 'idx_ledgers_name_search',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledgers_name_search 
              ON ledgers(LOWER(name) text_pattern_ops)`,
        desc: 'Index for name search optimization'
      }
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(index.sql);
        console.log(`  ✅ ${index.desc}`);
        this.optimizations.push(index.name);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${index.desc} (already exists)`);
        } else {
          console.error(`  ❌ Failed: ${index.desc}`, error.message);
        }
      }
    }
  }

  /**
   * Create performance indexes for Users table
   */
  async createUserIndexes() {
    console.log('\n📊 Optimizing Users Table...');

    const indexes = [
      {
        name: 'idx_users_is_active',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active 
              ON users("isActive", role)`,
        desc: 'Index for active user filtering'
      },
      {
        name: 'idx_users_role',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
              ON users(role) 
              WHERE "isActive" = true`,
        desc: 'Index for role-based queries'
      }
    ];

    for (const index of indexes) {
      try {
        await sequelize.query(index.sql);
        console.log(`  ✅ ${index.desc}`);
        this.optimizations.push(index.name);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${index.desc} (already exists)`);
        } else {
          console.error(`  ❌ Failed: ${index.desc}`, error.message);
        }
      }
    }
  }

  /**
   * Apply PostgreSQL-specific optimizations
   */
  async optimizePostgres() {
    console.log('\n⚙️  Applying PostgreSQL Optimizations...');

    const optimizations = [
      {
        name: 'Set random_page_cost for SSD',
        sql: `ALTER DATABASE ${sequelize.config.database} SET random_page_cost = 1.1`,
        desc: 'Optimize for SSD storage'
      },
      {
        name: 'Set effective_cache_size',
        sql: `ALTER DATABASE ${sequelize.config.database} SET effective_cache_size = '4GB'`,
        desc: 'Set cache size hint'
      },
      {
        name: 'Enable parallel queries',
        sql: `ALTER DATABASE ${sequelize.config.database} SET max_parallel_workers_per_gather = 2`,
        desc: 'Enable parallel query execution'
      }
    ];

    for (const opt of optimizations) {
      try {
        await sequelize.query(opt.sql);
        console.log(`  ✅ ${opt.desc}`);
        this.optimizations.push(opt.name);
      } catch (error) {
        console.warn(`  ⚠️  ${opt.desc}: ${error.message}`);
      }
    }
  }

  /**
   * Analyze database tables for query planner
   */
  async analyzeDatabase() {
    console.log('\n📈 Analyzing Database Tables...');

    const tables = ['transactions', 'anamath_entries', 'ledgers', 'users', 'opening_balances'];

    for (const table of tables) {
      try {
        await sequelize.query(`ANALYZE ${table}`);
        console.log(`  ✅ Analyzed ${table}`);
      } catch (error) {
        console.warn(`  ⚠️  Could not analyze ${table}:`, error.message);
      }
    }
  }

  /**
   * Get current database statistics
   */
  async getStatistics() {
    try {
      const [tableStats] = await sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      const [indexStats] = await sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `);

      return { tables: tableStats, indexes: indexStats };
    } catch (error) {
      console.error('Could not get statistics:', error);
      return null;
    }
  }
}

module.exports = new PerformanceOptimizer();
