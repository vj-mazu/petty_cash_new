// services/performanceCache.js
// High-performance caching service for transaction system

const NodeCache = require('node-cache');

class PerformanceCache {
  constructor() {
    // Cache configurations for different data types
    this.balanceCache = new NodeCache({
      stdTTL: 300,    // 5 minutes for balance data
      checkperiod: 60, // Check for expired keys every minute
      useClones: false // Faster, but be careful with mutations
    });

    this.ledgerCache = new NodeCache({
      stdTTL: 1800,   // 30 minutes for ledger data
      checkperiod: 120,
      useClones: false
    });

    this.userCache = new NodeCache({
      stdTTL: 3600,   // 1 hour for user data
      checkperiod: 300,
      useClones: false
    });

    this.transactionStatsCache = new NodeCache({
      stdTTL: 180,    // 3 minutes for transaction statistics
      checkperiod: 30,
      useClones: false
    });

    // Cache hit/miss statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Setup cache event listeners
    this.setupCacheEvents();
  }

  setupCacheEvents() {
    const caches = [this.balanceCache, this.ledgerCache, this.userCache, this.transactionStatsCache];

    caches.forEach(cache => {
      cache.on('set', () => this.stats.sets++);
      cache.on('del', () => this.stats.deletes++);
    });
  }

  // Balance caching methods
  getBalance(key) {
    const value = this.balanceCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  setBalance(key, value, ttl = null) {
    return this.balanceCache.set(key, value, ttl || 300);
  }

  invalidateBalance(ledgerId, date = null) {
    if (date) {
      this.balanceCache.del(`balance_${ledgerId}_${date}`);
      this.balanceCache.del(`opening_${ledgerId}_${date}`);
      this.balanceCache.del(`closing_${ledgerId}_${date}`);
    } else {
      // Clear all balance cache for this ledger
      const keys = this.balanceCache.keys();
      keys.forEach(key => {
        if (key.includes(`_${ledgerId}_`)) {
          this.balanceCache.del(key);
        }
      });
    }
  }

  // Ledger caching methods
  getLedger(key) {
    const value = this.ledgerCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  setLedger(key, value, ttl = null) {
    return this.ledgerCache.set(key, value, ttl || 1800);
  }

  invalidateLedger(ledgerId = null) {
    if (ledgerId) {
      this.ledgerCache.del(`ledger_${ledgerId}`);
    } else {
      this.ledgerCache.flushAll();
    }
  }

  // User caching methods
  getUser(key) {
    const value = this.userCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  setUser(key, value, ttl = null) {
    return this.userCache.set(key, value, ttl || 3600);
  }

  deleteUser(key) {
    return this.userCache.del(key);
  }

  // Transaction statistics caching
  getTransactionStats(key) {
    const value = this.transactionStatsCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  setTransactionStats(key, value, ttl = null) {
    return this.transactionStatsCache.set(key, value, ttl || 180);
  }

  // Bulk operations for transaction list caching
  cacheTransactionList(key, transactions, ttl = 300) {
    return this.transactionStatsCache.set(key, {
      data: transactions,
      count: transactions.length,
      cached_at: new Date()
    }, ttl);
  }

  getCachedTransactionList(key) {
    const cached = this.transactionStatsCache.get(key);
    if (cached && cached.data) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    return null;
  }

  // Cache invalidation for transactions
  invalidateTransactionCaches(ledgerId = null, date = null) {
    // Invalidate balance caches
    this.invalidateBalance(ledgerId, date);

    // Invalidate transaction list caches
    const keys = this.transactionStatsCache.keys();
    keys.forEach(key => {
      if (key.includes('transactions_') || key.includes('daily_')) {
        if (!ledgerId || key.includes(`_${ledgerId}_`)) {
          this.transactionStatsCache.del(key);
        }
      }
    });
  }

  // Memory management
  getMemoryUsage() {
    return {
      balance_cache_keys: this.balanceCache.keys().length,
      ledger_cache_keys: this.ledgerCache.keys().length,
      user_cache_keys: this.userCache.keys().length,
      transaction_stats_keys: this.transactionStatsCache.keys().length,
      stats: this.stats
    };
  }

  getCacheStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hit_rate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      total_requests: total
    };
  }

  // Flush all caches (use carefully)
  flushAll() {
    this.balanceCache.flushAll();
    this.ledgerCache.flushAll();
    this.userCache.flushAll();
    this.transactionStatsCache.flushAll();

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // Graceful shutdown
  close() {
    this.balanceCache.close();
    this.ledgerCache.close();
    this.userCache.close();
    this.transactionStatsCache.close();
  }
}

// Export singleton instance
const performanceCache = new PerformanceCache();
module.exports = performanceCache;