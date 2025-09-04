import { db } from './db';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela pagamentos_manual...\n');
    
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pagamentos_manual'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Colunas da tabela:');
    console.log('==========================================');
    result.rows.forEach((row: any) => {
      console.log(`${row.column_name}:`, {
        tipo: row.data_type,
        default: row.column_default || 'none',
        nullable: row.is_nullable
      });
    });
    
    console.log('\n📝 Exemplo de insert correto:');
    console.log(`{
  clienteId: null,        // Se não for usar cliente
  telefone: '5514999999999',
  valor: '50.00',
  status: 'pendente',
  tipo: 'manual',
  pixId: '',
  pixCopiaECola: '',
  qrCode: '',
  chargeId: '',
  paymentLinkUrl: '',
  expiresIn: 86400,
  metadata: {}
}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  process.exit(0);
}

checkTable();