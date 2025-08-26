-- Adicionar campos para dados completos do Woovi
ALTER TABLE pagamentos
ADD COLUMN IF NOT EXISTS charge_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
ADD COLUMN IF NOT EXISTS expires_in INTEGER;