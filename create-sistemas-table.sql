-- Create sistemas table for syncing external API systems
CREATE TABLE IF NOT EXISTS sistemas (
  id SERIAL PRIMARY KEY,
  system_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Create index on system_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sistemas_system_id ON sistemas(system_id);