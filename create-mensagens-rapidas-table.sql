CREATE TABLE IF NOT EXISTS mensagens_rapidas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  texto TEXT NOT NULL,
  imagem_url TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'suporte',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tecla_atalho VARCHAR(10),
  variavel BOOLEAN DEFAULT false,
  categoria VARCHAR(50),
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
