-- Add tipo_ultima_mensagem column to conversas table
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS tipo_ultima_mensagem VARCHAR(20);