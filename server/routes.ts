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
import { OnlineOfficeService } from "./services/onlineoffice";
import { createProxyMiddleware } from "http-proxy-middleware";
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
  officeExtensionConfig,
  officeCredentials,
} from "@shared/schema";
import { z } from "zod";
import { asc, desc, sql, eq, and } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { nanoid } from "nanoid";
import multer from "multer";
import { execSync } from "child_process";

// Helper function to get current date in Brazil timezone
// IMPORTANT: This should NOT be used for saving to database!
// Database should always save UTC time, conversion happens on display only
function getBrazilDate(): Date {
  // Get current UTC time
  const now = new Date();
  // Convert to Brazil time (UTC-3)
  const brazilTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  return brazilTime;
}

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
  
  // Setup proxy for OnlineOffice to bypass CORS
  const officeProxy = createProxyMiddleware({
    target: 'https://onlineoffice.zip',
    changeOrigin: true,
    secure: false,
    onProxyRes: (proxyRes, req, res) => {
      // Remove headers that prevent iframe embedding
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['x-content-type-options'];
      
      // Add permissive CORS headers
      proxyRes.headers['access-control-allow-origin'] = '*';
      proxyRes.headers['access-control-allow-methods'] = '*';
      proxyRes.headers['access-control-allow-headers'] = '*';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    },
    followRedirects: true,
    logLevel: 'warn',
  });
  
  app.use('/office-proxy', officeProxy);
  
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
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days by default
    }
  }));

  // Serve static files for uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  
  // Serve chrome extension zip file
  app.get("/chrome-extension.zip", (req, res) => {
    const filePath = path.join(process.cwd(), "chrome-extension.zip");
    
    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: "Extension file not found" });
    }
    
    // Set proper headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="chrome-extension.zip"');
    
    // Send the file
    res.sendFile(filePath);
  });
  
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
        // Set cookie to expire in 30 days
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        // Default to 7 days even without remember me
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
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

  // CORS middleware for Chrome Extension endpoints - MUST be before auth middleware
  app.use((req, res, next) => {
    // Handle CORS for extension endpoints including all office automation routes
    if (req.path === '/api/office/credentials' || 
        req.path === '/api/office/save-credentials' ||
        req.path.startsWith('/api/office/automation/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Extension-Key');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
    }
    next();
  });

  // Apply auth middleware to all API routes except login routes
  app.use("/api/*", (req, res, next) => {
    const publicPaths = [
      '/api/login', 
      '/api/logout', 
      '/api/auth/status', 
      '/api/pix/webhook', 
      '/api/pix/debug/pagamentos-manual', 
      '/api/pix/test-webhook', 
      '/api/office/save-credentials', 
      '/api/office/credentials',
      // Chrome extension automation endpoints (public for extension access)
      '/api/office/automation/next-task',
      '/api/office/automation/task-complete',
      '/api/office/automation/report',
      '/api/office/automation/config',
      '/api/office/automation/status',
      '/api/office/automation/credentials',
      '/api/office/automation/extension.zip'  // Extension download endpoint (public)
      // Note: start/stop/generate-single endpoints remain protected (require authentication)
    ];
    // Use originalUrl to get the full path including /api prefix
    const fullPath = req.originalUrl.split('?')[0]; // Remove query params if any
    if (publicPaths.includes(fullPath)) {
      return next();
    }
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
        dataUltimaMensagem: new Date(), // Update timestamp in UTC (conversion happens on display)
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
        true, // skipSaveMessage - message already saved by WebSocket handler
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

    // Notificar todos os clientes conectados sobre o envio bem-sucedido
    // NOTA: A mensagem já foi salva no banco de dados (linha 415)
    // Este evento é apenas para notificar o frontend que a mensagem foi enviada
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

      // Get all pontos in a single query
      const allPontos = await storage.getAllPontos();
      
      // Create a map of clienteId -> pontos for efficient lookup
      const pontosMap = new Map<number, typeof allPontos>();
      for (const ponto of allPontos) {
        if (!pontosMap.has(ponto.clienteId)) {
          pontosMap.set(ponto.clienteId, []);
        }
        pontosMap.get(ponto.clienteId)!.push(ponto);
      }

      // Calculate valorTotal for each client using the map
      const clientesComValor = clientes.map(cliente => {
        const clientePontos = pontosMap.get(cliente.id) || [];
        const valorTotal = clientePontos.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || '0');
          return sum + valor;
        }, 0);
        
        return {
          ...cliente,
          valorTotal: valorTotal  // Return as number, not string
        };
      });

      res.json(clientesComValor);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
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
      
      // Log to debug ultimoAcesso issue
      if (pontos.length > 0) {
        console.log('Sample ponto data:', {
          id: pontos[0].id,
          ultimoAcesso: pontos[0].ultimoAcesso,
          ultimoAcessoType: typeof pontos[0].ultimoAcesso,
          isNull: pontos[0].ultimoAcesso === null,
          isUndefined: pontos[0].ultimoAcesso === undefined
        });
      }
      
      // Return pontos immediately without external API sync to avoid timeouts
      // The sync can be done in a background job if needed
      res.json(pontos);
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

  // Bulk update pontos endpoint - MUST BE BEFORE /:id to avoid route conflicts
  app.put("/api/pontos/bulk-update", async (req, res) => {
    try {
      console.log("PUT /api/pontos/bulk-update - Called correctly!");
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Invalid updates array" });
      }

      console.log(`Bulk updating ${updates.length} pontos`);
      
      const results = [];
      const errors = [];
      
      for (const update of updates) {
        try {
          const { id, sistemaId } = update;
          
          if (!id || sistemaId === null || sistemaId === undefined) {
            errors.push({ id, error: "Missing id or sistemaId" });
            continue;
          }
          
          // Get old ponto data
          const oldPonto = await storage.getPontoById(id);
          if (!oldPonto) {
            errors.push({ id, error: "Ponto not found" });
            continue;
          }
          
          // Update the ponto
          const updatedPonto = await storage.updatePonto(id, { sistemaId });
          
          // Update system active points count if system changed
          if (oldPonto.sistemaId !== sistemaId) {
            if (oldPonto.sistemaId) {
              await storage.updateSistemaActivePontos(oldPonto.sistemaId);
            }
            if (sistemaId) {
              await storage.updateSistemaActivePontos(sistemaId);
            }
          }
          
          // Sync with external API if needed
          if (updatedPonto.apiUserId) {
            const sistema = await storage.getSistemaById(sistemaId);
            const cliente = await storage.getClienteById(updatedPonto.clienteId);
            
            if (sistema && cliente) {
              const expDate = cliente.vencimento
                ? Math.floor(new Date(cliente.vencimento).getTime() / 1000).toString()
                : Math.floor(new Date(updatedPonto.expiracao).getTime() / 1000).toString();
              
              const apiData = {
                username: updatedPonto.usuario,
                password: updatedPonto.senha,
                exp_date: expDate,
                status: updatedPonto.status === "ativo" ? "Active" : "Inactive",
                system: parseInt(sistema.systemId),
              };
              
              try {
                await externalApiService.updateUser(updatedPonto.apiUserId, apiData);
                console.log(`Updated ponto ${id} in external API`);
              } catch (apiError) {
                console.error(`Failed to update ponto ${id} in external API:`, apiError);
              }
            }
          }
          
          results.push({ id, success: true });
        } catch (error) {
          console.error(`Error updating ponto ${update.id}:`, error);
          errors.push({ id: update.id, error: error.message });
        }
      }
      
      res.json({
        success: true,
        updated: results.length,
        errors: errors.length,
        results,
        errors
      });
    } catch (error) {
      console.error("Error in bulk update:", error);
      res.status(500).json({ error: "Failed to bulk update pontos" });
    }
  });

  app.put("/api/pontos/:id", async (req, res) => {
    try {
      console.log(`PUT /api/pontos/${req.params.id} - Body recebido:`, req.body);

      // Separa os campos que não estão no schema
      const { valor, expiracao, observacoes, ...restData } = req.body;

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
      if (restData.observacoes !== undefined)
        updateData.observacoes = restData.observacoes;
      if (restData.status !== undefined) updateData.status = restData.status;
      if (restData.aplicativo !== undefined)
        updateData.aplicativo = restData.aplicativo;
      if (restData.dispositivo !== undefined)
        updateData.dispositivo = restData.dispositivo;
      if (restData.sistemaId !== undefined)
        updateData.sistemaId = restData.sistemaId;

      // Adiciona valor se fornecido (garantir que seja string)
      if (valor !== undefined) {
        updateData.valor = String(valor);
      }
      
      // Adiciona observações se fornecido
      if (observacoes !== undefined) {
        updateData.observacoes = observacoes;
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
          } catch (apiError: any) {
            console.error("Erro ao atualizar usuário na API:", apiError);
            
            // Se o usuário não existe mais na API (erro 404), criar um novo
            if (apiError.status === 404 || apiError.response?.status === 404) {
              console.log("Usuário não encontrado na API, criando novo...");
              try {
                const newUser = await externalApiService.createUser(apiData);
                if (newUser && newUser.id) {
                  // Atualizar o ponto com o novo apiUserId
                  await storage.updatePonto(ponto.id, { apiUserId: newUser.id });
                  console.log("Novo usuário criado na API com ID:", newUser.id);
                }
              } catch (createError) {
                console.error("Erro ao criar novo usuário na API:", createError);
              }
            }
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

  app.get("/api/avisos", async (req, res) => {
    try {
      const avisos = await storage.getAvisosVencimento();
      res.json(avisos);
    } catch (error) {
      console.error("Error in /api/avisos:", error);
      res.status(500).json({ error: "Erro ao buscar avisos" });
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
            mensagemEnviada: `[ERRO] ${whatsappError.message}`
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

      // Update last execution time if needed

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

  // Config recorrente routes
  app.get("/api/avisos/config-recorrente", async (req, res) => {
    try {
      const config = await storage.getConfigAvisos();
      res.json({
        ativo: config?.notificacoesRecorrentes ?? false,
        intervaloRecorrente: config?.intervaloRecorrente ?? 3,
        limiteNotificacoes: config?.limiteNotificacoes ?? 10,
        mensagemPadrao: config?.mensagemPadrao ?? ''
      });
    } catch (error) {
      console.error("Error in /api/avisos/config-recorrente:", error);
      res.status(500).json({ error: "Erro ao buscar configuração recorrente" });
    }
  });

  app.put("/api/avisos/config-recorrente", async (req, res) => {
    try {
      const { ativo, intervaloRecorrente, limiteNotificacoes, mensagemPadrao } = req.body;
      
      const updated = await storage.updateConfigAvisos({
        notificacoesRecorrentes: ativo,
        intervaloRecorrente: intervaloRecorrente,
        limiteNotificacoes: limiteNotificacoes,
        mensagemPadrao: mensagemPadrao
      });
      
      res.json({
        ativo: updated.notificacoesRecorrentes,
        intervaloRecorrente: updated.intervaloRecorrente,
        limiteNotificacoes: updated.limiteNotificacoes,
        mensagemPadrao: updated.mensagemPadrao
      });
    } catch (error) {
      console.error("Error in PUT /api/avisos/config-recorrente:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração recorrente" });
    }
  });

  // Avisos recorrentes ativas endpoint
  app.get("/api/avisos/recorrentes-ativas", async (req, res) => {
    try {
      const notificacoes = await storage.getNotificacoesRecorrentesAtivas();
      
      // Debug log to check the structure
      if (notificacoes.length > 0) {
        console.log("First notification structure:", Object.keys(notificacoes[0]));
      }
      
      // Map to the format expected by frontend
      const notificacoesFormatadas = await Promise.all(
        notificacoes.map(async (notif: any) => {
          const cliente = await storage.getClienteById(notif.clienteId);
          // Handle both camelCase and snake_case field names
          const dataUltimoEnvio = notif.dataUltimoEnvio || notif.data_ultimo_envio;
          const proximoEnvio = notif.proximoEnvio || notif.proximo_envio;
          const totalEnviado = notif.totalEnviado || notif.total_enviado;
          
          return {
            id: notif.id,
            clienteId: notif.clienteId || notif.cliente_id,
            cliente: cliente,
            contagemNotificacoes: totalEnviado || 0,
            ultimaNotificacao: dataUltimoEnvio ? new Date(dataUltimoEnvio).toISOString() : null,
            proximaNotificacao: proximoEnvio ? new Date(proximoEnvio).toISOString() : null,
            ativo: notif.ativo !== undefined ? notif.ativo : true
          };
        })
      );
      
      res.json(notificacoesFormatadas);
    } catch (error) {
      console.error("Error in /api/avisos/recorrentes-ativas - Full error:", error);
      res.status(500).json({ error: "Erro ao buscar notificações recorrentes ativas" });
    }
  });

  // Avisos historico endpoint
  app.get("/api/avisos/historico", async (req, res) => {
    try {
      const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : undefined;
      
      let avisos;
      if (clienteId) {
        // Get history for specific client
        avisos = await storage.getAvisosVencimentoByClienteId(clienteId);
      } else {
        // Get all history
        avisos = await storage.getAvisosVencimento();
      }
      
      // Enrich with client data
      const avisosComClientes = await Promise.all(
        avisos.map(async (aviso) => {
          const cliente = await storage.getClienteById(aviso.clienteId);
          return { ...aviso, cliente };
        })
      );
      
      res.json(avisosComClientes);
    } catch (error) {
      console.error("Error in /api/avisos/historico:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de avisos" });
    }
  });

  // Notificações recorrentes routes
  app.get("/api/notificacoes-recorrentes", async (req, res) => {
    try {
      const notificacoes = await storage.getNotificacoesRecorrentes();
      
      // Enrich with client data
      const notificacoesComClientes = await Promise.all(
        notificacoes.map(async (notif) => {
          const cliente = await storage.getClienteById(notif.clienteId);
          return { ...notif, cliente };
        })
      );
      
      res.json(notificacoesComClientes);
    } catch (error) {
      console.error("Error in /api/notificacoes-recorrentes:", error);
      res.status(500).json({ error: "Erro ao buscar notificações recorrentes" });
    }
  });

  app.post("/api/notificacoes-recorrentes/reset/:clienteId", async (req, res) => {
    try {
      const clienteId = parseInt(req.params.clienteId);
      await storage.resetNotificacaoRecorrente(clienteId);
      res.json({ success: true, message: "Contador de notificações resetado" });
    } catch (error) {
      console.error("Error in /api/notificacoes-recorrentes/reset:", error);
      res.status(500).json({ error: "Erro ao resetar notificações recorrentes" });
    }
  });

  app.post("/api/avisos/enviar-manual", async (req, res) => {
    try {
      const { clienteId } = req.body;
      
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const message = `📢 *Lembrete de Pagamento*\n\n` +
        `Olá ${cliente.nome}!\n\n` +
        `Seu plano está vencido. Por favor, entre em contato para regularizar sua situação.\n\n` +
        `_Mensagem enviada manualmente pelo administrador._`;

      const sent = await whatsappService.sendMessage(cliente.telefone, message);
      
      if (sent) {
        await storage.createAvisoVencimento({
          clienteId: cliente.id,
          telefone: cliente.telefone,
          dataVencimento: cliente.vencimento || new Date(),
          tipoAviso: 'manual',
          statusEnvio: 'enviado',
          mensagemEnviada: message
        });
        
        res.json({ success: true, message: "Notificação enviada com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao enviar notificação" });
      }
    } catch (error) {
      console.error("Error in /api/avisos/enviar-manual:", error);
      res.status(500).json({ error: "Erro ao enviar notificação manual" });
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

  // Corrigir números de telefone incorretos
  app.post("/api/conversas/corrigir-telefones", checkAuth, async (req, res) => {
    try {
      // Correção específica para o número incorreto conhecido
      const correcoesEspecificas = [
        { numeroIncorreto: "192354539552794", numeroCorreto: "5514998618158" }
      ];
      
      let totalCorrigido = 0;
      
      for (const correcao of correcoesEspecificas) {
        const conversasCorrigidas = await storage.corrigirTelefoneConversa(
          correcao.numeroIncorreto,
          correcao.numeroCorreto
        );
        totalCorrigido += conversasCorrigidas;
        
        if (conversasCorrigidas > 0) {
          console.log(`Corrigido número ${correcao.numeroIncorreto} para ${correcao.numeroCorreto} em ${conversasCorrigidas} conversas`);
        }
      }
      
      res.json({ 
        success: true, 
        message: `${totalCorrigido} conversas corrigidas com sucesso`,
        totalCorrigido 
      });
    } catch (error) {
      console.error("Error fixing phone numbers:", error);
      res.status(500).json({ error: "Erro ao corrigir números de telefone" });
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

  // Rota para corrigir conversas com LIDs incorretos do WhatsApp
  app.post("/api/conversas/fix-lids", async (req, res) => {
    try {
      console.log("=== INICIANDO CORREÇÃO DE LIDs ===");
      
      // Helper para validar se é número brasileiro válido
      const isValidBrazilianPhone = (phone: string): boolean => {
        return /^55\d{10,11}$/.test(phone);
      };
      
      // Helper para detectar se parece ser um LID
      const looksLikeLID = (phone: string): boolean => {
        // LIDs geralmente são números grandes que não seguem formato brasileiro
        return phone.length > 13 || !isValidBrazilianPhone(phone);
      };
      
      const allConversas = await storage.getConversas();
      const conversasByName = new Map<string, typeof allConversas>();
      const lidsFixed: any[] = [];
      let totalFixed = 0;
      
      // Agrupar conversas por nome
      allConversas.forEach(conversa => {
        const nome = conversa.nome;
        if (!conversasByName.has(nome)) {
          conversasByName.set(nome, []);
        }
        conversasByName.get(nome)!.push(conversa);
      });
      
      // Processar conversas com mesmo nome
      for (const [nome, conversas] of conversasByName.entries()) {
        if (conversas.length > 1) {
          // Separar conversas válidas e com LID
          const validPhoneConversas = conversas.filter(c => isValidBrazilianPhone(c.telefone));
          const lidConversas = conversas.filter(c => looksLikeLID(c.telefone));
          
          if (validPhoneConversas.length > 0 && lidConversas.length > 0) {
            // Temos conversas duplicadas: uma com número real e outra com LID
            console.log(`\n📱 Encontradas conversas duplicadas para "${nome}":`);
            console.log(`  - Conversas com número válido: ${validPhoneConversas.length}`);
            console.log(`  - Conversas com LID: ${lidConversas.length}`);
            
            // Usar a conversa com número válido como principal
            const mainConversa = validPhoneConversas[0];
            console.log(`  ✅ Conversa principal: ID ${mainConversa.id}, telefone ${mainConversa.telefone}`);
            
            // Mesclar conversas com LID
            for (const lidConversa of lidConversas) {
              console.log(`  🔄 Mesclando conversa LID: ID ${lidConversa.id}, LID ${lidConversa.telefone}`);
              
              // Mover mensagens da conversa LID para a principal
              const mensagens = await storage.getMensagensByConversaId(lidConversa.id);
              console.log(`    - Movendo ${mensagens.length} mensagens...`);
              
              for (const mensagem of mensagens) {
                // Verificar se mensagem já existe na conversa principal (evitar duplicatas)
                if (mensagem.whatsappMessageId) {
                  const existingMessage = await storage.getMensagemByWhatsappId(mensagem.whatsappMessageId);
                  if (existingMessage && existingMessage.conversaId === mainConversa.id) {
                    console.log(`    - Mensagem ${mensagem.whatsappMessageId} já existe na conversa principal, pulando...`);
                    continue;
                  }
                }
                
                // Atualizar mensagem para apontar para conversa principal
                await storage.updateMensagem(mensagem.id, {
                  conversaId: mainConversa.id
                });
              }
              
              // Mover tickets
              const tickets = await storage.getTicketsByConversaId(lidConversa.id);
              console.log(`    - Movendo ${tickets.length} tickets...`);
              for (const ticket of tickets) {
                await storage.updateTicket(ticket.id, {
                  conversaId: mainConversa.id
                });
              }
              
              // Registrar correção
              lidsFixed.push({
                nome,
                lidRemovido: lidConversa.telefone,
                numeroCorreto: mainConversa.telefone,
                mensagensMovidas: mensagens.length,
                ticketsMovidos: tickets.length,
                conversaIdRemovida: lidConversa.id,
                conversaIdPrincipal: mainConversa.id
              });
              
              // Deletar conversa com LID
              console.log(`    - Deletando conversa LID ${lidConversa.id}...`);
              await storage.deleteConversa(lidConversa.id);
              totalFixed++;
            }
          }
        }
      }
      
      console.log(`\n=== CORREÇÃO CONCLUÍDA ===`);
      console.log(`Total de conversas LID corrigidas: ${totalFixed}`);
      
      res.json({
        success: true,
        message: `Correção concluída. ${totalFixed} conversas com LID foram mescladas.`,
        totalFixed,
        details: lidsFixed
      });
    } catch (error) {
      console.error("Erro ao corrigir conversas com LID:", error);
      res.status(500).json({ error: "Erro ao corrigir conversas com LID" });
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
          dataUltimaMensagem: new Date(), // Set timestamp in UTC (conversion happens on display)
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
      // Get conversations with limit to avoid timeout
      const { limit = 30 } = req.query; // Reduced limit for better performance
      const conversas = await storage.getConversas(parseInt(limit as string));

      // Quick return if no conversations
      if (!conversas || conversas.length === 0) {
        return res.json([]);
      }

      // Get all tests once to avoid repeated queries
      const testes = await storage.getTestes();
      
      // Create a set of test phone numbers for O(1) lookup
      const testPhones = new Set(testes.map(teste => teste.telefone));

      // Process conversations in smaller batches to avoid timeout
      const batchSize = 10;
      const conversasEnriquecidas = [];
      
      for (let i = 0; i < conversas.length; i += batchSize) {
        const batch = conversas.slice(i, i + batchSize);
        
        const enrichedBatch = await Promise.all(
          batch.map(async (conversa) => {
            try {
              // Only fetch client if needed (don't run parallel queries for each conversation)
              const cliente = await storage.getClienteByTelefone(conversa.telefone);
              
              // Check if this phone number has a test (active or inactive)
              const cleanPhone = conversa.telefone.replace(/^55/, ""); // Remove country code
              const isTeste = testPhones.has(cleanPhone);

              // If ultimaMensagem is null, fetch last message
              let ultimaMensagem = conversa.ultimaMensagem;
              let tipoUltimaMensagem = conversa.tipoUltimaMensagem;

              if (!ultimaMensagem) {
                const lastMessageData = await storage.getMensagensByConversaId(conversa.id, 1, 0);
                if (lastMessageData.length > 0) {
                  ultimaMensagem = lastMessageData[0].conteudo;
                  tipoUltimaMensagem = lastMessageData[0].tipo;
                  // Update the conversation in the database (don't await to avoid blocking)
                  storage.updateConversa(conversa.id, {
                    ultimaMensagem: ultimaMensagem,
                    tipoUltimaMensagem: tipoUltimaMensagem,
                    dataUltimaMensagem: lastMessageData[0].timestamp,
                  }).catch(err => console.error("Failed to update conversation:", err));
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
            } catch (error) {
              console.error('Error processing conversation:', conversa.id, error);
              // Return the conversation as-is if there's an error
              return {
                ...conversa,
                isCliente: false,
                isTeste: false,
              };
            }
          })
        );
        
        conversasEnriquecidas.push(...enrichedBatch);
      }

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

  // Anotações Routes
  app.get("/api/anotacoes", async (req, res) => {
    try {
      const anotacoes = await storage.getAnotacoes();
      res.json(anotacoes);
    } catch (error) {
      console.error("Erro ao buscar anotações:", error);
      res.status(500).json({ error: "Falha ao buscar anotações" });
    }
  });

  app.get("/api/anotacoes/:id", async (req, res) => {
    try {
      const anotacao = await storage.getAnotacaoById(parseInt(req.params.id));
      if (!anotacao) {
        return res.status(404).json({ error: "Anotação não encontrada" });
      }
      res.json(anotacao);
    } catch (error) {
      console.error("Erro ao buscar anotação:", error);
      res.status(500).json({ error: "Falha ao buscar anotação" });
    }
  });

  app.post("/api/anotacoes", async (req, res) => {
    try {
      const { titulo, descricao, prioridade, cor, categoria, prazo } = req.body;
      
      if (!titulo) {
        return res.status(400).json({ error: "Título é obrigatório" });
      }

      const anotacao = await storage.createAnotacao({
        titulo,
        descricao,
        prioridade: prioridade || "media",
        cor: cor || "#4F46E5",
        categoria,
        prazo: prazo ? new Date(prazo) : null,
        concluida: false,
        ordem: 0
      });
      
      res.status(201).json(anotacao);
    } catch (error) {
      console.error("Erro ao criar anotação:", error);
      res.status(500).json({ error: "Falha ao criar anotação" });
    }
  });

  app.put("/api/anotacoes/:id", async (req, res) => {
    try {
      const anotacao = await storage.updateAnotacao(parseInt(req.params.id), req.body);
      res.json(anotacao);
    } catch (error) {
      console.error("Erro ao atualizar anotação:", error);
      res.status(500).json({ error: "Falha ao atualizar anotação" });
    }
  });

  app.delete("/api/anotacoes/:id", async (req, res) => {
    try {
      await storage.deleteAnotacao(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao deletar anotação:", error);
      res.status(500).json({ error: "Falha ao deletar anotação" });
    }
  });

  app.put("/api/anotacoes/reorder", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "IDs devem ser um array" });
      }
      await storage.reorderAnotacoes(ids);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao reordenar anotações:", error);
      res.status(500).json({ error: "Falha ao reordenar anotações" });
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

      // If test is already deleted, permanently remove from database
      if (teste.status === "deletado") {
        // Permanently delete from database
        await storage.deleteTeste(teste.id);
        
        // Broadcast test permanent delete event
        broadcastMessage("test_permanently_deleted", {
          id: teste.id,
        });
        
        res.json({ message: "Teste excluído permanentemente do banco de dados" });
      } else {
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
      }
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

  // Configuração PIX para Woovi (sem webhookSecret pois Woovi usa API key)
  app.post("/api/pix/configure", async (req, res) => {
    try {
      const { appId, correlationID, expiresIn } = req.body;

      // Salvar configuração no banco
      const existingConfig = await storage.getIntegracaoByTipo("pix");

      const configuracoes = {
        appId,
        correlationID: correlationID || `TVON_PIX_${Date.now()}`,
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

  // Webhook do Woovi
  app.post("/api/pix/webhook", async (req, res) => {
    try {
      console.log("🔔 ==================================================");
      console.log("🔔 WEBHOOK PIX RECEBIDO DO WOOVI");
      console.log("🔔 ==================================================");
      console.log("📅 Data/Hora:", new Date().toISOString());
      console.log("📨 Headers:", JSON.stringify(req.headers, null, 2));
      console.log("📦 Body completo:", JSON.stringify(req.body, null, 2));
      
      // Extrair informações importantes para log
      const event = req.body?.event || req.body?.type || 'UNKNOWN';
      const charge = req.body?.charge || req.body?.data || req.body;
      const chargeId = charge?.identifier || charge?.id || charge?.correlationID;
      
      console.log("🎯 Informações principais:");
      console.log("  - Evento:", event);
      console.log("  - ChargeId/Identifier:", chargeId);
      console.log("  - CorrelationID:", charge?.correlationID);
      console.log("  - Status:", charge?.status);
      console.log("  - Valor:", charge?.value || charge?.amount);

      // O Woovi autentica webhooks usando a própria API Key, não precisa validar assinatura adicional
      // A segurança vem do endpoint único e da validação dos dados

      // Processar evento do webhook
      await pixService.processWebhook(req.body);

      console.log("✅ Webhook processado com sucesso!");
      console.log("🔔 ==================================================");
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("❌ ERRO AO PROCESSAR WEBHOOK:", error);
      console.log("🔔 ==================================================");
      res.status(500).json({ error: "Erro ao processar webhook" });
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

  // Buscar pagamentos manuais por telefone
  app.get("/api/pix/conversa/:telefone", async (req, res) => {
    try {
      const { telefone } = req.params;
      console.log('[PIX] Buscando pagamentos para telefone:', telefone);
      
      // Buscar últimos pagamentos manuais deste telefone
      const result = await db.execute(sql`
        SELECT * FROM pagamentos_manual 
        WHERE telefone = ${telefone}
        ORDER BY data_criacao DESC
        LIMIT 5
      `);
      
      // Filtrar apenas pagamentos recentes (últimas 24h)
      const now = new Date();
      const pagamentos = result.filter((p: any) => {
        if (p.status === 'pago') return true; // Sempre mostrar pagamentos pagos
        if (p.data_vencimento) {
          const vencimento = new Date(p.data_vencimento);
          return vencimento > now; // Só mostrar pendentes não expirados
        }
        // Se não tem vencimento, considera 24h desde a criação
        const criacao = new Date(p.data_criacao);
        const expiracaoDefault = new Date(criacao.getTime() + 24 * 60 * 60 * 1000);
        return expiracaoDefault > now;
      });
      
      console.log('[PIX] Pagamentos encontrados:', pagamentos.length);
      res.json(pagamentos);
    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });
  
  // DEBUG: Endpoint para verificar todos os pagamentos manuais
  app.get("/api/pix/debug/pagamentos-manual", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, telefone, valor, status, charge_id, pix_id, data_criacao, data_pagamento 
        FROM pagamentos_manual 
        ORDER BY id DESC 
        LIMIT 20
      `);
      
      console.log('[DEBUG PIX] Pagamentos manuais no banco:', result.length);
      result.forEach((p: any) => {
        console.log(`[DEBUG PIX] ID: ${p.id}, ChargeId: ${p.charge_id}, Status: ${p.status}, Telefone: ${p.telefone}`);
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar pagamentos para debug:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos para debug" });
    }
  });
  
  // TEST: Endpoint para testar webhook do PIX
  app.post("/api/pix/test-webhook", async (req, res) => {
    try {
      console.log("🧪 TEST WEBHOOK - Simulando webhook do Woovi");
      
      const { chargeId } = req.body;
      if (!chargeId) {
        return res.status(400).json({ error: "ChargeId é obrigatório" });
      }
      
      // Simular estrutura do webhook do Woovi
      const mockWebhook = {
        event: "OPENPIX:CHARGE_COMPLETED",
        charge: {
          identifier: chargeId,
          id: chargeId,
          correlationID: `TVON_PIX_TEST_${Date.now()}`,
          status: "COMPLETED",
          value: 100, // 1 real em centavos
          customer: {
            phone: "5514991949280",
            name: "Cliente Teste"
          }
        }
      };
      
      console.log("🧪 Enviando webhook simulado:", JSON.stringify(mockWebhook, null, 2));
      
      // Processar webhook simulado
      await pixService.processWebhook(mockWebhook);
      
      res.json({ success: true, message: "Webhook simulado processado" });
    } catch (error: any) {
      console.error("❌ Erro no teste do webhook:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verificar status de pagamento PIX
  app.get("/api/pix/status/:chargeId", async (req, res) => {
    try {
      const { chargeId } = req.params;
      console.log('[PIX] Verificando status do pagamento:', chargeId);
      
      // Buscar pagamento manual no banco
      const result = await db.execute(sql`
        SELECT status FROM pagamentos_manual 
        WHERE charge_id = ${chargeId}
        LIMIT 1
      `);
      
      if (result.length > 0) {
        console.log('[PIX] Status encontrado:', result[0].status);
        res.json({ status: result[0].status });
      } else {
        res.status(404).json({ error: "Pagamento não encontrado" });
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      res.status(500).json({ error: "Erro ao verificar status" });
    }
  });

  // Cancelar pagamento PIX
  app.post("/api/pix/cancel/:chargeId", async (req, res) => {
    try {
      const { chargeId } = req.params;
      console.log('[PIX] Cancelando pagamento:', chargeId);
      
      // Atualizar status no banco para cancelado
      await db.execute(sql`
        UPDATE pagamentos_manual 
        SET status = 'cancelado', updated_at = NOW()
        WHERE charge_id = ${chargeId} AND status = 'pendente'
      `);
      
      console.log('[PIX] Pagamento cancelado com sucesso');
      res.json({ success: true, message: "Pagamento cancelado com sucesso" });
    } catch (error) {
      console.error("Erro ao cancelar pagamento:", error);
      res.status(500).json({ error: "Erro ao cancelar pagamento" });
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

  // Check for divergences between API and database
  app.get("/api/system-divergences", async (req, res) => {
    try {
      const apiSystems = await externalApiService.getSystemCredentials();
      const localSistemas = await db.select().from(sistemas);
      
      const divergences = [];
      
      // Check for systems in API but not in database
      for (const apiSystem of apiSystems) {
        const localSystem = localSistemas.find(s => s.systemId === apiSystem.system_id);
        if (!localSystem) {
          divergences.push({
            type: 'missing_in_db',
            systemId: apiSystem.system_id,
            message: `Sistema ${apiSystem.system_id} existe na API mas não no banco de dados`
          });
        } else if (localSystem.username !== apiSystem.username || localSystem.password !== apiSystem.password) {
          divergences.push({
            type: 'credentials_mismatch',
            systemId: apiSystem.system_id,
            message: `Credenciais do sistema ${apiSystem.system_id} diferem entre API e banco`
          });
        }
      }
      
      // Check for systems in database but not in API
      for (const localSystem of localSistemas) {
        const apiSystem = apiSystems.find((s: any) => s.system_id === localSystem.systemId);
        if (!apiSystem) {
          divergences.push({
            type: 'missing_in_api',
            systemId: localSystem.systemId,
            message: `Sistema ${localSystem.systemId} existe no banco mas não na API`
          });
        }
      }
      
      res.json({
        hasDivergences: divergences.length > 0,
        count: divergences.length,
        divergences
      });
    } catch (error) {
      console.error("Erro ao verificar divergências:", error);
      res.status(500).json({ error: "Erro ao verificar divergências" });
    }
  });

  // Config TV - Systems endpoints
  app.get("/api/external-api/systems", async (req, res) => {
    try {
      const systems = await externalApiService.getSystemCredentials();

      // Sync systems from API to local database (create missing ones)
      for (const system of systems) {
        const localSystem = await storage.getSistemaBySystemId(system.system_id);
        if (!localSystem) {
          console.log(`Sistema ${system.system_id} não encontrado no banco local, criando...`);
          await storage.createSistema({
            systemId: system.system_id,
            username: system.username,
            password: system.password,
          });
        }
      }

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
          expiracao: localSistema?.expiracao || null, // Adiciona o campo expiracao do banco local
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
          } else {
            // Create new system in local database if it doesn't exist
            console.log(`Sistema ${id} não encontrado no banco local, criando com novo ID ${system_id}...`);
            await storage.createSistema({
              systemId: system_id,
              username: createResult.username || username,
              password: createResult.password || password,
            });
          }
        }

        res.json(createResult);
      } else {
        // Normal update (just username/password)
        let result;
        try {
          result = await externalApiService.updateSystemCredential(
            parseInt(id),
            { username, password },
          );
        } catch (updateError: any) {
          // If system doesn't exist in API (404), create it
          if (updateError.status === 404 || updateError.response?.status === 404) {
            console.log(`Sistema ${id} não encontrado na API, criando novo...`);
            result = await externalApiService.createSystemCredential({
              system_id: id,
              username,
              password,
            });
          } else {
            throw updateError;
          }
        }

        // Also update in local database
        if (result) {
          const localSystem = await storage.getSistemaBySystemId(id);
          if (localSystem) {
            // Update existing system in local database
            console.log(`Atualizando sistema ${id} no banco local:`, { username, password });
            await storage.updateSistema(localSystem.id, {
              username: username || localSystem.username,
              password: password || localSystem.password,
            });
            console.log(`Sistema ${id} atualizado com sucesso no banco local`);
          } else {
            // Create new system in local database if it doesn't exist
            console.log(`Sistema ${id} não encontrado no banco local, criando...`);
            await storage.createSistema({
              systemId: id,
              username: username,
              password: password,
            });
            console.log(`Sistema ${id} criado com sucesso no banco local`);
          }
        } else {
          // Even if API didn't return a result, update local database
          console.log(`Atualizando sistema ${id} no banco local (sem resposta da API)...`);
          const localSystem = await storage.getSistemaBySystemId(id);
          if (localSystem) {
            await storage.updateSistema(localSystem.id, {
              username: username || localSystem.username,
              password: password || localSystem.password,
            });
            console.log(`Sistema ${id} atualizado no banco local`);
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

  // Update system expiration date
  app.put("/api/sistemas/:id/expiration", async (req, res) => {
    try {
      const sistemaId = parseInt(req.params.id);
      const { expiracao } = req.body;
      
      if (!expiracao) {
        return res.status(400).json({ error: "Data de expiração é obrigatória" });
      }
      
      // Update in local database
      const localSystem = await storage.getSistemaById(sistemaId);
      if (!localSystem) {
        return res.status(404).json({ error: "Sistema não encontrado" });
      }
      
      const expiracaoDate = new Date(expiracao);
      await db.update(sistemas)
        .set({ 
          expiracao: expiracaoDate,
          atualizadoEm: new Date()
        })
        .where(eq(sistemas.id, sistemaId));
      
      res.json({ 
        message: "Data de expiração atualizada com sucesso",
        expiracao: expiracaoDate
      });
    } catch (error) {
      console.error("Erro ao atualizar expiração:", error);
      res.status(500).json({ error: "Erro ao atualizar data de expiração" });
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

  // Endpoints de Renovação Automática de Sistemas
  app.get("/api/sistemas/para-renovar", async (req, res) => {
    try {
      const sistemas = await storage.getSistemasParaRenovar();
      res.json(sistemas);
    } catch (error) {
      console.error("Erro ao buscar sistemas para renovar:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas para renovar" });
    }
  });

  app.get("/api/sistemas/vencidos", async (req, res) => {
    try {
      const sistemas = await storage.getSistemasVencidos();
      res.json(sistemas);
    } catch (error) {
      console.error("Erro ao buscar sistemas vencidos:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas vencidos" });
    }
  });

  app.get("/api/sistemas/proximo-vencimento/:dias", async (req, res) => {
    try {
      const dias = parseInt(req.params.dias);
      const sistemas = await storage.getSistemasProximoVencimento(dias);
      res.json(sistemas);
    } catch (error) {
      console.error("Erro ao buscar sistemas próximo ao vencimento:", error);
      res.status(500).json({ error: "Erro ao buscar sistemas próximo ao vencimento" });
    }
  });

  // Atualizar configuração de renovação de um sistema
  app.patch("/api/sistemas/:id/renewal-config", async (req, res) => {
    try {
      const { autoRenewalEnabled, renewalAdvanceTime } = req.body;
      const result = await storage.updateSistema(Number(req.params.id), {
        autoRenewalEnabled,
        renewalAdvanceTime
      });
      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar configuração de renovação:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração de renovação" });
    }
  });

  // Atualizar validade de um sistema
  app.patch("/api/sistemas/:id/expiration", async (req, res) => {
    try {
      const { expiracao } = req.body;
      const result = await storage.updateSistema(Number(req.params.id), {
        expiracao: new Date(expiracao)
      });
      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar validade do sistema:", error);
      res.status(500).json({ error: "Erro ao atualizar validade do sistema" });
    }
  });

  // Gerar novo sistema automaticamente
  app.post("/api/sistemas/auto-generate", async (req, res) => {
    try {
      console.log('🚀 Iniciando geração automática de sistema...');
      const { sistemaId } = req.body; // Receber sistemaId se for renovação
      
      // 1. Criar tarefa para extensão Chrome gerar credenciais
      const task = await storage.createPendingTask('single_generation', {
        purpose: 'auto_generate_system',
        sistemaId: sistemaId // Passar sistemaId para o metadata
      });
      
      console.log(`📝 Tarefa criada com ID ${task.id}`);
      
      // 2. Aguardar a tarefa ser processada (timeout de 30 segundos)
      const maxWaitTime = 30000; // 30 seconds
      const checkInterval = 1000; // Check every second
      const startTime = Date.now();
      
      let completedTask = null;
      while (Date.now() - startTime < maxWaitTime) {
        // Check if task is completed
        const taskStatus = await storage.getOfficeAutomationTaskById(task.id);
        
        if (taskStatus && taskStatus.status === 'completed') {
          completedTask = taskStatus;
          break;
        } else if (taskStatus && taskStatus.status === 'error') {
          console.error('❌ Erro na geração de credenciais:', taskStatus.errorMessage);
          return res.status(500).json({ 
            error: 'Erro ao gerar credenciais',
            details: taskStatus.errorMessage 
          });
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      if (!completedTask) {
        console.error('⏰ Timeout esperando geração de credenciais');
        return res.status(408).json({ error: 'Timeout aguardando geração de credenciais. Certifique-se de que a extensão Chrome está instalada e ativa.' });
      }
      
      // 3. Extrair credenciais do resultado
      let credentials;
      try {
        // O resultado pode vir diretamente nos campos username/password
        if (completedTask.username && completedTask.password) {
          credentials = {
            username: completedTask.username,
            password: completedTask.password
          };
        } else if (completedTask.result) {
          // Ou pode vir no campo result como JSON
          const resultData = typeof completedTask.result === 'string' 
            ? JSON.parse(completedTask.result) 
            : completedTask.result;
          credentials = {
            username: resultData.username || resultData.user,
            password: resultData.password || resultData.pass
          };
        }
        
        if (!credentials || !credentials.username || !credentials.password) {
          throw new Error('Credenciais incompletas');
        }
      } catch (error) {
        console.error('❌ Erro ao processar credenciais:', error);
        return res.status(500).json({ 
          error: 'Erro ao processar credenciais geradas',
          details: error.message
        });
      }
      
      console.log(`✅ Credenciais geradas: ${credentials.username}`);
      
      // 4. Criar ou atualizar o sistema com as credenciais geradas
      const sistema = await storage.createSistemaAutoGenerated({
        username: credentials.username,
        password: credentials.password,
        nome: `Sistema Auto ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
        url: 'https://onlineoffice.zip/iptv/',
        sistemaId: sistemaId // Passar o sistemaId se for renovação
      });
      
      console.log(`💾 Sistema ${sistemaId ? 'atualizado' : 'criado'} com ID ${sistema.id} e systemId ${sistema.systemId}`);
      
      // 5. Retornar o sistema criado
      res.json({
        success: true,
        sistema: sistema
      });
      
    } catch (error) {
      console.error('Erro ao gerar sistema automaticamente:', error);
      res.status(500).json({ 
        error: 'Erro ao gerar sistema automaticamente',
        details: error.message 
      });
    }
  });

  // Renovar sistema manualmente
  app.post("/api/sistemas/:id/renew", async (req, res) => {
    try {
      const sistemaId = Number(req.params.id);
      
      // Marcar como renovando
      await storage.marcarSistemaComoRenovando(sistemaId);
      
      // Criar tarefa para extensão
      const task = await storage.createPendingTask('renew_system', {
        sistemaId
      });
      
      res.json({
        message: "Renovação iniciada",
        taskId: task.id
      });
    } catch (error) {
      console.error("Erro ao iniciar renovação:", error);
      res.status(500).json({ error: "Erro ao iniciar renovação do sistema" });
    }
  });

  // Processar renovação automática (chamado pelo serviço de renovação)
  app.post("/api/sistemas/process-renewal", async (req, res) => {
    try {
      const { sistemaId, username, password } = req.body;
      
      if (!sistemaId || !username || !password) {
        return res.status(400).json({ error: "Dados incompletos para renovação" });
      }
      
      // Atualizar sistema com novas credenciais
      const result = await storage.updateSistemaRenewal(sistemaId, username, password);
      
      // Registrar renovação automática
      await storage.registrarRenovacaoAutomatica(sistemaId, { username, password });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao processar renovação:", error);
      res.status(500).json({ error: "Erro ao processar renovação" });
    }
  });

  // Obter logs de renovação
  app.get("/api/sistemas/renewal-logs", async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const renewalLogs = await db
        .select()
        .from(logs)
        .where(eq(logs.origem, 'sistema_renewal'))
        .orderBy(desc(logs.timestamp))
        .limit(parseInt(limit as string));
      
      res.json(renewalLogs);
    } catch (error) {
      console.error("Erro ao buscar logs de renovação:", error);
      res.status(500).json({ error: "Erro ao buscar logs de renovação" });
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
      let apiUsers: any[] = [];
      let apiConnected = false;
      let apiRedirectUrl = "";

      try {
        apiSystems = await externalApiService.getSystemCredentials();
        apiUsers = await externalApiService.getUsers();
        apiConnected = true;
        
        // Get redirect_base_url from API externa
        try {
          const redirectUrlSetting = await externalApiService.getSetting("redirect_base_url");
          if (redirectUrlSetting?.setting_value) {
            apiRedirectUrl = redirectUrlSetting.setting_value;
          }
        } catch (settingError) {
          console.log("Não foi possível obter redirect_base_url da API:", settingError);
        }
      } catch (error) {
        console.log("API não conectada para verificação de sincronização");
      }

      // Get local users (pontos)
      const localPontos = await storage.getPontos();
      
      // Get redirect URLs
      const redirectUrls = await storage.getRedirectUrls();
      const principalUrl = redirectUrls.find(url => url.isPrincipal);

      // Get integration status
      const integration = await storage.getIntegracaoByTipo("api_externa");

      res.json({
        apiConnected,
        localSystemsCount: localSystems.length,
        apiSystemsCount: apiSystems.length,
        localUsersCount: localPontos.length,
        apiUsersCount: apiUsers.length,
        inSync: apiConnected && localSystems.length === apiSystems.length,
        lastSync: integration?.ultimaAtualizacao || null,
        localUrl: principalUrl?.url || "Nenhuma URL principal configurada",
        apiRedirectUrl: apiRedirectUrl || "Nenhuma URL configurada na API",
      });
    } catch (error) {
      console.error("Erro ao verificar status de sincronização:", error);
      res
        .status(500)
        .json({ error: "Erro ao verificar status de sincronização" });
    }
  });

  // Route to fix messages incorrectly marked as "Visualização única"
  app.post("/api/fix-view-once-messages", async (req, res) => {
    try {
      console.log("Starting fix for incorrectly marked view-once messages...");
      
      // Find all messages with "Visualização única" content
      const result = await db
        .update(mensagens)
        .set({ 
          conteudo: "[Mensagem não suportada]"
        })
        .where(
          and(
            eq(mensagens.conteudo, "Visualização única"),
            sql`${mensagens.metadados}->>'viewOnceType' IS NULL`
          )
        );
      
      console.log(`Fixed incorrectly marked messages`);
      
      res.json({ 
        success: true, 
        message: `Mensagens corrigidas com sucesso`
      });
    } catch (error) {
      console.error("Error fixing view-once messages:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao corrigir mensagens",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint duplicado removido - usando o de baixo que realmente salva no banco

  // OnlineOffice automation route
  app.post("/api/office/generate-iptv-test", async (req, res) => {
    try {
      console.log("🚀 Iniciando automação OnlineOffice...");
      
      // Import the automation service
      const { officeAutomation } = await import("./services/office-automation");
      
      // Run the automation
      const result = await officeAutomation.generateIPTVTest();
      
      if (result.error) {
        console.error("❌ Erro na automação:", result.error);
        return res.status(500).json({
          success: false,
          message: "Erro ao gerar teste IPTV",
          error: result.error
        });
      }
      
      console.log("✅ Teste IPTV gerado com sucesso!");
      res.json({
        success: true,
        usuario: result.usuario,
        senha: result.senha,
        vencimento: result.vencimento,
        message: "Teste IPTV gerado com sucesso!"
      });
    } catch (error) {
      console.error("❌ Erro na rota de automação:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao gerar teste IPTV",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // OnlineOffice automation route with Puppeteer
  app.post("/api/office/generate-iptv-auto", async (req, res) => {
    try {
      console.log("🚀 Iniciando automação OnlineOffice com Puppeteer...");
      
      const officeService = OnlineOfficeService.getInstance();
      const result = await officeService.generateIPTVTest();
      
      console.log("✅ Teste IPTV gerado com sucesso via Puppeteer!");
      res.json({
        success: true,
        usuario: result.usuario,
        senha: result.senha,
        vencimento: result.vencimento,
        message: "Teste IPTV gerado com sucesso!"
      });
    } catch (error) {
      console.error("❌ Erro na automação Puppeteer:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao executar automação",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // OnlineOffice manual extraction route
  app.post("/api/office/extract-credentials", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Texto com as credenciais é obrigatório"
        });
      }
      
      const officeService = OnlineOfficeService.getInstance();
      const result = await officeService.generateIPTVTestManual(text);
      
      res.json({
        success: true,
        usuario: result.usuario,
        senha: result.senha,
        vencimento: result.vencimento,
        message: "Credenciais extraídas com sucesso!"
      });
    } catch (error) {
      console.error("❌ Erro na extração de credenciais:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao extrair credenciais",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Click the "Gerar IPTV" button in OnlineOffice
  app.post("/api/office/click-generate-button", async (req, res) => {
    try {
      const puppeteer = (await import('puppeteer')).default;
      
      const browser = await puppeteer.launch({
        headless: false, // Show browser
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1280,720'
        ],
      });

      const page = await browser.newPage();
      await page.goto('https://onlineoffice.zip/', { waitUntil: 'networkidle2' });
      
      // Wait for and click the "Gerar IPTV" button
      await page.waitForSelector('button.btn-outline-success', { timeout: 5000 });
      await page.click('button.btn-outline-success');
      
      // Wait a moment for the modal to appear
      await page.waitForTimeout(1000);
      
      // Keep browser open for user interaction
      res.json({
        success: true,
        message: "Botão clicado! A janela do navegador ficará aberta para você copiar as credenciais."
      });
      
      // Close browser after 30 seconds
      setTimeout(() => {
        browser.close().catch(console.error);
      }, 30000);
      
    } catch (error) {
      console.error("Erro ao clicar no botão:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao clicar no botão",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // OnlineOffice automation with advanced human behavior simulation
  app.post("/api/office/generate-human", async (req, res) => {
    try {
      console.log("🎭 Iniciando automação OnlineOffice com comportamento humano...");
      
      const officeService = OnlineOfficeService.getInstance();
      const result = await officeService.generateIPTVWithHumanBehavior();
      
      console.log("✅ Teste IPTV gerado com sucesso usando comportamento humano!");
      res.json({
        success: true,
        usuario: result.usuario,
        senha: result.senha,
        vencimento: result.vencimento,
        message: "Teste IPTV gerado com sucesso com comportamento humano!"
      });
    } catch (error) {
      console.error("❌ Erro na automação humanizada:", error);
      
      // Check if it's a blocking error
      if (error instanceof Error && error.message?.includes('SITE_BLOQUEADO')) {
        return res.status(403).json({
          success: false,
          message: "Site detectou a automação",
          error: error.message,
          suggestion: "Use a opção de extração manual ou tente novamente mais tarde"
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Erro ao gerar teste IPTV com comportamento humano",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Download Chrome Extension for OnlineOffice IPTV
  app.get("/api/office/download-extension", async (req, res) => {
    try {
      const extensionPath = path.join(process.cwd(), 'chrome-extension');
      
      // Check if extension directory exists
      try {
        await fs.access(extensionPath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "Extensão não encontrada",
          error: "A pasta chrome-extension não existe"
        });
      }

      // Use tar to create an archive since zip might not be available
      const tarPath = path.join(process.cwd(), 'chrome-extension.tar.gz');
      
      try {
        // Create tar.gz file
        execSync(`tar -czf ${tarPath} -C ${process.cwd()} chrome-extension`);
        
        // Read the tar file
        const tarData = await fs.readFile(tarPath);
        
        // Clean up the temporary file
        await fs.unlink(tarPath);
        
        // Send the file
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', 'attachment; filename="onlineoffice-chrome-extension.tar.gz"');
        return res.send(tarData);
        
      } catch (tarError) {
        console.error("Erro ao criar arquivo tar:", tarError);
        
        // If tar doesn't work, provide manual download instructions
        return res.json({
          success: false,
          message: "Download automático não disponível",
          instructions: [
            "Por favor, faça o download manual dos arquivos:",
            "1. Acesse a pasta 'chrome-extension' no projeto",
            "2. Baixe todos os arquivos manualmente",
            "3. Crie uma pasta local e coloque os arquivos",
            "4. Siga as instruções de instalação no painel"
          ],
          files: [
            "manifest.json",
            "content.js",
            "popup.html",
            "popup.js",
            "popup.css",
            "background.js",
            "icons/*"
          ]
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao preparar download da extensão:', error);
      res.status(500).json({
        success: false,
        message: "Erro ao preparar download da extensão",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Download Chrome Extension as ZIP for OnlineOffice IPTV
  app.get("/api/office/automation/extension.zip", async (req, res) => {
    try {
      const archiver = (await import('archiver')).default;
      const extensionPath = path.join(process.cwd(), 'chrome-extension');
      
      // Check if extension directory exists BEFORE setting headers
      try {
        await fs.access(extensionPath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "Extensão não encontrada",
          error: "A pasta chrome-extension não existe"
        });
      }

      // Create archive first to check for errors before sending headers
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors - but don't send JSON after headers are set
      archive.on('error', (err) => {
        console.error('❌ Erro ao criar arquivo ZIP:', err);
        // If headers not sent yet, send error JSON
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Erro ao criar arquivo ZIP",
            error: err.message
          });
        } else {
          // If headers already sent, just end the response
          res.end();
        }
      });

      // Handle warning events (non-fatal)
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('⚠️ Arquivo não encontrado durante compressão:', err);
        } else {
          console.error('❌ Aviso do archiver:', err);
        }
      });

      // Set response headers for zip download ONLY after archive is ready
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="onlineoffice-chrome-extension.zip"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Pipe archive data to the response
      archive.pipe(res);

      // Add the entire chrome-extension directory to the archive
      archive.directory(extensionPath, false);

      // Finalize the archive - this will trigger the stream to start
      await archive.finalize();
      
      console.log('✅ Extensão Chrome preparada para download com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao preparar download da extensão em ZIP:', error);
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Erro ao preparar download da extensão",
          error: error instanceof Error ? error.message : "Erro desconhecido"
        });
      } else {
        // If headers were already sent, we can't send JSON
        res.end();
      }
    }
  });

  // Save credentials from Chrome Extension
  app.post("/api/office/save-credentials", async (req, res) => {
    try {
      const { usuario, senha, vencimento, source, taskType, systemId, taskId } = req.body;
      
      if (!usuario || !senha) {
        return res.status(400).json({
          success: false,
          message: "Usuário e senha são obrigatórios"
        });
      }
      
      console.log(`📥 Credenciais recebidas da ${source || 'aplicação'}:`, { usuario, vencimento });
      
      // SALVAR NO BANCO DE DADOS
      const savedCredential = await storage.createOfficeCredentials({
        username: usuario,
        password: senha,
        expiration: vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: source || 'chrome-extension',
        status: 'active',
        generatedAt: new Date().toISOString()
      });
      
      console.log('✅ Credencial salva no banco com ID:', savedCredential.id);
      
      // Processar renovação automática se for o caso
      if (taskType === 'renewal' && systemId) {
        try {
          console.log(`🔄 Processando renovação automática para sistema ${systemId}`);
          
          // Adicionar 6 horas à expiração
          const novaExpiracao = new Date();
          novaExpiracao.setHours(novaExpiracao.getHours() + 6);
          
          // Atualizar sistema com novas credenciais
          await storage.updateSistemaRenewal(systemId, usuario, senha);
          
          // Registrar renovação automática
          await storage.registrarRenovacaoAutomatica(systemId, {
            username: usuario,
            password: senha
          });
          
          // Atualizar task como completa se houver taskId
          if (taskId) {
            await storage.updateOfficeCredentials(taskId, {
              status: 'completed',
              metadata: {
                systemId,
                renewedAt: new Date().toISOString(),
                newExpiration: novaExpiracao.toISOString()
              }
            });
          }
          
          console.log(`✅ Sistema ${systemId} renovado com sucesso`);
          console.log(`   Novo usuário: ${usuario}`);
          console.log(`   Nova expiração: ${novaExpiracao.toISOString()}`);
          
          // Enviar notificação via WebSocket sobre renovação bem-sucedida
          broadcastMessage('system_renewal_completed', {
            systemId,
            newUsername: usuario,
            newExpiration: novaExpiracao.toISOString(),
            renewedAt: new Date().toISOString()
          });
        } catch (renewalError) {
          console.error(`❌ Erro ao processar renovação do sistema ${systemId}:`, renewalError);
          // Não falhar a requisição principal, apenas registrar o erro
        }
      }
      
      // Broadcast via WebSocket to update UI in real-time
      const wsMessage = JSON.stringify({
        type: 'extension_credentials',
        usuario,
        senha,
        vencimento: vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        source: source || 'manual',
        timestamp: new Date().toISOString()
      });
      
      // Broadcast to all connected WebSocket clients
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(wsMessage);
        }
      });
      
      res.json({
        success: true,
        message: "Credenciais salvas com sucesso",
        data: { 
          usuario, 
          vencimento,
          id: savedCredential.id 
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao salvar credenciais:', error);
      res.status(500).json({
        success: false,
        message: "Erro ao salvar credenciais",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Handle CORS preflight for Chrome Extension
  app.options("/api/office/credentials", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // Chrome Extension API endpoint for receiving credentials
  app.post("/api/office/credentials", async (req, res) => {
    try {
      console.log(`📥 [Extension] Request received:`, req.body);
      
      const { username, password, source = "extension" } = req.body;
      
      // CORS headers for extension
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (!username || !password) {
        console.error(`❌ [Extension] Missing credentials:`, { username: !!username, password: !!password });
        return res.status(400).json({
          success: false,
          message: "Username and password are required"
        });
      }
      
      console.log(`✅ [Extension] Credentials validated:`, { username, source });
      
      // Get current configuration
      console.log(`🔍 [Extension] Fetching config...`);
      const [config] = await db.select().from(officeExtensionConfig).limit(1);
      console.log(`📋 [Extension] Config found:`, !!config);
      
      // Determine which sistema to use
      let selectedSistema = null;
      if (config) {
        const sistemasList = await db.select().from(sistemas).orderBy(asc(sistemas.id));
        console.log(`📊 [Extension] Found ${sistemasList.length} sistemas`);
        
        if (sistemasList.length > 0) {
          const index = config.currentSistemaIndex % sistemasList.length;
          selectedSistema = sistemasList[index];
          console.log(`🎯 [Extension] Selected sistema:`, selectedSistema?.systemId);
          
          // Update for next use (round-robin)
          await db.update(officeExtensionConfig)
            .set({ 
              currentSistemaIndex: config.currentSistemaIndex + 1,
              totalGenerated: config.totalGenerated + 1,
              updatedAt: new Date()
            })
            .where(eq(officeExtensionConfig.id, config.id));
        }
      } else {
        console.log(`⚠️ [Extension] No config found, proceeding without sistema`);
      }
      
      // Save credentials to database
      const [savedCredential] = await db.insert(officeCredentials)
        .values({
          username,
          password,
          sistemaId: selectedSistema?.id,
          source,
          status: "active",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        })
        .returning();
      
      console.log(`✅ [Extension] Credentials saved with ID:`, savedCredential.id);
      
      // Broadcast via WebSocket
      const wsMessage = JSON.stringify({
        type: 'extension_credentials_new',
        id: savedCredential.id,
        username,
        password,
        sistema: selectedSistema?.systemId || null,
        source,
        timestamp: new Date().toISOString()
      });
      
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(wsMessage);
        }
      });
      
      res.json({
        success: true,
        message: "Credentials saved successfully",
        data: {
          id: savedCredential.id,
          username,
          sistema: selectedSistema?.systemId
        }
      });
      
    } catch (error) {
      console.error('❌ [Extension] Error saving credentials:', error);
      res.status(500).json({
        success: false,
        message: "Error saving credentials",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Get extension configuration
  app.get("/api/office/extension-config", checkAuth, async (req, res) => {
    try {
      const [config] = await db.select().from(officeExtensionConfig).limit(1);
      
      if (!config) {
        // Create default config if none exists
        const [newConfig] = await db.insert(officeExtensionConfig)
          .values({
            automationEnabled: false,
            quantityToGenerate: 10,
            intervalValue: 30,
            intervalUnit: "minutes"
          })
          .returning();
        
        return res.json({ success: true, config: newConfig });
      }
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error fetching extension config:', error);
      res.status(500).json({
        success: false,
        message: "Error fetching configuration",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Update extension configuration
  app.put("/api/office/extension-config", checkAuth, async (req, res) => {
    try {
      const { 
        automationEnabled, 
        quantityToGenerate, 
        intervalValue, 
        intervalUnit 
      } = req.body;
      
      // Get existing config or create new
      const [existingConfig] = await db.select().from(officeExtensionConfig).limit(1);
      
      let config;
      if (existingConfig) {
        [config] = await db.update(officeExtensionConfig)
          .set({
            automationEnabled,
            quantityToGenerate,
            intervalValue,
            intervalUnit,
            nextRun: automationEnabled 
              ? new Date(Date.now() + (intervalUnit === 'hours' 
                  ? intervalValue * 60 * 60 * 1000 
                  : intervalValue * 60 * 1000))
              : null,
            updatedAt: new Date()
          })
          .where(eq(officeExtensionConfig.id, existingConfig.id))
          .returning();
      } else {
        [config] = await db.insert(officeExtensionConfig)
          .values({
            automationEnabled,
            quantityToGenerate,
            intervalValue,
            intervalUnit,
            nextRun: automationEnabled 
              ? new Date(Date.now() + (intervalUnit === 'hours' 
                  ? intervalValue * 60 * 60 * 1000 
                  : intervalValue * 60 * 1000))
              : null
          })
          .returning();
      }
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating extension config:', error);
      res.status(500).json({
        success: false,
        message: "Error updating configuration",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Get generated credentials history
  app.get("/api/office/credentials-history", checkAuth, async (req, res) => {
    try {
      const credentials = await db.select({
        id: officeCredentials.id,
        username: officeCredentials.username,
        password: officeCredentials.password,
        sistemaId: officeCredentials.sistemaId,
        sistema: sistemas.systemId,
        generatedAt: officeCredentials.generatedAt,
        source: officeCredentials.source,
        status: officeCredentials.status
      })
      .from(officeCredentials)
      .leftJoin(sistemas, eq(officeCredentials.sistemaId, sistemas.id))
      .orderBy(desc(officeCredentials.generatedAt))
      .limit(50);
      
      res.json({ success: true, credentials });
    } catch (error) {
      console.error('Error fetching credentials history:', error);
      res.status(500).json({
        success: false,
        message: "Error fetching history",
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
        // Skip test users (those starting with "teste_")
        // They are local test users and don't need API sync
        if (username && username.startsWith('teste_')) {
          continue; // Skip test users
        }
        
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
        
        // Skip test users (those starting with "teste_")
        // They are local test users and don't need API sync
        if (ponto.usuario && ponto.usuario.startsWith('teste_')) {
          continue; // Skip test users
        }

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
        // Skip test users (those starting with "teste_")
        // They should not be deleted from API even if not in local
        if (apiUser.username && apiUser.username.startsWith('teste_')) {
          continue; // Skip test users
        }
        
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

  // Background sync for pontos last access from external API
  const syncPontosLastAccess = async () => {
    try {
      console.log('🔄 Sincronizando último acesso dos pontos da API externa...');
      const pontos = await storage.getAllPontos();
      const apiUsers = await externalApiService.getUsers();
      
      console.log(`📊 Encontrados ${pontos.length} pontos e ${apiUsers.length} usuários da API`);
      
      // Debug: Show first few API user IDs
      if (apiUsers.length > 0) {
        const sampleIds = apiUsers.slice(0, 5).map(u => u.id);
        console.log(`🔍 Primeiros IDs da API: ${sampleIds.join(', ')}`);
        
        // Check if we need to match by username instead of ID
        const firstApiUser = apiUsers[0];
        console.log(`🔍 Estrutura do primeiro usuário da API:`, {
          id: firstApiUser.id,
          username: firstApiUser.username,
          app_name: firstApiUser.app_name,
          last_access: firstApiUser.last_access
        });
      }
      
      // Try to match by username if IDs don't match
      const apiUsersByUsername = new Map(apiUsers.map(u => [u.username, u]));
      const apiUsersById = new Map(apiUsers.map(u => [u.id, u]));
      
      let updatedCount = 0;
      let matchedByUsername = 0;
      let matchedById = 0;
      let noMatch = 0;
      
      for (const ponto of pontos) {
        // Skip test users (those starting with "teste_")
        // They are local test users and don't need API sync
        if (ponto.usuario && ponto.usuario.startsWith('teste_')) {
          continue; // Skip this iteration for test users
        }
        
        let apiUser = null;
        
        // First try to match by apiUserId
        if (ponto.apiUserId && apiUsersById.has(ponto.apiUserId)) {
          apiUser = apiUsersById.get(ponto.apiUserId);
          matchedById++;
        }
        // If no match by ID, try to match by username
        else if (ponto.usuario && apiUsersByUsername.has(ponto.usuario)) {
          apiUser = apiUsersByUsername.get(ponto.usuario);
          matchedByUsername++;
          console.log(`📎 Ponto ${ponto.id} (usuario: ${ponto.usuario}) matched by username`);
        } else {
          noMatch++;
        }
        
        if (apiUser) {
          // Se a API retorna null, significa que nunca foi acessado
          if (apiUser.last_access === null) {
            // Limpar o último acesso se estava preenchido incorretamente
            if (ponto.ultimoAcesso !== null) {
              const updatedPonto = await storage.updatePonto(ponto.id, { ultimoAcesso: null });
              updatedCount++;
              console.log(`🔄 Ponto ${ponto.id} limpo: nunca acessado`);
              
              // Enviar atualização em tempo real via WebSocket
              broadcastMessage('ponto_updated', updatedPonto);
            }
          } else if (apiUser.last_access) {
            // Salvar o horário exatamente como vem da API, sem conversão
            const apiLastAccessStr = apiUser.last_access;
            
            // Para comparação, usar os timestamps
            const apiLastAccess = new Date(apiLastAccessStr);
            const currentLastAccess = ponto.ultimoAcesso ? new Date(ponto.ultimoAcesso) : null;
            
            // Update if no current access or if difference is more than 1 minute
            if (!currentLastAccess || Math.abs(apiLastAccess.getTime() - currentLastAccess.getTime()) > 60000) {
              const updatedPonto = await storage.updatePonto(ponto.id, { ultimoAcesso: apiLastAccess });
              updatedCount++;
              console.log(`✅ Ponto ${ponto.id} atualizado: ${apiLastAccessStr}`);
              
              // Enviar atualização em tempo real via WebSocket
              broadcastMessage('ponto_updated', updatedPonto);
            }
          }
        }
      }
      
      console.log(`✅ Sincronização concluída: ${updatedCount} pontos atualizados`);
      console.log(`📊 Estatísticas: ${matchedById} por ID, ${matchedByUsername} por username, ${noMatch} sem correspondência`);
    } catch (error) {
      console.error('❌ Erro na sincronização de último acesso:', error);
    }
  };
  
  // Run sync on startup and periodically
  setTimeout(syncPontosLastAccess, 5000); // Wait 5 seconds after startup
  setInterval(syncPontosLastAccess, 10 * 1000); // Every 10 seconds for real-time updates
  
  // Manual sync endpoint for testing
  app.post('/api/pontos/sync-access', async (req, res) => {
    try {
      await syncPontosLastAccess();
      res.json({ success: true, message: 'Sincronização de último acesso iniciada' });
    } catch (error) {
      console.error('Erro ao sincronizar acesso:', error);
      res.status(500).json({ error: 'Erro ao sincronizar último acesso' });
    }
  });

  // ============================================================================
  // OFFICE AUTOMATION APIs - Sistema profissional gerenciado pelo backend
  // ============================================================================

  // Nota: Sistema de automação agora usa banco de dados ao invés de memória

  // GET /api/office/automation/config - retorna configuração atual
  app.get('/api/office/automation/config', async (req, res) => {
    // Verificar autenticação: aceitar tanto API key da extensão quanto sessão autenticada
    const extensionKey = req.headers['x-extension-key'];
    const isAuthenticated = (req.session as any)?.user;
    
    // Se não tem nem API key nem está autenticado
    if (!extensionKey && !isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Se tem API key, verificar se é válida
    if (extensionKey && extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const config = await storage.getOfficeAutomationConfig();
      res.json(config);
    } catch (error) {
      console.error('Erro ao buscar configuração de automação:', error);
      res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
  });

  // POST /api/office/automation/config - atualiza configuração
  app.post('/api/office/automation/config', async (req, res) => {
    try {
      const config = await storage.updateOfficeAutomationConfig(req.body);
      
      // Enviar atualização via WebSocket
      broadcastMessage('office_automation_config', config);
      
      res.json(config);
    } catch (error) {
      console.error('Erro ao atualizar configuração de automação:', error);
      res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
  });

  // PUT /api/office/automation/config - atualiza configuração com validação schema
  app.put('/api/office/automation/config', checkAuth, async (req, res) => {
    try {
      const schema = z.object({
        isEnabled: z.boolean().optional(),
        batchSize: z.number().min(1).max(100).optional(),
        intervalMinutes: z.number().min(1).max(1440).optional(),
        singleGeneration: z.boolean().optional(),
        renewalAdvanceTime: z.number().min(1).max(1440).optional(), // Tempo em minutos antes do vencimento
      });

      const validated = schema.parse(req.body);
      
      // Obter configuração anterior para comparar
      const previousConfig = await storage.getOfficeAutomationConfig();
      
      // Atualizar configuração
      const config = await storage.updateOfficeAutomationConfig(validated);
      
      // Gerenciar serviço de renovação automática se isEnabled mudou
      if (validated.isEnabled !== undefined && validated.isEnabled !== previousConfig.isEnabled) {
        const { autoRenewalService } = await import('./services/AutoRenewalService');
        
        if (validated.isEnabled) {
          autoRenewalService.start();
          console.log('🔄 Serviço de renovação automática iniciado (configuração habilitada)');
        } else {
          autoRenewalService.stop();
          console.log('⏹️ Serviço de renovação automática parado (configuração desabilitada)');
        }
      }
      
      // Enviar atualização via WebSocket
      broadcastMessage('office_automation_config', config);
      
      console.log('✅ Configuração de automação atualizada:', validated);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      console.error('Erro ao atualizar configuração de automação:', error);
      res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
  });

  // POST /api/office/automation/start - inicia automação
  app.post('/api/office/automation/start', async (req, res) => {
    try {
      const config = await storage.updateOfficeAutomationConfig({ isEnabled: true });
      
      // Iniciar serviço de renovação automática
      const { autoRenewalService } = await import('./services/AutoRenewalService');
      autoRenewalService.start();
      console.log('✅ Serviço de renovação automática iniciado via endpoint');
      
      // Enviar atualização via WebSocket
      broadcastMessage('office_automation_started', config);
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('Erro ao iniciar automação:', error);
      res.status(500).json({ error: 'Erro ao iniciar automação' });
    }
  });

  // POST /api/office/automation/stop - para automação
  app.post('/api/office/automation/stop', async (req, res) => {
    try {
      const config = await storage.updateOfficeAutomationConfig({ isEnabled: false });
      
      // Parar serviço de renovação automática
      const { autoRenewalService } = await import('./services/AutoRenewalService');
      autoRenewalService.stop();
      console.log('⏹️ Serviço de renovação automática parado via endpoint');
      
      // Enviar atualização via WebSocket
      broadcastMessage('office_automation_stopped', config);
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('Erro ao parar automação:', error);
      res.status(500).json({ error: 'Erro ao parar automação' });
    }
  });

  // GET /api/office/automation/status - retorna status atual
  app.get('/api/office/automation/status', async (req, res) => {
    // Verificar API key da extensão
    const extensionKey = req.headers['x-extension-key'];
    if (extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const config = await storage.getOfficeAutomationConfig();
      
      // Buscar logs recentes do banco
      const recentLogs = await storage.getOfficeAutomationLogs(10);
      
      // Buscar credenciais do banco
      let recentCredentials = [];
      try {
        recentCredentials = await storage.getOfficeCredentials(5);
      } catch (e) {
        console.log('Credenciais não disponíveis');
      }
      
      res.json({
        config,
        recentLogs,
        recentCredentials,
        status: config.isEnabled ? 'running' : 'stopped'
      });
    } catch (error) {
      console.error('Erro ao buscar status de automação:', error);
      res.status(500).json({ error: 'Erro ao buscar status' });
    }
  });

  // POST /api/office/automation/generate-single - gera uma credencial única
  app.post('/api/office/automation/generate-single', async (req, res) => {
    try {
      await storage.createPendingTask('single_generation', {});
      
      // Enviar comando via WebSocket para extensão
      broadcastMessage('office_automation_generate_single', { timestamp: new Date() });
      
      res.json({ success: true, message: 'Solicitação de geração enviada' });
    } catch (error) {
      console.error('Erro ao solicitar geração única:', error);
      res.status(500).json({ error: 'Erro ao solicitar geração' });
    }
  });

  // GET /api/office/automation/next-task - extensão consulta próxima tarefa
  app.get('/api/office/automation/next-task', async (req, res) => {
    // Verificar API key da extensão
    const extensionKey = req.headers['x-extension-key'];
    if (extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const config = await storage.getOfficeAutomationConfig();
      
      // IMPORTANTE: Sempre incluir o status isEnabled na resposta
      const baseResponse = {
        isEnabled: config.isEnabled,
        hasTask: false
      };
      
      // Se automação está desabilitada, NUNCA retornar tarefas automáticas
      if (!config.isEnabled) {
        // Verifica se há tarefa pendente manual (single generation)
        const pendingTask = await storage.getNextPendingTask();
        if (pendingTask) {
          return res.json({
            ...baseResponse,
            hasTask: true,
            task: {
              id: pendingTask.id,
              type: pendingTask.taskType || 'generate_single',
              quantity: 1
            }
          });
        }
        
        // Verifica flag de geração única
        if (config.singleGeneration) {
          // Reset flag de geração única IMEDIATAMENTE
          await storage.updateOfficeAutomationConfig({ 
            singleGeneration: false
          });
          
          return res.json({
            ...baseResponse,
            hasTask: true,
            task: {
              type: 'generate_single',
              quantity: 1
            }
          });
        }
        
        // Automação desabilitada e sem tarefas manuais
        return res.json(baseResponse);
      }
      
      // Automação HABILITADA - verificar intervalo
      const now = new Date();
      const lastRun = config.lastRunAt ? new Date(config.lastRunAt) : new Date(0);
      const intervalMs = config.intervalMinutes * 60 * 1000;
      
      // Verificar se já passou o intervalo configurado
      if (now.getTime() - lastRun.getTime() >= intervalMs) {
        // NÃO atualizar lastRunAt aqui - será atualizado quando confirmar geração
        
        return res.json({
          ...baseResponse,
          hasTask: true,
          task: {
            type: 'generate_batch',
            quantity: config.batchSize
          }
        });
      }
      
      // Ainda não é hora de gerar novo lote
      res.json(baseResponse);
    } catch (error) {
      console.error('Erro ao buscar próxima tarefa:', error);
      res.status(500).json({ error: 'Erro ao buscar tarefa' });
    }
  });

  // POST /api/office/automation/task-complete - extensão reporta conclusão
  app.post('/api/office/automation/task-complete', async (req, res) => {
    // Verificar API key da extensão
    const extensionKey = req.headers['x-extension-key'];
    if (extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { type, credentials, error, taskId, results, summary, systemId, oldCredentials, clienteId } = req.body;
      
      console.log('📥 Recebendo task-complete:', {
        type,
        hasCredentials: !!credentials,
        hasResults: !!results,
        resultsCount: results?.length || 0,
        error: error || 'none'
      });
      
      // Atualizar status da tarefa se tiver taskId
      if (taskId) {
        await storage.updateTaskStatus(taskId, error ? 'failed' : 'completed', {
          errorMessage: error,
          username: credentials?.username,
          password: credentials?.password
        });
      }
      
      if (error) {
        console.error('❌ Erro reportado pela extensão:', error);
        return res.json({ success: true }); // Retorna success para não travar a extensão
      }
      
      // Processar credenciais únicas ou em lote
      let processedCount = 0;
      let savedCredentials = [];
      let errors = [];
      
      // IMPORTANTE: Processar APENAS UM caminho por vez para evitar duplicação
      // Prioridade: results (lote) > credentials (único)
      if (results && Array.isArray(results) && results.length > 0) {
        // Processar resultados em lote (generate_batch)
        console.log(`📦 Processando lote de ${results.length} credenciais`);
        
        for (const result of results) {
          // Verificar múltiplas possibilidades de estrutura de dados
          const username = result.username || result.user || result.login;
          const password = result.password || result.pass || result.senha;
          const success = result.success !== false; // Assume sucesso se não explicitamente falso
          
          if (success && username && password) {
            try {
              // Verificar duplicação antes de salvar credencial do lote
              const recentCredentials = await storage.getOfficeCredentials(100);
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
              
              const duplicate = recentCredentials.find(c => 
                c.username === username && 
                c.password === password &&
                c.source === 'automation' &&
                new Date(c.generatedAt) > fiveMinutesAgo
              );
              
              if (duplicate) {
                console.log(`⚠️ Credencial duplicada detectada no lote, pulando: ${username}`);
                savedCredentials.push(duplicate);
                processedCount++;
              } else {
                console.log(`💾 Salvando credencial do lote: ${username}`);
                const saved = await storage.createOfficeCredentials({
                  username: username,
                  password: password,
                  sistemaId: systemId || null, // Adicionar systemId se disponível
                  source: 'automation',
                  status: 'active',
                  generatedAt: new Date()
                });
                savedCredentials.push(saved);
                processedCount++;
              }
            } catch (e) {
              console.error(`❌ Erro ao salvar credencial ${username}:`, e);
              errors.push({ credential: username, error: e.message });
            }
          } else {
            console.warn(`⚠️ Credencial incompleta ou com erro:`, {
              username,
              hasPassword: !!password,
              success
            });
          }
        }
        console.log(`✅ Lote processado: ${processedCount} de ${results.length} salvas`);
      }
      // Se NÃO tem results, então processa credentials único
      else if (credentials && credentials.username && credentials.password) {
        try {
          // Verificar se já existe uma credencial idêntica criada recentemente (últimos 5 minutos)
          const recentCredentials = await storage.getOfficeCredentials(100);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          const duplicate = recentCredentials.find(c => 
            c.username === credentials.username && 
            c.password === credentials.password &&
            c.source === 'automation' &&
            new Date(c.generatedAt) > fiveMinutesAgo
          );
          
          if (duplicate) {
            console.log('⚠️ Credencial duplicada detectada, pulando salvamento:', credentials.username);
            savedCredentials.push(duplicate); // Usar a existente
            processedCount = 1;
          } else {
            console.log('💾 Salvando credencial única:', credentials.username);
            const saved = await storage.createOfficeCredentials({
              username: credentials.username,
              password: credentials.password,
              sistemaId: systemId || null, // Adicionar systemId se disponível
              source: 'automation',
              status: 'active',
              generatedAt: new Date()
            });
            savedCredentials.push(saved);
            processedCount = 1;
            console.log('✅ Credencial única salva com sucesso');
          }
        } catch (e) {
          console.error('❌ Erro ao salvar credencial única:', e);
          errors.push({ credential: credentials.username, error: e.message });
        }
      }
      // Processar renovação de sistema IPTV
      else if (type === 'renew_system' && credentials && systemId) {
        console.log('🔄 Processando renovação de sistema IPTV...');
        console.log(`   System ID: ${systemId}`);
        console.log(`   Novo usuário: ${credentials.username}`);
        
        try {
          // Buscar o sistema
          const sistema = await storage.getSistemaById(systemId);
          if (!sistema) {
            throw new Error(`Sistema ${systemId} não encontrado`);
          }
          
          console.log(`📊 Sistema encontrado: ${sistema.nome}`);
          console.log(`   API System ID: ${sistema.systemId}`);
          console.log(`   Usuário anterior: ${oldCredentials?.username || 'N/A'}`);
          
          // Atualizar sistema na API externa
          if (sistema.apiUserId) {
            console.log('🔄 Atualizando credenciais na API externa...');
            
            // Calcular nova data de expiração (6 horas)
            const newExpiration = new Date();
            newExpiration.setHours(newExpiration.getHours() + 6);
            const expTimestamp = Math.floor(newExpiration.getTime() / 1000);
            
            await externalApiService.updateUser(sistema.apiUserId, {
              username: credentials.username,
              password: credentials.password,
              exp_date: expTimestamp.toString(),
              system: parseInt(sistema.systemId)
            });
            
            console.log('✅ API externa atualizada com sucesso');
          }
          
          // Atualizar sistema local
          const updateData: any = {
            usuario: credentials.username,
            senha: credentials.password,
            expiracao: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 horas
            lastRenewalAt: new Date(),
            renewalCount: (sistema.renewalCount || 0) + 1,
            lastCheckedAt: new Date()
          };
          
          await storage.updateSistema(systemId, updateData);
          console.log('✅ Sistema local atualizado com sucesso');
          
          processedCount = 1;
          
          // Salvar credencial no histórico
          const saved = await storage.createOfficeCredentials({
            username: credentials.username,
            password: credentials.password,
            sistemaId: systemId, // Adicionar systemId para renovação
            source: 'renewal',
            status: 'active',
            generatedAt: new Date(),
            observacoes: `Renovação automática do sistema ${sistema.nome}`
          });
          savedCredentials.push(saved);
          
          // Enviar notificação para o cliente se houver
          if (clienteId) {
            const cliente = await storage.getClienteById(clienteId);
            if (cliente && cliente.whatsapp) {
              const message = `✅ *Sistema Renovado Automaticamente*\n\n` +
                `Sistema: ${sistema.nome}\n` +
                `Novo usuário: ${credentials.username}\n` +
                `Nova senha: ${credentials.password}\n` +
                `Validade estendida por 6 horas\n\n` +
                `_Renovação automática realizada com sucesso._`;
              
              await whatsappService.sendTextMessage(cliente.whatsapp, message);
              console.log('📱 Notificação WhatsApp enviada ao cliente');
            }
          }
          
          console.log('✅ Renovação de sistema concluída com sucesso!');
        } catch (e) {
          console.error('❌ Erro ao renovar sistema:', e);
          errors.push({ systemId, error: e.message });
        }
      }
      
      // Atualizar configuração apenas se houve sucesso
      if (processedCount > 0) {
        const config = await storage.getOfficeAutomationConfig();
        const newTotal = (config.totalGenerated || 0) + processedCount;
        
        // Atualizar totalGenerated E lastRunAt (agora que confirmamos a geração)
        await storage.updateOfficeAutomationConfig({
          totalGenerated: newTotal,
          lastRunAt: new Date() // Atualizar AQUI após confirmar sucesso
        });
        
        // Log de sucesso detalhado
        console.log(`✅ Tarefa concluída com sucesso!`);
        console.log(`   📊 Credenciais processadas: ${processedCount}`);
        console.log(`   📈 Total acumulado: ${newTotal}`);
        if (errors.length > 0) {
          console.log(`   ⚠️ Erros encontrados: ${errors.length}`);
        }
      }
      
      // Criar log de automação
      await storage.createOfficeAutomationLog({
        taskType: type || 'task_complete',
        status: processedCount > 0 ? 'completed' : 'failed',
        responseData: {
          processedCount,
          savedCredentials: savedCredentials.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
      
      // Enviar atualização via WebSocket
      broadcastMessage('office_automation_task_complete', {
        type,
        credentialsGenerated: processedCount,
        savedCredentials: savedCredentials.length,
        summary: summary || { 
          successCount: processedCount, 
          errorCount: errors.length,
          totalAttempted: (results?.length || 1)
        },
        timestamp: new Date()
      });
      
      res.json({ 
        success: true,
        processedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('❌ Erro crítico ao processar conclusão de tarefa:', error);
      res.status(500).json({ error: 'Erro ao processar conclusão' });
    }
  });

  // POST /api/office/automation/report - reporta resultado da extensão
  app.post('/api/office/automation/report', async (req, res) => {
    // Verificar API key da extensão
    const extensionKey = req.headers['x-extension-key'];
    if (extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Redireciona para task-complete com os mesmos dados
    req.url = '/api/office/automation/task-complete';
    return app.handle(req, res);
  });

  // GET /api/office/automation/logs - busca logs de execução
  app.get('/api/office/automation/logs', async (req, res) => {
    try {
      const logs = await storage.getOfficeAutomationLogs(100);
      res.json(logs);
    } catch (error) {
      console.error('Erro ao buscar logs de automação:', error);
      res.status(500).json({ error: 'Erro ao buscar logs' });
    }
  });

  // GET /api/office/automation/credentials - busca credenciais geradas
  app.get('/api/office/automation/credentials', async (req, res) => {
    // Verificar autenticação: aceitar tanto API key da extensão quanto sessão autenticada
    const extensionKey = req.headers['x-extension-key'];
    const isAuthenticated = (req.session as any)?.user;
    
    // Se não tem nem API key nem está autenticado
    if (!extensionKey && !isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Se tem API key, verificar se é válida
    if (extensionKey && extensionKey !== 'chrome-extension-secret-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      // Retornar TODAS as credenciais, sem limite artificial
      // Se houver muitas, o frontend pode paginar
      const credentials = await storage.getOfficeCredentials(1000); // Limite alto para garantir que pegue todas
      
      // Retornar no formato esperado pelo frontend
      res.json({
        success: true,
        credentials: credentials
      });
    } catch (error) {
      console.error('Erro ao buscar credenciais:', error);
      res.status(500).json({ error: 'Erro ao buscar credenciais' });
    }
  });

  // DELETE /api/office/automation/credentials/:id - deletar credencial específica
  app.delete('/api/office/automation/credentials/:id', checkAuth, async (req, res) => {
    try {
      const credentialId = parseInt(req.params.id);
      
      if (isNaN(credentialId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }
      
      await storage.deleteOfficeCredential(credentialId);
      
      res.json({ success: true, message: 'Credencial removida com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar credencial:', error);
      res.status(500).json({ error: 'Erro ao deletar credencial' });
    }
  });

  // DELETE /api/office/automation/credentials - deletar todas as credenciais
  app.delete('/api/office/automation/credentials', checkAuth, async (req, res) => {
    try {
      await storage.deleteAllOfficeCredentials();
      
      res.json({ success: true, message: 'Todas as credenciais foram removidas com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar todas as credenciais:', error);
      res.status(500).json({ error: 'Erro ao deletar credenciais' });
    }
  });
  
  // Endpoint to check API users for debugging
  app.get('/api/pontos/check-api-users', async (req, res) => {
    try {
      const apiUsers = await externalApiService.getUsers();
      const pontos = await storage.getAllPontos();
      
      // Get first 5 API users to see their structure
      const sampleApiUsers = apiUsers.slice(0, 5);
      
      // Get pontos with apiUserId to check mapping
      const pontosWithApiUser = pontos.filter(p => p.apiUserId).slice(0, 5);
      
      res.json({
        totalApiUsers: apiUsers.length,
        sampleApiUsers: sampleApiUsers.map(u => ({
          id: u.id,
          username: u.username,
          last_access: u.last_access,
          app_name: u.app_name
        })),
        pontosWithApiUser: pontosWithApiUser.map(p => ({
          id: p.id,
          apiUserId: p.apiUserId,
          usuario: p.usuario,
          aplicativo: p.aplicativo
        })),
        apiUserIds: apiUsers.map(u => u.id).sort((a, b) => a - b)
      });
    } catch (error) {
      console.error('Erro ao verificar usuários da API:', error);
      res.status(500).json({ error: 'Erro ao verificar usuários da API' });
    }
  });

  return httpServer;
}
