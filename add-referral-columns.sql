-- Add referral columns to clientes table if they don't exist
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20),
ADD COLUMN IF NOT EXISTS meses_gratis_acumulados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_indicacoes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS indicacoes_confirmadas INTEGER DEFAULT 0;

-- Create indicacoes table if it doesn't exist
CREATE TABLE IF NOT EXISTS indicacoes (
  id SERIAL PRIMARY KEY,
  indicador_id INTEGER NOT NULL REFERENCES clientes(id),
  indicado_id INTEGER NOT NULL REFERENCES clientes(id),
  codigo_indicacao VARCHAR(20) NOT NULL,
  data_indicacao TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  data_confirmacao TIMESTAMP,
  mes_gratis_aplicado BOOLEAN DEFAULT FALSE,
  observacoes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON indicacoes(indicador_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado ON indicacoes(indicado_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status ON indicacoes(status);
CREATE INDEX IF NOT EXISTS idx_indicacoes_codigo ON indicacoes(codigo_indicacao);
