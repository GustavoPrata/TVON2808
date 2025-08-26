import postgres from 'postgres';

async function addMetadadosColumn() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  try {
    // Add metadados column to conversas table if it doesn't exist
    await sql`
      ALTER TABLE conversas 
      ADD COLUMN IF NOT EXISTS metadados TEXT
    `;
    
    console.log('✅ Successfully added metadados column to conversas table');
  } catch (error) {
    console.error('Error adding metadados column:', error);
  } finally {
    await sql.end();
  }
}

addMetadadosColumn();