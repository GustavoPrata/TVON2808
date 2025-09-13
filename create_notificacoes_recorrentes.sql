-- Create the notificacoes_recorrentes table
CREATE TABLE IF NOT EXISTS notificacoes_recorrentes (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data_ultimo_envio TIMESTAMP NOT NULL DEFAULT NOW(),
  total_enviado INTEGER NOT NULL DEFAULT 1,
  proximo_envio TIMESTAMP NOT NULL,
  data_inicio_recorrencia TIMESTAMP NOT NULL DEFAULT NOW(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_recorrentes_cliente_id 
ON notificacoes_recorrentes(cliente_id);

CREATE INDEX IF NOT EXISTS idx_notificacoes_recorrentes_proximo_envio 
ON notificacoes_recorrentes(proximo_envio);

CREATE INDEX IF NOT EXISTS idx_notificacoes_recorrentes_ativo 
ON notificacoes_recorrentes(ativo);

-- Ensure unique constraint for cliente_id to avoid duplicates
ALTER TABLE notificacoes_recorrentes 
ADD CONSTRAINT unique_cliente_id UNIQUE(cliente_id);