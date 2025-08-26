-- Add metadados column to conversas table
ALTER TABLE conversas 
ADD COLUMN IF NOT EXISTS metadados TEXT;