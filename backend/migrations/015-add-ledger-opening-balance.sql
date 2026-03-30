-- Add openingBalance column to ledgers table if it doesn't exist
-- Note: Sequelize model uses camelCase (no underscored: true), so column name is "openingBalance"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ledgers' AND column_name = 'openingBalance'
    ) THEN
        ALTER TABLE ledgers ADD COLUMN "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0.00;
        RAISE NOTICE 'Added openingBalance column to ledgers table';
    ELSE
        RAISE NOTICE 'openingBalance column already exists on ledgers table';
    END IF;
END $$;
