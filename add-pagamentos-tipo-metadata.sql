-- Add tipo and metadata columns to pagamentos table
ALTER TABLE pagamentos 
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'mensalidade';

ALTER TABLE pagamentos 
ADD COLUMN IF NOT EXISTS metadata JSON;