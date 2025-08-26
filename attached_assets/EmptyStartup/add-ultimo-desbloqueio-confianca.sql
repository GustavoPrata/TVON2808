-- Add ultimo_desbloqueio_confianca column to clientes table
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS ultimo_desbloqueio_confianca TIMESTAMP;