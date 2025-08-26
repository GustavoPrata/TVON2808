-- Add apiUserId column to testes table
ALTER TABLE testes
ADD COLUMN IF NOT EXISTS api_user_id INTEGER;