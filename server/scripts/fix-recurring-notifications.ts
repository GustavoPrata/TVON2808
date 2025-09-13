import { sql } from 'drizzle-orm';
import { db } from '../db';

async function fixRecurringNotifications() {
  console.log('🔧 Fixing recurring notifications schema...');
  
  try {
    // Create notificacoes_recorrentes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notificacoes_recorrentes (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        total_enviado INTEGER DEFAULT 0,
        proximo_envio DATE,
        ativo BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ Created notificacoes_recorrentes table');
    
    // Add columns to config_avisos
    await db.execute(sql`
      ALTER TABLE config_avisos 
      ADD COLUMN IF NOT EXISTS notificacoes_recorrentes BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Added notificacoes_recorrentes column');
    
    await db.execute(sql`
      ALTER TABLE config_avisos 
      ADD COLUMN IF NOT EXISTS intervalo_recorrente INTEGER DEFAULT 3
    `);
    console.log('✅ Added intervalo_recorrente column');
    
    await db.execute(sql`
      ALTER TABLE config_avisos 
      ADD COLUMN IF NOT EXISTS limite_notificacoes INTEGER DEFAULT 10
    `);
    console.log('✅ Added limite_notificacoes column');
    
    console.log('✅ Schema fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixRecurringNotifications();