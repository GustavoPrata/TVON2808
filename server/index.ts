import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initDatabase } from "./db-init";
import path from "path";
import * as cron from "node-cron";
import { storage } from "./storage";
import { whatsappService } from "./services/whatsapp";
import { sql } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database tables
  await initDatabase();
  
  // Adicionar colunas de renovação automática na tabela sistemas se não existirem
  try {
    const { db } = await import("./db");
    console.log("🔧 Verificando colunas de renovação automática na tabela sistemas...");
    
    // Adicionar colunas que faltam usando ALTER TABLE
    // Nota: a coluna já se chama 'expiracao' no schema, não 'expiration'
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Adicionar coluna expiracao se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='expiracao') THEN
          ALTER TABLE sistemas ADD COLUMN expiracao TIMESTAMP;
        END IF;
        
        -- Adicionar coluna auto_renewal_enabled se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='auto_renewal_enabled') THEN
          ALTER TABLE sistemas ADD COLUMN auto_renewal_enabled BOOLEAN DEFAULT false;
        END IF;
        
        -- Adicionar coluna renewal_advance_time se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='renewal_advance_time') THEN
          ALTER TABLE sistemas ADD COLUMN renewal_advance_time INTEGER DEFAULT 60;
        END IF;
        
        -- Adicionar coluna last_renewal_at se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='last_renewal_at') THEN
          ALTER TABLE sistemas ADD COLUMN last_renewal_at TIMESTAMP;
        END IF;
        
        -- Adicionar coluna renewal_count se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='renewal_count') THEN
          ALTER TABLE sistemas ADD COLUMN renewal_count INTEGER DEFAULT 0;
        END IF;
        
        -- Adicionar coluna status se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sistemas' AND column_name='status') THEN
          ALTER TABLE sistemas ADD COLUMN status VARCHAR(20);
        END IF;
      END $$;
    `);
    
    console.log("✅ Colunas de renovação automática verificadas/criadas com sucesso");
    
    // Adicionar campo renewal_advance_time na tabela office_automation_config
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Adicionar coluna renewal_advance_time se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='office_automation_config' AND column_name='renewal_advance_time') THEN
          ALTER TABLE office_automation_config ADD COLUMN renewal_advance_time INTEGER DEFAULT 60;
        END IF;
      END $$;
    `);
    
    console.log("✅ Campo renewal_advance_time adicionado à tabela office_automation_config");
  } catch (error) {
    console.error("⚠️ Erro ao verificar/criar colunas de renovação automática:", error);
    // Não falhar a aplicação, apenas registrar o erro
  }
  
  const server = await registerRoutes(app);
  
  // Função para verificar testes expirados e enviar notificação
  async function checkExpiredTests() {
    try {
      const testesExpirados = await storage.getTestesExpiradosNaoNotificados();
      
      for (const teste of testesExpirados) {
        let telefone = teste.telefone.replace(/\D/g, "");
        
        // Adiciona o código do país se não tiver
        if (!telefone.startsWith("55")) {
          telefone = "55" + telefone;
        }
        
        // Mensagem de notificação sobre teste expirado
        const mensagem = `Seu teste terminou!\nAtive agora seu plano por apenas R$19,90!🔥\n\n` +
          `Escolha sua opção:\n\n` +
          `1️⃣ Ativar plano agora\n` +
          `2️⃣ Falar com um atendente`;
        
        try {
          // Envia a mensagem
          const sucesso = await whatsappService.sendMessage(telefone, mensagem);
          
          if (sucesso) {
            // Configura o estado da conversa para aguardar resposta do menu expirado
            whatsappService.setConversationState(telefone, {
              submenu: "teste_expirado_menu",
              lastActivity: new Date(),
              previousMenu: "main"
            });
            
            // Marca o teste como notificado através do expireOldTestes
            await storage.markTesteAsNotificado(teste.id);
            console.log(`✅ Notificação de teste expirado enviada para ${telefone}`);
          } else {
            console.log(`❌ Falha ao enviar notificação de teste expirado para ${telefone}`);
          }
        } catch (error) {
          console.error(`Erro ao processar teste expirado ${teste.id}:`, error);
        }
      }
      
      if (testesExpirados.length > 0) {
        console.log(`📢 ${testesExpirados.length} notificações de teste expirado processadas`);
      }
    } catch (error) {
      console.error("Erro ao verificar testes expirados:", error);
    }
  }
  
  // Executar verificação de testes expirados a cada minuto
  cron.schedule("* * * * *", async () => {
    await checkExpiredTests();
  });
  
  // Importar e inicializar o serviço de renovação automática
  const { autoRenewalService } = await import("./services/AutoRenewalService");
  
  // Iniciar o serviço de renovação automática se a configuração estiver habilitada
  try {
    const config = await storage.getOfficeAutomationConfig();
    if (config && config.isEnabled) {
      autoRenewalService.start();
      console.log("✅ Serviço de renovação automática iniciado");
    } else {
      console.log("⚠️ Serviço de renovação automática desabilitado na configuração");
    }
  } catch (error) {
    console.error("❌ Erro ao iniciar serviço de renovação automática:", error);
  }
  
  // Executar verificação imediatamente ao iniciar
  setTimeout(async () => {
    console.log("🔍 Iniciando verificação de testes expirados...");
    await checkExpiredTests();
  }, 5000); // Aguardar 5 segundos para garantir que tudo está inicializado

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Error handled:", err);
    res.status(status).json({ message });
    // Don't throw the error - this would crash the server
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
