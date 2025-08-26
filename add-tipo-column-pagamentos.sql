-- Add tipo column to pagamentos table if it doesn't exist
ALTER TABLE pagamentos 
ADD COLUMN IF NOT EXISTS tipo varchar(20) DEFAULT 'mensalidade';

-- Add metadata column if it doesn't exist
ALTER TABLE pagamentos
ADD COLUMN IF NOT EXISTS metadata json;