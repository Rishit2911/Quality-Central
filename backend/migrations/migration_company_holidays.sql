-- =====================================================================
-- PHYGITRON 360: COMPANY HOLIDAYS TABLE & INDEXES MIGRATION
-- Run this script in PostgreSQL on the production database
-- =====================================================================

DO $$
DECLARE
    schema_record RECORD;
BEGIN
    -- Loop through public and all tenant schemas
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format('SET search_path TO %I, public;', schema_record.schema_name);
        
        -- Create company_holidays table if not exists
        EXECUTE '
            CREATE TABLE IF NOT EXISTS company_holidays (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                holiday_type TEXT DEFAULT ''regular_holiday'',
                description TEXT,
                is_half_day BOOLEAN DEFAULT FALSE,
                created_by TEXT REFERENCES employees(employee_code) ON UPDATE CASCADE ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, name)
            );

            ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS holiday_type TEXT DEFAULT ''regular_holiday'';
            ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE;
            ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS created_by TEXT;
            ALTER TABLE company_holidays ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ';

        -- Create indexes
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date);';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_holidays_type ON company_holidays(holiday_type);';

        -- Normalize legacy holiday types to standard categories
        EXECUTE '
            UPDATE company_holidays 
            SET holiday_type = ''regular_holiday'' 
            WHERE holiday_type IN (''company_holiday'', ''festival'');
        ';

        EXECUTE '
            UPDATE company_holidays 
            SET holiday_type = ''restricted_holiday'' 
            WHERE holiday_type = ''optional_holiday'';
        ';

        RAISE NOTICE 'Migrated schema: %', schema_record.schema_name;
    END LOOP;
END $$;
