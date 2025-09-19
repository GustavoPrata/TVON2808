import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initDatabase } from "./db-init";
import path from "path";
import * as cron from "node-cron";
import { storage } from "./storage";
import { whatsappService } from "./services/whatsapp";

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
  
  // Função para renovação automática de sistemas IPTV
  async function checkSystemsForRenewal() {
    try {
      console.log("🔄 Verificando sistemas IPTV para renovação automática...");
      
      // Buscar sistemas com renovação automática ativada
      const sistemasParaRenovar = await storage.getSistemasExpirandoEm(24 * 60); // 24 horas
      
      if (sistemasParaRenovar.length === 0) {
        return;
      }
      
      console.log(`📋 ${sistemasParaRenovar.length} sistemas precisam ser renovados`);
      
      // Buscar pontos disponíveis
      const pontosDisponiveis = await storage.getAvailablePoints();
      console.log(`💡 ${pontosDisponiveis} pontos disponíveis para renovação`);
      
      let tarefasCriadas = 0;
      
      for (const sistema of sistemasParaRenovar) {
        if (!sistema.autoRenewalEnabled) continue;
        
        const now = new Date();
        const expiration = new Date(sistema.expiracao!);
        const diffMinutes = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60));
        
        // Verifica se está dentro do tempo de renovação antecipada
        if (diffMinutes <= (sistema.renewalAdvanceTime || 60)) {
          console.log(`📝 Criando tarefa de renovação para sistema ${sistema.id}...`);
          
          try {
            // Criar tarefa para a extensão Chrome gerar novas credenciais
            await storage.createPendingTask('renew_system', {
              systemId: sistema.id,
              currentUsername: sistema.usuario,
              currentPassword: sistema.senha,
              expiracao: sistema.expiracao,
              clienteId: sistema.clienteId
            });
            
            // Marcar sistema como em renovação para evitar duplicatas
            await storage.marcarSistemaComoRenovando(sistema.id);
            
            tarefasCriadas++;
            console.log(`📋 Tarefa de renovação criada para sistema ${sistema.id}`);
          } catch (error) {
            console.error(`❌ Erro ao criar tarefa de renovação para sistema ${sistema.id}:`, error);
          }
        }
      }
      
      if (tarefasCriadas > 0) {
        console.log(`📬 ${tarefasCriadas} tarefas de renovação criadas e aguardando processamento`);
      }
    } catch (error) {
      console.error("Erro ao verificar sistemas para renovação:", error);
    }
  }
  
  // Executar verificação de renovação a cada 10 minutos
  cron.schedule("*/10 * * * *", async () => {
    await checkSystemsForRenewal();
  });
  
  // Executar verificação imediatamente ao iniciar
  setTimeout(async () => {
    console.log("🔍 Iniciando verificação de testes expirados...");
    await checkExpiredTests();
    console.log("🔄 Iniciando verificação de sistemas IPTV para renovação...");
    await checkSystemsForRenewal();
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
