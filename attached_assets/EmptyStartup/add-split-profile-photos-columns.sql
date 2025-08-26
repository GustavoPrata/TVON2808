-- Split show_profile_photos into two separate columns
ALTER TABLE whatsapp_settings 
ADD COLUMN IF NOT EXISTS show_profile_photos_chat BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_profile_photos_clientes BOOLEAN DEFAULT TRUE;

-- Copy existing value to both new columns
UPDATE whatsapp_settings 
SET show_profile_photos_chat = COALESCE(show_profile_photos, TRUE),
    show_profile_photos_clientes = COALESCE(show_profile_photos, TRUE)
WHERE show_profile_photos_chat IS NULL OR show_profile_photos_clientes IS NULL;

-- Drop the old column
ALTER TABLE whatsapp_settings
DROP COLUMN IF EXISTS show_profile_photos;