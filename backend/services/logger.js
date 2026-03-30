// services/logger.js
// Professional logging service for production deployments

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    
    // Ensure logs directory exists
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFilePath(type) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  formatLogEntry(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(filepath, content) {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > this.maxLogSize) {
          this.rotateLogFile(filepath);
        }
      }

      fs.appendFileSync(filepath, content);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  rotateLogFile(filepath) {
    try {
      const dir = path.dirname(filepath);
      const basename = path.basename(filepath, '.log');
      
      // Move existing rotated files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(dir, `${basename}.${i}.log`);
        const newFile = path.join(dir, `${basename}.${i + 1}.log`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      const rotatedFile = path.join(dir, `${basename}.1.log`);
      fs.renameSync(filepath, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  // Application logs
  info(message, meta = {}) {
    const entry = this.formatLogEntry('info', message, meta);
    this.writeToFile(this.getLogFilePath('application'), entry);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[INFO] ${message}`, meta);
    }
  }

  warn(message, meta = {}) {
    const entry = this.formatLogEntry('warn', message, meta);
    this.writeToFile(this.getLogFilePath('application'), entry);
    console.warn(`[WARN] ${message}`, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...meta
    } : meta;

    const entry = this.formatLogEntry('error', message, errorMeta);
    this.writeToFile(this.getLogFilePath('error'), entry);
    console.error(`[ERROR] ${message}`, errorMeta);
  }

  // Security logs
  security(message, meta = {}) {
    const entry = this.formatLogEntry('security', message, meta);
    this.writeToFile(this.getLogFilePath('security'), entry);
    console.warn(`[SECURITY] ${message}`, meta);
  }

  // Performance logs
  performance(message, meta = {}) {
    const entry = this.formatLogEntry('performance', message, meta);
    this.writeToFile(this.getLogFilePath('performance'), entry);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PERF] ${message}`, meta);
    }
  }

  // Transaction audit logs
  audit(action, userId, details = {}) {
    const entry = this.formatLogEntry('audit', `User action: ${action}`, {
      userId,
      action,
      details,
      userAgent: details.userAgent || 'Unknown',
      ip: details.ip || 'Unknown'
    });
    this.writeToFile(this.getLogFilePath('audit'), entry);
  }

  // Database logs
  database(query, duration, meta = {}) {
    const entry = this.formatLogEntry('database', 'Query executed', {
      query: query.substring(0, 500), // Truncate long queries
      duration,
      ...meta
    });
    this.writeToFile(this.getLogFilePath('database'), entry);
  }

  // Get recent logs
  getRecentLogs(type = 'application', lines = 100) {
    try {
      const filepath = this.getLogFilePath(type);
      if (!fs.existsSync(filepath)) {
        return [];
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const logLines = content.trim().split('\n');
      
      return logLines
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        })
        .reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to read logs:', error.message);
      return [];
    }
  }

  // Get log statistics
  getLogStats() {
    const stats = {};
    const logTypes = ['application', 'error', 'security', 'performance', 'audit', 'database'];

    logTypes.forEach(type => {
      try {
        const filepath = this.getLogFilePath(type);
        if (fs.existsSync(filepath)) {
          const fileStats = fs.statSync(filepath);
          stats[type] = {
            exists: true,
            size: fileStats.size,
            sizeFormatted: this.formatBytes(fileStats.size),
            modified: fileStats.mtime
          };
        } else {
          stats[type] = { exists: false, size: 0, sizeFormatted: '0 B' };
        }
      } catch (error) {
        stats[type] = { exists: false, size: 0, error: error.message };
      }
    });

    return stats;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clean old logs
  cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filepath = path.join(this.logDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filepath);
          this.info(`Cleaned old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Failed to clean old logs', error);
    }
  }
}

// Export singleton instance
const logger = new Logger();

// Clean old logs on startup
logger.cleanOldLogs();

module.exports = logger;