import { db } from "../db";
import { sistemas as sistemasTable } from "../../shared/schema";

async function createTestSystem() {
  try {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 5 * 60 * 1000); // Expira em 5 minutos
    
    console.log("🚀 Criando sistema de teste...");
    
    const testSystem = await db.insert(sistemasTable).values({
      systemId: "test_system_" + Date.now(),
      username: "teste_auto_" + Date.now(),
      password: "test_password_" + Math.random().toString(36).substr(2, 9),
      expiracao: expirationDate, // Passar Date diretamente, não string ISO
      maxPontosAtivos: 100,
      pontosAtivos: 0
    }).returning();
    
    console.log("✅ Sistema de teste criado com sucesso!");
    console.log("📋 Detalhes do sistema:");
    console.log(testSystem[0]);
    console.log(`⏰ Expira em: 5 minutos (${expirationDate.toISOString()})`);
    console.log("🎯 Sistemas podem ser renovados automaticamente pela extensão quando expirarem");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar sistema de teste:", error);
    process.exit(1);
  }
}

createTestSystem();