/**
 * Migration: Add PostgreSQL sequences for transaction numbering
 * Replaces MAX() queries with O(1) nextval() for 10M+ scale
 */
const sequelize = require('../config/database');

async function addSequences() {
    const t = await sequelize.transaction();

    try {
        console.log('🔄 Creating PostgreSQL sequences for transaction numbering...');

        // Get current max transaction number
        const [txResult] = await sequelize.query(
            `SELECT COALESCE(MAX(transaction_number), 0) as max_num FROM transactions`,
            { transaction: t }
        );
        const txMax = parseInt(txResult[0].max_num) || 0;

        // Get current max anamath transaction number
        const [anResult] = await sequelize.query(
            `SELECT COALESCE(MAX(transaction_number), 0) as max_num FROM anamath_entries`,
            { transaction: t }
        );
        const anMax = parseInt(anResult[0].max_num) || 0;

        // Create transaction number sequence
        await sequelize.query(
            `CREATE SEQUENCE IF NOT EXISTS transaction_number_seq START WITH ${txMax + 1}`,
            { transaction: t }
        );
        console.log(`   ✅ transaction_number_seq created (starts at ${txMax + 1})`);

        // Create anamath number sequence
        await sequelize.query(
            `CREATE SEQUENCE IF NOT EXISTS anamath_number_seq START WITH ${anMax + 1}`,
            { transaction: t }
        );
        console.log(`   ✅ anamath_number_seq created (starts at ${anMax + 1})`);

        // If sequences already existed but are behind, advance them
        if (txMax > 0) {
            await sequelize.query(
                `SELECT setval('transaction_number_seq', GREATEST(${txMax + 1}, (SELECT last_value FROM transaction_number_seq)))`,
                { transaction: t }
            );
        }
        if (anMax > 0) {
            await sequelize.query(
                `SELECT setval('anamath_number_seq', GREATEST(${anMax + 1}, (SELECT last_value FROM anamath_number_seq)))`,
                { transaction: t }
            );
        }

        await t.commit();
        console.log('✅ PostgreSQL sequences created successfully');
        return { success: true, txStart: txMax + 1, anStart: anMax + 1 };

    } catch (error) {
        await t.rollback();
        // If sequences already exist, that's fine
        if (error.message.includes('already exists')) {
            console.log('✅ Sequences already exist, skipping creation');
            return { success: true, message: 'Sequences already exist' };
        }
        console.error('❌ Migration failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { addSequences };
