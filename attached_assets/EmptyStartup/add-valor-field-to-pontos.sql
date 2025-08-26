-- Adicionar campo valor na tabela pontos
ALTER TABLE pontos 
ADD COLUMN IF NOT EXISTS valor NUMERIC(10, 2) NOT NULL DEFAULT 0.00;