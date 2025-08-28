import bcrypt from 'bcrypt';
import { db } from './db';
import { sql } from 'drizzle-orm';

export async function initAdmin() {
  try {
    // Create login table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login (
        id SERIAL PRIMARY KEY,
        "user" VARCHAR(100) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ultimo_acesso TIMESTAMP
      )
    `);

    // Hash da senha
    const hashedPassword = await bcrypt.hash('Gustavoprata1@', 10);
    
    // Insert admin user
    await db.execute(sql`
      INSERT INTO login ("user", password) 
      VALUES ('gustavoprtt', ${hashedPassword})
      ON CONFLICT ("user") DO NOTHING
    `);
    
    console.log('Admin user initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing admin user:', error);
    return false;
  }
}