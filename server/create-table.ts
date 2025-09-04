import { db } from './db';
import { sql } from 'drizzle-orm';

async function createTable() {
  console.log('🔧 Criando/atualizando tabela pagamentos_manual...');
  
  try {
    // Criar tabela se não existir
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pagamentos_manual (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        telefone VARCHAR(20) NOT NULL,
        valor NUMERIC(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        tipo VARCHAR(20) DEFAULT 'manual',
        pix_id VARCHAR(100),
        pix_copia_e_cola TEXT,
        qr_code TEXT,
        charge_id VARCHAR(100),
        payment_link_url TEXT,
        expires_in INTEGER,
        metadata JSON,
        data_criacao TIMESTAMP DEFAULT NOW(),
        data_pagamento TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela pagamentos_manual criada/verificada!');
    
    // Criar índices
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pagamentos_manual_telefone 
      ON pagamentos_manual(telefone);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pagamentos_manual_charge_id 
      ON pagamentos_manual(charge_id);
    `);
    
    console.log('✅ Índices criados/verificados!');
    
    // Adicionar coluna cliente_id se não existir (para tabelas antigas)
    await db.execute(sql`
      ALTER TABLE pagamentos_manual 
      ADD COLUMN IF NOT EXISTS cliente_id INTEGER 
      REFERENCES clientes(id) ON DELETE SET NULL;
    `).catch(() => {
      // Ignora erro se coluna já existe
    });
    
    console.log('🎉 Tabela pagamentos_manual pronta para uso!');
    
  } catch (error: any) {
    console.error('❌ Erro ao criar tabela:', error.message);
  }
}

createTable().then(() => {
  console.log('✅ Script finalizado!');
  process.exit(0);
});