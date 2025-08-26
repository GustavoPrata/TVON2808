import { db } from "./db";
import { testes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkTestes() {
  try {
    // Check all tests in database
    const allTests = await db.select().from(testes);
    console.log("\n=== ALL TESTS IN DATABASE ===");
    allTests.forEach(test => {
      console.log({
        id: test.id,
        telefone: test.telefone,
        status: test.status,
        expiraEm: test.expiraEm
      });
    });

    // Check for specific phone
    const phone = "5514999887766";
    const testWithPhone = await db.select().from(testes).where(eq(testes.telefone, phone));
    console.log(`\n=== TEST WITH PHONE ${phone} ===`);
    console.log(testWithPhone);

    // Check active tests
    const now = new Date();
    const activeTests = await db.select().from(testes)
      .where(eq(testes.status, "ativo"));
    
    console.log("\n=== ACTIVE TESTS ===");
    activeTests.forEach(test => {
      const isExpired = test.expiraEm < now;
      console.log({
        id: test.id,
        telefone: test.telefone,
        expiraEm: test.expiraEm,
        isExpired: isExpired
      });
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkTestes();