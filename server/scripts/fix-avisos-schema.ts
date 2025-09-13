import { db } from "../db";
import { sql } from "drizzle-orm";

async function fixAvisosSchema() {
  try {
    console.log("Adding missing columns to config_avisos table...");
    
    // Add the missing columns to config_avisos table
    await db.execute(sql`
      ALTER TABLE config_avisos
      ADD COLUMN IF NOT EXISTS notificacoes_recorrentes BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS intervalo_recorrente INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS limite_notificacoes INTEGER DEFAULT 10
    `);
    
    console.log("✅ Successfully added missing columns to config_avisos table");
    
    // Remove the ultima_execucao column if it exists as it's not used for recurring notifications
    await db.execute(sql`
      ALTER TABLE config_avisos
      DROP COLUMN IF EXISTS ultima_execucao
    `).catch(() => {
      // Column might not exist, that's fine
    });
    
    console.log("✅ Schema fixed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing schema:", error);
    process.exit(1);
  }
}

fixAvisosSchema();