-- Adicionar coluna para controle de desbloqueio de confiança
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS ultimo_desbloqueio_confianca TIMESTAMP;