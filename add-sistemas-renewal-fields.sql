-- Adicionar campos de validade e renovação automática na tabela sistemas
ALTER TABLE sistemas 
ADD COLUMN IF NOT EXISTS expiration timestamp,
ADD COLUMN IF NOT EXISTS auto_renewal_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS renewal_advance_time integer NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS last_renewal_at timestamp,
ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';

-- Definir validade padrão de 30 dias para sistemas existentes
UPDATE sistemas 
SET expiration = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE expiration IS NULL;

-- Criar índice para melhorar performance de consultas por status e vencimento
CREATE INDEX IF NOT EXISTS idx_sistemas_status_expiration ON sistemas(status, expiration);
CREATE INDEX IF NOT EXISTS idx_sistemas_auto_renewal ON sistemas(auto_renewal_enabled, expiration);

-- Adicionar comentários nos campos
COMMENT ON COLUMN sistemas.expiration IS 'Data de validade do sistema IPTV';
COMMENT ON COLUMN sistemas.auto_renewal_enabled IS 'Se a renovação automática está habilitada';
COMMENT ON COLUMN sistemas.renewal_advance_time IS 'Tempo em minutos antes do vencimento para renovar';
COMMENT ON COLUMN sistemas.last_renewal_at IS 'Data/hora da última renovação automática';
COMMENT ON COLUMN sistemas.renewal_count IS 'Número total de renovações realizadas';
COMMENT ON COLUMN sistemas.status IS 'Status do sistema: active, expired, renewing, failed';