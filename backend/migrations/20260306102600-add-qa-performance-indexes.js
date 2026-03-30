'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add composite indexes for optimal 10M row filtering QA requirement
        // Table name is 'transactions' (lowercase) as defined in the model
        try {
            await queryInterface.addIndex('transactions', ['date'], {
                name: 'idx_transactions_date',
                concurrently: false
            });
        } catch (e) {
            if (e.message.includes('already exists') || e.message.includes('does not exist')) {
                console.log('⚠️  idx_transactions_date skipped:', e.message);
            } else { throw e; }
        }

        try {
            await queryInterface.addIndex('transactions', ['ledgerId', 'date'], {
                name: 'idx_transactions_ledger_date',
                concurrently: false
            });
        } catch (e) {
            if (e.message.includes('already exists') || e.message.includes('does not exist')) {
                console.log('⚠️  idx_transactions_ledger_date skipped:', e.message);
            } else { throw e; }
        }
    },

    down: async (queryInterface, Sequelize) => {
        try { await queryInterface.removeIndex('transactions', 'idx_transactions_date'); } catch (e) { /* ignore */ }
        try { await queryInterface.removeIndex('transactions', 'idx_transactions_ledger_date'); } catch (e) { /* ignore */ }
    }
};
