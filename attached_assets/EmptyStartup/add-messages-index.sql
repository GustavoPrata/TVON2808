-- Add index to improve message query performance
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_timestamp 
ON mensagens(conversa_id, timestamp DESC);