-- Add sistema_id column to testes table
ALTER TABLE testes ADD COLUMN IF NOT EXISTS sistema_id INTEGER REFERENCES sistemas(id);

-- Drop old api_system_id column if exists
ALTER TABLE testes DROP COLUMN IF EXISTS api_system_id;