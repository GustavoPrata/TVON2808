-- Create redirect_urls table if it doesn't exist
CREATE TABLE IF NOT EXISTS redirect_urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  nome TEXT NOT NULL,
  is_principal BOOLEAN DEFAULT FALSE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert a default URL if none exists
INSERT INTO redirect_urls (url, nome, is_principal, ativo)
SELECT 'http://example.com', 'URL Padrão', true, true
WHERE NOT EXISTS (SELECT 1 FROM redirect_urls);