-- Drop send_presence_updates column from whatsapp_settings table
ALTER TABLE whatsapp_settings
DROP COLUMN IF EXISTS send_presence_updates;