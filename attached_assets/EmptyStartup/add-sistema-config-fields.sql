-- Add internal configuration fields to sistemas table
ALTER TABLE sistemas ADD COLUMN IF NOT EXISTS max_pontos_ativos INTEGER DEFAULT 100 NOT NULL;
ALTER TABLE sistemas ADD COLUMN IF NOT EXISTS pontos_ativos INTEGER DEFAULT 0 NOT NULL;

-- Add sistema_id to pontos table
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS sistema_id INTEGER REFERENCES sistemas(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pontos_sistema_id ON pontos(sistema_id);