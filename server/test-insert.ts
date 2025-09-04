import { db } from './db';
import { sql } from 'drizzle-orm';

(async () => {
  try {
    console.log('🔧 Testando inserção direta...');
    
    // Teste com execute direto
    const result = await db.execute(sql`
      INSERT INTO pagamentos_manual (telefone, valor, status)
      VALUES ('5514999999999', '100', 'pendente')
      RETURNING *
    `);
    
    console.log('✅ Inserção bem sucedida!');
    console.log('Result completo:', result);
    console.log('Result.rows:', result.rows);
    console.log('Primeiro registro:', result.rows?.[0]);
    console.log('Tipo do result:', typeof result);
    console.log('É array?', Array.isArray(result));
    
    // Se result for array, pegar o primeiro elemento
    if (Array.isArray(result)) {
      console.log('Result[0]:', result[0]);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  process.exit();
})();