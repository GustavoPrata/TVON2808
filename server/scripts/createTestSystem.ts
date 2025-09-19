import { db } from "../db";
import { sistemas as sistemasTable } from "../../shared/schema";

async function createTestSystem() {
  try {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 5 * 60 * 1000); // Expira em 5 minutos
    
    console.log("🚀 Criando sistema de teste com renovação automática...");
    
    const testSystem = await db.insert(sistemasTable).values({
      nome: "Sistema Teste Auto-Renewal",
      username: "teste_auto_" + Date.now(),
      externalUserId: null,
      externalAppName: null, 
      expiracao: expirationDate, // Passar Date diretamente, não string ISO
      status: 'active',
      plano: 'basico',
      creditos: 100,
      autoRenewalEnabled: true,
      renewalAdvanceTime: 10, // Renovar com 10 minutos de antecedência
      maxRenewals: 5
    }).returning();
    
    console.log("✅ Sistema de teste criado com sucesso!");
    console.log("📋 Detalhes do sistema:");
    console.log(testSystem[0]);
    console.log(`⏰ Expira em: 5 minutos (${expirationDate.toISOString()})`);
    console.log("🔄 Deve entrar na fila de renovação imediatamente");
    console.log("⏳ Renovação antecipada: 10 minutos");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar sistema de teste:", error);
    process.exit(1);
  }
}

createTestSystem();