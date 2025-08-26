import { db } from "./db";
import { testes } from "@shared/schema";

async function createTestUser() {
  try {
    // Create a test user that expires in 2 hours from now
    const expiraEm = new Date();
    expiraEm.setHours(expiraEm.getHours() + 2);
    
    const result = await db.insert(testes).values({
      telefone: "5514999887766",
      aplicativo: "ibo_pro",
      dispositivo: "Android",
      mac: "00:11:22:33:44:55", // Required MAC address
      deviceKey: "TEST123456", // Required device key
      duracaoHoras: 2, // Test duration in hours
      status: "ativo",
      expiraEm: expiraEm,
      apiUsername: "teste_user",
      apiPassword: "123456",
      criadoEm: new Date()
    }).returning();
    
    console.log("Test user created successfully:", result[0]);
    process.exit(0);
  } catch (error) {
    console.error("Error creating test user:", error);
    process.exit(1);
  }
}

createTestUser();