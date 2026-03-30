/**
 * Balance Rollover Scheduler
 * Handles automatic daily balance rollover at 6 AM
 */

let cron;
try {
  cron = require('node-cron');
} catch (error) {
  console.warn('⚠️  node-cron not available. Scheduler features will be disabled.');
}

const dailyBalanceService = require('./dailyBalanceService');

class BalanceScheduler {
  constructor() {
    this.rolloverTask = null;
    this.isRunning = false;
  }

  /**
   * Start the balance rollover scheduler
   */
  start() {
    if (!cron) {
      console.log('⚠️  Scheduler disabled - node-cron not available');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️  Balance scheduler is already running');
      return;
    }

    try {
      // Schedule rollover for 6:00 AM every day
      // Cron expression: second minute hour day-of-month month day-of-week
      this.rolloverTask = cron.schedule('0 0 6 * * *', async () => {
        try {
          console.log('🕕 6 AM rollover scheduled task triggered');
          await dailyBalanceService.handleDailyRollover();
          console.log('✅ Scheduled rollover completed successfully');
        } catch (error) {
          console.error('❌ Scheduled rollover failed:', error);
          // Could send alert notification here in production
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata' // Adjust timezone as needed
      });

      this.isRunning = true;
      console.log('⏰ Balance rollover scheduler started (runs at 6:00 AM daily)');
      
      // Also run immediate rollover check
      this.checkForMissedRollover();
      
    } catch (error) {
      console.error('❌ Failed to start balance scheduler:', error);
    }
  }

  /**
   * Stop the balance rollover scheduler
   */
  stop() {
    if (this.rolloverTask && cron) {
      this.rolloverTask.stop();
      this.rolloverTask = null;
    }
    
    this.isRunning = false;
    console.log('🛑 Balance rollover scheduler stopped');
  }

  /**
   * Check if we missed a rollover and run it if needed
   */
  async checkForMissedRollover() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // If it's past 6 AM, check if we missed today's rollover
      if (currentHour >= 6) {
        const { SystemSettings } = require('../models');
        const today = now.toISOString().split('T')[0];
        
        const lastRollover = await SystemSettings.findOne({
          where: { 
            settingKey: 'last_daily_rollover',
            isActive: true 
          }
        });
        
        const lastRolloverDate = lastRollover ? lastRollover.settingValue : null;
        
        if (!lastRolloverDate || lastRolloverDate !== today) {
          console.log('🔄 Missed rollover detected, running now...');
          await dailyBalanceService.handleDailyRollover();
          console.log('✅ Missed rollover completed');
        } else {
          console.log('✓ Daily rollover already completed for today');
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking for missed rollover:', error);
    }
  }

  /**
   * Manual rollover trigger (for admin use)
   */
  async triggerManualRollover() {
    try {
      console.log('🔧 Manual rollover triggered');
      await dailyBalanceService.handleDailyRollover();
      console.log('✅ Manual rollover completed');
      return { success: true, message: 'Manual rollover completed successfully' };
    } catch (error) {
      console.error('❌ Manual rollover failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: (cron && this.rolloverTask) ? 'Daily at 6:00 AM' : 'Disabled (node-cron not available)',
      timezone: 'Asia/Kolkata',
      cronAvailable: !!cron
    };
  }
}

// Export singleton instance
module.exports = new BalanceScheduler();