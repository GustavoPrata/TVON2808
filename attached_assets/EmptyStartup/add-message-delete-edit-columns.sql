-- Adicionar novos campos na tabela mensagens para suportar delete e edit
ALTER TABLE mensagens 
ADD COLUMN IF NOT EXISTS deletada BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deletada_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS conteudo_original TEXT,
ADD COLUMN IF NOT EXISTS editada BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS editada_em TIMESTAMP,
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;