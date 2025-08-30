import { db } from "./db";
import { sql } from "drizzle-orm";

export async function initDatabase() {
  try {
    // Create redirect_urls table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS redirect_urls (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        nome TEXT NOT NULL,
        is_principal BOOLEAN DEFAULT FALSE NOT NULL,
        ativo BOOLEAN DEFAULT TRUE NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    // Add media_url column to mensagens table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS media_url TEXT
    `);
    
    // Add last_seen and is_online columns to conversas table
    await db.execute(sql`
      ALTER TABLE conversas 
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE
    `);
    
    // Add ultimo_remetente and mensagem_lida columns to conversas table
    await db.execute(sql`
      ALTER TABLE conversas 
      ADD COLUMN IF NOT EXISTS ultimo_remetente VARCHAR(20),
      ADD COLUMN IF NOT EXISTS mensagem_lida BOOLEAN DEFAULT FALSE
    `);
    
    // Add profile_picture column to conversas table
    await db.execute(sql`
      ALTER TABLE conversas 
      ADD COLUMN IF NOT EXISTS profile_picture TEXT
    `);
    
    // Drop profile_picture column from clientes table (photos now come from conversas table)
    await db.execute(sql`
      ALTER TABLE clientes 
      DROP COLUMN IF EXISTS profile_picture
    `);
    
    // Add tipo_ultima_mensagem column to conversas table
    await db.execute(sql`
      ALTER TABLE conversas 
      ADD COLUMN IF NOT EXISTS tipo_ultima_mensagem VARCHAR(20)
    `);
    
    // Add columns for message delete/edit functionality
    await db.execute(sql`
      ALTER TABLE mensagens 
      ADD COLUMN IF NOT EXISTS deletada BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS deletada_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS conteudo_original TEXT,
      ADD COLUMN IF NOT EXISTS editada BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS editada_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT
    `);
    
    // Add ultimo_desbloqueio_confianca column to clientes table for expired client management
    await db.execute(sql`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS ultimo_desbloqueio_confianca TIMESTAMP
    `);
    
    // Create mensagens_rapidas table for quick support messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mensagens_rapidas (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(100) NOT NULL,
        texto TEXT NOT NULL,
        imagem_url TEXT,
        tipo VARCHAR(50) NOT NULL DEFAULT 'suporte',
        ordem INTEGER NOT NULL DEFAULT 0,
        ativo BOOLEAN NOT NULL DEFAULT true,
        tecla_atalho VARCHAR(10),
        variavel BOOLEAN DEFAULT false,
        categoria VARCHAR(50),
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Add index for better message query performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_timestamp 
      ON mensagens(conversa_id, timestamp DESC)
    `);
    
    // Create anotacoes table - ultra simplified
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS anotacoes (
        id SERIAL PRIMARY KEY,
        texto TEXT NOT NULL,
        concluida BOOLEAN DEFAULT FALSE,
        ordem INTEGER NOT NULL DEFAULT 0,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create WhatsApp settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id SERIAL PRIMARY KEY,
        profile_name TEXT,
        profile_status TEXT,
        profile_picture TEXT,
        mark_online_on_connect BOOLEAN DEFAULT FALSE,
        sync_full_history BOOLEAN DEFAULT TRUE,
        generate_high_quality_link_preview BOOLEAN DEFAULT TRUE,
        mark_messages_read BOOLEAN DEFAULT TRUE,
        send_read_receipts BOOLEAN DEFAULT TRUE,

        auto_download_media BOOLEAN DEFAULT TRUE,
        auto_download_documents BOOLEAN DEFAULT TRUE,
        save_chat_history BOOLEAN DEFAULT TRUE,
        fetch_client_photos BOOLEAN DEFAULT FALSE,
        cache_client_photos BOOLEAN DEFAULT TRUE,
        show_client_status BOOLEAN DEFAULT TRUE,
        show_profile_photos BOOLEAN DEFAULT TRUE,
        reconnect_interval INTEGER DEFAULT 5000,
        max_reconnect_retries INTEGER DEFAULT 5,
        log_level TEXT DEFAULT 'info',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insert default settings if none exist
    await db.execute(sql`
      INSERT INTO whatsapp_settings (id)
      SELECT 1
      WHERE NOT EXISTS (SELECT 1 FROM whatsapp_settings WHERE id = 1)
    `);
    
    // Add split profile photos columns
    await db.execute(sql`
      ALTER TABLE whatsapp_settings 
      ADD COLUMN IF NOT EXISTS show_profile_photos_chat BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS show_profile_photos_clientes BOOLEAN DEFAULT TRUE
    `);
    
    // Add sistema configuration fields
    await db.execute(sql`
      ALTER TABLE sistemas ADD COLUMN IF NOT EXISTS max_pontos_ativos INTEGER DEFAULT 100 NOT NULL;
      ALTER TABLE sistemas ADD COLUMN IF NOT EXISTS pontos_ativos INTEGER DEFAULT 0 NOT NULL;
      
      -- Add sistema_id to pontos table
      ALTER TABLE pontos ADD COLUMN IF NOT EXISTS sistema_id INTEGER REFERENCES sistemas(id);
      
      -- Add valor field to pontos table
      ALTER TABLE pontos ADD COLUMN IF NOT EXISTS valor NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
      
      -- Create index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_pontos_sistema_id ON pontos(sistema_id);
    `);
    
    // Add api_user_id column to testes table
    await db.execute(sql`
      ALTER TABLE testes ADD COLUMN IF NOT EXISTS api_user_id INTEGER;
    `);
    
    // Add sistema_id column to testes and drop old api_system_id
    await db.execute(sql`
      ALTER TABLE testes ADD COLUMN IF NOT EXISTS sistema_id INTEGER REFERENCES sistemas(id);
    `);
    await db.execute(sql`
      ALTER TABLE testes DROP COLUMN IF EXISTS api_system_id;
    `);
    
    // Update bot_config table with all missing columns
    await db.execute(sql`
      -- Update tipo column to allow new values
      ALTER TABLE bot_config ALTER COLUMN tipo TYPE varchar(20);
      
      -- Add new columns for enhanced bot functionality
      ALTER TABLE bot_config 
      ADD COLUMN IF NOT EXISTS variaveis_disponiveis json DEFAULT '["{{nome}}", "{{telefone}}", "{{vencimento}}", "{{status}}", "{{valorTotal}}", "{{ultimoAcesso}}", "{{teste_dispositivo}}", "{{teste_aplicativo}}", "{{teste_expiracao}}", "{{teste_status}}"]',
      ADD COLUMN IF NOT EXISTS mensagem_erro text DEFAULT 'Desculpe, não entendi sua solicitação. Por favor, escolha uma das opções disponíveis.',
      ADD COLUMN IF NOT EXISTS mensagem_timeout text DEFAULT 'Tempo esgotado! Você levou muito tempo para responder. Digite qualquer coisa para continuar.',
      ADD COLUMN IF NOT EXISTS permitir_texto_livre boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS redirecionar_humano boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS opcao_atendimento_humano boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS max_botoes_menu integer DEFAULT 3,
      ADD COLUMN IF NOT EXISTS mostrar_numeracao boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS permitir_voltar boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS menu_principal_texto text DEFAULT '📱 *Menu Principal*\nEscolha uma das opções abaixo:';
    `);
    
    // Add pix_copia_e_cola column to pagamentos table
    await db.execute(sql`
      ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS pix_copia_e_cola TEXT;
    `);
    
    // Add Woovi-specific fields to pagamentos table
    await db.execute(sql`
      ALTER TABLE pagamentos 
      ADD COLUMN IF NOT EXISTS charge_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
      ADD COLUMN IF NOT EXISTS expires_in INTEGER;
    `);
    
    // Add referral system columns to clientes table
    await db.execute(sql`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20),
      ADD COLUMN IF NOT EXISTS meses_gratis_acumulados INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_indicacoes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS indicacoes_confirmadas INTEGER DEFAULT 0;
    `);
    
    // Create indicacoes table for referral tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS indicacoes (
        id SERIAL PRIMARY KEY,
        indicador_id INTEGER NOT NULL REFERENCES clientes(id),
        indicado_id INTEGER NOT NULL REFERENCES clientes(id),
        codigo_indicacao VARCHAR(20) NOT NULL,
        data_indicacao TIMESTAMP NOT NULL DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        data_confirmacao TIMESTAMP,
        mes_gratis_aplicado BOOLEAN DEFAULT FALSE,
        observacoes TEXT
      );
      
      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON indicacoes(indicador_id);
      CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado ON indicacoes(indicado_id);
      CREATE INDEX IF NOT EXISTS idx_indicacoes_status ON indicacoes(status);
      CREATE INDEX IF NOT EXISTS idx_indicacoes_codigo ON indicacoes(codigo_indicacao);
    `);
    
    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}