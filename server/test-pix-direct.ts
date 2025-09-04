import { db } from './db';
import { sql } from 'drizzle-orm';

async function testDirectInsert() {
  console.log('🔧 Testando inserção direta na tabela pagamentos_manual...');
  
  try {
    const result = await db.execute(sql`
      INSERT INTO pagamentos_manual (telefone, valor, status)
      VALUES ('5514991949280', 100.00, 'pendente')
      RETURNING *;
    `);
    
    console.log('✅ Inserção direta bem sucedida!');
    console.log('📊 Resultado:', result.rows[0]);
    
    // Testar atualização
    if (result.rows[0]) {
      const updated = await db.execute(sql`
        UPDATE pagamentos_manual 
        SET pix_id = 'TEST123', 
            pix_copia_e_cola = 'PIX COPIA E COLA TEST',
            charge_id = 'CHARGE123'
        WHERE id = ${result.rows[0].id}
        RETURNING *;
      `);
      console.log('✅ Atualização bem sucedida!');
      console.log('📊 Atualizado:', updated.rows[0]);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testDirectInsert().then(() => process.exit(0));