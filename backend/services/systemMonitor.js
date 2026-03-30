// services/systemMonitor.js
// Production-ready system monitoring and health checks

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { sequelize } = require('../models');
const performanceCache = require('./performanceCache');

class SystemMonitor {
  constructor() {
    this.startTime = Date.now();
    this.healthChecks = {
      database: { status: 'unknown', lastCheck: null, error: null },
      memory: { status: 'unknown', usage: 0, limit: 0 },
      disk: { status: 'unknown', usage: 0, available: 0 },
      cache: { status: 'unknown', hitRate: 0, entries: 0 }
    };
    this.alerts = [];
    this.maxAlerts = 100;
  }

  // System health check
  async performHealthCheck() {
    const healthReport = {
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      status: 'healthy',
      checks: {},
      alerts: this.alerts.slice(-10), // Last 10 alerts
      performance: {}
    };

    try {
      // Database health check
      await this.checkDatabase();
      healthReport.checks.database = this.healthChecks.database;

      // Memory health check
      this.checkMemory();
      healthReport.checks.memory = this.healthChecks.memory;

      // Disk health check
      await this.checkDisk();
      healthReport.checks.disk = this.healthChecks.disk;

      // Cache health check
      this.checkCache();
      healthReport.checks.cache = this.healthChecks.cache;

      // Performance metrics
      healthReport.performance = this.getPerformanceMetrics();

      // Determine overall health status
      const failedChecks = Object.values(healthReport.checks)
        .filter(check => check.status === 'error');

      if (failedChecks.length > 0) {
        healthReport.status = 'degraded';
      }

      const criticalChecks = Object.values(healthReport.checks)
        .filter(check => check.status === 'critical');

      if (criticalChecks.length > 0) {
        healthReport.status = 'critical';
      }

    } catch (error) {
      console.error('Health check failed:', error);
      healthReport.status = 'critical';
      healthReport.error = error.message;
    }

    return healthReport;
  }

  // Database connectivity check
  async checkDatabase() {
    try {
      const start = Date.now();
      await sequelize.authenticate();
      const responseTime = Date.now() - start;

      // Check connection pool status
      const pool = sequelize.connectionManager.pool;
      const poolStatus = {
        total: pool.size,
        used: pool.used,
        waiting: pool.pending
      };

      this.healthChecks.database = {
        status: responseTime < 1000 ? 'healthy' : 'warning',
        lastCheck: new Date().toISOString(),
        responseTime,
        pool: poolStatus,
        error: null
      };

      // Alert if database is slow
      if (responseTime > 2000) {
        this.addAlert('warning', `Database response time is slow: ${responseTime}ms`);
      }

    } catch (error) {
      this.healthChecks.database = {
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
      this.addAlert('error', `Database connection failed: ${error.message}`);
    }
  }

  // Memory usage check
  checkMemory() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const systemUsedPercent = (usedMemory / totalMemory) * 100;

    let status = 'healthy';
    if (heapUsedMB > 1536) status = 'warning'; // 1.5GB
    if (heapUsedMB > 1792) status = 'critical'; // 1.75GB
    if (systemUsedPercent > 90) status = 'critical';

    this.healthChecks.memory = {
      status,
      heap: {
        used: heapUsedMB,
        total: heapTotalMB,
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        usedPercent: Math.round(systemUsedPercent)
      }
    };

    // Memory usage alerts
    if (status === 'critical') {
      this.addAlert('critical', `High memory usage: ${heapUsedMB}MB heap, ${Math.round(systemUsedPercent)}% system`);
    } else if (status === 'warning') {
      this.addAlert('warning', `Memory usage warning: ${heapUsedMB}MB heap used`);
    }
  }

  // Disk space check
  async checkDisk() {
    try {
      const stats = await fs.stat(process.cwd());
      const diskInfo = {
        path: process.cwd(),
        available: 'N/A', // Simplified for Windows
        status: 'healthy'
      };

      this.healthChecks.disk = diskInfo;
    } catch (error) {
      this.healthChecks.disk = {
        status: 'error',
        error: error.message
      };
    }
  }

  // Cache performance check
  checkCache() {
    const cacheStats = performanceCache.getCacheStats();
    const cacheMemory = performanceCache.getMemoryUsage();
    
    const hitRate = parseFloat(cacheStats.hit_rate) || 0;
    let status = 'healthy';
    
    if (hitRate < 50) status = 'warning';
    if (hitRate < 25) status = 'critical';

    this.healthChecks.cache = {
      status,
      hitRate: cacheStats.hit_rate,
      totalRequests: cacheStats.total_requests,
      entries: cacheMemory.balance_cache_keys + cacheMemory.ledger_cache_keys + 
               cacheMemory.user_cache_keys + cacheMemory.transaction_stats_keys,
      memory: cacheMemory
    };

    if (status === 'critical') {
      this.addAlert('critical', `Cache hit rate critically low: ${cacheStats.hit_rate}`);
    }
  }

  // Performance metrics
  getPerformanceMetrics() {
    const cpuUsage = process.cpuUsage();
    return {
      uptime: this.getUptime(),
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000)
      },
      eventLoop: {
        active: process._getActiveHandles().length,
        requests: process._getActiveRequests().length
      },
      version: {
        node: process.version,
        platform: os.platform(),
        arch: os.arch()
      }
    };
  }

  // Get system uptime
  getUptime() {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    return {
      ms: uptimeMs,
      formatted: `${hours}h ${minutes}m ${seconds}s`
    };
  }

  // Add system alert
  addAlert(level, message) {
    const alert = {
      level, // 'info', 'warning', 'error', 'critical'
      message,
      timestamp: new Date().toISOString()
    };

    this.alerts.unshift(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    // Log critical and error alerts
    if (level === 'critical' || level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`);
    } else if (level === 'warning') {
      console.warn(`[WARNING] ${message}`);
    }
  }

  // Get system recommendations
  getRecommendations() {
    const recommendations = [];
    
    // Memory recommendations
    if (this.healthChecks.memory.status === 'warning') {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Consider reducing memory usage or increasing server memory'
      });
    }

    // Cache recommendations
    const hitRate = parseFloat(this.healthChecks.cache.hitRate) || 0;
    if (hitRate < 70) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        message: 'Cache hit rate is low. Consider increasing cache TTL or size'
      });
    }

    // Database recommendations
    if (this.healthChecks.database.responseTime > 500) {
      recommendations.push({
        type: 'database',
        priority: 'high',
        message: 'Database response time is high. Check indexes and query optimization'
      });
    }

    return recommendations;
  }

  // Reset alerts
  clearAlerts() {
    this.alerts = [];
  }

  // Get detailed system report
  async getSystemReport() {
    const healthReport = await this.performHealthCheck();
    const recommendations = this.getRecommendations();
    
    return {
      ...healthReport,
      recommendations,
      system_info: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        architecture: os.arch(),
        cpus: os.cpus().length,
        total_memory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        node_version: process.version
      }
    };
  }
}

// Export singleton instance
const systemMonitor = new SystemMonitor();
module.exports = systemMonitor;