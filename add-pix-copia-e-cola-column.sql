-- Adicionar coluna pix_copia_e_cola à tabela pagamentos
ALTER TABLE pagamentos
ADD COLUMN IF NOT EXISTS pix_copia_e_cola TEXT;