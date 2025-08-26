import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Adding tipo column to pagamentos table...');
    
    // Add tipo column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE pagamentos 
      ADD COLUMN IF NOT EXISTS tipo varchar(20) DEFAULT 'mensalidade'
    `);
    
    console.log('✓ tipo column added/verified');
    
    // Add metadata column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE pagamentos
      ADD COLUMN IF NOT EXISTS metadata json
    `);
    
    console.log('✓ metadata column added/verified');
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();