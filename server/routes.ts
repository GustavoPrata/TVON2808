import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { db } from "./db";
import { whatsappService } from "./services/whatsapp";
import { externalApiService } from "./services/externalApi";
import { pixService } from "./services/pix";
import { notificationService } from "./services/notifications";
import quickMessagesRouter from "./routes/quick-messages";
import { authenticate, checkAuth } from "./auth";
import bcrypt from 'bcrypt';
import { initAdmin } from "./init-admin";
import {
  insertClienteSchema,
  insertPontoSchema,
  insertBotConfigSchema,
  insertNotificacaoConfigSchema,
  insertIntegracaoSchema,
  sistemas,
  pontos,
  testes,
  insertTesteSchema,
  login,
} from "@shared/schema";
import { z } from "zod";
import { asc, sql, eq } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import multer from "multer";

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "temp", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Configure uploads directory for profile pictures
const profilePictureStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const profilePictureUpload = multer({
  storage: profilePictureStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Helper function to format phone number
function formatPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  let number = digits;
  if (digits.startsWith("55") && digits.length > 11) {
    number = digits.substring(2);
  }

  if (number.length === 11) {
    return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
  }

  if (number.length === 10) {
    return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
  }

  return phone;
}

// Store for auto-close timers and their start times
const autoCloseTimers = new Map<number, { timer: NodeJS.Timeout, startTime: number }>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize admin user on startup
  await initAdmin();
  
  // Configure session middleware
  const MemoryStoreSession = (MemoryStore as any)(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'tv-on-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      secure: false, // set to true in production with HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days by default
    }
  }));

  // Serve static files for uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  
  // Authentication routes (before checkAuth middleware)
  app.post("/api/login", async (req, res) => {
    const { user, password, rememberMe } = req.body;
    
    if (!user || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    const isValid = await authenticate(user, password);
    
    if (isValid) {
      const [admin] = await db.select().from(login).where(eq(login.user, user));
      (req.session as any).userId = admin.id;
      (req.session as any).user = admin.user;
      
      // Set longer session cookie if remember me is checked
      if (rememberMe) {
        // Set cookie to expire in 90 days for remember me
        req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      } else {
        // Default to 30 days even without remember me
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      // Update last access
      await db.update(login)
        .set({ ultimoAcesso: new Date() })
        .where(eq(login.user, user));
      
      return res.json({ success: true, user: admin.user });
    }
    
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao fazer logout' });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/status", (req, res) => {
    if ((req.session as any).userId) {
      res.json({ authenticated: true, user: (req.session as any).user });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Webhook do Woovi (ANTES do middleware de auth para evitar problemas)
  app.post("/api/pix/webhook", async (req, res) => {
    try {
      console.log("🔔 Webhook recebido do Woovi");
      console.log("Headers completos:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));
      console.log("Método:", req.method);
      console.log("URL:", req.url);

      // Sempre responder sucesso primeiro para evitar reenvios
      res.status(200).json({ received: true, timestamp: new Date().toISOString() });

      // Buscar configuração
      const config = await storage.getIntegracaoByTipo("pix");
      console.log("🔧 Configuração PIX encontrada:", {
        existe: !!config,
        ativo: config?.ativo,
        temConfiguracao: !!config?.configuracoes,
        authConfigurado: !!(config?.configuracoes?.authorization)
      });

      // Validar Authorization header se configurado
      if (config && config.configuracoes && config.configuracoes.authorization) {
        const authHeader = req.headers.authorization;
        const authHeaderLower = req.headers['authorization']; // Caso esteja em lowercase
        const expectedAuth = config.configuracoes.authorization;
        
        console.log("🔐 Detalhes completos da validação:", {
          'Esperado (salvo no DB)': expectedAuth,
          'Recebido (authorization)': authHeader,
          'Recebido (Authorization)': authHeaderLower,
          'Todos os headers auth-like': Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth')),
          'Header exato recebido': authHeader || authHeaderLower || 'Nenhum',
          'Tipos': {
            esperado: typeof expectedAuth,
            recebido: typeof (authHeader || authHeaderLower)
          }
        });

        const receivedAuth = authHeader || authHeaderLower;
        
        // Verificar diferentes formatos comuns
        let isValid = false;
        if (receivedAuth && expectedAuth) {
          // Comparação exata
          if (receivedAuth === expectedAuth) {
            isValid = true;
            console.log("✅ Authorization válido (comparação exata)");
          }
          // Comparação sem "Bearer " prefix
          else if (receivedAuth.replace(/^Bearer\s+/i, '') === expectedAuth) {
            isValid = true;
            console.log("✅ Authorization válido (removendo Bearer prefix)");
          }
          // Comparação adicionando "Bearer " prefix
          else if (`Bearer ${receivedAuth}` === expectedAuth) {
            isValid = true;
            console.log("✅ Authorization válido (adicionando Bearer prefix)");
          }
          // Comparação case-insensitive
          else if (receivedAuth.toLowerCase() === expectedAuth.toLowerCase()) {
            isValid = true;
            console.log("✅ Authorization válido (case-insensitive)");
          }
        }

        if (!isValid && expectedAuth) {
          console.warn("⚠️ Authorization inválido no webhook - RETORNANDO ERRO");
          console.warn("Todas as tentativas falharam:");
          console.warn("- Exata:", receivedAuth === expectedAuth);
          console.warn("- Sem Bearer:", receivedAuth?.replace(/^Bearer\s+/i, '') === expectedAuth);
          console.warn("- Com Bearer:", `Bearer ${receivedAuth}` === expectedAuth);
          console.warn("- Case-insensitive:", receivedAuth?.toLowerCase() === expectedAuth?.toLowerCase());
          
          // NÃO retornar erro, apenas logar - vamos aceitar sempre para debug
          console.log("🚨 MODO DEBUG: Aceitando webhook mesmo com Authorization inválido");
        } else {
          console.log("✅ Authorization validado com sucesso");
        }
      } else {
        console.log("ℹ️ Nenhum Authorization configurado ou configuração não encontrada - processando sem validação");
      }

      // Processar evento do webhook de forma assíncrona
      try {
        await pixService.processWebhook(req.body);
        console.log("✅ Webhook processado com sucesso");
      } catch (processingError) {
        console.error("❌ Erro ao processar webhook (não crítico):", processingError);
        // Não retornar erro para o Woovi, apenas logar
      }

    } catch (error) {
      console.error("❌ Erro crítico no webhook:", error);
      // Se falhar antes de responder, retornar sucesso mesmo assim
      if (!res.headersSent) {
        res.status(200).json({ received: true, error: "Processamento interno falhou", timestamp: new Date().toISOString() });
      }
    }
  });

  // Apply auth middleware to all API routes except login routes and webhooks
  app.use("/api/*", (req, res, next) => {
    const publicPaths = [
      '/api/login', 
      '/api/logout', 
      '/api/auth/status',
      '/api/pix/webhook'  // Webhook do Woovi deve ser público
    ];
    
    // Debug log for webhook
    if (req.path === '/api/pix/webhook') {
      console.log('🚨 WEBHOOK DEBUG - Middleware interceptou:', {
        path: req.path,
        method: req.method,
        inPublicPaths: publicPaths.includes(req.path),
        headers: Object.keys(req.headers),
        body: req.body
      });
    }
    
    if (publicPaths.includes(req.path)) {
      console.log('✅ Caminho público detectado, passando adiante:', req.path);
      return next();
    }
    
    console.log('🔒 Aplicando checkAuth para:', req.path);
    return checkAuth(req, res, next);
  });
  
  // Register quick messages routes
  app.use("/api/mensagens-rapidas", quickMessagesRouter);
  
  const httpServer = createServer(app);

  // WebSocket para chat em tempo real
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<string, WebSocket>();
  const clientsSet = new Set<WebSocket>();

  // Pass WebSocket clients to WhatsApp service
  whatsappService.setWebSocketClients(clientsSet);

  // Listen for WhatsApp service events and broadcast to WebSocket clients
  whatsappService.on("new_message", (messageData) => {
    console.log("Bot message event received:", messageData);
    // Broadcast as 'whatsapp_message' to match frontend expectation
    broadcastMessage("whatsapp_message", messageData);
  });

  // Listen for external message sent events (from personal WhatsApp)
  whatsappService.on("message_sent", (messageData) => {
    console.log("External message sent event received:", messageData);
    broadcastMessage("message_sent", messageData);
  });

  // Listen for conversation created events
  whatsappService.on("conversation_created", (conversationData) => {
    console.log("Conversation created event received:", conversationData);
    broadcastMessage("conversation_created", conversationData);
  });

  // Listen for conversation updated events
  whatsappService.on("conversation_updated", (conversationData) => {
    console.log("Conversation updated event received:", conversationData);
    broadcastMessage("conversation_updated", conversationData);
  });

  // Listen for message deleted events
  whatsappService.on("message_deleted", (messageData) => {
    console.log("Message deleted event received:", messageData);
    broadcastMessage("message_deleted", messageData);
  });

  // Listen for message edited events
  whatsappService.on("message_edited", (messageData) => {
    console.log("Message edited event received:", messageData);
    broadcastMessage("message_edited", messageData);
  });

  // Helper function to broadcast messages to all connected clients
  const broadcastMessage = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  wss.on("connection", (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(clientId, ws);
    clientsSet.add(ws);

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case "join_chat":
            // Cliente se juntou ao chat
            break;

          case "send_message":
            await handleSendMessage(data, clientId);
            break;

          case "switch_mode":
            await handleSwitchMode(data);
            break;

          case "mark_messages_read":
            await handleMarkMessagesRead(data);
            break;

          case "delete_message":
            await handleDeleteMessage(data, clientId, clientsSet);
            break;

          case "edit_message":
            await handleEditMessage(data, clientId, clientsSet);
            break;
        }
      } catch (error) {
        console.error("Erro ao processar mensagem WebSocket:", error);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      clientsSet.delete(ws);
    });
  });

  // Function to convert audio from WebM to OGG using ffmpeg
  async function convertAudioToOgg(inputBuffer: Buffer): Promise<Buffer> {
    const tempDir = path.join(process.cwd(), "temp");
    await fs.mkdir(tempDir, { recursive: true });

    const inputFile = path.join(tempDir, `${nanoid()}.webm`);
    const outputFile = path.join(tempDir, `${nanoid()}.ogg`);

    try {
      // Write input buffer to temp file
      await fs.writeFile(inputFile, inputBuffer);

      // Convert using ffmpeg
      return new Promise<Buffer>((resolve, reject) => {
        ffmpeg(inputFile)
          .toFormat("ogg")
          .audioCodec("libopus")
          .audioBitrate("64k") // Lower bitrate for mobile compatibility
          .audioFrequency(16000) // 16kHz sample rate for voice
          .audioChannels(1) // Mono audio
          .outputOptions([
            "-avoid_negative_ts",
            "1", // Avoid negative timestamps
            "-fflags",
            "+genpts", // Generate presentation timestamps
          ])
          .on("end", async () => {
            try {
              const outputBuffer = await fs.readFile(outputFile);
              // Clean up temp files
              await fs.unlink(inputFile).catch(() => {});
              await fs.unlink(outputFile).catch(() => {});
              resolve(outputBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on("error", (err) => {
            // Clean up temp files on error
            fs.unlink(inputFile).catch(() => {});
            fs.unlink(outputFile).catch(() => {});
            reject(err);
          })
          .save(outputFile);
      });
    } catch (error) {
      // Clean up temp files on error
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
      throw error;
    }
  }

  async function handleSendMessage(data: any, clientId: string) {
    const {
      conversaId,
      conteudo,
      telefone,
      tipo = "texto",
      mediaUrl,
      metadados,
      replyToId,
    } = data;

    // If no conversaId but has telefone, find or create conversation
    let actualConversaId = conversaId;
    if (!conversaId && telefone) {
      const conversa = await storage.getConversaByTelefone(telefone);
      if (conversa) {
        actualConversaId = conversa.id;
      } else {
        // Create new conversation
        const newConversa = await storage.createConversa({
          telefone,
          nome: telefone,
          ultimaMensagem: conteudo,
          status: 'ativo',
          modoAtendimento: 'humano',
          mensagensNaoLidas: 0,
          lastSeen: null,
          isOnline: false,
          ultimoRemetente: 'sistema',
          mensagemLida: true,
          profilePicture: null,
          tipoUltimaMensagem: tipo,
        });
        actualConversaId = newConversa.id;
      }
    }

    // For audio messages, ensure we have proper duration in the content
    let finalContent = conteudo;
    if (tipo === "audio" && metadados?.duration) {
      const duration = Math.max(1, Math.floor(metadados.duration)); // Minimum 1 second
      finalContent = `[Áudio ${duration}s]`;
      console.log("Audio message with duration:", duration, "seconds");
    }

    // Only save to database if we have a conversaId
    let mensagem = null;
    if (actualConversaId) {
      // Salvar mensagem no banco
      mensagem = await storage.createMensagem({
        conversaId: actualConversaId,
        conteudo: finalContent,
        tipo,
        remetente: "sistema",
        lida: true,
        mediaUrl,
        metadados,
      });

      // Atualizar última mensagem da conversa
      await storage.updateConversa(actualConversaId, {
        ultimaMensagem: conteudo,
        mensagensNaoLidas: 0, // Reset unread count when system sends message
        ultimoRemetente: "sistema", // Track who sent the last message
      });
    }

    // Enviar via WhatsApp
    if (tipo === "texto" || tipo === "text") {
      // Handle reply if replyToId is provided
      let replyMessage = null;
      if (replyToId) {
        const replyMsg = await storage.getMensagemById(replyToId);

        if (replyMsg && replyMsg.metadados?.whatsappMessageId) {
          // Get the cached WhatsApp message object
          const cachedMessage = whatsappService.getCachedMessage(
            replyMsg.metadados.whatsappMessageId,
          );
          if (cachedMessage) {
            replyMessage = cachedMessage;
          } else {
            // If not in cache, we need at least the basic structure
            replyMessage = {
              key: {
                remoteJid: `${telefone}@s.whatsapp.net`,
                fromMe: false,
                id: replyMsg.metadados.whatsappMessageId,
              },
              message: {
                conversation: replyMsg.conteudo || "",
              },
            };
          }
        }
      }
      console.log("=== ENVIANDO MENSAGEM WHATSAPP ===");
      console.log("Telefone:", telefone);
      console.log("Conteúdo:", conteudo);
      console.log("Reply Message:", replyMessage);

      const whatsappMessageId = await whatsappService.sendMessage(
        telefone,
        conteudo,
        replyMessage,
      );
      console.log("WhatsApp Message ID:", whatsappMessageId);

      if (whatsappMessageId && mensagem) {
        // Update message with WhatsApp ID for future replies
        await storage.updateMensagem(mensagem.id, {
          metadados: {
            ...mensagem.metadados,
            whatsappMessageId,
          },
        });
      }
    } else if (mediaUrl) {
      // Check if mediaUrl is an external URL (http/https)
      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        // External URL (like PIX QR Code from OpenPix)
        if (tipo === "image") {
          console.log("Sending external image URL:", mediaUrl);
          // Don't send URL as caption for external images (like PIX QR codes)
          const caption = (mediaUrl === conteudo) ? undefined : conteudo;
          const whatsappMessageId = await whatsappService.sendImage(
            telefone,
            mediaUrl, // Send the external URL directly
            caption,
            undefined, // replyTo
            true // skipSaveMessage - message already saved by WebSocket handler
          );
          console.log("External image send result:", whatsappMessageId);
          
          if (whatsappMessageId && mensagem) {
            await storage.updateMensagem(mensagem.id, {
              metadados: {
                ...mensagem.metadados,
                whatsappMessageId,
              },
            });
          }
        }
      } else if (mediaUrl.startsWith('/uploads/')) {
        // Local file upload - use full path for WhatsApp but keep relative for storage
        if (tipo === "image") {
          const fullPath = path.join(process.cwd(), mediaUrl);
          const whatsappMessageId = await whatsappService.sendImage(
            telefone,
            fullPath,
            conteudo || undefined,
            undefined, // replyTo
            true // skipSaveMessage - message already saved by WebSocket handler
          );
          console.log("Local image send result:", whatsappMessageId);
          
          if (whatsappMessageId && mensagem) {
            await storage.updateMensagem(mensagem.id, {
              metadados: {
                ...mensagem.metadados,
                whatsappMessageId,
              },
            });
          }
        }
      } else if (mediaUrl.startsWith('data:')) {
        // Base64 data URL
        const base64Data = mediaUrl.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        let mediaMessage: any = {};

        if (tipo === "image") {
          mediaMessage = {
            image: buffer,
            caption: conteudo || undefined,
          };
        } else if (tipo === "video") {
          mediaMessage = {
            video: buffer,
            caption: conteudo || undefined,
          };
        } else if (tipo === "audio") {
          console.log("Processing audio message:", {
            bufferSize: buffer.length,
            telefone,
            asFile: true,
            duration: metadados?.duration,
            mimeType: metadados?.mimeType,
          });

          try {
            // Convert WebM audio to OGG format for WhatsApp compatibility
            console.log("Converting audio from WebM to OGG...");
            const convertedBuffer = await convertAudioToOgg(buffer);
            console.log(
              "Audio converted successfully, size:",
              convertedBuffer.length,
            );

            // Send audio as voice note with OGG/Opus format
            mediaMessage = {
              audio: convertedBuffer,
              ptt: true, // Send as voice note for proper WhatsApp playback
              mimetype: "audio/ogg; codecs=opus", // WhatsApp prefers this format
            };
          } catch (error) {
            console.error("Failed to convert audio:", error);
            // Fallback to original buffer if conversion fails
            mediaMessage = {
              audio: buffer,
              ptt: true, // Send as voice note
              mimetype: metadados?.mimeType || "audio/ogg; codecs=opus",
            };
          }
        } else if (tipo === "document") {
        mediaMessage = {
          document: buffer,
          fileName: conteudo || "documento",
          mimetype: "application/octet-stream",
        };
      }

        const whatsappMessageId = await whatsappService.sendMedia(
          telefone,
          mediaMessage,
        );
        console.log("Media send result:", whatsappMessageId);

        if (whatsappMessageId && mensagem) {
          // Update message with WhatsApp ID for future replies/edits/deletes
          await storage.updateMensagem(mensagem.id, {
            whatsappMessageId: whatsappMessageId,
          });
        }
      }
    }

    // Notificar todos os clientes conectados (incluindo o remetente)
    const responseMessage = JSON.stringify({
      type: "message_sent",
      data: mensagem,
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  }

  async function handleSwitchMode(data: any) {
    const { conversaId, modo } = data;

    await storage.updateConversa(conversaId, {
      modoAtendimento: modo,
    });

    // Clear bot state when switching modes
    const conversa = await storage.getConversa(conversaId);
    if (conversa && whatsappService) {
      // Clear the bot state for this phone number
      whatsappService.resetConversationState(conversa.telefone);
      console.log(`Bot state cleared for ${conversa.telefone} when switching to ${modo} mode`);
    }

    // Notificar clientes sobre mudança de modo
    const responseMessage = JSON.stringify({
      type: "mode_changed",
      data: { conversaId, modo },
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  }

  async function handleMarkMessagesRead(data: any) {
    const { conversaId, messageIds } = data;

    try {
      // Mark messages as read in database
      for (const messageId of messageIds) {
        await storage.updateMensagem(messageId, { lida: true });
      }

      // Reset unread count on conversation
      await storage.updateConversa(conversaId, { mensagensNaoLidas: 0 });

      // Notify all clients about the update
      const responseMessage = JSON.stringify({
        type: "messages_marked_read",
        data: { conversaId, messageIds },
      });

      clientsSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(responseMessage);
        }
      });
    } catch (error) {
      console.error("Erro ao marcar mensagens como lidas:", error);
    }
  }

  async function handleDeleteMessage(
    data: any,
    clientId: string,
    clientsSet: Set<WebSocket>,
  ) {
    const { messageId, telefone } = data;

    try {
      // Get the message to be deleted
      const message = await storage.getMensagemById(messageId);
      if (!message) {
        console.error("Mensagem não encontrada:", messageId);
        return;
      }

      // Check if message has WhatsApp ID
      if (message.metadados?.whatsappMessageId) {
        // Delete from WhatsApp
        const success = await whatsappService.deleteMessage(
          telefone,
          message.metadados.whatsappMessageId,
        );
        if (!success) {
          console.error("Falha ao deletar mensagem no WhatsApp");
        }
      }

      // Update message in database - mark as deleted but preserve content
      await storage.updateMensagem(messageId, {
        deletada: true,
        deletadaEm: new Date(),
        conteudoOriginal: message.conteudo, // Preserve original content
      });

      // Notify all clients about the deletion
      const responseMessage = JSON.stringify({
        type: "message_deleted",
        data: {
          messageId,
          conversaId: message.conversaId,
          deletadaEm: new Date(),
          // Include message info for proper UI update
          messageData: {
            ...message,
            deletada: true,
            deletadaEm: new Date(),
            conteudoOriginal: message.conteudo,
          },
        },
      });

      clientsSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(responseMessage);
        }
      });
    } catch (error) {
      console.error("Erro ao deletar mensagem:", error);
    }
  }

  async function handleEditMessage(
    data: any,
    clientId: string,
    clientsSet: Set<WebSocket>,
  ) {
    const { messageId, newContent, telefone } = data;

    try {
      // Get the message to be edited
      const message = await storage.getMensagemById(messageId);
      if (!message) {
        console.error("Mensagem não encontrada:", messageId);
        return;
      }

      // Check if message has WhatsApp ID
      if (message.metadados?.whatsappMessageId) {
        // Edit on WhatsApp
        const success = await whatsappService.editMessage(
          telefone,
          message.metadados.whatsappMessageId,
          newContent,
        );
        if (!success) {
          console.error("Falha ao editar mensagem no WhatsApp");
        }
      }

      // Update message in database - preserve original content on first edit
      const updateData: any = {
        conteudo: newContent,
        editada: true,
        editadaEm: new Date(),
      };

      // If this is the first edit, save the original content
      if (!message.editada && !message.conteudoOriginal) {
        updateData.conteudoOriginal = message.conteudo;
      }

      await storage.updateMensagem(messageId, updateData);

      // Notify all clients about the edit
      const responseMessage = JSON.stringify({
        type: "message_edited",
        data: {
          messageId,
          conversaId: message.conversaId,
          conteudo: newContent,
          editadaEm: new Date(),
          // Include complete message data for proper UI update
          messageData: {
            ...message,
            conteudo: newContent,
            editada: true,
            editadaEm: new Date(),
            conteudoOriginal:
              updateData.conteudoOriginal ||
              message.conteudoOriginal ||
              message.conteudo,
          },
        },
      });

      clientsSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(responseMessage);
        }
      });
    } catch (error) {
      console.error("Erro ao editar mensagem:", error);
    }
  }

  // Integração com WhatsApp
  whatsappService.on("whatsapp_message", (message) => {
    const responseMessage = JSON.stringify({
      type: "whatsapp_message",
      data: message,
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  });

  whatsappService.on("qr", (qr) => {
    const responseMessage = JSON.stringify({
      type: "whatsapp_qr",
      data: { qr },
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  });

  whatsappService.on("message_edited", (data) => {
    const responseMessage = JSON.stringify({
      type: "message_edited",
      data,
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  });

  whatsappService.on("message_deleted", (data) => {
    const responseMessage = JSON.stringify({
      type: "message_deleted",
      data,
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  });

  whatsappService.on("conversation_updated", (data) => {
    const responseMessage = JSON.stringify({
      type: "conversation_updated",
      data,
    });

    clientsSet.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(responseMessage);
      }
    });
  });

  // ============ ROTAS API ============

  // Dashboard
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error in /api/dashboard/stats:", error);
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // Referral System Routes
  app.get("/api/indicacoes", async (req, res) => {
    try {
      const { indicadorId, status } = req.query;
      let indicacoes;
      
      if (indicadorId) {
        indicacoes = await storage.getIndicacoesByIndicadorId(parseInt(indicadorId as string));
        if (status) {
          indicacoes = indicacoes.filter(i => i.status === status);
        }
      } else if (status === 'pendente') {
        indicacoes = await storage.getIndicacoesPendentes();
      } else if (status === 'confirmada') {
        indicacoes = await storage.getIndicacoesConfirmadas();
      } else {
        // Get all indicacoes with client details
        const todasIndicacoes = await storage.getIndicacoesPendentes();
        const confirmadas = await storage.getIndicacoesConfirmadas();
        indicacoes = [...todasIndicacoes, ...confirmadas];
      }
      
      // Enrich with client names
      const indicacoesEnriquecidas = await Promise.all(
        indicacoes.map(async (ind) => {
          const indicador = await storage.getClienteById(ind.indicadorId);
          const indicado = await storage.getClienteById(ind.indicadoId);
          return {
            ...ind,
            indicadorNome: indicador?.nome || 'Desconhecido',
            indicadorTelefone: indicador?.telefone || '',
            indicadoNome: indicado?.nome || 'Desconhecido',
            indicadoTelefone: indicado?.telefone || ''
          };
        })
      );
      
      res.json(indicacoesEnriquecidas);
    } catch (error) {
      console.error("Error in /api/indicacoes:", error);
      res.status(500).json({ error: "Erro ao buscar indicações" });
    }
  });

  app.post("/api/indicacoes/confirmar/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.confirmarIndicacao(id);
      res.json({ success: true, message: "Indicação confirmada com sucesso" });
    } catch (error) {
      console.error("Error confirming indicacao:", error);
      res.status(500).json({ error: "Erro ao confirmar indicação" });
    }
  });

  app.post("/api/indicacoes/criar-automatica", async (req, res) => {
    try {
      const { indicadorId, indicadoId } = req.body;
      
      // Check if indicacao already exists
      const existente = await storage.getIndicacoesByIndicadoId(indicadoId);
      if (existente) {
        return res.status(400).json({ error: "Cliente já foi indicado por outra pessoa" });
      }
      
      // Get indicador to get their phone number for codigo
      const indicador = await storage.getClienteById(indicadorId);
      if (!indicador) {
        return res.status(404).json({ error: "Indicador não encontrado" });
      }
      
      // Create new indicacao
      const indicacao = await storage.createIndicacao({
        indicadorId,
        indicadoId,
        codigoIndicacao: indicador.telefone, // Use phone number as referral code
        status: 'pendente',
        mesGratisAplicado: false
      });
      
      res.json(indicacao);
    } catch (error) {
      console.error("Error creating indicacao:", error);
      res.status(500).json({ error: "Erro ao criar indicação" });
    }
  });

  // Clientes
  app.get("/api/clientes", async (req, res) => {
    try {
      const { search, tipo } = req.query;
      let clientes;

      if (search) {
        clientes = await storage.searchClientes(
          search as string,
          tipo as string,
        );
      } else {
        clientes = await storage.getClientes();
        if (tipo) {
          clientes = clientes.filter((c) => c.tipo === tipo);
        }
      }

      // Calculate valorTotal for each client by summing their pontos values
      const clientesComValor = await Promise.all(
        clientes.map(async (cliente) => {
          const pontos = await storage.getPontosByClienteId(cliente.id);
          const valorTotal = pontos.reduce((sum, ponto) => {
            const valor = parseFloat(ponto.valor || '0');
            return sum + valor;
          }, 0);
          
          return {
            ...cliente,
            valorTotal: valorTotal.toFixed(2)
          };
        })
      );

      res.json(clientesComValor);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar clientes" });
    }
  });

  app.get("/api/clientes/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(parseInt(req.params.id));
      if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }
      
      // Calculate valorTotal by summing pontos values
      const pontos = await storage.getPontosByClienteId(cliente.id);
      const valorTotal = pontos.reduce((sum, ponto) => {
        const valor = parseFloat(ponto.valor || '0');
        return sum + valor;
      }, 0);
      
      res.json({
        ...cliente,
        valorTotal: valorTotal.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cliente" });
    }
  });

  app.post("/api/clientes", async (req, res) => {
    try {
      const clienteData = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente(clienteData);

      // Se o cliente foi indicado por alguém, processar indicação automaticamente
      if (clienteData.indicadoPor) {
        console.log("Cliente tem código de indicação:", clienteData.indicadoPor);
        
        // Normalizar o código (remover caracteres especiais)
        const codigoNormalizado = clienteData.indicadoPor.replace(/\D/g, '');
        
        console.log("Buscando indicador com telefone:", codigoNormalizado);
        
        // Buscar o indicador pelo telefone (código de indicação)
        const indicador = await storage.getClienteByTelefone(codigoNormalizado);
        
        console.log("Resultado da busca:", indicador ? `Encontrado: ${indicador.nome}` : "Não encontrado");
        
        if (indicador) {
          console.log("Indicador encontrado:", indicador.nome);
          
          try {
            // Criar a indicação já confirmada (pois o cliente pagou para ser cadastrado)
            const indicacao = await storage.createIndicacao({
              indicadorId: indicador.id,
              indicadoId: cliente.id,
              codigoIndicacao: codigoNormalizado,
              status: 'confirmada',
              mesGratisAplicado: true,
              dataConfirmacao: new Date(),
              observacoes: 'Confirmada automaticamente ao cadastrar cliente'
            });
            
            // Adicionar 30 dias ao vencimento do indicador
            const novoVencimento = new Date(indicador.vencimento);
            novoVencimento.setDate(novoVencimento.getDate() + 30);
            
            // Atualizar indicador com mês grátis e contadores
            await storage.updateCliente(indicador.id, {
              vencimento: novoVencimento,
              mesesGratisAcumulados: (indicador.mesesGratisAcumulados || 0) + 1,
              totalIndicacoes: (indicador.totalIndicacoes || 0) + 1,
              indicacoesConfirmadas: (indicador.indicacoesConfirmadas || 0) + 1
            });
            
            console.log("Indicação confirmada e mês grátis aplicado!");
            
            // Enviar mensagem no WhatsApp avisando sobre o mês grátis
            if (whatsappService && whatsappService.isConnected()) {
              const mensagemParaIndicador = `🎉 PARABÉNS!\n\n` +
                `Sua indicação foi confirmada com sucesso! 🎊\n\n` +
                `${cliente.nome} acabou de se tornar nosso cliente usando seu código de indicação.\n\n` +
                `✅ Você ganhou 1 MÊS GRÁTIS!\n` +
                `📅 Seu novo vencimento: ${novoVencimento.toLocaleDateString('pt-BR')}\n\n` +
                `Total de meses acumulados: ${(indicador.mesesGratisAcumulados || 0) + 1}\n\n` +
                `Continue indicando amigos e ganhe ainda mais meses grátis! 🚀\n\n` +
                `_Obrigado por fazer parte da família TV ON!_ ❤️`;
              
              try {
                // Adicionar código 55 se necessário
                let telefoneIndicador = indicador.telefone;
                if (!telefoneIndicador.startsWith('55')) {
                  telefoneIndicador = '55' + telefoneIndicador;
                }
                
                await whatsappService.sendMessage(telefoneIndicador, mensagemParaIndicador);
                console.log("Mensagem de parabéns enviada para o indicador:", indicador.nome);
              } catch (error) {
                console.error("Erro ao enviar mensagem para indicador:", error);
              }
            }
            
          } catch (error) {
            console.error("Erro ao processar indicação:", error);
            // Não falhar a criação do cliente se houver erro na indicação
          }
        } else {
          console.log("Código de indicação não encontrado:", codigoNormalizado);
        }
      }

      // Enviar mensagem de boas-vindas
      await notificationService.sendWelcomeMessage(cliente.id);

      // Broadcast new client event to all connected clients
      broadcastMessage("client_created", {
        id: cliente.id,
        cliente: cliente,
      });

      res.status(201).json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao criar cliente" });
    }
  });

  app.put("/api/clientes/:id", async (req, res) => {
    try {
      const clienteId = parseInt(req.params.id);
      const oldCliente = await storage.getClienteById(clienteId);
      const clienteData = insertClienteSchema.partial().parse(req.body);
      const cliente = await storage.updateCliente(clienteId, clienteData);

      // If vencimento changed, sync with API for all active pontos
      if (
        oldCliente &&
        cliente.vencimento &&
        oldCliente.vencimento?.getTime() !== cliente.vencimento.getTime()
      ) {
        const pontos = await storage.getPontosByClienteId(clienteId);
        const exp_date = Math.floor(
          cliente.vencimento.getTime() / 1000,
        ).toString();

        for (const ponto of pontos) {
          if (ponto.apiUserId && ponto.status === "ativo") {
            try {
              await externalApiService.updateUser(ponto.apiUserId, {
                exp_date,
              });
            } catch (error) {
              console.error(
                `Erro ao atualizar exp_date do user ${ponto.apiUserId}:`,
                error,
              );
            }
          }
        }
      }

      // Broadcast update event to all connected clients
      broadcastMessage("client_updated", {
        id: cliente.id,
        cliente: cliente,
      });

      res.json(cliente);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao atualizar cliente" });
    }
  });

  app.delete("/api/clientes/:id", async (req, res) => {
    try {
      const clienteId = parseInt(req.params.id);
      
      // Check if cliente exists
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }
      
      await storage.deleteCliente(clienteId);
      
      // Broadcast delete event to all connected clients
      broadcastMessage("client_deleted", {
        id: clienteId,
      });
      
      res.json({ message: "Cliente deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar cliente:", error);
      res.status(500).json({ error: "Erro ao deletar cliente. Verifique os logs do servidor." });
    }
  });

  // Pontos
  app.get("/api/clientes/:id/pontos", async (req, res) => {
    try {
      const pontos = await storage.getPontosByClienteId(
        parseInt(req.params.id),
      );
      res.json(pontos);
    } catch (error) {
      console.error("Erro ao buscar pontos:", error);
      res
        .status(500)
        .json({ error: "Erro ao buscar pontos", details: error.message });
    }
  });

  // Buscar todos os pontos (aplicativos)
  app.get("/api/pontos", async (req, res) => {
    try {
      const pontos = await storage.getAllPontos();
      // Enrich pontos with cliente data
      const pontosWithClientes = await Promise.all(
        pontos.map(async (ponto) => {
          const cliente = await storage.getClienteById(ponto.clienteId);
          return {
            ...ponto,
            clienteNome: cliente?.nome || 'Cliente não encontrado',
            clienteTelefone: cliente?.telefone || ''
          };
        })
      );
      res.json(pontosWithClientes);
    } catch (error) {
      console.error("Erro ao buscar todos os pontos:", error);
      res
        .status(500)
        .json({ error: "Erro ao buscar pontos", details: error.message });
    }
  });

  app.post("/api/clientes/:id/pontos", async (req, res) => {
    try {
      const pontoData = insertPontoSchema.parse({
        ...req.body,
        clienteId: parseInt(req.params.id),
      });

      // Criar na API externa primeiro
      if (req.body.syncWithApi) {
        const externalUser = await externalApiService.createUser({
          username: pontoData.usuario,
          password: pontoData.senha,
          exp_date: pontoData.expiracao.toISOString(),
          system:
            pontoData.aplicativo === "ibo_pro"
              ? 1
              : pontoData.aplicativo === "ibo_player"
                ? 2
                : 3,
        });

        if (externalUser) {
          pontoData.apiUserId = externalUser.id;
        }
      }

      const ponto = await storage.createPonto(pontoData);
      res.status(201).json(ponto);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao criar ponto" });
    }
  });

  // Rota alternativa para criar pontos
  app.post("/api/pontos", async (req, res) => {
    try {
      console.log("=== BACKEND: CRIANDO PONTO ===");
      console.log("Dados recebidos:", req.body);

      const pontoData = insertPontoSchema.parse(req.body);
      console.log("Dados validados:", pontoData);

      // Adiciona valor se fornecido (o campo valor não está no schema de validação mas está no banco)
      const createData = {
        ...pontoData,
        ...(req.body.valor !== undefined && { valor: req.body.valor }),
      };
      console.log("Dados para criar:", createData);

      // Sempre sincronizar com API externa ao criar ponto
      if (pontoData.sistemaId) {
        const sistema = await storage.getSistemaById(pontoData.sistemaId);
        const cliente = await storage.getClienteById(pontoData.clienteId);

        if (sistema && cliente) {
          console.log("Sincronizando com API externa...");
          console.log("Sistema:", sistema);
          console.log("Cliente:", cliente);

          // Usar vencimento do cliente como exp_date
          const expDate = cliente.vencimento
            ? Math.floor(
                new Date(cliente.vencimento).getTime() / 1000,
              ).toString()
            : Math.floor(
                new Date().getTime() / 1000 + 365 * 24 * 60 * 60,
              ).toString();

          const apiData = {
            username: pontoData.usuario,
            password: pontoData.senha,
            exp_date: expDate,
            system: parseInt(sistema.systemId),
            status: "Active",
          };

          console.log("Dados para API:", apiData);

          try {
            // Verificar se API está configurada
            const integracao = await storage.getIntegracaoByTipo("api_externa");
            if (!integracao || !integracao.ativo) {
              console.warn("API externa não está configurada ou ativa");
              console.warn("Configure em Integrações > API Externa");
            } else {
              const config = integracao.configuracoes as any;
              console.log("API configurada:", {
                baseUrl: config.baseUrl ? "Configurado" : "NÃO CONFIGURADO",
                apiKey: config.apiKey ? "Configurado" : "NÃO CONFIGURADO",
              });

              if (!config.baseUrl || !config.apiKey) {
                console.error(
                  "API externa configurada mas faltam credenciais (baseUrl ou apiKey)",
                );
              } else {
                const externalUser =
                  await externalApiService.createUser(apiData);
                console.log("Usuário criado na API:", externalUser);

                if (externalUser) {
                  createData.apiUserId = externalUser.id;
                  console.log("ID do usuário na API salvo:", externalUser.id);
                }
              }
            }
          } catch (apiError: any) {
            console.error("=== ERRO AO CRIAR USUÁRIO NA API ===");
            console.error("Tipo:", apiError?.constructor?.name);
            console.error("Mensagem:", apiError?.message);
            console.error("Response:", apiError?.response?.data);
            console.error("Status:", apiError?.response?.status);

            if (apiError?.response?.status === 401) {
              console.error("ERRO 401: API Key inválida ou expirada");
            } else if (apiError?.response?.status === 404) {
              console.error("ERRO 404: URL da API incorreta");
            } else if (apiError?.code === "ECONNREFUSED") {
              console.error(
                "ERRO: Não foi possível conectar à API (URL incorreta ou servidor offline)",
              );
            }

            // Continuar mesmo se falhar na API
            console.warn("Ponto será criado apenas localmente");
          }
        }
      }

      const ponto = await storage.createPonto(createData);

      // Update system active points count
      if (pontoData.sistemaId) {
        await storage.updateSistemaActivePontos(pontoData.sistemaId);
      }

      res.status(201).json(ponto);
    } catch (error) {
      console.error("=== ERRO AO CRIAR PONTO ===");
      console.error("Tipo do erro:", error?.constructor?.name);
      console.error("Mensagem:", error?.message);
      console.error("Stack:", error?.stack);

      if (error instanceof z.ZodError) {
        console.error("Erros de validação:", error.errors);
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }

      console.error("Erro completo:", error);
      res
        .status(500)
        .json({
          error: "Erro ao criar ponto",
          details: error?.message || String(error),
        });
    }
  });

  app.put("/api/pontos/:id", async (req, res) => {
    try {
      console.log("PUT /api/pontos/:id - Body recebido:", req.body);

      // Separa os campos que não estão no schema
      const { valor, expiracao, ...restData } = req.body;

      // Cria objeto de atualização diretamente sem validação do schema
      const updateData: any = {};

      // Adiciona apenas campos que foram enviados
      if (restData.usuario !== undefined) updateData.usuario = restData.usuario;
      if (restData.senha !== undefined) updateData.senha = restData.senha;
      if (restData.macAddress !== undefined)
        updateData.macAddress = restData.macAddress;
      if (restData.deviceKey !== undefined)
        updateData.deviceKey = restData.deviceKey;
      if (restData.descricao !== undefined)
        updateData.descricao = restData.descricao;
      if (restData.status !== undefined) updateData.status = restData.status;
      if (restData.aplicativo !== undefined)
        updateData.aplicativo = restData.aplicativo;
      if (restData.dispositivo !== undefined)
        updateData.dispositivo = restData.dispositivo;
      if (restData.sistemaId !== undefined)
        updateData.sistemaId = restData.sistemaId;

      // Adiciona valor se fornecido
      if (valor !== undefined) {
        updateData.valor = valor;
      }

      // Adiciona expiracao se fornecido
      if (expiracao !== undefined && expiracao !== null && expiracao !== "") {
        updateData.expiracao = new Date(expiracao);
      }

      console.log("Dados para atualizar:", updateData);

      // Get old ponto data to check system changes
      const oldPonto = await storage.getPontoById(parseInt(req.params.id));
      const ponto = await storage.updatePonto(
        parseInt(req.params.id),
        updateData,
      );

      // Sempre sincronizar com API externa
      if (ponto.sistemaId && ponto.apiUserId) {
        const sistema = await storage.getSistemaById(ponto.sistemaId);
        const cliente = await storage.getClienteById(ponto.clienteId);
        if (sistema && cliente) {
          console.log("Sincronizando ponto com API externa...");

          // Usar vencimento do cliente como exp_date
          const expDate = cliente.vencimento
            ? Math.floor(
                new Date(cliente.vencimento).getTime() / 1000,
              ).toString()
            : Math.floor(new Date(ponto.expiracao).getTime() / 1000).toString();

          const apiData = {
            username: ponto.usuario,
            password: ponto.senha,
            exp_date: expDate,
            status: ponto.status === "ativo" ? "Active" : "Inactive",
            system: parseInt(sistema.systemId),
          };

          console.log("Atualizando usuário na API:", ponto.apiUserId, apiData);

          try {
            await externalApiService.updateUser(ponto.apiUserId, apiData);
            console.log("Usuário atualizado na API com sucesso");
          } catch (apiError) {
            console.error("Erro ao atualizar usuário na API:", apiError);
          }
        }
      }

      // Update system active points count if system changed
      if (oldPonto && oldPonto.sistemaId !== ponto.sistemaId) {
        if (oldPonto.sistemaId) {
          await storage.updateSistemaActivePontos(oldPonto.sistemaId);
        }
        if (ponto.sistemaId) {
          await storage.updateSistemaActivePontos(ponto.sistemaId);
        }
      }

      res.json(ponto);
    } catch (error) {
      console.error("Erro ao atualizar ponto:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res
        .status(500)
        .json({ error: "Erro ao atualizar ponto", details: error.message });
    }
  });

  app.delete("/api/pontos/:id", async (req, res) => {
    try {
      console.log("=== DELETANDO PONTO ===");
      const ponto = await storage.getPontoById(parseInt(req.params.id));
      console.log("Ponto encontrado:", ponto);

      if (ponto && ponto.apiUserId) {
        console.log("Deletando usuário da API:", ponto.apiUserId);
        try {
          await externalApiService.deleteUser(ponto.apiUserId);
          console.log("Usuário deletado da API com sucesso");
        } catch (apiError: any) {
          console.error("Erro ao deletar na API:", apiError.message);
          // Continua mesmo se falhar na API
        }
      } else {
        console.log("Ponto não tem apiUserId:", ponto?.apiUserId);
      }

      await storage.deletePonto(parseInt(req.params.id));
      res.json({ message: "Ponto deletado com sucesso" });
    } catch (error: any) {
      console.error("Erro ao deletar ponto:", error);
      res
        .status(500)
        .json({ error: "Erro ao deletar ponto", details: error.message });
    }
  });

  // Pagamentos
  app.get("/api/clientes/:id/pagamentos", async (req, res) => {
    try {
      const pagamentos = await storage.getPagamentosByClienteId(
        parseInt(req.params.id),
      );
      res.json(pagamentos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  app.post("/api/clientes/:id/pagamentos", async (req, res) => {
    try {
      const { valor, descricao } = req.body;
      const clienteId = parseInt(req.params.id);

      const payment = await pixService.createPayment(
        clienteId,
        parseFloat(valor),
        descricao,
      );
      if (!payment) {
        return res.status(500).json({ error: "Erro ao criar pagamento" });
      }

      // Broadcast payment created event to all connected clients
      broadcastMessage("payment_created", {
        id: payment.id,
        clienteId: clienteId,
        payment: payment,
      });

      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar pagamento" });
    }
  });

  // Avisos de Vencimento Routes
  app.get("/api/clientes-vencimentos", async (req, res) => {
    try {
      const clientes = await storage.getClientes();
      // Filter only clients with expiry dates and exclude familia type
      const clientesComVencimento = clientes.filter(c => c.vencimento && c.tipo !== 'familia');
      res.json(clientesComVencimento);
    } catch (error) {
      console.error("Error in /api/clientes-vencimentos:", error);
      res.status(500).json({ error: "Erro ao buscar clientes com vencimentos" });
    }
  });

  app.get("/api/avisos/hoje", async (req, res) => {
    try {
      const avisos = await storage.getAvisosHoje();
      res.json(avisos);
    } catch (error) {
      console.error("Error in /api/avisos/hoje:", error);
      res.status(500).json({ error: "Erro ao buscar avisos de hoje" });
    }
  });

  app.get("/api/avisos/config", async (req, res) => {
    try {
      const config = await storage.getConfigAvisos();
      res.json(config);
    } catch (error) {
      console.error("Error in /api/avisos/config:", error);
      res.status(500).json({ error: "Erro ao buscar configuração de avisos" });
    }
  });

  app.put("/api/avisos/config", async (req, res) => {
    try {
      const config = await storage.updateConfigAvisos(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error in /api/avisos/config:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração de avisos" });
    }
  });

  app.post("/api/avisos/enviar", async (req, res) => {
    try {
      const { clienteId, telefone } = req.body;
      
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      // Check if already sent today
      const avisoExistente = await storage.getAvisoByClienteId(clienteId, new Date());
      if (avisoExistente) {
        return res.status(400).json({ error: "Aviso já enviado hoje para este cliente" });
      }

      // Get config for message template
      const config = await storage.getConfigAvisos();
      let mensagem = config?.mensagemPadrao || 'Olá {nome}! Seu plano vence hoje. Entre em contato para renovar.';
      mensagem = mensagem.replace('{nome}', cliente.nome);

      // Ensure phone number has country code (Brazil 55)
      let phoneNumber = telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      // Send WhatsApp message if connected
      if (whatsappService && whatsappService.isConnected()) {
        try {
          await whatsappService.sendMessage(phoneNumber, mensagem);
          
          // Record the sent notification
          const aviso = await storage.createAvisoVencimento({
            clienteId,
            telefone: phoneNumber,
            dataVencimento: cliente.vencimento || new Date(),
            tipoAviso: 'manual',
            statusEnvio: 'enviado',
            mensagemEnviada: mensagem
          });
          
          res.json({ success: true, aviso });
        } catch (whatsappError) {
          console.error("Erro ao enviar WhatsApp:", whatsappError);
          
          // Record failed notification
          const aviso = await storage.createAvisoVencimento({
            clienteId,
            telefone: phoneNumber,
            dataVencimento: cliente.vencimento || new Date(),
            tipoAviso: 'manual',
            statusEnvio: 'erro',
            mensagemErro: whatsappError.message
          });
          
          res.status(500).json({ error: "Erro ao enviar mensagem WhatsApp" });
        }
      } else {
        res.status(503).json({ error: "WhatsApp não conectado" });
      }
    } catch (error) {
      console.error("Error in /api/avisos/enviar:", error);
      res.status(500).json({ error: "Erro ao enviar aviso" });
    }
  });

  app.post("/api/avisos/verificar-vencimentos", async (req, res) => {
    try {
      const config = await storage.getConfigAvisos();
      if (!config?.ativo) {
        return res.json({ message: "Avisos automáticos desativados", avisosEnviados: 0 });
      }

      // Get all clients expiring today
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      
      const clientes = await storage.getClientes();
      const clientesVencendoHoje = clientes.filter(cliente => {
        if (!cliente.vencimento) return false;
        const vencimento = new Date(cliente.vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return vencimento.getTime() === hoje.getTime();
      });

      let avisosEnviados = 0;
      let mensagem = config.mensagemPadrao || 'Olá {nome}! Seu plano vence hoje.';

      for (const cliente of clientesVencendoHoje) {
        // Check if already notified today
        const avisoExistente = await storage.getAvisoByClienteId(cliente.id, new Date());
        if (avisoExistente) continue;

        const mensagemPersonalizada = mensagem.replace('{nome}', cliente.nome);

        // Ensure phone number has country code (Brazil 55)
        let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
        if (!phoneNumber.startsWith('55')) {
          phoneNumber = '55' + phoneNumber;
        }

        if (whatsappService && whatsappService.isConnected()) {
          try {
            await whatsappService.sendMessage(phoneNumber, mensagemPersonalizada);
            
            await storage.createAvisoVencimento({
              clienteId: cliente.id,
              telefone: phoneNumber,
              dataVencimento: cliente.vencimento,
              tipoAviso: 'automatico',
              statusEnvio: 'enviado',
              mensagemEnviada: mensagemPersonalizada
            });
            
            avisosEnviados++;
          } catch (error) {
            console.error(`Erro ao enviar aviso para ${cliente.nome}:`, error);
            
            await storage.createAvisoVencimento({
              clienteId: cliente.id,
              telefone: phoneNumber,
              dataVencimento: cliente.vencimento,
              tipoAviso: 'automatico',
              statusEnvio: 'erro',
              mensagemErro: error.message
            });
          }
        }
      }

      // Update last execution time
      await storage.updateConfigAvisos({ ultimaExecucao: new Date() });

      res.json({
        message: `${avisosEnviados} avisos enviados com sucesso`,
        avisosEnviados,
        totalVencendoHoje: clientesVencendoHoje.length
      });
    } catch (error) {
      console.error("Error in /api/avisos/verificar-vencimentos:", error);
      res.status(500).json({ error: "Erro ao verificar vencimentos" });
    }
  });

  // Conversas
  app.get("/api/conversas", async (req, res) => {
    try {
      const conversas = await storage.getConversas();
      res.json(conversas);
    } catch (error) {
      console.error("Error in /api/conversas:", error);
      res.status(500).json({ error: "Erro ao buscar conversas" });
    }
  });

  // Limpar conversas duplicadas
  app.post("/api/conversas/limpar-duplicadas", async (req, res) => {
    try {
      const totalMerged = await storage.mergeConversasDuplicadas();
      res.json({ 
        success: true, 
        message: `${totalMerged} conversas duplicadas foram mescladas com sucesso`,
        totalMerged 
      });
    } catch (error) {
      console.error("Error cleaning duplicate conversations:", error);
      res.status(500).json({ error: "Erro ao limpar conversas duplicadas" });
    }
  });

  app.get("/api/conversas/:id/mensagens", async (req, res) => {
    try {
      const mensagens = await storage.getMensagensByConversaId(
        parseInt(req.params.id),
      );
      res.json(mensagens);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  });

  // Delete conversation and its messages
  app.delete("/api/conversas/:id", async (req, res) => {
    try {
      const conversaId = parseInt(req.params.id);
      
      // Get conversation details before deleting
      const conversa = await storage.getConversaById(conversaId);
      if (!conversa) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }
      
      // Delete all messages from this conversation
      await storage.deleteMessagesByConversaId(conversaId);
      
      // Delete the conversation itself
      await storage.deleteConversa(conversaId);
      
      console.log(`Deleted conversation ${conversaId} and all its messages`);
      
      res.json({ success: true, message: "Conversa apagada com sucesso" });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Erro ao apagar conversa" });
    }
  });

  // API to clean duplicate conversations  
  app.post("/api/conversas/clean-duplicates", async (req, res) => {
    try {
      console.log("Starting duplicate conversations cleanup...");
      
      // Get all conversations
      const allConversas = await storage.getConversas();
      
      // Group conversations by phone number
      const conversasByPhone = new Map<string, typeof allConversas>();
      
      allConversas.forEach(conversa => {
        const phone = conversa.telefone;
        if (!conversasByPhone.has(phone)) {
          conversasByPhone.set(phone, []);
        }
        conversasByPhone.get(phone)!.push(conversa);
      });
      
      let duplicatesRemoved = 0;
      const duplicatesList: any[] = [];
      
      // Process each phone number
      for (const [phone, conversas] of conversasByPhone.entries()) {
        if (conversas.length > 1) {
          // Sort by ID descending (keep the newest one based on ID)
          conversas.sort((a, b) => b.id - a.id);
          
          // Keep the first (newest) conversation, delete the rest
          const toKeep = conversas[0];
          const toDelete = conversas.slice(1);
          
          console.log(`Found ${toDelete.length} duplicate conversations for ${phone}`);
          
          for (const conversa of toDelete) {
            // Check if this conversation has messages
            const messages = await storage.getMensagensByConversaId(conversa.id, 1, 0);
            
            duplicatesList.push({
              id: conversa.id,
              telefone: conversa.telefone,
              nome: conversa.nome,
              hasMessages: messages.length > 0,
              keptConversationId: toKeep.id
            });
            
            // Delete messages and conversation
            await storage.deleteMessagesByConversaId(conversa.id);
            await storage.deleteConversa(conversa.id);
            
            duplicatesRemoved++;
            console.log(`Deleted duplicate conversation ${conversa.id} for ${phone}`);
          }
        }
      }
      
      console.log(`Cleanup complete. Removed ${duplicatesRemoved} duplicate conversations`);
      
      res.json({
        success: true,
        message: `Limpeza concluída. ${duplicatesRemoved} conversas duplicadas removidas.`,
        duplicatesRemoved,
        details: duplicatesList
      });
    } catch (error) {
      console.error("Error cleaning duplicate conversations:", error);
      res.status(500).json({ error: "Erro ao limpar conversas duplicadas" });
    }
  });

  // Rota para buscar mensagens de teste
  app.get("/api/mensagens/conversa/teste/:telefone", async (req, res) => {
    try {
      const telefone = req.params.telefone.replace(/\D/g, '');
      
      // Buscar conversa para esse telefone
      const conversa = await storage.getConversaByTelefone(telefone);
      
      if (!conversa) {
        return res.json([]);
      }
      
      // Buscar mensagens dessa conversa
      const mensagens = await storage.getMensagensByConversaId(conversa.id);
      res.json(mensagens);
    } catch (error) {
      console.error("Erro ao buscar mensagens de teste:", error);
      res.status(500).json({ error: "Erro ao buscar mensagens de teste" });
    }
  });

  // Tickets
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error in /api/tickets:", error);
      res.status(500).json({ error: "Erro ao buscar tickets" });
    }
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const { titulo, descricao, prioridade, clienteId, telefone } = req.body;
      
      // Normalize phone number
      const normalizedTelefone = telefone.replace(/\D/g, '');
      
      // Find or create conversation for this phone number
      let conversa = await storage.getConversaByTelefone(normalizedTelefone);
      if (!conversa) {
        conversa = await storage.createConversa({
          telefone: normalizedTelefone,
          nome: normalizedTelefone,
          status: 'ativo',
          modoAtendimento: 'humano', // Set to human mode for new tickets
          mensagensNaoLidas: 0
        });
      } else {
        // Update existing conversation to human mode
        await storage.updateConversa(conversa.id, {
          modoAtendimento: 'humano'
        });
      }
      
      const ticket = await storage.createTicket({
        titulo,
        descricao,
        prioridade,
        clienteId: clienteId || null,
        conversaId: conversa.id,
        telefone: normalizedTelefone,
        status: 'aberto'
      });
      
      // Broadcast new ticket event to all connected clients
      broadcastMessage("ticket_created", {
        id: ticket.id,
        ticket: ticket,
      });
      
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ error: "Erro ao criar ticket" });
    }
  });

  app.put("/api/tickets/:id", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Cancel auto-close timer if ticket is being closed
      if (autoCloseTimers.has(ticketId)) {
        clearTimeout(autoCloseTimers.get(ticketId));
        autoCloseTimers.delete(ticketId);
      }
      
      const ticket = await storage.updateTicket(ticketId, {
        status,
        dataFechamento: status === "fechado" ? new Date() : null,
      });
      
      // If ticket is being closed, automatically switch conversation mode back to bot
      if (status === "fechado" && ticket.conversaId) {
        try {
          await storage.updateConversa(ticket.conversaId, {
            modoAtendimento: 'bot'
          });
          
          // Clear bot state when switching back to bot mode
          const conversa = await storage.getConversa(ticket.conversaId);
          if (conversa && whatsappService) {
            whatsappService.resetConversationState(conversa.telefone);
            console.log(`Bot state cleared for ${conversa.telefone} when ticket was closed`);
          }
          
          console.log(`Ticket #${ticket.id} fechado - Conversa ${ticket.conversaId} voltou para modo bot`);
        } catch (error) {
          console.error('Erro ao mudar modo da conversa após fechar ticket:', error);
          // Don't fail the ticket closing if mode change fails
        }
      }
      
      // Broadcast ticket update event to all connected clients
      broadcastMessage("ticket_updated", {
        id: ticket.id,
        ticket: ticket,
      });
      
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar ticket" });
    }
  });

  // Start auto-close timer for a ticket
  app.post("/api/tickets/:id/auto-close", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicket(ticketId);
      
      if (!ticket || ticket.status !== 'aberto') {
        return res.status(400).json({ error: "Ticket não encontrado ou já fechado" });
      }
      
      // Cancel existing timer if any
      if (autoCloseTimers.has(ticketId)) {
        clearTimeout(autoCloseTimers.get(ticketId));
      }
      
      // Set new timer for 5 minutes
      const timer = setTimeout(async () => {
        try {
          // Close the ticket
          await storage.updateTicket(ticketId, {
            status: 'fechado',
            dataFechamento: new Date(),
          });
          
          // Switch conversation back to bot mode
          if (ticket.conversaId) {
            await storage.updateConversa(ticket.conversaId, {
              modoAtendimento: 'bot'
            });
            
            const conversa = await storage.getConversa(ticket.conversaId);
            if (conversa && whatsappService) {
              whatsappService.resetConversationState(conversa.telefone);
            }
          }
          
          // Notify all connected clients via WebSocket
          const wsClients = wss.clients || [];
          wsClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'ticket_auto_closed',
                ticketId,
                conversaId: ticket.conversaId
              }));
            }
          });
          
          console.log(`Ticket #${ticketId} fechado automaticamente após 5 minutos`);
          autoCloseTimers.delete(ticketId);
        } catch (error) {
          console.error('Erro ao fechar ticket automaticamente:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      autoCloseTimers.set(ticketId, { timer, startTime: Date.now() });
      
      res.json({ 
        success: true, 
        message: "Timer de fechamento automático iniciado",
        ticketId,
        timeoutMinutes: 5
      });
    } catch (error) {
      console.error("Error starting auto-close timer:", error);
      res.status(500).json({ error: "Erro ao iniciar timer de fechamento automático" });
    }
  });
  
  // Cancel auto-close timer for a ticket
  app.delete("/api/tickets/:id/auto-close", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      if (autoCloseTimers.has(ticketId)) {
        const timerData = autoCloseTimers.get(ticketId)!;
        clearTimeout(timerData.timer);
        autoCloseTimers.delete(ticketId);
        
        res.json({ 
          success: true, 
          message: "Timer de fechamento automático cancelado",
          ticketId
        });
      } else {
        res.json({ 
          success: false, 
          message: "Nenhum timer ativo para este ticket",
          ticketId
        });
      }
    } catch (error) {
      console.error("Error canceling auto-close timer:", error);
      res.status(500).json({ error: "Erro ao cancelar timer de fechamento automático" });
    }
  });
  
  // Internal endpoint to cancel auto-close timer (called from WhatsApp service)
  app.post("/api/tickets/:id/cancel-auto-close-internal", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      if (autoCloseTimers.has(ticketId)) {
        const timerData = autoCloseTimers.get(ticketId)!;
        clearTimeout(timerData.timer);
        autoCloseTimers.delete(ticketId);
        console.log(`Timer de auto-fechamento cancelado para ticket #${ticketId} (mensagem do cliente)`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error canceling auto-close timer internally:", error);
      res.status(500).json({ error: "Internal error" });
    }
  });
  
  // Check if auto-close timer is active for a ticket
  app.get("/api/tickets/:id/auto-close-status", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const isActive = autoCloseTimers.has(ticketId);
      let remainingSeconds = 0;
      
      if (isActive) {
        const timerData = autoCloseTimers.get(ticketId)!;
        const elapsed = Date.now() - timerData.startTime;
        const totalTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const remaining = totalTime - elapsed;
        remainingSeconds = Math.max(0, Math.floor(remaining / 1000));
      }
      
      res.json({ 
        active: isActive,
        ticketId,
        remainingSeconds
      });
    } catch (error) {
      console.error("Error checking auto-close status:", error);
      res.status(500).json({ error: "Erro ao verificar status do timer" });
    }
  });

  // Bot Config
  app.get("/api/bot-config", async (req, res) => {
    try {
      const configs = await storage.getBotConfig();
      res.json(configs);
    } catch (error) {
      console.error("Erro ao buscar bot-config:", error);
      res
        .status(500)
        .json({
          error: "Erro ao buscar configurações do bot",
          details: error.message,
        });
    }
  });

  app.post("/api/bot-config", async (req, res) => {
    try {
      const configData = insertBotConfigSchema.parse(req.body);
      const config = await storage.createBotConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao criar configuração do bot" });
    }
  });

  app.put("/api/bot-config/:id", async (req, res) => {
    try {
      const configData = insertBotConfigSchema.partial().parse(req.body);
      const config = await storage.updateBotConfig(
        parseInt(req.params.id),
        configData,
      );
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao atualizar configuração do bot" });
    }
  });

  // Notificações Config
  app.get("/api/notificacoes-config", async (req, res) => {
    try {
      const configs = await storage.getNotificacoesConfig();
      res.json(configs);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Erro ao buscar configurações de notificações" });
    }
  });

  app.post("/api/notificacoes-config", async (req, res) => {
    try {
      const configData = insertNotificacaoConfigSchema.parse(req.body);
      const config = await storage.createNotificacaoConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res
        .status(500)
        .json({ error: "Erro ao criar configuração de notificação" });
    }
  });

  app.put("/api/notificacoes-config/:id", async (req, res) => {
    try {
      const configData = insertNotificacaoConfigSchema
        .partial()
        .parse(req.body);
      const config = await storage.updateNotificacaoConfig(
        parseInt(req.params.id),
        configData,
      );
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res
        .status(500)
        .json({ error: "Erro ao atualizar configuração de notificação" });
    }
  });

  // Integrações
  app.get("/api/integracoes", async (req, res) => {
    try {
      const integracoes = await storage.getIntegracoes();
      res.json(integracoes);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar integrações" });
    }
  });

  app.post("/api/integracoes", async (req, res) => {
    try {
      const integracaoData = insertIntegracaoSchema.parse(req.body);
      const integracao = await storage.createIntegracao(integracaoData);
      res.status(201).json(integracao);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao criar integração" });
    }
  });

  app.put("/api/integracoes/:id", async (req, res) => {
    try {
      const integracaoData = insertIntegracaoSchema.partial().parse(req.body);
      const integracao = await storage.updateIntegracao(
        parseInt(req.params.id),
        integracaoData,
      );
      res.json(integracao);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao atualizar integração" });
    }
  });

  // WhatsApp
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const status = whatsappService.getConnectionState();
      const qr = whatsappService.getQRCode();
      const userProfile = await whatsappService.getCurrentUserProfile();
      res.json({ status, qr, userProfile });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar status do WhatsApp" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      await whatsappService.disconnect();
      res.json({ message: "WhatsApp desconectado" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao desconectar WhatsApp" });
    }
  });

  // Clear WhatsApp session forcefully
  app.post("/api/whatsapp/clear-session", async (req, res) => {
    try {
      // First disconnect if connected
      if (whatsappService.isConnected()) {
        await whatsappService.disconnect();
      }

      // Clear auth files
      const fs = await import("fs/promises");
      const path = await import("path");
      const authDir = "./auth_info_baileys";

      try {
        await fs.access(authDir);
        const files = await fs.readdir(authDir);
        for (const file of files) {
          await fs.unlink(path.join(authDir, file));
        }
        console.log("Sessão do WhatsApp limpa manualmente");
      } catch (error) {
        console.log("Diretório de autenticação não existe ou já está vazio");
      }

      res.json({ message: "Sessão limpa com sucesso" });
    } catch (error) {
      console.error("Erro ao limpar sessão:", error);
      res.status(500).json({ error: "Erro ao limpar sessão" });
    }
  });

  // Connect WhatsApp
  app.post("/api/whatsapp/connect", async (req, res) => {
    try {
      await whatsappService.initialize();
      res.json({ message: "Iniciando conexão WhatsApp" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao conectar WhatsApp" });
    }
  });

  // Request pairing code for phone number authentication
  app.post("/api/whatsapp/request-pairing-code", async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res
          .status(400)
          .json({ error: "Número de telefone é obrigatório" });
      }

      // Format phone number
      const formattedNumber = phoneNumber.replace(/\D/g, "");
      const pairingCode =
        await whatsappService.requestPairingCode(formattedNumber);

      res.json({
        message: "Código de pareamento solicitado",
        phoneNumber: formattedNumber,
      });
    } catch (error) {
      console.error("Erro ao solicitar código de pareamento:", error);
      res.status(500).json({ error: "Erro ao solicitar código de pareamento" });
    }
  });

  // Connect using pairing code
  app.post("/api/whatsapp/connect-pairing", async (req, res) => {
    try {
      const { phoneNumber, pairingCode } = req.body;

      if (!phoneNumber || !pairingCode) {
        return res
          .status(400)
          .json({ error: "Número de telefone e código são obrigatórios" });
      }

      // Format phone number and pairing code
      const formattedNumber = phoneNumber.replace(/\D/g, "");
      const formattedCode = pairingCode.replace(/\D/g, "");

      await whatsappService.connectWithPairingCode(
        formattedNumber,
        formattedCode,
      );

      res.json({
        message: "Conectando com código de pareamento",
        phoneNumber: formattedNumber,
      });
    } catch (error) {
      console.error("Erro ao conectar com código de pareamento:", error);
      res
        .status(500)
        .json({ error: "Erro ao conectar com código de pareamento" });
    }
  });

  // Send WhatsApp message
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { to, message } = req.body;
      console.log(`Sending message to ${to}: ${message}`);

      // First check if conversation exists
      let conversa = await storage.getConversaByTelefone(to);

      // If conversation doesn't exist, create it
      if (!conversa) {
        console.log("Creating new conversation for:", to);

        // Check if it's a client
        const cliente = await storage.getClienteByTelefone(to);

        // Create conversation
        conversa = await storage.createConversa({
          telefone: to,
          nome: cliente?.nome || formatPhoneNumber(to),
          ultimaMensagem: message,
          status: "ativo",
          modoAtendimento: "bot", // Default to bot mode
          mensagensNaoLidas: 0,
          ultimoRemetente: "sistema",
          mensagemLida: true,
          clienteId: cliente?.id || null,
          tipoUltimaMensagem: "text",
          dataUltimaMensagem: new Date(), // Set timestamp when creating conversation
        });

        // Send WebSocket event for new conversation
        broadcastMessage("conversation_created", {
          conversaId: conversa.id,
          conversa: conversa,
        });
      }

      // Now send the message
      const messageId = await whatsappService.sendMessage(to, message);

      if (messageId) {
        // Save message to database
        await storage.createMensagem({
          conversaId: conversa!.id,
          conteudo: message,
          remetente: "sistema",
          timestamp: new Date(),
          lida: true,
          tipo: "text",
          whatsappMessageId: messageId,
        });

        // Update conversation timestamp and last message
        await storage.updateConversa(conversa!.id, {
          ultimaMensagem: message,
          dataUltimaMensagem: new Date(),
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: "text",
        });

        res.json({
          success: true,
          message: "Mensagem enviada",
          conversaId: conversa!.id,
        });
      } else {
        res
          .status(400)
          .json({ success: false, error: "Falha ao enviar mensagem" });
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage = error.message || "Erro ao enviar mensagem";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Test menu message endpoint
  app.post("/api/whatsapp/test-menu", async (req, res) => {
    try {
      const telefone = "5514991949280";

      // Send test menu as text (buttons were deprecated by WhatsApp in 2022)
      const menuMessage = `👋 *Olá Carlos Oliveira!*


📅 Vencimento: 14/11/2025
💰 Valor: R$ 49.90

Como posso ajudar você hoje?

1 - 📅 Ver Vencimento
2 - 💳 Segunda Via  
3 - 🛠️ Suporte/Atendimento

*Digite o número da opção desejada*`;

      const messageId = await whatsappService.sendMessage(
        telefone,
        menuMessage,
      );

      res.json({
        success: true,
        messageId,
        message: "Menu enviado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao enviar menu de teste:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset bot conversation state endpoint
  app.post("/api/whatsapp/reset-bot-state", async (req, res) => {
    try {
      const { telefone } = req.body;
      if (!telefone) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      // Reset the conversation state
      whatsappService.resetConversationState(telefone);

      // Send confirmation message
      await whatsappService.sendMessage(
        telefone,
        `✅ Estado do bot foi resetado com sucesso!\n\nDigite qualquer coisa para recomeçar.`,
      );

      res.json({ success: true, message: "Estado resetado com sucesso" });
    } catch (error) {
      console.error("Erro ao resetar estado do bot:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test bot message endpoint
  app.post("/api/whatsapp/test-bot", async (req, res) => {
    try {
      const { telefone } = req.body;
      if (!telefone) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      // Force bot to send menu
      const conversa = await storage.getConversaByTelefone(telefone);
      if (!conversa) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      // Get bot configuration
      const cliente = await storage.getClienteByTelefone(telefone);
      const teste = await storage.getTesteAtivoByTelefone(telefone);

      let tipoBot = "novos";
      if (teste) {
        tipoBot = "testes";
      } else if (cliente) {
        tipoBot = "clientes";
      }

      const botConfig = await storage.getBotConfigByTipo(tipoBot);
      if (!botConfig || !botConfig.ativo) {
        return res.status(400).json({ error: `Bot ${tipoBot} não está ativo` });
      }

      // Process and send welcome message
      const processedMessage = await whatsappService.processVariables(
        botConfig.mensagemBoasVindas,
        telefone,
      );
      const result = await whatsappService.sendMessage(
        telefone,
        processedMessage,
      );

      if (result) {
        // Also send the menu options
        await whatsappService.sendBotMenu(telefone, botConfig);
        res.json({
          success: true,
          messageId: result,
          tipoBot,
          message: processedMessage,
        });
      } else {
        res.status(500).json({ error: "Falha ao enviar mensagem do bot" });
      }
    } catch (error) {
      console.error("Erro no teste do bot:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Simulate message endpoint for testing bot flow
  app.post("/api/whatsapp/simulate-message", async (req, res) => {
    try {
      const { telefone, mensagem } = req.body;
      if (!telefone || !mensagem) {
        return res.status(400).json({ error: "Telefone e mensagem são obrigatórios" });
      }
      
      // Call the public simulateMessage method
      await whatsappService.simulateMessage(telefone, mensagem);
      
      res.json({ 
        success: true, 
        message: "Mensagem simulada processada",
        telefone,
        mensagem 
      });
    } catch (error) {
      console.error("Erro ao simular mensagem:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all WhatsApp conversations with client status
  app.get("/api/whatsapp/conversations", async (req, res) => {
    try {
      const conversas = await storage.getConversas();
      console.log("Conversas do banco:", conversas);

      // Enrich conversations with client info and fix null messages
      const conversasEnriquecidas = await Promise.all(
        conversas.map(async (conversa) => {
          const cliente = await storage.getClienteByTelefone(conversa.telefone);

          // Check if this phone number has a test (active or inactive)
          const cleanPhone = conversa.telefone.replace(/^55/, ""); // Remove country code
          const testes = await storage.getTestes();
          const isTeste = testes.some((teste) => teste.telefone === cleanPhone);

          // If ultimaMensagem is null, try to get the last message
          let ultimaMensagem = conversa.ultimaMensagem;
          let tipoUltimaMensagem = conversa.tipoUltimaMensagem;

          if (!ultimaMensagem) {
            const messages = await storage.getMensagensByConversaId(
              conversa.id,
              1,
              0,
            );
            if (messages.length > 0) {
              ultimaMensagem = messages[0].conteudo;
              tipoUltimaMensagem = messages[0].tipo;
              // Update the conversation in the database
              await storage.updateConversa(conversa.id, {
                ultimaMensagem: ultimaMensagem,
                tipoUltimaMensagem: tipoUltimaMensagem,
                dataUltimaMensagem: messages[0].timestamp,
              });
            }
          }

          return {
            ...conversa,
            ultimaMensagem: ultimaMensagem,
            tipoUltimaMensagem: tipoUltimaMensagem,
            isCliente: !!cliente,
            isTeste: isTeste,
            clienteId: cliente?.id || null,
            clienteNome: cliente?.nome || null,
            clienteStatus: cliente?.status || null,
          };
        }),
      );

      console.log("Conversas enriquecidas:", conversasEnriquecidas);
      res.json(conversasEnriquecidas);
    } catch (error) {
      console.error("Error in /api/whatsapp/conversations:", error);
      res.status(500).json({ error: "Erro ao buscar conversas" });
    }
  });

  // Debug endpoint to count messages
  app.get(
    "/api/whatsapp/conversations/:id/messages/count",
    async (req, res) => {
      try {
        const { id } = req.params;
        const total = await storage.countMensagensByConversaId(parseInt(id));
        res.json({ total });
      } catch (error) {
        res.status(500).json({ error: "Erro ao contar mensagens" });
      }
    },
  );

  // Get messages for a conversation
  app.get("/api/whatsapp/conversations/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      console.log(
        `Fetching messages for conversation ${id} with limit=${limit} offset=${offset}`,
      );

      const messages = await storage.getMensagensByConversaId(
        parseInt(id),
        parseInt(limit as string),
        parseInt(offset as string),
      );

      // Ensure messages is always an array
      const messagesArray = messages || [];

      console.log(`Retrieved ${messagesArray.length} messages from database`);

      // Reverse messages to show oldest first (since we fetch newest first from DB)
      const reversedMessages = messagesArray.reverse();

      res.json(reversedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  });

  // Mark messages as read
  app.post("/api/whatsapp/conversations/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const conversaId = parseInt(id);

      console.log(`=== MARKING CONVERSATION ${conversaId} AS READ ===`);

      // Get conversation details
      const conversa = await storage.getConversaById(conversaId);
      if (!conversa) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      console.log(
        `Conversation found: ${conversa.telefone}, unread count: ${conversa.mensagensNaoLidas}`,
      );

      // Get unread messages from this conversation
      const unreadMessages = await storage.getMensagensByConversaId(
        conversaId,
        100,
        0,
      );
      console.log(`Total messages retrieved: ${unreadMessages.length}`);

      const unreadClientMessages = unreadMessages.filter(
        (msg) =>
          msg.remetente === "cliente" && !msg.lida && msg.whatsappMessageId,
      );

      console.log(
        `Found ${unreadClientMessages.length} unread client messages to mark as read`,
      );
      console.log(
        "Unread messages details:",
        unreadClientMessages.map((m) => ({
          id: m.id,
          whatsappId: m.whatsappMessageId,
          lida: m.lida,
          conteudo: m.conteudo.substring(0, 20) + "...",
        })),
      );

      // Mark all messages as read in database
      await storage.markConversationMessagesAsRead(conversaId);

      // Reset unread count
      await storage.updateConversa(conversaId, {
        mensagensNaoLidas: 0,
      });

      // If WhatsApp is connected and sendReadReceipts is enabled, send read receipts
      // This runs when user opens a conversation (not automatic)
      if (whatsappService && whatsappService.isConnected()) {
        const settings = await storage.getWhatsAppSettings();
        console.log("Manual read settings:", {
          sendReadReceipts: settings?.sendReadReceipts,
          markMessagesRead: settings?.markMessagesRead,
          shouldSendReadReceipts: settings?.sendReadReceipts,
        });

        if (settings?.sendReadReceipts) {
          const remoteJid = conversa.telefone.includes("@")
            ? conversa.telefone
            : conversa.telefone + "@s.whatsapp.net";

          for (const message of unreadClientMessages) {
            try {
              await whatsappService.markMessageAsRead(
                remoteJid,
                message.whatsappMessageId,
              );
              console.log(
                `Manually marked message ${message.whatsappMessageId} as read on WhatsApp (user opened conversation)`,
              );
            } catch (error) {
              console.error(
                `Failed to mark message ${message.whatsappMessageId} as read:`,
                error,
              );
            }
          }
        } else {
          console.log(
            "Send read receipts disabled - not sending read confirmations to WhatsApp",
          );
        }
      }

      res.json({ success: true, markedCount: unreadClientMessages.length });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Erro ao marcar como lido" });
    }
  });

  // Update contact names from WhatsApp
  app.post("/api/whatsapp/update-contact-names", async (req, res) => {
    try {
      const conversations = await storage.getConversas();
      let updated = 0;

      for (const conversa of conversations) {
        // Skip if already has a name different from phone number
        if (conversa.nome && conversa.nome !== conversa.telefone) {
          continue;
        }

        // Try to get name from WhatsApp
        const contactName = await whatsappService.getContactName(
          conversa.telefone,
        );
        if (contactName) {
          await storage.updateConversa(conversa.id, { nome: contactName });
          updated++;
          console.log(
            `Updated contact name for ${conversa.telefone}: ${contactName}`,
          );
        }
      }

      res.json({ success: true, updated });
    } catch (error) {
      console.error("Error updating contact names:", error);
      res.status(500).json({ error: "Failed to update contact names" });
    }
  });

  // Fix conversations with null ultimaMensagem
  app.post("/api/whatsapp/fix-null-messages", async (req, res) => {
    try {
      const { fixMediaMessages } = await import("./routes/fix-media-messages");
      const fixed = await fixMediaMessages(storage);
      res.json({ success: true, fixed });
    } catch (error) {
      console.error("Error fixing conversations:", error);
      res.status(500).json({ error: "Failed to fix conversations" });
    }
  });

  // WhatsApp settings endpoints
  app.get("/api/whatsapp/settings", async (req, res) => {
    try {
      const settings = await storage.getWhatsAppSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting WhatsApp settings:", error);
      res.status(500).json({ error: "Failed to get WhatsApp settings" });
    }
  });

  app.patch("/api/whatsapp/settings", async (req, res) => {
    try {
      console.log("Received settings update:", req.body);
      console.log("Request headers:", req.headers);

      const settings = await storage.updateWhatsAppSettings(req.body);
      console.log("Settings saved to database:", settings);

      // Apply settings to WhatsApp service
      if (whatsappService.applySettings) {
        whatsappService.applySettings(settings);
      }

      res.json(settings);
    } catch (error) {
      console.error("Error updating WhatsApp settings:", error);
      console.error("Error details:", error.message, error.stack);
      res
        .status(500)
        .json({
          error: "Failed to update WhatsApp settings",
          details: error.message,
        });
    }
  });

  // Mensagens Rápidas (Quick Messages) Routes
  app.get("/api/mensagens-rapidas", async (req, res) => {
    try {
      const mensagens = await storage.getMensagensRapidas();
      res.json(mensagens);
    } catch (error) {
      console.error("Erro ao buscar mensagens rápidas:", error);
      res.status(500).json({ error: "Falha ao buscar mensagens rápidas" });
    }
  });

  app.get("/api/mensagens-rapidas/ativas", async (req, res) => {
    try {
      const mensagens = await storage.getMensagensRapidasAtivas();
      res.json(mensagens);
    } catch (error) {
      console.error("Erro ao buscar mensagens rápidas ativas:", error);
      res.status(500).json({ error: "Falha ao buscar mensagens rápidas ativas" });
    }
  });

  app.get("/api/mensagens-rapidas/:id", async (req, res) => {
    try {
      const mensagem = await storage.getMensagemRapidaById(parseInt(req.params.id));
      if (!mensagem) {
        return res.status(404).json({ error: "Mensagem rápida não encontrada" });
      }
      res.json(mensagem);
    } catch (error) {
      console.error("Erro ao buscar mensagem rápida:", error);
      res.status(500).json({ error: "Falha ao buscar mensagem rápida" });
    }
  });

  app.post("/api/mensagens-rapidas", async (req, res) => {
    try {
      const mensagem = await storage.createMensagemRapida(req.body);
      res.json(mensagem);
    } catch (error) {
      console.error("Erro ao criar mensagem rápida:", error);
      res.status(500).json({ error: "Falha ao criar mensagem rápida" });
    }
  });

  app.put("/api/mensagens-rapidas/:id", async (req, res) => {
    try {
      const mensagem = await storage.updateMensagemRapida(parseInt(req.params.id), req.body);
      res.json(mensagem);
    } catch (error) {
      console.error("Erro ao atualizar mensagem rápida:", error);
      res.status(500).json({ error: "Falha ao atualizar mensagem rápida" });
    }
  });

  app.delete("/api/mensagens-rapidas/:id", async (req, res) => {
    try {
      await storage.deleteMensagemRapida(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao deletar mensagem rápida:", error);
      res.status(500).json({ error: "Falha ao deletar mensagem rápida" });
    }
  });

  app.post(
    "/api/whatsapp/profile-picture",
    profilePictureUpload.single("profilePicture"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Create URL path for the uploaded file
        const fileUrl = `/uploads/${req.file.filename}`;

        // Update WhatsApp profile picture
        const result = await whatsappService.updateProfilePicture(
          req.file.path,
        );

        // Save URL to settings
        await storage.updateWhatsAppSettings({ profilePicture: fileUrl });

        res.json({ success: true, url: fileUrl });
      } catch (error) {
        console.error("Error updating profile picture:", error);
        res.status(500).json({ error: "Failed to update profile picture" });
      }
    },
  );

  // Check if phone number has WhatsApp
  app.post("/api/whatsapp/check-number", async (req, res) => {
    const { telefone } = req.body;

    if (!whatsappService || !whatsappService.isConnected()) {
      // If WhatsApp is not connected, assume the number exists to not block users
      console.log(
        "WhatsApp não conectado, permitindo continuar com número:",
        telefone,
      );
      return res.json({
        exists: true,
        warning: "WhatsApp não conectado, assumindo número válido",
      });
    }

    try {
      const exists = await whatsappService.checkIfNumberExists(telefone);
      console.log(
        `Verificação do número ${telefone}: ${exists ? "existe" : "não existe"}`,
      );
      res.json({ exists });
    } catch (error) {
      console.error("Erro ao verificar número:", error);
      // In case of error, assume the number exists to not block valid numbers
      res.json({
        exists: true,
        warning: "Erro na verificação, permitindo continuar",
      });
    }
  });

  // Testes API endpoints
  app.get("/api/testes", async (req, res) => {
    try {
      const { status } = req.query;
      let testes;

      if (status === "ativo") {
        testes = await storage.getTestesAtivos();
      } else if (status === "expirado") {
        testes = await storage.getTestesExpirados();
      } else if (status === "deletado") {
        testes = await storage.getTestesDeletados();
      } else {
        testes = await storage.getTestes();
      }

      res.json(testes);
    } catch (error) {
      console.error("Error getting tests:", error);
      res.status(500).json({ error: "Erro ao buscar testes" });
    }
  });

  app.get("/api/testes/:id", async (req, res) => {
    try {
      const teste = await storage.getTesteById(parseInt(req.params.id));
      if (!teste) {
        return res.status(404).json({ error: "Teste não encontrado" });
      }
      res.json(teste);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar teste" });
    }
  });

  app.get("/api/testes/by-phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const testes = await storage.getTestes();

      // Try to find test with exact match or with country code
      const teste = testes.find((t) => {
        const phoneClean = phone.replace(/\D/g, "");
        const testPhoneClean = t.telefone.replace(/\D/g, "");
        return (
          testPhoneClean === phoneClean ||
          testPhoneClean === `55${phoneClean}` ||
          `55${testPhoneClean}` === phoneClean
        );
      });

      if (!teste) {
        return res.status(404).json({ error: "Teste não encontrado" });
      }

      res.json(teste);
    } catch (error) {
      console.error("Error fetching teste by phone:", error);
      res.status(500).json({ error: "Failed to fetch teste" });
    }
  });

  app.post("/api/testes", async (req, res) => {
    try {
      console.log("Dados recebidos para criar teste:", req.body);

      const apiUsername = `teste_${nanoid(8)}`;
      const apiPassword = `pass_${nanoid(8)}`;

      // Ensure duracaoHoras is a number
      const duracaoHoras = Number(req.body.duracaoHoras);

      const testeData = {
        ...req.body,
        duracaoHoras,
        apiUsername,
        apiPassword,
        expiraEm: new Date(Date.now() + duracaoHoras * 60 * 60 * 1000),
      };

      // Use system from request or get the first available
      let sistemaId = req.body.sistemaId;
      let sistema;

      if (!sistemaId) {
        const sistemas = await storage.getSistemas();
        if (!sistemas || sistemas.length === 0) {
          return res
            .status(400)
            .json({ error: "Nenhum sistema disponível para criar teste" });
        }
        sistema = sistemas[0];
        sistemaId = sistema.id;
      } else {
        // Get the sistema to have access to systemId field
        sistema = await storage.getSistemaById(sistemaId);
        if (!sistema) {
          return res.status(400).json({ error: "Sistema não encontrado" });
        }
      }

      testeData.sistemaId = sistemaId;

      // Create test in database
      const teste = await storage.createTeste(testeData);

      // Create user in external API
      try {
        // Convert expiraEm to Unix timestamp
        const expTimestamp = Math.floor(teste.expiraEm.getTime() / 1000);

        const externalUser = await externalApiService.createUser({
          username: teste.apiUsername,
          password: teste.apiPassword,
          exp_date: expTimestamp.toString(),
          system: parseInt(sistema.systemId), // Use systemId field which is the API system_id
          device_limit: 1,
          device_mac: teste.mac,
          device_key: teste.deviceKey,
          device_model: teste.dispositivo,
          app_name: teste.aplicativo,
          user_type: "test",
          is_active: true,
        });

        // Update test with API user ID
        await storage.updateTeste(teste.id, { apiUserId: externalUser.id });
        teste.apiUserId = externalUser.id;
      } catch (apiError) {
        console.error("Error creating user in external API:", apiError);
        // Delete test if API creation fails
        await storage.deleteTeste(teste.id);
        throw apiError;
      }

      // Broadcast new test event to all connected clients
      broadcastMessage("test_created", {
        id: teste.id,
        teste: teste,
      });

      res.status(201).json(teste);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Erro de validação:", error.errors);
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("Error creating test:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Erro ao criar teste" });
    }
  });

  app.patch("/api/testes/:id", async (req, res) => {
    try {
      const testeId = parseInt(req.params.id);
      const teste = await storage.getTesteById(testeId);

      if (!teste) {
        return res.status(404).json({ error: "Teste não encontrado" });
      }

      const {
        macAddress,
        deviceKey,
        aplicativo,
        dispositivo,
        sistemaId,
        horasAdicionar,
        expiraEm,
      } = req.body;

      console.log("PATCH request body:", req.body);

      // Prepare update data
      const updateData: any = {};

      if (macAddress !== undefined) updateData.mac = macAddress;
      if (deviceKey !== undefined) updateData.deviceKey = deviceKey;
      if (aplicativo !== undefined) updateData.aplicativo = aplicativo;
      if (dispositivo !== undefined) updateData.dispositivo = dispositivo;
      if (sistemaId !== undefined) updateData.sistemaId = parseInt(sistemaId);

      // Handle direct expiration date update
      if (expiraEm !== undefined) {
        const newExpiration = new Date(expiraEm);
        const currentExpiration = new Date(teste.expiraEm);
        
        // Calculate duration in hours from creation to new expiration
        const criadoEm = new Date(teste.criadoEm);
        const durationMs = newExpiration.getTime() - criadoEm.getTime();
        const durationHours = Math.round(durationMs / (1000 * 60 * 60));
        
        updateData.expiraEm = newExpiration;
        updateData.duracaoHoras = durationHours;
      }
      // Handle adding hours - add to current expiration time
      else if (horasAdicionar && parseInt(horasAdicionar) > 0) {
        const currentExpiration = new Date(teste.expiraEm);
        const additionalMs = parseInt(horasAdicionar) * 60 * 60 * 1000;
        const newExpiration = new Date(
          currentExpiration.getTime() + additionalMs,
        );
        updateData.expiraEm = newExpiration;
        updateData.duracaoHoras = teste.duracaoHoras + parseInt(horasAdicionar);
      }

      console.log("Update data prepared:", updateData);
      console.log("Update data keys:", Object.keys(updateData));

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Nenhum dado para atualizar" });
      }

      // Update in database
      const updatedTeste = await storage.updateTeste(testeId, updateData);

      // Sync with external API if test has API user ID
      if (teste.apiUserId && teste.sistemaId) {
        try {
          let sistema = await storage.getSistemaById(
            updateData.sistemaId || teste.sistemaId,
          );

          if (sistema) {
            const apiUpdateData: any = {};

            if (updateData.expiraEm) {
              apiUpdateData.exp_date = Math.floor(
                updateData.expiraEm.getTime() / 1000,
              ).toString();
            }
            if (updateData.mac !== undefined) {
              apiUpdateData.device_mac = updateData.mac;
            }
            if (updateData.deviceKey !== undefined) {
              apiUpdateData.device_key = updateData.deviceKey;
            }
            if (updateData.aplicativo !== undefined) {
              apiUpdateData.app_name = updateData.aplicativo;
            }
            if (updateData.dispositivo !== undefined) {
              apiUpdateData.device_type = updateData.dispositivo;
            }
            if (updateData.sistemaId !== undefined) {
              apiUpdateData.system = parseInt(sistema.systemId);
            }

            console.log(
              "Updating test user in external API:",
              teste.apiUserId,
              apiUpdateData,
            );
            await externalApiService.updateUser(teste.apiUserId, apiUpdateData);
          }
        } catch (apiError) {
          console.error("Error updating test user in external API:", apiError);
          // Continue even if API update fails
        }
      }

      // Broadcast test update event to all connected clients
      broadcastMessage("test_updated", {
        id: updatedTeste.id,
        teste: updatedTeste,
      });

      res.json(updatedTeste);
    } catch (error) {
      console.error("Error updating test:", error);
      res.status(500).json({ error: "Erro ao atualizar teste" });
    }
  });

  app.delete("/api/testes/:id", async (req, res) => {
    try {
      const teste = await storage.getTesteById(parseInt(req.params.id));
      if (!teste) {
        return res.status(404).json({ error: "Teste não encontrado" });
      }

      // Delete from external API if has API user ID
      if (teste.apiUserId) {
        try {
          await externalApiService.deleteUser(teste.apiUserId);
        } catch (apiError) {
          console.error("Error deleting user from external API:", apiError);
        }
      }

      // Mark as deleted instead of removing from database
      await storage.updateTeste(teste.id, { status: "deletado" });
      
      // Broadcast test delete event to all connected clients
      broadcastMessage("test_deleted", {
        id: teste.id,
      });
      
      res.json({ message: "Teste deletado com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar teste" });
    }
  });

  app.post("/api/testes/cleanup", async (req, res) => {
    try {
      // Get all expired tests that are still active
      const expiredTestes = await storage.getTestesExpirados();
      let deletedCount = 0;

      for (const teste of expiredTestes) {
        if (teste.apiUserId && teste.status === "ativo") {
          try {
            await externalApiService.deleteUser(teste.apiUserId);
            // Mark as deleted instead of expired
            await storage.updateTeste(teste.id, { status: "deletado" });
            deletedCount++;
          } catch (apiError) {
            console.error(
              `Error deleting user ${teste.apiUserId} from API:`,
              apiError,
            );
            // Still mark as expired if API deletion fails
            await storage.updateTeste(teste.id, { status: "expirado" });
          }
        }
      }

      // Broadcast cleanup event to all connected clients
      if (deletedCount > 0) {
        broadcastMessage("tests_cleanup", {
          deletedCount,
          totalExpired: expiredTestes.length,
        });
      }
      
      res.json({
        message: `${deletedCount} testes expirados movidos para deletados`,
        totalExpired: expiredTestes.length,
      });
    } catch (error) {
      console.error("Error cleaning up tests:", error);
      res.status(500).json({ error: "Erro ao limpar testes" });
    }
  });

  app.get("/api/testes/m3u/:id", async (req, res) => {
    try {
      const teste = await storage.getTesteById(parseInt(req.params.id));
      if (!teste) {
        return res.status(404).json({ error: "Teste não encontrado" });
      }

      // Get redirect URL
      const redirectUrls = await storage.getRedirectUrls();
      const principalUrl = redirectUrls.find((url) => url.isPrincipal);

      if (!principalUrl) {
        return res
          .status(500)
          .json({ error: "URL de redirecionamento não configurada" });
      }

      const m3uLink = `http://tvonbr.fun/get.php?username=${teste.apiUsername}&password=${teste.apiPassword}&type=m3u_plus&output=hls`;
      res.json({ m3uLink });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar link M3U" });
    }
  });

  // API Externa
  app.post("/api/external-api/config", async (req, res) => {
    try {
      const { baseUrl, apiKey } = req.body;
      await externalApiService.updateConfig(baseUrl, apiKey);
      res.json({ message: "Configuração atualizada" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
  });

  app.post("/api/external-api/test", async (req, res) => {
    try {
      const isConnected = await externalApiService.testConnection();
      res.json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ error: "Erro ao testar conexão" });
    }
  });

  // PIX Woovi
  app.post("/api/pix/config", async (req, res) => {
    try {
      const { appId, correlationID, webhook } = req.body;
      await pixService.updateConfig(appId, correlationID, webhook);
      res.json({ message: "Configuração Woovi PIX atualizada" });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Erro ao atualizar configuração Woovi PIX" });
    }
  });

  // Obter configuração PIX
  app.get("/api/pix/config", async (req, res) => {
    try {
      const config = await storage.getIntegracaoByTipo("pix");
      if (config && config.configuracoes) {
        res.json(config.configuracoes);
      } else {
        res.json({ expiresIn: 86400 }); // 24h padrão
      }
    } catch (error) {
      console.error("Erro ao obter configuração PIX:", error);
      res.status(500).json({ error: "Erro ao obter configuração" });
    }
  });

  // Configuração PIX para Woovi (com authorization para webhook)
  app.post("/api/pix/configure", async (req, res) => {
    try {
      const { appId, correlationID, authorization, expiresIn } = req.body;

      // Salvar configuração no banco
      const existingConfig = await storage.getIntegracaoByTipo("pix");

      const configuracoes = {
        appId,
        correlationID: correlationID || `TVON_PIX_${Date.now()}`,
        authorization: authorization || '',
        expiresIn: expiresIn || 86400, // 24h padrão
      };

      if (existingConfig) {
        await storage.updateIntegracao(existingConfig.id, {
          configuracoes,
          ativo: true,
        });
      } else {
        await storage.createIntegracao({
          tipo: "pix",
          configuracoes,
          ativo: true,
        });
      }

      // Atualizar configuração do serviço PIX
      await pixService.updateConfig(appId, correlationID, null, expiresIn);

      res.json({ message: "Configuração Woovi salva com sucesso" });
    } catch (error) {
      console.error("Erro ao configurar PIX:", error);
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  });

  // Buscar pagamentos
  app.get("/api/pix/pagamentos", async (req, res) => {
    try {
      const pagamentos = await storage.getPagamentosWithClientes();
      res.json(pagamentos);
    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  // Buscar logs PIX
  app.get("/api/pix/logs", async (req, res) => {
    try {
      const logs = await storage.getPixLogs();
      res.json(logs);
    } catch (error) {
      console.error("Erro ao buscar logs:", error);
      res.status(500).json({ error: "Erro ao buscar logs" });
    }
  });

  // Gerar PIX de teste
  app.post("/api/pix/gerar-teste", async (req, res) => {
    try {
      const { valor, descricao } = req.body;

      // Buscar cliente de teste pelo telefone primeiro
      let clienteTeste = await storage.getClienteByTelefone("14991949280");

      // Se não existir, tentar pelo nome
      if (!clienteTeste) {
        clienteTeste = await storage.getClienteByNome("Cliente Teste Woovi");
      }

      // Se ainda não existir, criar
      if (!clienteTeste) {
        clienteTeste = await storage.createCliente({
          nome: "Cliente Teste Woovi",
          telefone: "14991949280",
          email: "teste@tvon.com.br",
          cpf: "00000000000",
          endereco: "Endereço Teste",
          bairro: "Centro",
          cidade: "Teste",
          estado: "SP",
          cep: "00000-000",
          status: "ativo",
          plano: "teste",
          vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        });
      }

      // Gerar PIX
      const pix = await pixService.generatePix(
        clienteTeste.id,
        valor || 10.0,
        descricao || "Teste de PIX - TV ON Sistema",
      );

      res.json(pix);
    } catch (error: any) {
      console.error("Erro ao gerar PIX de teste:", error);
      res.status(500).json({
        error: "Erro ao gerar PIX de teste",
        details: error.response?.data || error.message,
      });
    }
  });

  // Verificar configuração PIX (temporário para debug)
  app.get("/api/pix/config-debug", async (req, res) => {
    try {
      const integracao = await storage.getIntegracaoByTipo("pix");
      res.json({
        configurado: !!integracao,
        config: integracao?.configuracoes || {},
        ativo: integracao?.ativo || false,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configuração" });
    }
  });

  // Generate PIX manually
  app.post("/api/pix/generate", async (req, res) => {
    try {
      const { clienteId, telefone, valor, descricao } = req.body;
      console.log("[PIX API] Recebido pedido de PIX:", { clienteId, telefone, valor, descricao });

      if (!valor) {
        console.log("[PIX API] Erro: valor é obrigatório");
        return res.status(400).json({ 
          error: "Valor é obrigatório" 
        });
      }

      let cliente = null;
      let nomeIdentificacao = "";
      let idParaPix = clienteId;

      // Se tem clienteId, usa ele
      if (clienteId) {
        cliente = await storage.getClienteById(clienteId);
        if (cliente) {
          nomeIdentificacao = cliente.nome;
        }
      }
      
      // Se não tem cliente ou clienteId, tenta buscar pelo telefone
      if (!cliente && telefone) {
        // Normaliza o telefone
        const telefoneNormalizado = telefone.replace(/\D/g, '');
        cliente = await storage.getClienteByTelefone(telefoneNormalizado);
        
        if (cliente) {
          idParaPix = cliente.id;
          nomeIdentificacao = cliente.nome;
        } else {
          // Se não tem cliente, usa o telefone como identificação
          nomeIdentificacao = telefone;
          // Para conversas sem cliente, usaremos um ID fictício negativo baseado no hash do telefone
          idParaPix = -Math.abs(telefoneNormalizado.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
        }
      }

      // Se nem cliente nem telefone foram fornecidos
      if (!idParaPix) {
        return res.status(400).json({ 
          error: "Cliente ID ou telefone é obrigatório" 
        });
      }

      console.log("[PIX API] Identificação:", nomeIdentificacao, "ID:", idParaPix);

      // Generate PIX
      console.log("[PIX API] Chamando pixService.generatePix...");
      const pixResult = await pixService.generatePix(
        idParaPix,
        valor,
        descricao || `Pagamento - ${nomeIdentificacao}`,
        { manual: true, telefone: telefone }
      );
      
      console.log("[PIX API] Resultado do pixService:", pixResult ? "OK" : "FALHOU");
      console.log("[PIX API] pixResult.pixKey:", pixResult?.pixKey ? "EXISTE" : "NÃO EXISTE");

      if (pixResult && pixResult.pixKey) {
        const response = {
          success: true,
          pixData: {
            qrCode: pixResult.qrCode,
            pixCopiaCola: pixResult.pixCopiaCola,
            chargeId: (pixResult as any).chargeId,
            expiresIn: (pixResult as any).expiresIn || '30 minutos'
          }
        };
        console.log("[PIX API] Enviando resposta de sucesso");
        res.json(response);
      } else {
        console.log("[PIX API] PIX falhou, sem pixKey");
        res.status(500).json({ 
          error: "Erro ao gerar PIX - sem dados retornados" 
        });
      }
    } catch (error: any) {
      console.error("[PIX API] Error generating manual PIX:", error);
      res.status(500).json({ 
        error: "Erro ao gerar PIX: " + (error.message || "Erro desconhecido")
      });
    }
  });

  // In-memory storage for PIX state (temporary solution)
  const pixStateMemoryStore = new Map<string, any>();

  // Salvar estado do PIX por conversa
  app.post("/api/pix/state/:conversaId", async (req, res) => {
    try {
      const { conversaId } = req.params;
      const { telefone, activePixData, pixHistory, pixAmount, pixDescription } = req.body;

      // Armazenar na memória para persistir durante a sessão
      const key = `conv_${conversaId}`;
      pixStateMemoryStore.set(key, {
        conversaId: Number(conversaId),
        telefone,
        activePixData,
        pixHistory,
        pixAmount,
        pixDescription,
        updatedAt: new Date(),
      });
      
      console.log('[PIX State] Estado salvo para conversa:', conversaId);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao salvar estado do PIX:", error);
      res.status(500).json({ error: "Erro ao salvar estado do PIX" });
    }
  });

  // Recuperar estado do PIX por conversa
  app.get("/api/pix/state/:conversaId", async (req, res) => {
    try {
      const { conversaId } = req.params;
      const key = `conv_${conversaId}`;
      const state = pixStateMemoryStore.get(key);
      
      if (state) {
        console.log('[PIX State] Estado recuperado para conversa:', conversaId);
        res.json(state);
      } else {
        console.log('[PIX State] Nenhum estado encontrado para conversa:', conversaId);
        res.json(null);
      }
    } catch (error) {
      console.error("Erro ao recuperar estado do PIX:", error);
      res.status(500).json({ error: "Erro ao recuperar estado do PIX" });
    }
  });

  // Limpar estado do PIX por conversa
  app.delete("/api/pix/state/:conversaId", async (req, res) => {
    try {
      const { conversaId } = req.params;
      const key = `conv_${conversaId}`;
      pixStateMemoryStore.delete(key);
      
      console.log('[PIX State] Estado limpo para conversa:', conversaId);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao limpar estado do PIX:", error);
      res.status(500).json({ error: "Erro ao limpar estado do PIX" });
    }
  });

  // Config TV - Settings endpoints
  app.get("/api/external-api/settings/redirect_base_url", async (req, res) => {
    try {
      const setting = await externalApiService.getSetting("redirect_base_url");
      res.json(setting || { key: "redirect_base_url", value: "" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configuração" });
    }
  });

  app.put("/api/external-api/settings/redirect_base_url", async (req, res) => {
    try {
      const { value } = req.body;

      let result;

      // Try to update first
      try {
        result = await externalApiService.updateSetting("redirect_base_url", {
          setting_key: "redirect_base_url",
          setting_value: value,
        });
        console.log("Update result:", result);
      } catch (updateError: any) {
        console.error(
          "Update error:",
          updateError.response?.data || updateError.message,
        );

        // If update fails with 404, try to create
        if (updateError.response?.status === 404) {
          console.log("Setting not found, creating new one...");
          try {
            result = await externalApiService.createSetting({
              setting_key: "redirect_base_url",
              setting_value: value,
            });
            console.log("Create result:", result);
          } catch (createError: any) {
            // If create fails with duplicate entry, the setting exists but update failed
            // In this case, consider it a success since the value is already set
            if (
              createError.response?.data?.message?.includes("Duplicate entry")
            ) {
              console.log("Setting already exists, considering as success");
              result = {
                setting_key: "redirect_base_url",
                setting_value: value,
              };
            } else {
              throw createError;
            }
          }
        } else {
          throw updateError;
        }
      }

      console.log("Final result:", result);

      if (result !== null && result !== undefined) {
        // Also save in local database
        try {
          const existingConfig =
            await storage.getIntegracaoByTipo("redirect_url");
          if (existingConfig) {
            await storage.updateIntegracao(existingConfig.id, {
              configuracoes: JSON.stringify({ url: value }),
            });
          } else {
            await storage.createIntegracao({
              tipo: "redirect_url",
              ativo: true,
              configuracoes: JSON.stringify({ url: value }),
            });
          }
        } catch (dbError) {
          console.error("Database error:", dbError);
        }

        // Return success response with the saved data
        res.json({
          setting_key: "redirect_base_url",
          setting_value: value,
          success: true,
        });
      } else {
        console.log("Result is null or undefined");
        res.status(500).json({ error: "Erro ao atualizar URL" });
      }
    } catch (error) {
      console.error("Erro ao atualizar URL:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
  });

  // Test URL connection
  app.post("/api/external-api/settings/test-url", async (req, res) => {
    try {
      const { url } = req.body;

      // Parse URL to get just the hostname
      let hostname: string;
      try {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      } catch {
        // If URL parsing fails, try to extract hostname manually
        hostname = url
          .replace(/^https?:\/\//, "")
          .split("/")[0]
          .split(":")[0];
      }

      // Try DNS lookup first (similar to ping)
      const dns = await import("dns/promises");

      try {
        // Try to resolve the hostname (like ping)
        const startTime = Date.now();
        const result = await dns.lookup(hostname);
        const responseTime = Date.now() - startTime;

        res.json({
          success: true,
          hostname: hostname,
          ip: result.address,
          family: result.family === 4 ? "IPv4" : "IPv6",
          responseTime: responseTime,
          message: `✓ Ping para ${hostname} (${result.address}) - ${responseTime}ms`,
        });
      } catch (dnsError: any) {
        // DNS lookup failed
        res.json({
          success: false,
          hostname: hostname,
          error: "Host não encontrado",
          message: `✗ Ping para ${hostname} falhou - host não encontrado ou bloqueado`,
        });
      }
    } catch (error: any) {
      console.error("Erro ao testar URL:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao testar URL",
      });
    }
  });

  // Get all systems
  app.get("/api/sistemas", async (req, res) => {
    try {
      const sistemas = await storage.getSistemas();
      res.json(sistemas);
    } catch (error) {
      console.error("Erro ao buscar sistemas:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas" });
    }
  });

  // Get available systems (not at max capacity)
  app.get("/api/sistemas/disponiveis", async (req, res) => {
    try {
      const sistemas = await storage.getAvailableSistemas();
      res.json(sistemas);
    } catch (error) {
      console.error("Erro ao buscar sistemas disponíveis:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas disponíveis" });
    }
  });

  // Config TV - Systems endpoints
  app.get("/api/external-api/systems", async (req, res) => {
    try {
      const systems = await externalApiService.getSystemCredentials();

      // Enrich systems with pontos counts from local database
      const localSistemas = await db.select().from(sistemas);

      // Get real-time pontos count for each system
      const pontosAtivosCount = await db
        .select({
          sistemaId: pontos.sistemaId,
          count: sql<number>`count(*)`,
        })
        .from(pontos)
        .where(eq(pontos.status, "ativo"))
        .groupBy(pontos.sistemaId);

      // Create a map for quick lookup
      const pontosCountMap = new Map(
        pontosAtivosCount.map((p) => [p.sistemaId, Number(p.count)]),
      );

      const enrichedSystems = systems.map((system: any) => {
        const localSistema = localSistemas.find(
          (s) => s.systemId === system.system_id,
        );
        return {
          ...system,
          id: localSistema?.id,
          maxPontosAtivos: localSistema?.maxPontosAtivos || 100,
          pontosAtivos: pontosCountMap.get(localSistema?.id) || 0,
        };
      });

      res.json(enrichedSystems || []);
    } catch (error) {
      console.error("Erro ao buscar sistemas:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas" });
    }
  });

  app.post("/api/external-api/systems", async (req, res) => {
    try {
      const { system_id, username, password } = req.body;

      let finalSystemId = system_id;

      // If no system_id provided, generate next ID
      if (!finalSystemId) {
        const existingSystems = await externalApiService.getSystemCredentials();
        const maxId = existingSystems.reduce((max, system) => {
          const id = parseInt(system.system_id);
          return id > max ? id : max;
        }, 0);
        finalSystemId = (maxId + 1).toString();
      }

      // Create in external API with system_id
      const result = await externalApiService.createSystemCredential({
        system_id: finalSystemId,
        username,
        password,
      });

      // Also create in local database
      if (result) {
        await storage.createSistema({
          systemId: result.system_id || finalSystemId,
          username: result.username || username,
          password: result.password || password,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Erro ao criar sistema:", error);
      console.error("Detalhes do erro:", error.response?.data || error.message);
      res.status(500).json({
        error: "Erro ao criar sistema",
        details: error.response?.data?.error || error.message,
      });
    }
  });

  app.put("/api/external-api/systems/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { system_id, username, password } = req.body;

      // If system_id is being changed, we need to handle it differently
      if (system_id && system_id !== id) {
        // Create new system with new ID
        const createResult = await externalApiService.createSystemCredential({
          system_id,
          username,
          password,
        });

        if (createResult) {
          // Delete old system
          await externalApiService.deleteSystemCredential(parseInt(id));

          // Update local database
          const localSystem = await storage.getSistemaBySystemId(id);
          if (localSystem) {
            await storage.updateSistema(localSystem.id, {
              systemId: system_id,
              username: createResult.username || username,
              password: createResult.password || password,
            });
          }
        }

        res.json(createResult);
      } else {
        // Normal update (just username/password)
        const result = await externalApiService.updateSystemCredential(
          parseInt(id),
          { username, password },
        );

        // Also update in local database
        if (result) {
          const localSystem = await storage.getSistemaBySystemId(id);
          if (localSystem) {
            await storage.updateSistema(localSystem.id, {
              username: result.username || username,
              password: result.password || password,
            });
          }
        }

        res.json(result);
      }
    } catch (error) {
      console.error("Erro ao atualizar sistema:", error);
      res.status(500).json({ error: "Erro ao atualizar sistema" });
    }
  });

  app.delete("/api/external-api/systems/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Delete from external API
      await externalApiService.deleteSystemCredential(parseInt(id));

      // Also delete from local database
      const localSystem = await storage.getSistemaBySystemId(id);
      if (localSystem) {
        await storage.deleteSistema(localSystem.id);
      }

      // Renumber remaining systems
      const remainingSystems = await externalApiService.getSystemCredentials();
      const renumberedSystems = remainingSystems.map((system, index) => ({
        ...system,
        system_id: (index + 1).toString(),
      }));

      // Since API always generates sequential IDs, we need to recreate all systems
      // Clear all remaining systems first
      for (const system of remainingSystems) {
        await externalApiService.deleteSystemCredential(
          parseInt(system.system_id),
        );
      }

      // Recreate with proper sequence
      for (let i = 0; i < renumberedSystems.length; i++) {
        const system = renumberedSystems[i];
        await externalApiService.createSystemCredential({
          system_id: (i + 1).toString(), // API requires this field even though it ignores it
          username: system.username,
          password: system.password,
        });
      }

      // Sync with local database
      await storage.syncSistemasFromApi(renumberedSystems);

      res.json({ message: "Sistema removido e sistemas reordenados" });
    } catch (error) {
      console.error("Erro ao remover sistema:", error);
      res.status(500).json({ error: "Erro ao remover sistema" });
    }
  });

  app.post("/api/external-api/systems/reorder", async (req, res) => {
    try {
      const { systems } = req.body;

      // Delete all existing systems
      const existingSystems = await externalApiService.getSystemCredentials();
      for (const system of existingSystems) {
        await externalApiService.deleteSystemCredential(
          parseInt(system.system_id),
        );
      }

      // Recreate systems in the new order
      // The API will assign sequential IDs automatically
      for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        await externalApiService.createSystemCredential({
          system_id: (i + 1).toString(), // API requires this field even though it ignores it
          username: system.username,
          password: system.password,
        });
      }

      // Get the updated systems from API
      const updatedSystems = await externalApiService.getSystemCredentials();

      // Sync with local database
      await storage.syncSistemasFromApi(updatedSystems);

      res.json({
        message: "Sistemas reordenados com sucesso",
        systems: updatedSystems,
      });
    } catch (error) {
      console.error("Erro ao reordenar sistemas:", error);
      res.status(500).json({ error: "Erro ao reordenar sistemas" });
    }
  });

  // Vencimentos
  app.get("/api/vencimentos", async (req, res) => {
    try {
      const { tipo = "proximos", dias = 5 } = req.query;

      let vencimentos;
      if (tipo === "vencidos") {
        vencimentos = await storage.getVencimentosVencidos();
      } else {
        vencimentos = await storage.getVencimentosProximos(
          parseInt(dias as string),
        );
      }

      res.json(vencimentos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar vencimentos" });
    }
  });

  // Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      const logs = await storage.getLogs(parseInt(limit as string));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar logs" });
    }
  });

  app.delete("/api/logs", async (req, res) => {
    try {
      await storage.clearLogs();
      res.json({ message: "Logs limpos com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao limpar logs" });
    }
  });

  // Redirect URLs endpoints
  app.get("/api/redirect-urls", async (req, res) => {
    try {
      const urls = await storage.getRedirectUrls();
      res.json(urls);
    } catch (error: any) {
      // Return empty array if table doesn't exist
      if (error.code === "42P01") {
        res.json([]);
      } else {
        throw error;
      }
    }
  });

  app.post("/api/redirect-urls", async (req, res) => {
    try {
      const url = await storage.createRedirectUrl(req.body);
      res.json(url);
    } catch (error: any) {
      if (error.code === "42P01") {
        res
          .status(500)
          .json({
            error:
              "Tabela de URLs não encontrada. Por favor, execute a migração do banco de dados.",
          });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.put("/api/redirect-urls/:id", async (req, res) => {
    try {
      const url = await storage.updateRedirectUrl(
        Number(req.params.id),
        req.body,
      );
      res.json(url);
    } catch (error: any) {
      if (error.code === "42P01") {
        res.status(500).json({ error: "Tabela de URLs não encontrada" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.delete("/api/redirect-urls/:id", async (req, res) => {
    try {
      await storage.deleteRedirectUrl(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "42P01") {
        res.status(500).json({ error: "Tabela de URLs não encontrada" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/redirect-urls/:id/set-principal", async (req, res) => {
    try {
      await storage.setPrincipalUrl(Number(req.params.id));

      // Get the URL to sync with external API
      const url = await storage.getRedirectUrlById(Number(req.params.id));
      if (url) {
        try {
          await externalApiService.updateSetting("redirect_base_url", {
            setting_key: "redirect_base_url",
            setting_value: url.url,
          });
        } catch (error: any) {
          if (error.response?.status === 404) {
            try {
              await externalApiService.createSetting({
                setting_key: "redirect_base_url",
                setting_value: url.url,
              });
            } catch (createError: any) {
              if (
                !createError.response?.data?.message?.includes(
                  "Duplicate entry",
                )
              ) {
                console.error("Error syncing with API:", createError);
              }
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "42P01") {
        res.status(500).json({ error: "Tabela de URLs não encontrada" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Sync endpoints
  app.post("/api/sync/api-config", async (req, res) => {
    try {
      // Get API configuration from external API
      const apiConfig = await externalApiService.getSettings();

      // Update local integration record
      const existingIntegration =
        await storage.getIntegracaoByTipo("api_externa");

      if (existingIntegration) {
        await storage.updateIntegracao(existingIntegration.id, {
          configuracao: {
            ...(existingIntegration.configuracao as any),
            syncedAt: new Date().toISOString(),
            apiSettings: apiConfig,
          },
          ultimaAtualizacao: new Date(),
        });
      }

      res.json({
        message: "Configuração da API sincronizada",
        apiSettings: apiConfig,
      });
    } catch (error) {
      console.error("Erro ao sincronizar configuração da API:", error);
      res
        .status(500)
        .json({ error: "Erro ao sincronizar configuração da API" });
    }
  });

  app.post("/api/sync/systems", async (req, res) => {
    try {
      // Get systems from external API
      const apiSystems = await externalApiService.getSystemCredentials();

      // Sync with local database
      await storage.syncSistemasFromApi(apiSystems);

      // Get updated local systems
      const localSystems = await storage.getSistemas();

      res.json({
        message: "Sistemas sincronizados",
        synced: apiSystems.length,
        local: localSystems.length,
      });
    } catch (error) {
      console.error("Erro ao sincronizar sistemas:", error);
      res.status(500).json({ error: "Erro ao sincronizar sistemas" });
    }
  });

  app.get("/api/sync/status", async (req, res) => {
    try {
      // Get local systems
      const localSystems = await storage.getSistemas();

      // Get API systems
      let apiSystems: any[] = [];
      let apiConnected = false;

      try {
        apiSystems = await externalApiService.getSystemCredentials();
        apiConnected = true;
      } catch (error) {
        console.log("API não conectada para verificação de sincronização");
      }

      // Get integration status
      const integration = await storage.getIntegracaoByTipo("api_externa");

      res.json({
        apiConnected,
        localSystemsCount: localSystems.length,
        apiSystemsCount: apiSystems.length,
        inSync: apiConnected && localSystems.length === apiSystems.length,
        lastSync: integration?.ultimaAtualizacao || null,
        apiUrl: integration?.baseUrl || null,
      });
    } catch (error) {
      console.error("Erro ao verificar status de sincronização:", error);
      res
        .status(500)
        .json({ error: "Erro ao verificar status de sincronização" });
    }
  });

  app.get("/api/sync/details", async (req, res) => {
    try {
      // Get local systems
      const localSystems = await storage.getSistemas();
      const localSystemsMap = new Map(localSystems.map((s) => [s.systemId, s]));

      // Get real-time pontos count for each system
      const pontosAtivosCount = await db
        .select({
          sistemaId: pontos.sistemaId,
          count: sql<number>`count(*)`,
        })
        .from(pontos)
        .where(eq(pontos.status, "ativo"))
        .groupBy(pontos.sistemaId);

      // Create a map for quick lookup
      const pontosCountMap = new Map(
        pontosAtivosCount.map((p) => [p.sistemaId, Number(p.count)]),
      );

      // Get API systems
      let apiSystems: any[] = [];
      let apiSystemsMap = new Map();
      let apiConnected = false;

      try {
        apiSystems = await externalApiService.getSystemCredentials();
        apiSystemsMap = new Map(apiSystems.map((s) => [s.system_id, s]));
        apiConnected = true;
      } catch (error) {
        console.log("API não conectada para comparação detalhada");
      }

      // Compare systems
      const systemComparison: any[] = [];
      const systemIds = new Set([
        ...localSystemsMap.keys(),
        ...apiSystemsMap.keys(),
      ]);

      for (const systemId of systemIds) {
        const localSystem = localSystemsMap.get(systemId);
        const apiSystem = apiSystemsMap.get(systemId);

        if (localSystem && apiSystem) {
          // System exists in both
          const isDivergent =
            localSystem.username !== apiSystem.username ||
            localSystem.password !== apiSystem.password;
          systemComparison.push({
            id: localSystem.id,
            systemId,
            username: localSystem.username,
            password: localSystem.password,
            pontosAtivos: pontosCountMap.get(localSystem.id) || 0,
            maxPontosAtivos: localSystem.maxPontosAtivos,
            source: "both",
            status: isDivergent ? "divergent" : "ok",
          });
        } else if (localSystem) {
          // Only in local
          systemComparison.push({
            id: localSystem.id,
            systemId,
            username: localSystem.username,
            password: localSystem.password,
            pontosAtivos: pontosCountMap.get(localSystem.id) || 0,
            maxPontosAtivos: localSystem.maxPontosAtivos,
            source: "local",
            status: "missing",
          });
        } else if (apiSystem) {
          // Only in API
          systemComparison.push({
            systemId,
            username: apiSystem.username,
            password: apiSystem.password,
            source: "api",
            status: "missing",
          });
        }
      }

      // Get local pontos and API users for comparison
      const pontosLocais = await db
        .select()
        .from(pontos)
        .orderBy(asc(pontos.usuario));
      const clientes = await storage.getClientes();
      const clienteMap = new Map(clientes.map((c) => [c.id, c]));

      let apiUsers: any[] = [];
      if (apiConnected) {
        try {
          apiUsers = await externalApiService.getUsers();
        } catch (error) {
          console.log("Erro ao buscar usuários da API:", error);
        }
      }

      const apiUsersMap = new Map(apiUsers.map((u) => [u.username, u]));
      const userComparison: any[] = [];
      const pontosMap = new Map(pontosLocais.map((p) => [p.usuario, p]));
      const usernames = new Set([...pontosMap.keys(), ...apiUsersMap.keys()]);

      for (const username of usernames) {
        const ponto = pontosMap.get(username);
        const apiUser = apiUsersMap.get(username);
        const cliente = ponto ? clienteMap.get(ponto.clienteId) : null;

        if (ponto && apiUser) {
          // User exists in both
          const expDate = cliente?.vencimento
            ? Math.floor(
                new Date(cliente.vencimento).getTime() / 1000,
              ).toString()
            : "";
          const isDivergent =
            ponto.senha !== apiUser.password ||
            expDate !== apiUser.exp_date ||
            (ponto.status === "ativo" ? "Active" : "Inactive") !==
              apiUser.status;

          userComparison.push({
            id: ponto.id,
            apiUserId: apiUser.id,
            usuario: username,
            cliente: cliente?.nome || "Sem cliente",
            vencimento: cliente?.vencimento?.toISOString(),
            status: ponto.status,
            source: "both",
            syncStatus: isDivergent ? "divergent" : "ok",
          });
        } else if (ponto) {
          // Only in local
          userComparison.push({
            id: ponto.id,
            usuario: username,
            cliente: cliente?.nome || "Sem cliente",
            vencimento: cliente?.vencimento?.toISOString(),
            status: ponto.status,
            source: "local",
            syncStatus: "missing",
          });
        } else if (apiUser) {
          // Only in API
          userComparison.push({
            apiUserId: apiUser.id,
            usuario: username,
            cliente: "Desconhecido",
            vencimento: new Date(
              parseInt(apiUser.exp_date) * 1000,
            ).toISOString(),
            status: apiUser.status === "Active" ? "ativo" : "inativo",
            source: "api",
            syncStatus: "missing",
          });
        }
      }

      const hasDivergence =
        systemComparison.some((s) => s.status !== "ok") ||
        userComparison.some((u) => u.syncStatus !== "ok");

      res.json({
        systems: {
          items: systemComparison,
          hasDivergence: systemComparison.some((s) => s.status !== "ok"),
        },
        users: {
          items: userComparison,
          hasDivergence: userComparison.some((u) => u.syncStatus !== "ok"),
        },
        apiConnected,
      });
    } catch (error) {
      console.error("Erro ao buscar detalhes de sincronização:", error);
      res.status(500).json({ error: "Erro ao buscar detalhes" });
    }
  });

  app.post("/api/sync/users", async (req, res) => {
    try {
      // Get local pontos
      const pontosLocais = await storage.getPontos();
      const clientes = await storage.getClientes();
      const clienteMap = new Map(clientes.map((c) => [c.id, c]));

      // Get API users
      const apiUsers = await externalApiService.getUsers();
      const apiUsersMap = new Map(apiUsers.map((u) => [u.username, u]));

      let created = 0;
      let updated = 0;
      let deleted = 0;
      const errors: string[] = [];

      // Create/update users in API from local pontos
      for (const ponto of pontosLocais) {
        if (ponto.status !== "ativo") continue;

        const cliente = clienteMap.get(ponto.clienteId);
        const sistema = await storage.getSistemaById(ponto.sistemaId);

        if (!cliente) {
          console.warn(`Cliente não encontrado para ponto ${ponto.id}`);
          continue;
        }
        
        if (!sistema) {
          console.warn(`Sistema não encontrado para ponto ${ponto.id}`);
          continue;
        }

        const expDate = cliente.vencimento
          ? Math.floor(new Date(cliente.vencimento).getTime() / 1000).toString()
          : Math.floor(Date.now() / 1000 + 365 * 24 * 60 * 60).toString();

        const apiUser = apiUsersMap.get(ponto.usuario);
        
        // Parse systemId safely
        let systemNumber = 1;
        try {
          systemNumber = parseInt(sistema.systemId);
          if (isNaN(systemNumber)) {
            console.warn(`SystemId inválido para sistema ${sistema.id}: ${sistema.systemId}, usando padrão 1`);
            systemNumber = 1;
          }
        } catch (e) {
          console.warn(`Erro ao converter systemId: ${e}, usando padrão 1`);
          systemNumber = 1;
        }

        try {
          if (apiUser) {
            // Update existing user
            await externalApiService.updateUser(apiUser.id, {
              password: ponto.senha,
              exp_date: expDate,
              status: "Active",
              system: systemNumber,
            });
            updated++;

            // Save apiUserId if not already saved
            if (!ponto.apiUserId) {
              await storage.updatePonto(ponto.id, { apiUserId: apiUser.id });
            }
          } else {
            // Create new user
            const newUser = await externalApiService.createUser({
              username: ponto.usuario,
              password: ponto.senha,
              exp_date: expDate,
              status: "Active",
              system: systemNumber,
            });

            if (newUser) {
              await storage.updatePonto(ponto.id, { apiUserId: newUser.id });
              created++;
            }
          }
        } catch (userError) {
          const errorMsg = `Erro ao processar usuário ${ponto.usuario}: ${userError}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Delete users from API that don't exist locally
      const localUsernames = new Set(
        pontosLocais.filter((p) => p.status === "ativo").map((p) => p.usuario),
      );
      for (const apiUser of apiUsers) {
        if (!localUsernames.has(apiUser.username)) {
          try {
            await externalApiService.deleteUser(apiUser.id);
            deleted++;
          } catch (deleteError) {
            const errorMsg = `Erro ao deletar usuário ${apiUser.username}: ${deleteError}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      res.json({
        success: errors.length === 0,
        synced: created + updated,
        created,
        updated,
        deleted,
        message: `Sincronização concluída: ${created} criados, ${updated} atualizados, ${deleted} removidos`,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Erro ao sincronizar usuários:", error);
      res.status(500).json({ 
        error: "Erro ao sincronizar usuários",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return httpServer;
}
