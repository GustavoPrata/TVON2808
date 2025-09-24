-- Migration script to consolidate sistema IDs to numeric only
-- This script migrates all sistema IDs from mixed format (1, sistema1, sistema7, etc.) to numeric only (1, 7, etc.)
-- Author: Database Migration Team
-- Date: 2025-01-24

-- Start transaction to ensure atomicity
BEGIN;

-- Step 1: Create temporary table to map old system_ids to new ones
CREATE TEMP TABLE sistema_mapping (
    old_id INTEGER,
    new_id INTEGER,
    old_system_id TEXT,
    new_system_id TEXT
);

-- Step 2: Populate mapping for duplicates (sistema1-6 → 1-6)
-- These are the duplicates where we'll migrate pontos to the numeric version
INSERT INTO sistema_mapping (old_id, new_id, old_system_id, new_system_id)
SELECT 
    s1.id as old_id,
    s2.id as new_id,
    s1.system_id as old_system_id,
    s2.system_id as new_system_id
FROM sistemas s1
JOIN sistemas s2 ON s2.system_id = REPLACE(s1.system_id, 'sistema', '')
WHERE s1.system_id LIKE 'sistema%' 
    AND LENGTH(REPLACE(s1.system_id, 'sistema', '')) <= 2
    AND REPLACE(s1.system_id, 'sistema', '') ~ '^[1-6]$';

-- Display what we're about to migrate for verification
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== MIGRATION PLAN ===';
    RAISE NOTICE 'Duplicate systems to be merged:';
    
    FOR rec IN SELECT * FROM sistema_mapping LOOP
        RAISE NOTICE 'Will migrate % (id: %) → % (id: %)', 
            rec.old_system_id, rec.old_id, rec.new_system_id, rec.new_id;
    END LOOP;
END $$;

-- Step 3: Migrate pontos from duplicate sistemas to numeric versions
UPDATE pontos p
SET sistema_id = m.new_id
FROM sistema_mapping m
WHERE p.sistema_id = m.old_id;

-- Log how many pontos were migrated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % pontos from duplicate sistemas', updated_count;
END $$;

-- Step 4: Update officeCredentials references
UPDATE office_credentials oc
SET sistema_id = m.new_id
FROM sistema_mapping m
WHERE oc.sistema_id = m.old_id;

-- Log how many office_credentials were migrated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % office_credentials from duplicate sistemas', updated_count;
END $$;

-- Step 5: Update testes references
UPDATE testes t
SET sistema_id = m.new_id
FROM sistema_mapping m
WHERE t.sistema_id = m.old_id;

-- Log how many testes were migrated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % testes from duplicate sistemas', updated_count;
END $$;

-- Step 6: Delete the duplicate sistema entries (sistema1-6)
DELETE FROM sistemas
WHERE id IN (SELECT old_id FROM sistema_mapping);

-- Log how many duplicate sistemas were deleted
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate sistemas (sistema1-6)', deleted_count;
END $$;

-- Step 7: Update remaining sistema7-27 to numeric format (7-27)
-- First, let's see what we're about to rename
DO $$
DECLARE
    rec RECORD;
    count INTEGER;
BEGIN
    RAISE NOTICE '=== RENAMING REMAINING SISTEMAS ===';
    
    SELECT COUNT(*) INTO count 
    FROM sistemas 
    WHERE system_id LIKE 'sistema%';
    
    RAISE NOTICE 'Found % sistemas to rename', count;
    
    FOR rec IN 
        SELECT id, system_id, 
               REPLACE(system_id, 'sistema', '') as new_system_id
        FROM sistemas 
        WHERE system_id LIKE 'sistema%'
        ORDER BY LENGTH(REPLACE(system_id, 'sistema', '')), system_id
    LOOP
        RAISE NOTICE 'Will rename % (id: %) → %', 
            rec.system_id, rec.id, rec.new_system_id;
    END LOOP;
END $$;

-- Actually update the system_ids
UPDATE sistemas
SET system_id = REPLACE(system_id, 'sistema', ''),
    atualizado_em = NOW()
WHERE system_id LIKE 'sistema%';

-- Log how many sistemas were renamed
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Renamed % sistemas from sistemaX to X format', updated_count;
END $$;

-- Step 8: Verify final state
DO $$
DECLARE
    sistema_count INTEGER;
    ponto_count INTEGER;
    credential_count INTEGER;
    teste_count INTEGER;
    invalid_count INTEGER;
BEGIN
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    
    -- Count total sistemas
    SELECT COUNT(*) INTO sistema_count FROM sistemas;
    RAISE NOTICE 'Total sistemas: %', sistema_count;
    
    -- Count sistemas with numeric-only IDs
    SELECT COUNT(*) INTO invalid_count 
    FROM sistemas 
    WHERE system_id ~ '[^0-9]';
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % sistemas with non-numeric IDs after migration!', invalid_count;
    ELSE
        RAISE NOTICE '✓ All sistemas have numeric IDs';
    END IF;
    
    -- Check for orphaned pontos
    SELECT COUNT(*) INTO ponto_count
    FROM pontos p
    WHERE p.sistema_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sistemas s WHERE s.id = p.sistema_id);
    
    IF ponto_count > 0 THEN
        RAISE WARNING 'Found % orphaned pontos!', ponto_count;
    ELSE
        RAISE NOTICE '✓ No orphaned pontos found';
    END IF;
    
    -- Check for orphaned office_credentials
    SELECT COUNT(*) INTO credential_count
    FROM office_credentials oc
    WHERE oc.sistema_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sistemas s WHERE s.id = oc.sistema_id);
    
    IF credential_count > 0 THEN
        RAISE WARNING 'Found % orphaned office_credentials!', credential_count;
    ELSE
        RAISE NOTICE '✓ No orphaned office_credentials found';
    END IF;
    
    -- Check for orphaned testes
    SELECT COUNT(*) INTO teste_count
    FROM testes t
    WHERE t.sistema_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sistemas s WHERE s.id = t.sistema_id);
    
    IF teste_count > 0 THEN
        RAISE WARNING 'Found % orphaned testes!', teste_count;
    ELSE
        RAISE NOTICE '✓ No orphaned testes found';
    END IF;
    
    -- Display final system list
    RAISE NOTICE '';
    RAISE NOTICE 'Final sistemas list:';
    FOR sistema_count IN 
        SELECT system_id 
        FROM sistemas 
        ORDER BY LENGTH(system_id), system_id
    LOOP
        RAISE NOTICE '  - %', sistema_count;
    END LOOP;
    
END $$;

-- Step 9: Create backup of the migration for rollback purposes
-- This creates a record of what was done for potential rollback
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE,
    notes TEXT
);

INSERT INTO migration_history (migration_name, notes)
VALUES (
    'migrate_sistema_ids_to_numeric',
    'Migrated all sistema IDs from mixed format (sistema1, sistema7) to pure numeric (1, 7). ' ||
    'Merged duplicates 1-6, migrated all references in pontos, office_credentials, and testes tables.'
);

-- Commit the transaction if everything succeeded
COMMIT;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All sistema IDs have been migrated to numeric format.';
    RAISE NOTICE 'Duplicates have been merged and all references updated.';
    RAISE NOTICE '';
    RAISE NOTICE 'To verify the migration, run:';
    RAISE NOTICE '  SELECT id, system_id FROM sistemas ORDER BY LENGTH(system_id), system_id;';
    RAISE NOTICE '';
END $$;

-- Rollback script (in case needed)
-- To rollback this migration, you would need to restore from backup
-- as this migration permanently merges and deletes duplicate data.
-- Always backup your database before running this migration!