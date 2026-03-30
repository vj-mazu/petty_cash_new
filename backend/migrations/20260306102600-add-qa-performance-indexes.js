'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add composite indexes for optimal 10M row filtering QA requirement
        await queryInterface.addIndex('Transactions', ['date'], {
            name: 'idx_transactions_date'
        });

        await queryInterface.addIndex('Transactions', ['ledgerId', 'date'], {
            name: 'idx_transactions_ledger_date'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('Transactions', 'idx_transactions_date');
        await queryInterface.removeIndex('Transactions', 'idx_transactions_ledger_date');
    }
};
