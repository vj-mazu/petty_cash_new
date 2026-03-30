/**
 * HIGH-PERFORMANCE REDIS-LIKE IN-MEMORY CACHE SERVICE
 * For ultra-fast API responses with generative AI-like speed
 */

const NodeCache = require('node-cache');

class CacheService {
  constructor() {
    // Transaction cache - 30 second TTL (fast-changing data)
    this.transactionCache = new NodeCache({
      stdTTL: 30, // 30 seconds
      checkperiod: 15, // Check for expired entries every 15 seconds
      useClones: false, // Don't clone for better performance
      maxKeys: 10000 // Maximum 10k cached entries
    });

    // Summary cache - 5 minute TTL (slower-changing data)
    this.summaryCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60,
      useClones: false,
      maxKeys: 1000
    });

    // Balance cache - 10 minute TTL (very stable data)
    this.balanceCache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120,
      useClones: false,
      maxKeys: 500
    });

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    console.log('✅ Cache Service initialized with 3 memory tiers');
  }

  /**
   * Generate cache key from query parameters
   */
  generateCacheKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get cached transaction list
   */
  getTransactions(params) {
    const key = this.generateCacheKey('txlist', params);
    const cached = this.transactionCache.get(key);

    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set transaction list cache
   */
  setTransactions(params, data) {
    const key = this.generateCacheKey('txlist', params);
    this.transactionCache.set(key, data);
    this.stats.sets++;
  }

  /**
   * Get cached summary
   */
  getSummary(params) {
    const key = this.generateCacheKey('summary', params);
    const cached = this.summaryCache.get(key);

    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set summary cache
   */
  setSummary(params, data) {
    const key = this.generateCacheKey('summary', params);
    this.summaryCache.set(key, data);
    this.stats.sets++;
  }

  /**
   * Get cached balance
   */
  getBalance(date) {
    const key = `balance:${date}`;
    const cached = this.balanceCache.get(key);

    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set balance cache
   */
  setBalance(date, data) {
    const key = `balance:${date}`;
    this.balanceCache.set(key, data);
    this.stats.sets++;
  }

  /**
   * Invalidate all transaction caches (call after create/update/delete)
   */
  invalidateTransactions() {
    const deletedCount = this.transactionCache.flushAll();
    this.stats.deletes += deletedCount;
  }

  /**
   * Invalidate summary caches
   */
  invalidateSummaries() {
    const deletedCount = this.summaryCache.flushAll();
    this.stats.deletes += deletedCount;
  }

  /**
   * Invalidate specific balance cache
   */
  invalidateBalance(date) {
    const key = `balance:${date}`;
    this.balanceCache.del(key);
    this.stats.deletes++;
  }

  /**
   * Invalidate all caches (both cacheService and performanceCache)
   */
  invalidateAll() {
    this.transactionCache.flushAll();
    this.summaryCache.flushAll();
    this.balanceCache.flushAll();
    // Also invalidate performanceCache to prevent stale balance/ledger data
    try {
      const performanceCache = require('./performanceCache');
      performanceCache.flushAll();
    } catch (e) { /* performanceCache not available */ }
  }

  /**
   * Invalidate transaction-related caches across both cache systems
   */
  invalidateAfterWrite() {
    this.invalidateTransactions();
    this.invalidateSummaries();
    try {
      const performanceCache = require('./performanceCache');
      performanceCache.invalidateTransactionCaches();
      performanceCache.invalidateLedger();
    } catch (e) { /* performanceCache not available */ }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      transactionCacheSize: this.transactionCache.keys().length,
      summaryCacheSize: this.summaryCache.keys().length,
      balanceCacheSize: this.balanceCache.keys().length
    };
  }

  /**
   * Warmup cache with frequently accessed data
   */
  async warmup(Transaction, Ledger) {
    console.log('🔥 Warming up cache...');

    try {
      // Pre-cache recent transactions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentTx = await Transaction.findAll({
        where: {
          date: {
            [require('sequelize').Op.gte]: sevenDaysAgo
          },
          isSuspended: false
        },
        include: [
          {
            model: Ledger,
            as: 'ledger',
            attributes: ['id', 'name', 'ledgerType']
          }
        ],
        limit: 100,
        order: [['date', 'DESC']]
      });

      // Cache common query patterns
      const params = {
        page: 1,
        limit: 20,
        startDate: sevenDaysAgo.toISOString().split('T')[0]
      };

      this.setTransactions(params, {
        success: true,
        data: {
          transactions: recentTx,
          pagination: { total: recentTx.length }
        }
      });

      console.log('✅ Cache warmed up with', recentTx.length, 'recent transactions');
    } catch (error) {
      console.error('❌ Cache warmup failed:', error.message);
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
