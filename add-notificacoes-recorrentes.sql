-- Adicionar campos de configuração recorrente na tabela config_avisos
ALTER TABLE config_avisos 
ADD COLUMN IF NOT EXISTS notificacoes_recorrentes BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS intervalo_recorrente INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS limite_notificacoes INTEGER NOT NULL DEFAULT 10;

-- Criar nova tabela para rastrear notificações recorrentes enviadas
CREATE TABLE IF NOT EXISTS notificacoes_recorrentes (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data_ultimo_envio TIMESTAMP NOT NULL DEFAULT NOW(),
  total_enviado INTEGER NOT NULL DEFAULT 1,
  proximo_envio TIMESTAMP NOT NULL,
  data_inicio_recorrencia TIMESTAMP NOT NULL DEFAULT NOW(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Criar índice para otimizar buscas por cliente_id
CREATE INDEX IF NOT EXISTS idx_notificacoes_recorrentes_cliente_id ON notificacoes_recorrentes(cliente_id);

-- Criar índice para otimizar buscas por proximo_envio
CREATE INDEX IF NOT EXISTS idx_notificacoes_recorrentes_proximo_envio ON notificacoes_recorrentes(proximo_envio) WHERE ativo = true;

-- Comentário para documentar o propósito dos campos
COMMENT ON COLUMN config_avisos.notificacoes_recorrentes IS 'Ativa ou desativa notificações recorrentes após o vencimento';
COMMENT ON COLUMN config_avisos.intervalo_recorrente IS 'Intervalo em dias entre notificações recorrentes';
COMMENT ON COLUMN config_avisos.limite_notificacoes IS 'Limite máximo de notificações recorrentes a enviar para cada cliente';

COMMENT ON TABLE notificacoes_recorrentes IS 'Tabela para rastrear notificações recorrentes enviadas para clientes vencidos';
COMMENT ON COLUMN notificacoes_recorrentes.cliente_id IS 'ID do cliente que está recebendo notificações recorrentes';
COMMENT ON COLUMN notificacoes_recorrentes.data_ultimo_envio IS 'Data e hora do último envio de notificação';
COMMENT ON COLUMN notificacoes_recorrentes.total_enviado IS 'Total de notificações recorrentes já enviadas';
COMMENT ON COLUMN notificacoes_recorrentes.proximo_envio IS 'Data e hora do próximo envio programado';
COMMENT ON COLUMN notificacoes_recorrentes.data_inicio_recorrencia IS 'Data e hora em que iniciou a sequência de notificações recorrentes';
COMMENT ON COLUMN notificacoes_recorrentes.ativo IS 'Se a recorrência está ativa para este cliente';