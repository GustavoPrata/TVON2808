-- Drop profile_picture column from clientes table since photos are now pulled from conversas table
ALTER TABLE clientes DROP COLUMN IF EXISTS profile_picture;