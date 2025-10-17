import { Boom } from "@hapi/boom";
import pkg from "baileys";
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  isJidBroadcast,
  isJidStatusBroadcast,
  downloadMediaMessage,
  proto,
} = pkg;

// Type definitions
type WASocket = any;
type ConnectionState = any;
type WAMessage = any;
import { storage } from "../storage";
import { EventEmitter } from "events";

// Import sharp for image processing - required by Baileys
import sharp from "sharp";
import { addMonths } from 'date-fns';

console.log("📱 WhatsApp service module loading...");

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

// Helper function to check if JID is a LID (Local ID)
function isLidJid(jid: string | undefined): boolean {
  if (!jid) return false;
  return jid.includes('@lid');
}

// Helper function to check if phone number is valid (not a LID)
function isValidBrazilianPhone(phone: string): boolean {
  // Brazilian phones should start with 55 and have 12-13 digits
  // Format: 55 + DDD (2 digits) + number (8-9 digits)
  return /^55\d{10,11}$/.test(phone);
}

// Helper function to extract phone number from WhatsApp JID
function extractPhoneFromJid(jid: string | undefined): string {
  if (!jid) return "";
  
  // Log the JID for debugging
  if (isLidJid(jid)) {
    console.log(`⚠️ WARNING: Received LID format JID: ${jid}`);
    // LIDs are internal WhatsApp IDs, not real phone numbers
    // We should not process them as phone numbers
  }
  
  // Remove any WhatsApp suffixes (@s.whatsapp.net, @g.us, @lid, etc.)
  const phone = jid.split('@')[0] || "";
  
  // Clean up any non-digit characters that might remain
  return phone.replace(/[^0-9]/g, '');
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker";
  isFromMe: boolean;
  mediaUrl?: string;
  metadados?: any;
}

export class WhatsAppService extends EventEmitter {
  private sock: WASocket | null = null;
  private qrCode: string | null = null;
  private connectionState: ConnectionState = {
    connection: "close",
    lastDisconnect: undefined,
  } as any;
  private wsClients: Set<any> = new Set();
  private messageCache: Map<string, any> = new Map(); // Cache mensagens do WhatsApp por message ID
  private maxCacheSize = 1000; // Keep last 1000 messages in cache
  private settings: any = {}; // Store WhatsApp settings
  private isReconnecting = false; // Prevent multiple reconnection attempts
  private reconnectAttempts = 0; // Track reconnection attempts
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private conversationCreationLocks: Map<string, Promise<any>> = new Map(); // Prevent duplicate conversation creation
  private processedMessagesOnStartup: Set<string> = new Set(); // Track processed messages during startup
  private lidToPhoneMap: Map<string, string> = new Map(); // LID to real phone number mapping
  
  // Anti-spam structures
  private messageBuffers: Map<string, {
    messages: WhatsAppMessage[],
    timer: NodeJS.Timeout | null,
    lastMessageTime: Date,
    conversaId?: number,
    pushName?: string
  }> = new Map();

  constructor() {
    super();
    // Initialize WhatsApp service
    console.log("🚀 WhatsApp Service Constructor Called");
    this.initialize().catch(error => {
      console.error("❌ Failed to initialize WhatsApp service:", error);
    });
  }

  setWebSocketClients(clients: Set<any>) {
    this.wsClients = clients;
  }

  private notifyWebSocketClients(type: string, data: any) {
    // Emit event to be handled by routes.ts WebSocket handler
    this.emit(type, data);
  }

  async initialize() {
    console.log("📱 Starting WhatsApp initialization...");
    
    // Prevent multiple simultaneous initializations
    if (this.sock?.ws && this.connectionState.connection === "open") {
      console.log("WhatsApp already connected, skipping initialization");
      return;
    }

    try {
      console.log("📂 Creating auth directory...");
      // Ensure auth directory exists
      const fs = await import("fs/promises");
      const authDir = "./auth_info_baileys";
      await fs.mkdir(authDir, { recursive: true });
      console.log("✅ Auth directory ready");

      console.log("🔧 Loading WhatsApp settings from database...");
      // Load saved settings from database
      const savedSettings = await storage.getWhatsAppSettings();
      if (savedSettings) {
        this.settings = savedSettings;
        console.log("✅ Loaded WhatsApp settings from database:", this.settings);
      } else {
        console.log("ℹ️ No saved WhatsApp settings found, using defaults");
      }

      console.log("🔐 Loading authentication state...");
      const { state, saveCreds } = await useMultiFileAuthState(
        "./auth_info_baileys",
      );
      console.log("✅ Authentication state loaded");

      // Close existing connection if any
      if (this.sock) {
        try {
          await this.sock.ws.close();
        } catch (error) {
          console.log("Error closing existing connection:", error);
        }
        this.sock = null;
      }

      console.log("🔌 Creating WhatsApp socket connection...");

      // Create a simple logger that has the methods Baileys expects
      const logger = {
        child: () => logger,
        info: (...args: any[]) => console.log('[INFO]', ...args),
        error: (...args: any[]) => console.error('[ERROR]', ...args),
        warn: (...args: any[]) => console.warn('[WARN]', ...args),
        debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
        trace: (...args: any[]) => console.debug('[TRACE]', ...args),
        level: 'info'
      };

      this.sock = makeWASocket({
        auth: state,
        browser: ["TV ON System", "Chrome", "1.0.0"],
        logger: logger,
        // Add connection timeout to prevent hanging
        connectTimeoutMs: 60000,
        // Add default presence to available
        markOnlineOnConnect: this.settings?.markOnlineOnConnect ?? true,
        // Add retry options
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
      }) as any;

      this.sock.ev.on("connection.update", (update) => {
        this.handleConnectionUpdate(update);
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("messages.upsert", async (m) => {
        await this.handleIncomingMessage(m);
      });

      // Handle message updates (edits, deletes, etc)
      this.sock.ev.on("messages.update", async (updates) => {
        console.log("=== MESSAGES.UPDATE EVENT RECEIVED ===");
        console.log("Number of updates:", updates.length);
        console.log("Full updates data:", JSON.stringify(updates, null, 2));

        for (const update of updates) {
          console.log("=== PROCESSING SINGLE UPDATE ===");
          console.log("Update object:", JSON.stringify(update, null, 2));
          console.log("Has key?", !!update.key);
          console.log("Has update?", !!update.update);

          const { key, update: updateData } = update;

          console.log("Key details:", {
            id: key?.id,
            remoteJid: key?.remoteJid,
            fromMe: key?.fromMe,
          });

          console.log("Update data:", {
            hasMessage: !!updateData?.message,
            hasStatus: !!updateData?.status,
            messageStubType: updateData?.messageStubType,
            messageIsNull: updateData?.message === null,
          });

          // Check if message was deleted
          if (
            updateData?.message === null ||
            updateData?.messageStubType === 1
          ) {
            console.log("Message deleted detected");
            await this.handleMessageDelete(key);
          }
          // Check if message content was edited
          else if (updateData?.message) {
            console.log("Message edit detected - message object exists");
            await this.handleMessageEdit(key, updateData);
          }
          // Check for message revoked
          else if (updateData?.messageStubType === 1) {
            console.log("Message revoked detected");
            await this.handleMessageDelete(key);
          }
          // Log any other type of update
          else {
            console.log("Other type of update, not edit or delete");
          }
        }
      });

      console.log("✅ WhatsApp service initialization complete");
      await this.logActivity(
        "info",
        "WhatsApp",
        "Serviço WhatsApp inicializado",
      );
    } catch (error) {
      console.error("❌ Erro ao inicializar WhatsApp:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao inicializar: ${error}`,
      );
      // Retry initialization after 5 seconds
      console.log("🔄 Retrying WhatsApp initialization in 5 seconds...");
      setTimeout(() => {
        this.initialize().catch(err => {
          console.error("❌ Retry failed:", err);
        });
      }, 5000);
    }
  }

  private async handleMessageDelete(key: any) {
    console.log("Handling message delete:", { key });

    const whatsappMessageId = key.id;
    const phone = extractPhoneFromJid(key.remoteJid);

    if (!whatsappMessageId || !phone) return;

    try {
      // Find conversation and existing message
      const conversa = await storage.getConversaByTelefone(phone);
      if (!conversa) return;

      const mensagens = await storage.getMensagensByConversaId(conversa.id);
      const existingMessage = mensagens.find(
        (msg) => msg.whatsappMessageId === whatsappMessageId,
      );

      if (existingMessage) {
        console.log("Marking message as deleted:", {
          messageId: existingMessage.id,
        });

        // Mark the message as deleted
        // Don't update conteudoOriginal - it should keep the original content before any edits
        await storage.updateMensagem(existingMessage.id, {
          deletada: true,
          deletadaEm: new Date(),
        });

        // Emit delete event for WebSocket clients
        const updatedMessage = {
          ...existingMessage,
          deletada: true,
          deletadaEm: new Date(),
        };

        this.emit("message_deleted", {
          messageId: existingMessage.id,
          conversaId: conversa.id,
          deletadaEm: new Date(),
          messageData: updatedMessage,
        });

        // Check if this was the last message and update conversation
        const allMessages = await storage.getMensagensByConversaId(conversa.id);
        const sortedMessages = allMessages
          .filter((msg) => !msg.deletada) // Exclude deleted messages
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

        if (sortedMessages.length > 0) {
          // Update with the newest non-deleted message
          await storage.updateConversa(conversa.id, {
            ultimaMensagem: sortedMessages[0].conteudo,
            tipoUltimaMensagem: sortedMessages[0].tipo,
          });

          // Emit conversation update event
          this.emit("conversation_updated", {
            conversaId: conversa.id,
            ultimaMensagem: sortedMessages[0].conteudo,
            tipoUltimaMensagem: sortedMessages[0].tipo,
          });
        } else {
          // All messages are deleted, show "mensagem apagada"
          await storage.updateConversa(conversa.id, {
            ultimaMensagem: "🚫 Mensagem apagada",
            tipoUltimaMensagem: "text",
          });

          // Emit conversation update event
          this.emit("conversation_updated", {
            conversaId: conversa.id,
            ultimaMensagem: "🚫 Mensagem apagada",
            tipoUltimaMensagem: "text",
          });
        }

        console.log("Message delete processed successfully");
      }
    } catch (error) {
      console.error("Error handling message delete:", error);
    }
  }

  private async handleMessageEdit(key: any, update: any) {
    console.log("=== HANDLING MESSAGE EDIT ===");
    console.log("Key:", JSON.stringify(key, null, 2));
    console.log("Update:", JSON.stringify(update, null, 2));
    console.log("Update.message:", JSON.stringify(update.message, null, 2));

    const whatsappMessageId = key.id;
    const phone = extractPhoneFromJid(key.remoteJid);

    if (!whatsappMessageId || !phone) {
      console.log("Missing whatsappMessageId or phone, aborting");
      return;
    }

    try {
      // Find conversation and existing message
      const conversa = await storage.getConversaByTelefone(phone);
      if (!conversa) {
        console.log("Conversation not found for phone:", phone);
        return;
      }

      const mensagens = await storage.getMensagensByConversaId(conversa.id);
      const existingMessage = mensagens.find(
        (msg) => msg.whatsappMessageId === whatsappMessageId,
      );

      if (existingMessage) {
        // Extract edited text - check if it's in editedMessage structure
        const editedMessage =
          update.message?.editedMessage?.message || update.message;
        const editedText =
          editedMessage?.conversation ||
          editedMessage?.extendedTextMessage?.text ||
          editedMessage?.text ||
          editedMessage?.body ||
          editedMessage?.caption ||
          "";

        console.log("=== EDIT CONTENT EXTRACTION ===");
        console.log("editedMessage structure:", editedMessage);
        console.log("conversation:", editedMessage?.conversation);
        console.log(
          "extendedTextMessage.text:",
          editedMessage?.extendedTextMessage?.text,
        );
        console.log("text:", editedMessage?.text);
        console.log("body:", editedMessage?.body);
        console.log("caption:", editedMessage?.caption);
        console.log("Final editedText:", editedText);
        console.log("Is editedText empty?", editedText === "");

        // Update the message
        const updateData = {
          conteudo: editedText,
          editada: true,
          editadaEm: new Date(),
          conteudoOriginal:
            existingMessage.conteudoOriginal || existingMessage.conteudo,
        };

        console.log("Updating message with:", updateData);
        await storage.updateMensagem(existingMessage.id, updateData);

        // Get updated message to confirm
        const updatedMsgs = await storage.getMensagensByConversaId(conversa.id);
        const updatedMsg = updatedMsgs.find(
          (msg) => msg.id === existingMessage.id,
        );
        console.log("Message after update:", updatedMsg);

        // Emit edit event for WebSocket clients
        this.emit("message_edited", {
          messageId: existingMessage.id,
          conversaId: conversa.id,
          conteudo: editedText,
          editadaEm: new Date(),
          messageData: {
            ...existingMessage,
            conteudo: editedText,
            editada: true,
            editadaEm: new Date(),
            conteudoOriginal:
              existingMessage.conteudoOriginal || existingMessage.conteudo,
          },
        });

        // Check if this was the last message and update conversation
        const allMessages = await storage.getMensagensByConversaId(conversa.id);
        const sortedMessages = allMessages
          .filter((msg) => !msg.deletada) // Exclude deleted messages
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

        if (
          sortedMessages.length > 0 &&
          sortedMessages[0].id === existingMessage.id
        ) {
          // This is the last message, update conversation with edited text
          await storage.updateConversa(conversa.id, {
            ultimaMensagem: editedText,
            tipoUltimaMensagem: existingMessage.tipo,
          });

          // Emit conversation update event
          this.emit("conversation_updated", {
            conversaId: conversa.id,
            ultimaMensagem: editedText,
            tipoUltimaMensagem: existingMessage.tipo,
          });
        }

        console.log("=== MESSAGE EDIT COMPLETED ===");
      } else {
        console.log(
          "Existing message not found with whatsappMessageId:",
          whatsappMessageId,
        );
      }
    } catch (error) {
      console.error("Error handling message edit:", error);
    }
  }

  // Helper function to check if message is a menu option (number only)
  private isMenuOption(text: string): boolean {
    return /^[0-9]+$/.test(text.trim());
  }

  // Helper function to normalize button/list IDs to their corresponding menu options
  private normalizeInteractiveId(id: string): string {
    if (!id) return id;
    
    // Handle "option_X" format - extract the number
    const optionMatch = id.match(/option[_\-]?(\d+)/i);
    if (optionMatch) {
      return optionMatch[1];
    }
    
    // Map specific IDs to their menu numbers
    const idMappings: Record<string, string> = {
      // Common menu options
      'ver_vencimento': '1',
      'segunda_via': '2',
      'suporte': '3',
      'suporte_tecnico': '3',
      'adicionar_ponto': '4',
      'falar_vendedor': '5',
      'teste_gratis': '6',
      'renovar': '1',
      'alterar_vencimento': '2',
      'pagamento': '3',
      'outros': '7',
      
      // Test menu options
      'testar_novamente': '1',
      'ativar_servico': '2',
      
      // Support submenu
      'app_travando': '1',
      'fora_do_ar': '2',
      'outros_problemas': '3',
      
      // Device type options
      'android': '1',
      'iphone': '2',
      'smart_tv': '1',
      'tv_box': '2',
      'computador': '3',
      'celular': '4',
      
      // Common actions
      'sim': '1',
      'nao': '2',
      'voltar': '0',
      'menu': '0',
    };
    
    // Check if ID is in our mappings (case-insensitive)
    const lowerCaseId = id.toLowerCase().trim();
    if (idMappings[lowerCaseId]) {
      return idMappings[lowerCaseId];
    }
    
    // If it's already a number, return as is
    if (/^\d+$/.test(id.trim())) {
      return id.trim();
    }
    
    // Return original if no mapping found
    return id;
  }

  // Process buffered messages after delay
  private async processBufferedMessages(telefone: string) {
    const buffer = this.messageBuffers.get(telefone);
    if (!buffer || buffer.messages.length === 0) return;

    console.log(`[ANTI-SPAM] Processing ${buffer.messages.length} buffered messages for ${telefone}`);
    
    // Join all messages into one
    const allMessages = buffer.messages.map(m => m.message).join(' ');
    console.log(`[ANTI-SPAM] Combined message: ${allMessages}`);
    
    // Get the first message as the base (for metadata)
    const firstMessage = buffer.messages[0];
    firstMessage.message = allMessages;
    
    // Process the combined message
    await this.processIncomingMessage(firstMessage, buffer.pushName, true);
    
    // Clear buffer
    this.messageBuffers.delete(telefone);
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.qrCode = qr;
      this.emit("qr", qr);
      await this.logActivity("info", "WhatsApp", "QR Code gerado");
    }

    if (connection === "close") {
      const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
      const isConflict =
        lastDisconnect?.error?.message?.includes("conflict") ||
        lastDisconnect?.error?.message?.includes("replaced");
      const isAuthFailure = errorCode === 401;

      console.log("Conexão fechada devido a:", lastDisconnect?.error);
      console.log(
        "Error code:",
        errorCode,
        "Is conflict:",
        isConflict,
        "Is auth failure:",
        isAuthFailure,
      );

      if (shouldReconnect && !this.isReconnecting) {
        this.isReconnecting = true;

        // Handle different error types with appropriate delays
        let reconnectDelay = 5000; // Default 5 seconds

        if (isConflict) {
          // For conflicts, clear session and reconnect immediately
          console.log("Conflito detectado, limpando sessão e reconectando...");
          try {
            // Clear auth state to force new session
            const fs = await import("fs/promises");
            const path = await import("path");
            const authDir = "./auth_info_baileys";

            if (
              await fs
                .access(authDir)
                .then(() => true)
                .catch(() => false)
            ) {
              const files = await fs.readdir(authDir);
              for (const file of files) {
                if (file.includes("session") || file.includes("creds")) {
                  await fs.unlink(path.join(authDir, file)).catch(() => {});
                }
              }
            }
          } catch (error) {
            console.error("Erro ao limpar sessão:", error);
          }
          reconnectDelay = 2000; // Reconnect quickly after clearing session
          this.reconnectAttempts = 0; // Reset attempts on conflict
        } else if (errorCode === 401 || isAuthFailure) {
          // For auth failures, clear session and wait
          reconnectDelay = 5000;
          console.log("Falha de autenticação detectada, limpando sessão...");

          // Clear auth state on 401 error
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const authDir = "./auth_info_baileys";

            if (
              await fs
                .access(authDir)
                .then(() => true)
                .catch(() => false)
            ) {
              const files = await fs.readdir(authDir);
              for (const file of files) {
                await fs.unlink(path.join(authDir, file)).catch(() => {});
              }
              console.log("Sessão limpa devido a erro 401");
            }
          } catch (error) {
            console.error("Erro ao limpar sessão:", error);
          }
          this.reconnectAttempts = 0; // Reset attempts
        } else if (this.reconnectAttempts > 2) {
          // Progressive backoff for repeated failures
          reconnectDelay = Math.min(30000, 5000 * this.reconnectAttempts);
        }

        // Always try to reconnect
        this.reconnectAttempts++;
        console.log(
          `Reconectando em ${reconnectDelay / 1000}s (tentativa ${this.reconnectAttempts})...`,
        );

        setTimeout(() => {
          this.isReconnecting = false;
          this.initialize();
        }, reconnectDelay);
      } else if (!shouldReconnect) {
        // User logged out manually, clear session
        console.log("Usuário deslogou manualmente, limpando sessão...");
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const authDir = "./auth_info_baileys";

          if (
            await fs
              .access(authDir)
              .then(() => true)
              .catch(() => false)
          ) {
            const files = await fs.readdir(authDir);
            for (const file of files) {
              await fs.unlink(path.join(authDir, file)).catch(() => {});
            }
            console.log("Sessão limpa após logout manual");
          }
        } catch (error) {
          console.error("Erro ao limpar sessão após logout:", error);
        }
      }

      this.emit("disconnected");
      await this.logActivity("warn", "WhatsApp", "Conexão perdida");
    } else if (connection === "open") {
      this.qrCode = null;
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      this.isReconnecting = false;
      this.emit("connected");
      await this.logActivity("info", "WhatsApp", "Conectado com sucesso");

      // Clean up self-conversations (conversations with our own number)
      if (this.sock?.user?.id) {
        const myNumber = extractPhoneFromJid(this.sock.user.id);
        const selfConversation = await storage.getConversaByTelefone(myNumber);
        if (selfConversation) {
          console.log(`Removing self-conversation with number: ${myNumber}`);
          await storage.deleteConversa(selfConversation.id);
          console.log("Self-conversation removed successfully");
        }
      }

      // Apply settings when connected
      await this.applySettings(this.settings);

      // Set up keep-alive mechanism
      this.setupKeepAlive();
    }

    this.connectionState = { ...this.connectionState, ...update };
  }

  private async handleIncomingMessage(m: any) {
    console.log("=== INCOMING MESSAGE RECEIVED ===");
    const message = m.messages[0];
    if (!message) return;

    // Check if this is a reaction message
    if (message.message?.reactionMessage) {
      await this.handleReactionMessage(message);
      return;
    }

    console.log("Processing incoming message:", {
      id: message.key?.id,
      from: message.key?.remoteJid,
      fromMe: message.key?.fromMe,
      text:
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text,
    });

    // Store the original WhatsApp message object for future replies
    if (message.key?.id) {
      // Manage cache size
      if (this.messageCache.size >= this.maxCacheSize) {
        const firstKey = this.messageCache.keys().next().value;
        this.messageCache.delete(firstKey);
      }
      this.messageCache.set(message.key.id, message);
    }

    const isFromMe = message.key.fromMe;
    let remoteJid = message.key.remoteJid;

    // Skip broadcast messages but process our own messages now
    if (isJidBroadcast(remoteJid) || isJidStatusBroadcast(remoteJid)) {
      return;
    }

    let phone = extractPhoneFromJid(remoteJid);
    const pushName = message.pushName || ""; // Get contact's display name
    
    // Handle LID format - map to real phone number
    if (isLidJid(remoteJid)) {
      console.log(`🔄 LID detected for ${pushName}: ${remoteJid}`);
      
      // Check if we have a stored mapping
      if (this.lidToPhoneMap.has(phone)) {
        const realPhone = this.lidToPhoneMap.get(phone)!;
        console.log(`✅ Found stored mapping: ${phone} -> ${realPhone}`);
        phone = realPhone;
      } else if (pushName) {
        // Try to find real number from existing conversation by pushName
        console.log(`🔍 Searching for real number using pushName: ${pushName}`);
        const conversas = await storage.getConversas();
        const existingConversa = conversas.find(c => 
          c.nome === pushName && 
          c.telefone !== phone &&
          isValidBrazilianPhone(c.telefone)
        );
        
        if (existingConversa) {
          console.log(`✅ Found real number from existing conversation: ${existingConversa.telefone}`);
          this.lidToPhoneMap.set(phone, existingConversa.telefone);
          phone = existingConversa.telefone;
        } else {
          console.warn(`⚠️ Could not find real number for LID ${phone} with pushName ${pushName}`);
          // Still allow the message to process, but it might create a duplicate conversation
        }
      }
    }
    // Extract text from different message types
    let messageText = "";
    let mediaUrl: string | undefined;
    let replyMetadata: any = undefined;
    
    // Try to extract text from various message formats
    if (message.message?.conversation) {
      messageText = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
      messageText = message.message.extendedTextMessage.text;
    } else if (message.message?.ephemeralMessage?.message?.conversation) {
      messageText = message.message.ephemeralMessage.message.conversation;
    } else if (message.message?.ephemeralMessage?.message?.extendedTextMessage?.text) {
      messageText = message.message.ephemeralMessage.message.extendedTextMessage.text;
    } else if (message.message?.buttonsResponseMessage?.selectedButtonId) {
      // Handle button response and normalize the ID
      const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
      messageText = this.normalizeInteractiveId(buttonId);
      console.log(`Button response received: "${buttonId}" -> normalized to: "${messageText}"`);
      // Store original button ID in metadata for debugging
      if (buttonId !== messageText) {
        replyMetadata = { ...replyMetadata, originalButtonId: buttonId };
      }
    } else if (message.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
      // Handle list response and normalize the ID
      const listId = message.message.listResponseMessage.singleSelectReply.selectedRowId;
      messageText = this.normalizeInteractiveId(listId);
      console.log(`List response received: "${listId}" -> normalized to: "${messageText}"`);
      // Store original list ID in metadata for debugging
      if (listId !== messageText) {
        replyMetadata = { ...replyMetadata, originalButtonId: listId };
      }
    } else if (message.message?.templateButtonReplyMessage?.selectedId) {
      // Handle template button reply and normalize the ID
      const templateId = message.message.templateButtonReplyMessage.selectedId;
      messageText = this.normalizeInteractiveId(templateId);
      console.log(`Template button response received: "${templateId}" -> normalized to: "${messageText}"`);
      // Store original template ID in metadata for debugging
      if (templateId !== messageText) {
        replyMetadata = { ...replyMetadata, originalButtonId: templateId };
      }
    }

    // Check if this is a reply message
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted =
        message.message.extendedTextMessage.contextInfo.quotedMessage;
      const quotedText =
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        "[Mídia]";

      // Determine if the quoted message was from the system/bot
      const quotedParticipant =
        message.message.extendedTextMessage.contextInfo.participant;
      const isQuotedFromSystem =
        !quotedParticipant || quotedParticipant === this.sock?.user?.id;

      replyMetadata = {
        reply: {
          content: quotedText,
          sender: isQuotedFromSystem ? "Você" : "Cliente",
        },
      };
    }

    // Check FIRST if it's a view-once message (before processing type)
    const isViewOnce = !!message.message?.viewOnceMessage || !!message.message?.viewOnceMessageV2;
    
    // For view-once messages from clients, always show "Visualização única"
    if (isViewOnce && !message.key.fromMe) {
      console.log("View-once message detected from client, setting text to 'Visualização única'");
      messageText = "Visualização única";
      
      // Detect media type within view-once message
      const viewOnceContent = message.message?.viewOnceMessage?.message || message.message?.viewOnceMessageV2?.message;
      if (viewOnceContent) {
        // Store media type in metadata for display purposes
        let viewOnceType = "mídia";
        if (viewOnceContent.imageMessage) {
          viewOnceType = "foto";
          console.log("View-once image detected");
        } else if (viewOnceContent.videoMessage) {
          viewOnceType = "vídeo";
          console.log("View-once video detected");
        } else if (viewOnceContent.audioMessage) {
          viewOnceType = "áudio";
          console.log("View-once audio detected");
        }
        // Store type in metadata
        replyMetadata = { ...replyMetadata, viewOnceType };
      }
      // Don't process further - we don't download or extract content from view-once
    } else {
      // Process media messages normally
      const messageType = this.getMessageType(message);
      if (messageType !== "text") {
        try {
          mediaUrl = await this.downloadMedia(message);
          
          // Get the actual message content based on message type
          let actualMessage = message.message;
          
          // Extract from ephemeral messages
          if (message.message?.ephemeralMessage) {
            actualMessage = message.message.ephemeralMessage.message;
          }
          
          if (messageType === "image") {
            const caption = actualMessage?.imageMessage?.caption || "";
            messageText = caption;
          } else if (messageType === "video") {
            const caption = actualMessage?.videoMessage?.caption || "";
            messageText = caption;
          } else if (messageType === "audio") {
            // For audio, extract duration properly
            const duration = actualMessage?.audioMessage?.seconds || 0;
            // Don't store as JSON - store as readable text
            messageText = `[Áudio ${duration}s]`;
            // Store duration in metadata instead
            replyMetadata = { ...replyMetadata, duration };
          } else if (messageType === "document") {
            const fileName = actualMessage?.documentMessage?.fileName || "documento";
            // Store filename as text, not JSON
            messageText = fileName;
          } else if (messageType === "sticker") {
            messageText = "[Sticker]"; // Store as readable text
          }
        } catch (error) {
          console.error("Erro ao baixar mídia:", error);
          // If media download fails, show appropriate message
          if (messageType === "image") {
            messageText = "[Imagem não disponível]";
          } else if (messageType === "video") {
            messageText = "[Vídeo não disponível]";
          } else if (messageType === "audio") {
            messageText = "[Áudio não disponível]";
          }
        }
      }
    }

    // For view-once messages, ensure we always have text
    if (isViewOnce && !message.key.fromMe && !messageText) {
      console.log("Forcing view-once text for empty message");
      messageText = "Visualização única";
    }

    // Get the message type (but use "text" for view-once messages)
    const messageType = isViewOnce && !message.key.fromMe ? "text" : this.getMessageType(message);
    
    // Log when we receive an empty text message for debugging
    if (!messageText && !mediaUrl && messageType === "text" && !isViewOnce) {
      console.log("Empty text message received - checking for special message types:", {
        key: message.key,
        messageKeys: message.message ? Object.keys(message.message) : [],
        fullMessage: JSON.stringify(message.message, null, 2)
      });
      
      // Check if this is a protocol message (delete, edit, etc)
      if (message.message?.protocolMessage) {
        console.log("Protocol message detected - skipping (will be handled by messages.update)");
        return; // Don't process protocol messages as regular messages
      }
      
      // Check if this is an edited message notification
      if (message.message?.editedMessage) {
        console.log("Edited message notification detected - skipping (will be handled by messages.update)");
        return; // Don't process edited notifications as regular messages
      }
      
      // Check if this is a message update/sync
      if (message.message?.messageContextInfo) {
        console.log("Message context update detected - skipping");
        return; // Don't process context updates as regular messages
      }
      
      // Check if this is a status broadcast or other non-text message
      if (message.message?.protocolMessage || message.message?.senderKeyDistributionMessage) {
        console.log("Non-text protocol message detected - skipping");
        return;
      }
      
      // Try to extract any text from the message object
      const tryExtractText = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        if (obj.text) return obj.text;
        if (obj.caption) return obj.caption;
        if (obj.selectedDisplayText) return obj.selectedDisplayText;
        if (obj.hydratedContentText) return obj.hydratedContentText;
        if (obj.hydratedFooterText) return obj.hydratedFooterText;
        if (obj.hydratedTitleText) return obj.hydratedTitleText;
        if (obj.body) return obj.body;
        if (obj.content) return obj.content;
        for (const key in obj) {
          const result = tryExtractText(obj[key]);
          if (result) return result;
        }
        return '';
      };
      
      const extractedText = tryExtractText(message.message);
      if (extractedText) {
        console.log("Found text in message object:", extractedText);
        messageText = extractedText;
      } else {
        // Only set placeholder for truly unsupported messages
        console.log("Setting placeholder for unsupported message type");
        messageText = "[Mensagem não suportada]";
      }
    }

    const whatsappMessage: WhatsAppMessage = {
      id: message.key.id || "",
      from: isFromMe ? "system" : phone, // If from me, set as system
      to: isFromMe ? phone : "system", // If from me, set recipient as phone
      message: messageText,
      timestamp: message.messageTimestamp
        ? Number(message.messageTimestamp) * 1000
        : Date.now(),
      type: messageType,
      isFromMe: isFromMe,
      mediaUrl,
      metadados: replyMetadata,
    };

    // Check if this is a self-message (sent to ourselves)
    if (isFromMe && this.sock?.user?.id) {
      const myNumber = extractPhoneFromJid(this.sock.user.id);
      if (myNumber === phone) {
        console.log("Skipping self-message to prevent unnecessary chat creation:", phone);
        return; // Skip processing self-messages
      }
    }

    // Process the message differently based on who sent it
    if (isFromMe) {
      // Handle outgoing messages sent from personal WhatsApp
      await this.processOutgoingMessage(whatsappMessage, phone);
    } else {
      // ANTI-SPAM SYSTEM: Check if message should be buffered or processed immediately
      console.log(`[ANTI-SPAM] Incoming message from ${phone} - Type: ${messageType}, Text: "${messageText}"`);
      
      // Process immediately if:
      // 1. It's a menu option (numbers only)
      // 2. It's NOT a text message (audio, image, video, document, sticker)
      if (this.isMenuOption(messageText) || messageType !== 'text') {
        if (this.isMenuOption(messageText)) {
          console.log(`[ANTI-SPAM] Menu option detected (${messageText}) - processing immediately`);
        } else {
          console.log(`[ANTI-SPAM] Media message detected (${messageType}) - processing immediately without delay`);
        }
        // Process immediately
        await this.processIncomingMessage(whatsappMessage, pushName);
      } else {
        // Only text messages that are NOT menu options: apply 5s delay
        console.log(`[ANTI-SPAM] Text message detected - adding to buffer with 5s delay`);
        
        // Text messages: add to buffer with delay
        if (!this.messageBuffers.has(phone)) {
          console.log(`[ANTI-SPAM] Creating new buffer for ${phone}`);
          this.messageBuffers.set(phone, {
            messages: [],
            timer: null,
            lastMessageTime: new Date(),
            pushName: pushName
          });
        }
        
        const buffer = this.messageBuffers.get(phone)!;
        buffer.messages.push(whatsappMessage);
        buffer.lastMessageTime = new Date();
        buffer.pushName = pushName || buffer.pushName; // Update pushName if available
        
        // Cancel previous timer if exists
        if (buffer.timer) {
          console.log(`[ANTI-SPAM] Cancelling previous timer for ${phone} - new message arrived`);
          clearTimeout(buffer.timer);
        }
        
        // Schedule processing in 5 seconds
        console.log(`[ANTI-SPAM] Scheduling message processing in 5 seconds for ${phone}`);
        buffer.timer = setTimeout(() => {
          console.log(`[ANTI-SPAM] Timer expired for ${phone} - processing buffered messages`);
          this.processBufferedMessages(phone);
        }, 5000);
        
        console.log(`[ANTI-SPAM] Buffer now has ${buffer.messages.length} messages for ${phone}`);
      }
    }

    // Only mark as read automatically if markMessagesRead is true
    // If false, messages will only be marked as read when user opens the conversation
    console.log("Auto read settings:", {
      markMessagesRead: this.settings?.markMessagesRead,
      sendReadReceipts: this.settings?.sendReadReceipts,
      shouldAutoMarkAsRead: this.settings?.markMessagesRead,
    });

    if (this.settings?.markMessagesRead) {
      // Auto mark as read is enabled - mark immediately
      try {
        const jid = message.key.remoteJid;
        const participant = message.key.participant;
        const messageKey = {
          remoteJid: jid,
          id: message.key.id,
          participant: participant,
        };

        console.log(
          "Auto marking message as read (markMessagesRead=true):",
          messageKey,
        );

        // Add a small delay before marking as read
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Send read receipt
        await this.sock.readMessages([messageKey]);

        console.log(
          "Message auto-marked as read successfully:",
          message.key.id,
        );
      } catch (error) {
        console.error("Error auto-marking message as read:", error);
      }
    } else {
      console.log(
        "Auto-read disabled (markMessagesRead=false) - will only mark as read when user opens conversation",
      );
    }

    // Don't emit the raw WhatsApp message, it will be emitted from processIncomingMessage
  }

  private async handleReactionMessage(message: any) {
    try {
      const reaction = message.message.reactionMessage;
      const isFromMe = message.key.fromMe;
      const remoteJid = message.key.remoteJid;
      const phone = extractPhoneFromJid(remoteJid);
      
      console.log("=== REACTION MESSAGE RECEIVED ===");
      console.log("Reaction details:", {
        emoji: reaction.text,
        messageId: reaction.key?.id,
        from: phone,
        isFromMe: isFromMe,
        isRemoval: !reaction.text // Empty text means reaction removal
      });

      // Get the conversation
      let conversa = await storage.getConversaByTelefone(phone);
      if (!conversa) {
        console.log("No conversation found for reaction, ignoring");
        return;
      }

      // Find the original message that was reacted to
      const targetMessageId = reaction.key?.id;
      if (!targetMessageId) {
        console.log("No target message ID for reaction");
        return;
      }

      // Get the message from database
      const mensagens = await storage.getMensagensByConversaId(conversa.id);
      const targetMessage = mensagens.find(
        msg => msg.whatsappMessageId === targetMessageId || 
               msg.metadados?.whatsappMessageId === targetMessageId
      );

      if (!targetMessage) {
        console.log("Target message not found for reaction");
        return;
      }

      // Update the message with the reaction
      const updatedMetadados = {
        ...(targetMessage.metadados || {}),
        reaction: reaction.text || null, // null means reaction was removed
        reactionFrom: isFromMe ? "sistema" : "cliente",
        reactionTimestamp: new Date().toISOString()
      };

      await storage.updateMensagem(targetMessage.id, {
        metadados: updatedMetadados
      });

      // Notify WebSocket clients about the reaction
      this.notifyWebSocketClients("message_reaction", {
        conversaId: conversa.id,
        messageId: targetMessage.id,
        reaction: reaction.text || null,
        from: isFromMe ? "sistema" : "cliente",
        targetMessageId: targetMessage.id
      });

      // If it's from a client and bot is active, DON'T respond to reactions
      if (!isFromMe) {
        const botActive = conversa.modoAtendimento === "bot";
        if (botActive) {
          console.log("Bot ignoring reaction message from client");
          return; // Bot doesn't respond to reactions
        }
      }

      console.log("Reaction processed successfully");
    } catch (error) {
      console.error("Error handling reaction message:", error);
    }
  }

  private getMessageType(
    message: WAMessage,
  ): "text" | "image" | "video" | "audio" | "document" | "sticker" {
    // Check for view-once messages first
    if (message.message?.viewOnceMessage) {
      const viewOnce = message.message.viewOnceMessage.message;
      if (viewOnce?.imageMessage) return "image";
      if (viewOnce?.videoMessage) return "video";
      if (viewOnce?.audioMessage) return "audio";
    }
    
    // Check for view-once v2 messages
    if (message.message?.viewOnceMessageV2) {
      const viewOnce = message.message.viewOnceMessageV2.message;
      if (viewOnce?.imageMessage) return "image";
      if (viewOnce?.videoMessage) return "video";
      if (viewOnce?.audioMessage) return "audio";
    }

    // Check for ephemeral messages
    if (message.message?.ephemeralMessage) {
      const ephemeral = message.message.ephemeralMessage.message;
      if (ephemeral?.imageMessage) return "image";
      if (ephemeral?.videoMessage) return "video";
      if (ephemeral?.audioMessage) return "audio";
      if (ephemeral?.documentMessage) return "document";
      if (ephemeral?.stickerMessage) return "sticker";
    }
    
    // Check regular messages
    if (message.message?.imageMessage) return "image";
    if (message.message?.videoMessage) return "video";
    if (message.message?.audioMessage) return "audio";
    if (message.message?.documentMessage) return "document";
    if (message.message?.stickerMessage) return "sticker";
    return "text";
  }

  private async downloadMedia(message: any): Promise<string | undefined> {
    try {
      const buffer = await downloadMediaMessage(
        message,
        "buffer",
        {},
        {
          logger: console,
          reuploadRequest: this.sock!.updateMediaMessage,
        },
      );

      if (!buffer) return undefined;

      // Get the actual message content for extracting mime type
      let actualMessage = message.message;
      
      // Extract from view-once messages
      if (message.message?.viewOnceMessage) {
        actualMessage = message.message.viewOnceMessage.message;
      } else if (message.message?.viewOnceMessageV2) {
        actualMessage = message.message.viewOnceMessageV2.message;
      } else if (message.message?.ephemeralMessage) {
        actualMessage = message.message.ephemeralMessage.message;
      }

      // Convert buffer to base64 data URL
      let mimeType = "image/jpeg";
      if (actualMessage?.imageMessage) {
        mimeType = actualMessage.imageMessage.mimetype || "image/jpeg";
      } else if (actualMessage?.videoMessage) {
        mimeType = actualMessage.videoMessage.mimetype || "video/mp4";
      } else if (actualMessage?.audioMessage) {
        mimeType = actualMessage.audioMessage.mimetype || "audio/ogg";
      } else if (actualMessage?.documentMessage) {
        mimeType =
          actualMessage.documentMessage.mimetype ||
          "application/octet-stream";
      } else if (actualMessage?.stickerMessage) {
        mimeType = actualMessage.stickerMessage.mimetype || "image/webp";
      }

      const base64 = buffer.toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error("Error downloading media:", error);
      return undefined;
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Remove non-digits for validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check if it's a valid Brazilian phone number
    // Should start with 55 (Brazil code) and have 10-11 digits for the number itself
    // Total: 12-13 digits
    if (cleanPhone.startsWith('55')) {
      return cleanPhone.length >= 12 && cleanPhone.length <= 13;
    }
    
    // For non-Brazilian numbers, should be at least 10 digits
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }

  private async getOrCreateConversation(
    phone: string,
    pushName?: string,
    message?: WhatsAppMessage,
  ): Promise<any> {
    // Validate phone number before creating conversation
    if (!this.isValidPhoneNumber(phone)) {
      console.error(`❌ INVALID PHONE NUMBER DETECTED: ${phone}`);
      console.error(`This appears to be an internal WhatsApp ID, not a phone number`);
      
      // If this is from a message, try to extract the real phone from the key
      if (message?.from) {
        const realPhone = message.from.split('@')[0];
        if (this.isValidPhoneNumber(realPhone)) {
          console.log(`✅ Extracted valid phone from message.from: ${realPhone}`);
          phone = realPhone;
        } else {
          console.error(`Could not extract valid phone from message.from: ${message.from}`);
          return null;
        }
      } else {
        // Cannot proceed with invalid phone number
        return null;
      }
    }

    // Check if we already have a lock for this phone number
    const existingLock = this.conversationCreationLocks.get(phone);
    if (existingLock) {
      console.log(`Waiting for existing conversation creation lock for ${phone}`);
      return await existingLock;
    }

    // Create a new lock promise
    const lockPromise = (async () => {
      try {
        // First, try to get existing conversation
        let conversa = await storage.getConversaByTelefone(phone);
        
        if (!conversa) {
          // Double-check to prevent race condition with longer delay
          await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay
          conversa = await storage.getConversaByTelefone(phone);
          
          if (!conversa) {
            console.log(`Creating new conversation for ${phone}`);
            
            // Check if we should fetch client photos
            let profilePictureUrl: string | undefined;
            if (this.settings?.fetchClientPhotos) {
              profilePictureUrl = await this.getProfilePicture(phone);
            }

            // For media messages, ensure we have proper display text
            let displayMessage = message?.message || "";
            // Only set default message for media if there's absolutely no text
            // This preserves text content from media messages (like video captions)
            if (message && message.type !== "text" && (!displayMessage || displayMessage === "")) {
              // Only use placeholder text if no actual message content exists
              switch (message.type) {
                case "image":
                  displayMessage = "[Imagem]";
                  break;
                case "video":
                  displayMessage = "[Vídeo]";
                  break;
                case "audio":
                  displayMessage = "[Áudio]";
                  break;
                case "document":
                  displayMessage = "[Documento]";
                  break;
                case "sticker":
                  displayMessage = "[Sticker]";
                  break;
              }
            }

            // Detectar se a conversa foi iniciada por anúncio
            // Anúncios do Facebook/Instagram geralmente contêm palavras específicas
            const isFromAd = displayMessage && (
              displayMessage.toLowerCase().includes("anúncio") ||
              displayMessage.toLowerCase().includes("facebook") ||
              displayMessage.toLowerCase().includes("instagram") ||
              displayMessage.toLowerCase().includes("publicidade") ||
              displayMessage.toLowerCase().includes("propaganda") ||
              displayMessage.toLowerCase().includes("cliquei no anúncio") ||
              displayMessage.toLowerCase().includes("vi o anúncio") ||
              displayMessage.toLowerCase().includes("vi no face") ||
              displayMessage.toLowerCase().includes("vi no insta")
            );

            try {
              conversa = await storage.createConversa({
                telefone: phone,
                nome: pushName || phone,
                ultimaMensagem: displayMessage,
                modoAtendimento: "bot",
                mensagensNaoLidas: this.settings?.markMessagesRead ? 0 : 1,
                lastSeen: new Date(),
                isOnline: true,
                ultimoRemetente: "cliente",
                profilePicture: profilePictureUrl,
                tipoUltimaMensagem: message?.type || "text",
                iniciadoPorAnuncio: isFromAd,
              });
              
              console.log(`New conversation created for ${phone} with ID ${conversa.id}`);
            } catch (createError: any) {
              // Se a criação falhar por duplicação, busca novamente
              console.log(`Creation failed, likely duplicate. Fetching again for ${phone}`);
              conversa = await storage.getConversaByTelefone(phone);
              if (!conversa) {
                throw createError; // Re-throw if still not found
              }
            }
          } else {
            console.log(`Conversation already exists for ${phone} (found on double-check)`);
          }
        } else {
          console.log(`Existing conversation found for ${phone} with ID ${conversa.id}`);
        }
        
        return conversa;
      } finally {
        // Clean up the lock after a delay
        setTimeout(() => {
          this.conversationCreationLocks.delete(phone);
        }, 2000); // Increased lock retention time
      }
    })();

    // Store the lock promise
    this.conversationCreationLocks.set(phone, lockPromise);
    
    return await lockPromise;
  }

  private async processOutgoingMessage(
    message: WhatsAppMessage,
    phone: string,
  ): Promise<void> {
    try {
      console.log("Processing outgoing WhatsApp message:", message);

      // Use the mutex-protected method to get or create conversation
      const conversa = await this.getOrCreateConversation(phone, undefined, message);

      if (conversa) {
        // Update existing conversation
        await storage.updateConversa(conversa.id, {
          ultimaMensagem: message.message,
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: message.type,
          // Don't change mode - keep current mode (bot or human)
          // modoAtendimento is only changed when explicitly needed
          // Reset unread messages when system sends a message
          mensagensNaoLidas: 0,
        });
      }

      // Check if message already exists (to avoid duplicates)
      if (message.id) {
        const existingMessage = await storage.getMensagemByWhatsappId(
          message.id,
        );
        if (existingMessage) {
          console.log(
            "Message already exists by WhatsApp ID, skipping duplicate save:",
            message.id,
          );
          return;
        }
      }

      // Additional check: Look for recent duplicate messages by content and sender
      // This helps avoid duplicates when the same message is processed twice
      const recentMessages = await storage.getMensagensByConversaId(conversa.id);
      const duplicateFound = recentMessages.some((msg) => {
        if (msg.remetente === "sistema" && msg.conteudo === message.message) {
          const msgTime = new Date(msg.timestamp).getTime();
          const currentTime = new Date(message.timestamp).getTime();
          const timeDiff = Math.abs(msgTime - currentTime);
          // If same message within 5 seconds, consider it a duplicate
          return timeDiff < 5000;
        }
        return false;
      });

      if (duplicateFound) {
        console.log(
          "Message already exists by content/time check, skipping duplicate save:",
          message.message.substring(0, 50),
        );
        return;
      }

      // Save the message
      await storage.createMensagem({
        conversaId: conversa.id,
        conteudo: message.message,
        remetente: "sistema",
        timestamp: new Date(message.timestamp),
        lida: true,
        tipo: message.type,
        mediaUrl: message.mediaUrl,
        metadados: message.metadados,
        whatsappMessageId: message.id,
      });

      // Note: We don't broadcast here anymore since sendMessage already does it

      console.log("Outgoing message processed and saved");
    } catch (error) {
      console.error("Error processing outgoing message:", error);
    }
  }

  private async processIncomingMessage(
    message: WhatsAppMessage,
    pushName?: string,
    bypassAntiSpam?: boolean
  ) {
    try {
      console.log("Processando mensagem recebida:", message);
      if (bypassAntiSpam) {
        console.log("[ANTI-SPAM] Processing buffered/combined message");
      }

      // Check if message was already processed during startup (to avoid duplicates)
      const messageKey = `${message.from}_${message.id}_${message.timestamp}`;
      if (this.processedMessagesOnStartup.has(messageKey)) {
        console.log("Message already processed during startup, skipping:", messageKey);
        return;
      }
      
      // Mark message as processed
      this.processedMessagesOnStartup.add(messageKey);
      
      // Clean old processed messages after 5 minutes to prevent memory leak
      if (this.processedMessagesOnStartup.size > 100) {
        setTimeout(() => {
          this.processedMessagesOnStartup.clear();
        }, 5 * 60 * 1000);
      }

      // Buscar ou criar conversa com proteção contra duplicatas
      let conversa = await this.getOrCreateConversation(message.from, pushName, message);
      
      // Cancel auto-close timer if there's an open ticket for this conversation
      if (conversa) {
        const openTicket = await storage.getOpenTicketByConversaId(conversa.id);
        if (openTicket) {
          // Send cancellation request to main server
          try {
            await fetch(`http://localhost:${process.env.PORT || 3000}/api/tickets/${openTicket.id}/cancel-auto-close-internal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            console.log(`Auto-close timer cancelado para ticket #${openTicket.id} - cliente enviou mensagem`);
          } catch (error) {
            console.error('Erro ao cancelar timer de auto-fechamento:', error);
          }
        }
      }

      // Update the conversation if it already existed
      if (conversa) {
        // Check if we should fetch client photos
        let profilePictureUrl: string | undefined;
        if (this.settings?.fetchClientPhotos) {
          profilePictureUrl = await this.getProfilePicture(message.from);
        }

        // For media messages, ensure we have proper display text
        let displayMessage = message.message;
        // Only set default message for media if there's absolutely no text
        // This preserves text content from media messages (like video captions)
        if (
          message.type !== "text" &&
          (!displayMessage || displayMessage === "")
        ) {
          // Only use placeholder text if no actual message content exists
          switch (message.type) {
            case "image":
              displayMessage = "[Imagem]";
              break;
            case "video":
              displayMessage = "[Vídeo]";
              break;
            case "audio":
              displayMessage = "[Áudio]";
              break;
            case "document":
              displayMessage = "[Documento]";
              break;
            case "sticker":
              displayMessage = "[Sticker]";
              break;
          }
        }

        // Update conversation including profile picture if settings enabled
        const updateData: any = {
          ultimaMensagem: displayMessage,
          // Only increment unread messages for incoming CLIENT messages
          mensagensNaoLidas: this.settings?.markMessagesRead
            ? 0
            : (conversa.mensagensNaoLidas || 0) + 1,
          lastSeen: new Date(),
          isOnline: true, // User is online when sending message
          ultimoRemetente: "cliente", // Add this field
          tipoUltimaMensagem: message.type, // Save message type
        };

        // Update name if pushName is provided and different
        if (pushName && pushName !== conversa.nome) {
          updateData.nome = pushName;
        }

        // Only update profile picture if fetchClientPhotos is enabled
        if (this.settings?.fetchClientPhotos && profilePictureUrl) {
          updateData.profilePicture = profilePictureUrl;
        }

        await storage.updateConversa(conversa.id, updateData);
      }

      // Check if message already exists (to avoid duplicates)
      if (message.id) {
        const existingMessage = await storage.getMensagemByWhatsappId(
          message.id,
        );
        if (existingMessage) {
          console.log(
            "Incoming message already exists, skipping duplicate save:",
            message.id,
          );
          return;
        }
      }

      // Salvar mensagem
      // Log to verify normalized value is being saved
      if (message.type === "text" && message.metadados?.originalButtonId) {
        console.log(`[DEBUG] Saving normalized button response: "${message.message}" (original: "${message.metadados.originalButtonId}")`);
      }
      const mensagem = await storage.createMensagem({
        conversaId: conversa.id,
        conteudo: message.message,
        tipo: message.type,
        remetente: "cliente",
        lida: this.settings?.markMessagesRead || false, // Auto-mark as read if setting is enabled
        mediaUrl: message.mediaUrl,
        metadados: message.metadados,
        whatsappMessageId: message.id, // Save WhatsApp message ID directly
      });

      // Notificar clientes conectados via WebSocket com estrutura completa
      const mensagemCompleta = {
        ...mensagem,
        conversaId: conversa.id,
        ehRemetente: false, // mensagem do cliente, não nossa
      };

      console.log("Enviando mensagem via WebSocket:", mensagemCompleta);
      this.notifyWebSocketClients("whatsapp_message", mensagemCompleta);

      // Processar bot se estiver ativo
      console.log("=== VERIFICAÇÃO DO BOT ===");
      console.log("Conversa ID:", conversa.id);
      console.log("Telefone:", conversa.telefone);
      console.log("Modo de atendimento:", conversa.modoAtendimento);
      console.log("Cliente ID:", conversa.clienteId);

      if (conversa.modoAtendimento === "bot") {
        console.log("Modo bot ativo, processando mensagem...");
        await this.processBot(conversa, message);
      } else if (conversa.modoAtendimento === "humano") {
        console.log(
          "Conversação em modo humano, não processando bot",
        );
        // When in human mode, do not process any bot logic
        // Just let the message be saved and wait for human response
      } else {
        console.log(
          "Modo indefinido, verificando configuração...",
        );

        // Only auto-activate bot for NEW conversations (not those already in human mode)
        if (!conversa.clienteId) {
          console.log(
            "Não é cliente cadastrado, verificando se há bot para novos...",
          );
          const botNovos = await storage.getBotConfigByTipo("novos");
          if (botNovos && botNovos.ativo) {
            console.log(
              "Bot para novos está ativo, ativando modo bot e enviando menu...",
            );
            await storage.updateConversa(conversa.id, {
              modoAtendimento: "bot",
            });
            conversa.modoAtendimento = "bot";
            // Don't send menu here - processBot will handle it
            await this.processBot(conversa, message);
          }
        }
      }

      await this.logActivity(
        "info",
        "WhatsApp",
        `Mensagem recebida de ${message.from}`,
      );
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao processar mensagem: ${error}`,
      );
    }
  }

  private async processBot(conversa: any, message: WhatsAppMessage) {
    try {
      console.log("Iniciando processamento do bot para:", conversa.telefone);

      // CRITICAL: Re-check conversation mode to ensure it's still in bot mode
      // This prevents any race conditions where mode might have changed
      const currentConversa = await storage.getConversaByTelefone(conversa.telefone);
      if (currentConversa?.modoAtendimento !== "bot") {
        console.log("BLOCKED: Conversation is in human mode, bot will not respond");
        // Clear any existing state when in human mode
        this.conversaStates.delete(conversa.telefone);
        return;
      }

      // Check if we're in payment silence period
      if (this.isInPaymentSilencePeriod(conversa.telefone)) {
        console.log(`[PAYMENT] Bot em período de silêncio após pagamento para ${conversa.telefone} - não responderá`);
        return; // Don't respond to any messages during silence period
      }

      const cliente = await storage.getClienteByTelefone(conversa.telefone);

      // Verificar se é um cliente teste (ativo ou expirado)
      console.log(`[BOT DEBUG] Buscando teste para telefone: ${conversa.telefone}`);
      const teste = await storage.getAnyTesteByTelefone(conversa.telefone);
      console.log(`[BOT DEBUG] Teste encontrado:`, teste ? `ID ${teste.id}, expira em ${teste.expiraEm}` : 'NENHUM');



      // Determinar o tipo de bot correto
      let tipoBot = "novos";
      if (teste) {
        tipoBot = "testes";
        console.log(`[BOT DEBUG] TESTE DETECTADO para ${conversa.telefone} - usando bot de testes (ativo ou expirado)`);
      } else if (cliente) {
        tipoBot = "clientes";
        console.log(`[BOT DEBUG] CLIENTE DETECTADO para ${conversa.telefone} - usando bot de clientes`);
      } else {
        console.log(`[BOT DEBUG] NOVO USUÁRIO para ${conversa.telefone} - usando bot de novos`);
      }

      console.log(`Tipo de bot determinado: ${tipoBot}`);

      // For test bot, we don't need to get botConfig from database
      // We'll handle it directly with our custom menu
      let botConfig: any;
      
      if (tipoBot === "testes") {
        // Create a fake botConfig for test type to satisfy the code flow
        botConfig = { tipo: "testes", ativo: true, opcoes: [] };
        console.log("Using custom test bot configuration");
      } else {
        botConfig = await storage.getBotConfigByTipo(tipoBot);
        if (!botConfig || !botConfig.ativo) {
          console.log("Bot não está ativo ou não encontrado para tipo:", tipoBot);
          return;
        }
      }

      console.log("Configuração do bot encontrada:", botConfig);

      const opcoes = botConfig.opcoes as any[];
      const messageText = message.message.toLowerCase().trim();

      // Check if user is in a submenu
      const state = this.conversaStates.get(conversa.telefone);
      const isInSubmenu = state && state.submenu;
      
      // Debug log for expired client tracking
      if (cliente && isInSubmenu) {
        console.log(`[DEBUG] Cliente ${cliente.nome} - Estado: ${state.submenu} - Mensagem: ${messageText}`);
      }



      // If in submenu, handle submenu logic only
      if (isInSubmenu) {
        console.log("===== USUÁRIO EM SUBMENU =====");
        console.log("Submenu atual:", state.submenu);
        console.log("Mensagem recebida:", messageText);
        console.log("Tipo de bot:", tipoBot);

        // Special case: aguardando_codigo accepts any text
        if (state.submenu !== "aguardando_codigo") {
          // Validate option before processing
          const validOptions = this.getValidOptionsForSubmenu(state.submenu);
          console.log(
            `Opções válidas para submenu ${state.submenu}: ${validOptions.join(", ")}`,
          );

          if (!validOptions.includes(messageText)) {
            console.log(
              `ERRO: Opção "${messageText}" inválida para submenu "${state.submenu}"`,
            );
            await this.sendMessage(
              conversa.telefone,
              `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
            );
            return;
          }
        } else {
          console.log(
            `Submenu aguardando_codigo - aceitando qualquer texto como código: ${messageText}`,
          );
        }

        console.log(`Opção válida! Processando...`);

        if (tipoBot === "novos") {
          await this.handleNovosSubmenu(
            conversa,
            messageText,
            conversa.telefone,
            state.submenu,
          );
        } else if (tipoBot === "clientes") {
          await this.handleClientesSubmenu(
            conversa,
            messageText,
            conversa.telefone,
            state.submenu,
            cliente,
          );
        } else if (tipoBot === "testes") {
          await this.handleTestesBotOption(
            conversa,
            messageText,
            teste,
            conversa.telefone,
          );
        }
        return;
      }

      // Check for reset command
      if (messageText === "reset" || messageText === "resetar") {
        console.log(
          "Comando de reset detectado para número:",
          conversa.telefone,
        );
        this.conversaStates.delete(conversa.telefone);
        await this.sendMessage(
          conversa.telefone,
          `✅ Estado do bot resetado com sucesso!\n\nVou reenviar o menu principal.`,
        );
        await this.sendBotMenu(conversa.telefone, botConfig);
        return;
      }

      // Handle option "0" - always return to menu
      if (messageText === "0") {
        console.log("Opção 0 detectada - voltando ao menu principal");
        this.conversaStates.delete(conversa.telefone);
        await this.sendBotMenu(conversa.telefone, botConfig);
      }
      // Special handling for clientes bot - always accept options 1-6
      // BUT ONLY IF NOT IN A SUBMENU (fix for expired client menu bug)
      else if (tipoBot === "clientes" && ["1", "2", "3", "4", "5", "6"].includes(messageText) && !isInSubmenu) {
        console.log(`Opção ${messageText} selecionada para bot clientes (menu principal)`);
        await this.handleClientesBotOption(
          conversa,
          messageText,
          cliente,
          conversa.telefone,
        );
      } 
      // Special handling for novos bot - accept options 1-8
      // BUT ONLY IF NOT IN A SUBMENU
      else if (tipoBot === "novos" && ["1", "2", "3", "4", "5", "6", "7", "8"].includes(messageText) && !isInSubmenu) {
        console.log(`Opção ${messageText} selecionada para bot novos (menu principal)`);
        await this.handleNovosBotOption(
          conversa,
          messageText,
          conversa.telefone,
        );
      }
      // Special handling for test bot - accept options 1-2
      // BUT ONLY IF NOT IN A SUBMENU  
      else if (tipoBot === "testes" && ["1", "2"].includes(messageText) && !isInSubmenu) {
        console.log(`Opção ${messageText} selecionada para bot testes (menu principal)`);
        await this.handleTestesBotOption(
          conversa,
          messageText,
          teste,
          conversa.telefone,
        );
      } else {
        // Verificar se é um número de opção válida do menu principal
        const opcaoSelecionada = opcoes.find(
          (op) =>
            (op.id && op.id === messageText) ||
            (op.numero && op.numero === messageText),
        );

        if (opcaoSelecionada) {
          console.log("Opção selecionada:", opcaoSelecionada);
          await this.handleBotOption(
            conversa,
            opcaoSelecionada,
            cliente,
            teste,
            tipoBot,
          );
        } else {
          // SEMPRE enviar o menu principal para qualquer mensagem inicial
          console.log(
            `Mensagem inicial recebida: "${messageText}" - enviando menu principal`,
          );
          console.log(`Tipo de bot para menu principal: ${tipoBot}`);
          
          // Para bot de testes, passar tipo correto para sendBotMenu
          if (tipoBot === "testes") {
            // Create proper test bot config with tipo
            const testBotConfig = { tipo: "testes", ativo: true, opcoes: [] };
            await this.sendBotMenu(conversa.telefone, testBotConfig);
          } else {
            await this.sendBotMenu(conversa.telefone, botConfig);
          }
        }
      }
    } catch (error) {
      console.error("Erro no bot:", error);
      await this.logActivity("error", "WhatsApp Bot", `Erro no bot: ${error}`);
    }
  }

  private async handleBotOption(
    conversa: any,
    opcao: any,
    cliente: any,
    teste?: any,
    tipoBot?: string,
  ) {
    const telefone = conversa.telefone;
    const opcaoId = opcao.id || opcao.numero;

    // Determine bot type if not provided
    if (!tipoBot) {
      tipoBot = "novos";
      if (teste) {
        tipoBot = "testes";
      } else if (cliente) {
        tipoBot = "clientes";
      }
    }

    console.log(`Processando opção ${opcaoId} para bot tipo ${tipoBot}`);

    // Handle option "0" - return to menu
    if (opcaoId === "0") {
      const botConfig = await storage.getBotConfigByTipo(tipoBot);
      await this.sendBotMenu(telefone, botConfig);
      return;
    }

    // Handle different bot types with their specific menus
    switch (tipoBot) {
      case "novos":
        await this.handleNovosBotOption(conversa, opcaoId, telefone);
        break;
      case "clientes":
        await this.handleClientesBotOption(
          conversa,
          opcaoId,
          cliente,
          telefone,
        );
        break;
      case "testes":
        await this.handleTestesBotOption(conversa, opcaoId, teste, telefone);
        break;
    }
  }

  // Armazenar estado do submenu da conversa
  private conversaStates = new Map<
    string,
    {
      submenu?: string;
      lastActivity: Date;
      lastOption?: string;
      retryCount?: number;
      previousMenu?: string; // Para rastrear de onde veio
      codigoIndicacao?: string; // Para armazenar código de indicação
      paymentConfirmedAt?: Date; // Para rastrear quando o pagamento foi confirmado
    }
  >();

  // Método público para resetar o estado de uma conversa
  public resetConversationState(telefone: string) {
    console.log(`Resetando estado da conversa para: ${telefone}`);
    this.conversaStates.delete(telefone);
  }

  // Método público para marcar pagamento como confirmado e iniciar período de silêncio
  public handlePaymentConfirmed(telefone: string) {
    console.log(`[PAYMENT] Marcando pagamento como confirmado para: ${telefone}`);
    
    // Get existing state and MERGE with payment confirmation fields
    // Preserve important fields like telefone while clearing submenu
    const existingState = this.conversaStates.get(telefone) || {};
    this.conversaStates.set(telefone, {
      ...existingState, // Preserve all existing fields including telefone and other metadata
      paymentConfirmedAt: new Date(),
      lastActivity: new Date(),
      submenu: null, // Clear payment menu to prevent showing options
      retryCount: 0 // Reset retry count
    });
    
    console.log(`[PAYMENT] Período de silêncio iniciado e menu limpo para: ${telefone}`);
  }

  // Método privado para verificar se está no período de silêncio após pagamento
  private isInPaymentSilencePeriod(telefone: string): boolean {
    const state = this.conversaStates.get(telefone);
    
    if (!state || !state.paymentConfirmedAt) {
      return false;
    }
    
    const now = new Date();
    const paymentTime = new Date(state.paymentConfirmedAt);
    const timeDiff = now.getTime() - paymentTime.getTime();
    const minutesPassed = timeDiff / (1000 * 60);
    
    // Se passaram mais de 10 minutos, limpar APENAS o flag de pagamento e retornar false
    if (minutesPassed > 10) {
      console.log(`[PAYMENT] Período de silêncio expirou para ${telefone} (${minutesPassed.toFixed(2)} minutos)`);
      // Remove ONLY the payment confirmation flag, preserve other state
      const updatedState = { ...state };
      delete updatedState.paymentConfirmedAt;
      
      // If there are other fields, preserve them; otherwise delete the entry
      if (Object.keys(updatedState).length > 0) {
        this.conversaStates.set(telefone, updatedState);
        console.log(`[PAYMENT] Flag de pagamento removido para ${telefone}, estado preservado:`, updatedState);
      } else {
        this.conversaStates.delete(telefone);
        console.log(`[PAYMENT] Estado vazio após remover flag de pagamento para ${telefone} - removendo entrada`);
      }
      return false;
    }
    
    console.log(`[PAYMENT] Em período de silêncio para ${telefone} (${minutesPassed.toFixed(2)} minutos desde confirmação)`);
    return true;
  }

  private async handleNovosBotOption(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    // Always get fresh state
    const state = this.conversaStates.get(telefone) || {
      lastActivity: new Date(),
    };

    console.log(`[NOVOS BOT] Processing option for ${telefone}`);
    console.log(`[NOVOS BOT] Current state:`, state);
    console.log(`[NOVOS BOT] Option received: ${opcaoId}`);

    // Processar opção baseado no estado atual (menu principal ou submenu)
    if (state.submenu) {
      console.log(`[NOVOS BOT] Has submenu: ${state.submenu}, calling handleNovosSubmenu`);
      await this.handleNovosSubmenu(conversa, opcaoId, telefone, state.submenu);
      return;
    }

    // Menu principal - validar opções
    const validMainMenuOptions = ["1", "2", "3", "4", "5", "6", "7", "8"];
    if (!validMainMenuOptions.includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
      );
      return;
    }

    switch (opcaoId) {
      case "1": // Teste grátis por 6h
        await this.sendInteractiveMenu(
          telefone,
          `Legal! 😄 Vamos ativar seu teste gratuito por 6h.\n\n` +
            `Onde você vai assistir?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ TV Box (caixinha)\n` +
            `3️⃣ Smart TV\n` +
            `4️⃣ Notebook ou Computador\n` +
            `5️⃣ Outros\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "teste_dispositivo",
          lastActivity: new Date(),
          previousMenu: "main",
        });
        break;

      case "2": // Quero assinar agora
        await this.sendInteractiveMenu(
          telefone,
          `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
            `1️⃣ Sim, tenho código\n` +
            `2️⃣ Não tenho\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "assinar_codigo",
          lastActivity: new Date(),
          previousMenu: "main",
        });
        break;

      case "3": // Qual o conteúdo?
        await this.sendInteractiveMenu(
          telefone,
          `📺 A TvON te dá acesso a:\n\n` +
            `• Todos os canais ao vivo (Globo, SBT, Record, SporTV, Premiere, Discovery, Cartoon, etc)\n` +
            `• Todos os filmes e séries das principais plataformas: Netflix, Prime Video, Disney+, Paramount+, HBO Max e outras\n` +
            `• Programação infantil, esportiva, documentários, realities, filmes em lançamento e muito mais\n` +
            `• Qualidade até 4K, sem travar\n` +
            `• Suporte 24 horas!\n\n` +
            `1️⃣ Assinar agora\n` +
            `2️⃣ Testar grátis por 6h\n` +
            `0️⃣ Voltar`,
        );
        // Set state to track this is an info-only menu
        this.conversaStates.set(telefone, {
          submenu: "info_only",
          lastActivity: new Date(),
          lastOption: "3",
          previousMenu: "main",
        });
        break;

      case "4": // Qual o valor?
        await this.sendInteractiveMenu(
          telefone,
          `💰 Planos TvON:\n\n` +
            `• 🔹 Mensal: R$ 29,90\n` +
            `• 🔹 Trimestral: R$ 79,90 (10% OFF)\n` +
            `• 🔹 Semestral: R$ 139,90 (20% OFF)\n` +
            `• 🔹 Anual: R$ 249,90 (30% OFF)\n\n` +
            `• ✅ Pode cancelar quando quiser\n` +
            `• ✅ Sem taxas extras\n` +
            `• ✅ Reembolso proporcional em caso de cancelamento, conforme nossas políticas\n\n` +
            `1️⃣ Assinar agora\n` +
            `2️⃣ Testar grátis por 6h\n` +
            `0️⃣ Voltar`,
        );
        // Set state to track this is an info-only menu
        this.conversaStates.set(telefone, {
          submenu: "info_only",
          lastActivity: new Date(),
          lastOption: "4",
          previousMenu: "main",
        });
        break;

      case "5": // Por onde consigo assistir?
        await this.sendInteractiveMenu(
          telefone,
          `Você pode usar a TvON em praticamente qualquer dispositivo com internet:\n\n` +
            `• 📱 Celulares Android e iPhone\n` +
            `• 📺 Todas as Smart TVs (Samsung, LG, Philips, AOC, TCL e outras)\n` +
            `• 🖥️ TV Box\n` +
            `• 💻 Notebooks e PCs\n` +
            `• 📦 Outros aparelhos conectados à internet\n\n` +
            `1️⃣ Assinar agora\n` +
            `2️⃣ Testar grátis por 6h\n` +
            `0️⃣ Voltar`,
        );
        // Set state to track this is an info-only menu
        this.conversaStates.set(telefone, {
          submenu: "info_only",
          lastActivity: new Date(),
          lastOption: "5",
          previousMenu: "main",
        });
        break;

      case "6": // Saber mais
        await this.sendInteractiveMenu(
          telefone,
          `A *TvON* é uma central de conteúdo que reúne:\n\n` +
            `• ✅ Canais ao vivo de todas as categorias (abertos e fechados)\n` +
            `• ✅ Filmes e séries completas de todas as plataformas\n` +
            `• ✅ Qualidade até 4K, sem travar\n` +
            `• ✅ Suporte técnico 24 horas\n` +
            `• ✅ Planos a partir de R$ 29,90\n` +
            `• ✅ Sem fidelidade, sem multa, com liberdade total\n` +
            `• ✅ Acesso por celular, Smart TV, TV Box, notebook, computador e muito mais!\n\n` +
            `Tudo isso por um preço justo, com estabilidade e facilidade.\n\n` +
            `1️⃣ Assinar agora\n` +
            `2️⃣ Testar grátis por 6h\n` +
            `0️⃣ Voltar`,
        );
        // Set state to track this is an info-only menu
        this.conversaStates.set(telefone, {
          submenu: "info_only",
          lastActivity: new Date(),
          lastOption: "6",
          previousMenu: "main",
        });
        break;

      case "7": // Falar com atendente
        await this.sendMessage(
          telefone,
          `Chamando um atendente agora...\n` +
            `Por favor, aguarde um instante enquanto transferimos você para um atendente humano.`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Suporte manual solicitado - Novo Cliente",
        );
        // Clear the state so bot stops responding
        this.conversaStates.delete(telefone);
        break;

      case "8": // Já sou cliente
        await this.sendMessage(
          telefone,
          `Entendido! Você já é nosso cliente. 👍\n\n` +
            `Vou chamar um atendente para te ajudar melhor.\n` +
            `Por favor, aguarde um instante...`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Cliente existente precisando de atendimento - Informou ser cliente atual",
        );
        // Clear the state so bot stops responding
        this.conversaStates.delete(telefone);
        break;

      case "0": // Voltar ao menu
        const botConfig = await storage.getBotConfigByTipo("novos");
        await this.sendBotMenu(telefone, botConfig);
        this.conversaStates.delete(telefone);
        break;
    }
  }

  private async handleNovosSubmenu(
    conversa: any,
    opcaoId: string,
    telefone: string,
    submenuParam: string,
  ) {
    // IMPORTANT: Always get the fresh state from memory, not the passed parameter
    // The parameter might be outdated if state was updated during processing
    const currentState = this.conversaStates.get(telefone);
    const submenu = currentState?.submenu || submenuParam;
    
    console.log("===== HANDLE NOVOS SUBMENU =====");
    console.log(`Telefone: ${telefone}`);
    console.log(`Submenu from parameter: ${submenuParam}`);
    console.log(`Submenu from current state: ${submenu}`);
    console.log(`OpcaoId: ${opcaoId}`);
    console.log(`Current state in map:`, currentState);
    console.log("================================");

    // Special handling for info-only menus
    if (submenu === "info_only") {
      if (opcaoId === "0") {
        this.conversaStates.delete(telefone);
        const botConfig = await storage.getBotConfigByTipo("novos");
        await this.sendBotMenu(telefone, botConfig);
      } else if (opcaoId === "1") {
        // Assinar agora - redirect to subscription flow
        this.conversaStates.set(telefone, {
          submenu: "assinar_codigo",
          lastActivity: new Date(),
          previousMenu: "info_only",
        });
        await this.sendInteractiveMenu(
          telefone,
          `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
            `1️⃣ Sim, tenho código\n` +
            `2️⃣ Não tenho\n` +
            `0️⃣ Voltar`,
        );
      } else if (opcaoId === "2") {
        // Testar grátis - redirect to test flow
        this.conversaStates.set(telefone, {
          submenu: "teste_dispositivo",
          lastActivity: new Date(),
          previousMenu: "info_only",
        });
        await this.sendInteractiveMenu(
          telefone,
          `Legal! 😄 Vamos ativar seu teste gratuito por 6h.\n\n` +
            `Onde você vai assistir?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ TV Box (caixinha)\n` +
            `3️⃣ Smart TV\n` +
            `4️⃣ Notebook ou Computador\n` +
            `5️⃣ Outros\n` +
            `0️⃣ Voltar`,
        );
      } else {
        await this.sendMessage(
          telefone,
          `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
        );
      }
      return;
    }

    // Voltar ao menu anterior
    if (opcaoId === "0") {
      const state = this.conversaStates.get(telefone) as any;
      const previousMenu = state?.previousMenu || "main";

      if (previousMenu === "main") {
        this.conversaStates.delete(telefone);
        const botConfig = await storage.getBotConfigByTipo("novos");
        await this.sendBotMenu(telefone, botConfig);
      } else if (previousMenu === "info_only") {
        // Voltar para o menu informativo
        const lastOption = state?.lastOption || "3";
        this.conversaStates.set(telefone, {
          submenu: "info_only",
          lastActivity: new Date(),
          lastOption: lastOption,
          previousMenu: "main",
        });
        await this.sendMessage(telefone, this.getInfoOnlyMenuText(lastOption));
      } else if (previousMenu === "assinar_codigo") {
        // Voltar para o menu de código
        this.conversaStates.set(telefone, {
          submenu: "assinar_codigo",
          lastActivity: new Date(),
          previousMenu: "main",
        });
        await this.sendInteractiveMenu(
          telefone,
          `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
            `1️⃣ Sim, tenho código\n` +
            `2️⃣ Não tenho\n` +
            `0️⃣ Voltar`,
        );
      }
      return;
    }

    // Check if the option is valid for the current submenu
    const validOptions = this.getValidOptionsForSubmenu(submenu);
    console.log(
      `Validando opções para submenu ${submenu}: ${validOptions.join(", ")}, recebido: ${opcaoId}`,
    );

    // Caso especial: aguardando_codigo aceita qualquer texto
    if (submenu === "aguardando_codigo") {
      // Não validar, apenas continuar para processar o código
    } else if (!validOptions.includes(opcaoId)) {
      // Send only error message without resending the menu
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
      );
      return;
    }

    // Process valid submenu options
    console.log("===== PROCESSING SUBMENU =====");
    console.log("Submenu to process:", submenu);
    console.log("Phone key:", telefone);
    console.log("==============================");
    
    switch (submenu) {
      case "teste_dispositivo":
        await this.handleTesteDispositivo(conversa, opcaoId, telefone);
        break;
      case "assinar_codigo":
        await this.handleAssinarCodigo(conversa, opcaoId, telefone);
        break;
      case "assinar_dispositivo":
        await this.handleAssinarDispositivo(conversa, opcaoId, telefone);
        break;
      case "celular_tipo":
        await this.handleCelularTipo(conversa, opcaoId, telefone);
        break;
      case "smart_tv_marca":
        await this.handleSmartTvMarca(conversa, opcaoId, telefone);
        break;
      case "celular_tipo_assinar":
        await this.handleCelularTipoAssinar(conversa, opcaoId, telefone);
        break;
      case "smart_tv_marca_assinar":
        await this.handleSmartTvMarcaAssinar(conversa, opcaoId, telefone);
        break;
      case "renovar_periodo":
        await this.handleRenovarPeriodo(conversa, opcaoId, telefone);
        break;
      case "renovar_confirmar":
        await this.handleRenovarConfirmar(conversa, opcaoId, telefone);
        break;
      case "renovar_aguardando_pagamento":
        await this.handleRenovarAguardandoPagamento(
          conversa,
          opcaoId,
          telefone,
        );
        break;
      case "aguardando_codigo":
        console.log("===== PROCESSING REFERRAL CODE =====");
        console.log("Phone key (telefone):", telefone);
        console.log("Conversa ID:", conversa.id);
        console.log("Received code:", opcaoId);
        console.log("Current state before processing:", this.conversaStates.get(telefone));
        
        // Format the phone number to check against database
        let formattedCode = opcaoId.replace(/\D/g, ''); // Remove all non-digits
        
        // Remove leading zeros
        formattedCode = formattedCode.replace(/^0+/, '') || '0';
        
        // Check if the code is too short to be a valid phone number
        if (formattedCode.length < 8) {
          console.log("Code too short to be a valid phone number:", formattedCode);
          // Invalid referral code - give options
          await this.sendInteractiveMenu(
            telefone,
            `❌ Código de indicação inválido!\n\n` +
            `O código "${opcaoId}" não é um número de telefone válido.\n` +
            `O código deve ser o WhatsApp de quem te indicou.\n\n` +
            `Escolha uma opção:\n\n` +
            `1️⃣ Digitar novamente\n` +
            `2️⃣ Continuar sem código\n` +
            `0️⃣ Voltar`,
          );
          
          this.conversaStates.set(telefone, {
            submenu: "codigo_invalido",
            lastActivity: new Date(),
            previousMenu: "aguardando_codigo",
          } as any);
          return;
        }
        
        // Remove +55 or 55 if it's at the beginning and the remaining is 10 or 11 digits
        if (formattedCode.startsWith('55')) {
          const withoutCountryCode = formattedCode.substring(2);
          if (withoutCountryCode.length === 10 || withoutCountryCode.length === 11) {
            // It already has country code, keep it
            // formattedCode is already correct
          } else if (withoutCountryCode.length === 8 || withoutCountryCode.length === 9) {
            // Might be missing area code, keep as is
            formattedCode = '55' + withoutCountryCode;
          }
        } else if (formattedCode.length === 10 || formattedCode.length === 11) {
          // Brazilian mobile/landline without country code
          formattedCode = '55' + formattedCode;
        } else if (formattedCode.length === 8 || formattedCode.length === 9) {
          // Number without area code - can't validate properly
          // Try to add default area code or reject
          formattedCode = '5514' + formattedCode; // Using 14 as default area code
        }
        
        console.log("Formatted code to check:", formattedCode);
        
        // Check if this phone number exists as a client in database
        let clienteIndicador = null;
        try {
          clienteIndicador = await storage.getClienteByTelefone(formattedCode);
        } catch (error) {
          console.error("Error checking referral code:", error);
          // If there's a database error, treat as invalid code
          clienteIndicador = null;
        }
        
        if (clienteIndicador) {
          // Valid referral code - save it and continue
          // Save the referral code in conversation metadata
          await storage.updateConversa(conversa.id, {
            metadados: JSON.stringify({
              ...JSON.parse(conversa.metadados || '{}'),
              codigoIndicacao: formattedCode,
              nomeIndicador: clienteIndicador.nome
            })
          });
          
          // Check if user already has a test with device information
          const teste = await storage.getAnyTesteByTelefone(telefone);
          
          if (teste && teste.dispositivo) {
            // User has test with device info - skip device selection
            console.log(`[BOT] Cliente com teste já tem dispositivo: ${teste.dispositivo}`);
            
            // Map device type to human-readable format
            let dispositivoFormatado = teste.dispositivo;
            if (teste.dispositivo === "smart_tv") {
              dispositivoFormatado = "Smart TV";
            } else if (teste.dispositivo === "tv_box") {
              dispositivoFormatado = "TV Box";
            } else if (teste.dispositivo === "celular") {
              dispositivoFormatado = `Celular (${teste.aplicativo === "ibo_player" ? "iPhone" : "Android"})`;
            } else if (teste.dispositivo === "notebook") {
              dispositivoFormatado = "Notebook ou Computador";
            }
            
            // Go directly to human signup with existing device info
            await this.completeSignupWithHuman(
              conversa,
              telefone,
              dispositivoFormatado,
              formattedCode,
              clienteIndicador.nome,
            );
          } else {
            // No test or no device info - ask for device
            await this.sendInteractiveMenu(
              telefone,
              `✅ Código de indicação válido!\n` +
              `Indicado por: *${clienteIndicador.nome}*\n\n` +
              `Onde você vai assistir?\n\n` +
              `1️⃣ Celular\n` +
              `2️⃣ TV Box (caixinha)\n` +
              `3️⃣ Smart TV\n` +
              `4️⃣ Notebook ou Computador\n` +
              `5️⃣ Outros\n` +
              `0️⃣ Voltar`,
            );
            
            const newState = {
              submenu: "assinar_dispositivo",
              lastActivity: new Date(),
              codigoIndicacao: formattedCode,
              nomeIndicador: clienteIndicador.nome,
              previousMenu: "aguardando_codigo",
            } as any;
            
            console.log("===== SETTING NEW STATE AFTER VALID CODE =====");
            console.log("Phone key for setting:", telefone);
            console.log("New state:", newState);
            
            this.conversaStates.set(telefone, newState);
            
            // Verify state was set correctly
            const verifyState = this.conversaStates.get(telefone);
            console.log("State after setting:", verifyState);
            console.log("All keys in map:", Array.from(this.conversaStates.keys()));
            console.log("==============================================");
          }
          
          // IMPORTANT: Return here to prevent fall-through to invalid code handling
          return;
        } else {
          // Invalid referral code - give options
          await this.sendInteractiveMenu(
            telefone,
            `❌ Código de indicação não encontrado!\n\n` +
            `O código "${opcaoId}" não está cadastrado.\n\n` +
            `Escolha uma opção:\n\n` +
            `1️⃣ Digitar novamente\n` +
            `2️⃣ Continuar sem código\n` +
            `0️⃣ Voltar`,
          );
          
          this.conversaStates.set(telefone, {
            submenu: "codigo_invalido",
            lastActivity: new Date(),
            previousMenu: "aguardando_codigo",
          } as any);
        }
        break;
      case "codigo_invalido":
        // Handle invalid referral code options
        if (opcaoId === "0") {
          // Go back to asking if they have a code
          await this.sendInteractiveMenu(
            telefone,
            `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
              `1️⃣ Sim, tenho código\n` +
              `2️⃣ Não tenho\n` +
              `0️⃣ Voltar`,
          );
          this.conversaStates.set(telefone, {
            submenu: "assinar_codigo",
            lastActivity: new Date(),
            previousMenu: "main",
          });
        } else if (opcaoId === "1") {
          // Try again - ask for code again
          await this.sendMessage(
            telefone,
            `O código é o WhatsApp de quem te indicou!\n` +
            `Por favor, digite seu código de indicação:`,
          );
          this.conversaStates.set(telefone, {
            submenu: "aguardando_codigo",
            lastActivity: new Date(),
            previousMenu: "codigo_invalido",
          } as any);
        } else if (opcaoId === "2") {
          // Continue without code
          // Check if user already has a test with device information
          const teste = await storage.getAnyTesteByTelefone(telefone);
          
          if (teste && teste.dispositivo) {
            // User has test with device info - skip device selection
            console.log(`[BOT] Cliente com teste já tem dispositivo: ${teste.dispositivo}`);
            
            // Map device type to human-readable format
            let dispositivoFormatado = teste.dispositivo;
            if (teste.dispositivo === "smart_tv") {
              dispositivoFormatado = "Smart TV";
            } else if (teste.dispositivo === "tv_box") {
              dispositivoFormatado = "TV Box";
            } else if (teste.dispositivo === "celular") {
              dispositivoFormatado = `Celular (${teste.aplicativo === "ibo_player" ? "iPhone" : "Android"})`;
            } else if (teste.dispositivo === "notebook") {
              dispositivoFormatado = "Notebook ou Computador";
            }
            
            // Go directly to human signup with existing device info
            await this.completeSignupWithHuman(
              conversa,
              telefone,
              dispositivoFormatado,
              "Não",
              null,
            );
          } else {
            // No test or no device info - ask for device
            await this.sendInteractiveMenu(
              telefone,
              `Onde você vai assistir?\n\n` +
                `1️⃣ Celular\n` +
                `2️⃣ TV Box (caixinha)\n` +
                `3️⃣ Smart TV\n` +
                `4️⃣ Notebook ou Computador\n` +
                `5️⃣ Outros\n` +
                `0️⃣ Voltar`,
            );
            this.conversaStates.set(telefone, {
              submenu: "assinar_dispositivo",
              lastActivity: new Date(),
              previousMenu: "codigo_invalido",
            } as any);
          }
        } else {
          await this.sendMessage(
            telefone,
            `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
          );
        }
        break;
        
      case "teste_expirado_menu":
        // Tratamento para o menu de teste expirado
        if (opcaoId === "1") {
          // Ativar plano agora
          await this.sendInteractiveMenu(
            telefone,
            `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
              `1️⃣ Sim, tenho código\n` +
              `2️⃣ Não tenho\n` +
              `0️⃣ Voltar`,
          );
          this.conversaStates.set(telefone, {
            submenu: "assinar_codigo",
            lastActivity: new Date(),
            previousMenu: "teste_expirado_menu",
          });
        } else if (opcaoId === "2") {
          // Falar com atendente
          // Abre um ticket de suporte
          const ticket = await storage.createTicket({
            conversaId: conversa.id,
            titulo: "Cliente com teste expirado",
            descricao: "Cliente solicitou falar com atendente após teste expirar",
            status: "aberto",
            tipo: "expiracao",
            prioridade: "alta"
          });
          
          // Send Discord notification for new ticket
          try {
            const { discordNotificationService } = await import('./DiscordNotificationService');
            const clientName = cliente?.nome || null;
            await discordNotificationService.notifyTicketOpened(clientName, "Cliente com teste expirado");
            console.log(`🎫 Notificação Discord enviada para ticket de teste expirado`);
          } catch (error) {
            console.error("Erro ao enviar notificação Discord para ticket de teste expirado:", error);
          }
          
          // Switch conversation to human mode
          await storage.updateConversa(conversa.id, { modoAtual: "humano" });
          
          // Clear conversation state
          this.conversaStates.delete(telefone);
          
          await this.sendMessage(
            telefone,
            `🙋 *Aguarde!* Um atendente entrará em contato em breve para ajudá-lo com a ativação do seu plano.\n\n` +
            `⏰ *Horário de atendimento:* Das 8h às 22h`,
          );
        } else {
          await this.sendInteractiveMenu(
            telefone,
            `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.\n\n` +
            `1️⃣ Ativar plano agora\n` +
            `2️⃣ Falar com atendente`,
          );
        }
        break;
        
      default:
        console.log(`Submenu não reconhecido: ${submenu}`);
        await this.sendMessage(
          telefone,
          `❌ Erro interno. Por favor, digite 0 para voltar ao menu principal.`,
        );
        break;
    }
  }

  private getValidOptionsForSubmenu(submenu: string): string[] {
    const validOptions: Record<string, string[]> = {
      info_only: ["0", "1", "2"], // Menus informativos - voltar, assinar, testar
      teste_dispositivo: ["0", "1", "2", "3", "4", "5"],
      assinar_codigo: ["0", "1", "2"],
      assinar_dispositivo: ["0", "1", "2", "3", "4", "5"],
      celular_tipo: ["0", "1", "2"],
      celular_tipo_assinar: ["0", "1", "2"], // Tipo de celular para assinatura
      smart_tv_marca: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      smart_tv_marca_assinar: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], // Marca da TV para assinatura
      aguardando_codigo: [], // Aceita qualquer texto como código
      codigo_invalido: ["0", "1", "2"], // Opções para código inválido
      vencimento_submenu: ["0", "1"], // Ver vencimento submenu - voltar, renovar plano
      renovar_periodo: ["0", "1", "2", "3", "4"], // Opções de período de renovação
      renovar_confirmar: ["0", "1"], // Confirmar ou cancelar renovação
      renovar_aguardando_pagamento: ["0", "1"], // Já paguei ou cancelar
      pontos_menu: ["0", "1", "2"], // Menu de gerenciar pontos
      ponto_dispositivo: ["0", "1", "2", "3", "4", "5"], // Escolher dispositivo para adicionar ponto
      ponto_celular_tipo: ["0", "1", "2"], // Escolher tipo de celular (Android/iPhone)
      ponto_smarttv_marca: [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
      ], // Escolher marca da Smart TV
      suporte_tecnico: ["0", "1", "2", "3"], // Menu de suporte técnico simplificado
      suporte_resultado: ["0", "1", "2"], // Resultado do suporte - resolveu ou não
      cliente_vencido: ["1", "2", "3"], // Expired client menu - trust unlock, payment, support
      // Test bot submenus
      teste_dados_acesso: ["0", "1", "2"], // Copy data or send by email
      teste_tutorial: ["0", "1", "2", "3", "4", "5", "6"], // Device tutorials
      teste_conexao: ["0", "1", "2", "3", "4", "5"], // Connection problems
      teste_estender: ["0", "1", "2", "3"], // Extend test time
      teste_virar_cliente: ["0", "1", "2", "3", "4", "5"], // Become a client plans
      teste_reportar: ["0", "1", "2", "3", "4", "5", "6"], // Report problems
      teste_suporte: ["0", "1", "2", "3", "4", "5"], // Technical support
      teste_expirado_menu: ["1", "2"], // Expired test menu - activate plan or contact support
    };

    return validOptions[submenu] || [];
  }

  private getInfoOnlyMenuText(lastOption: string): string {
    switch (lastOption) {
      case "3": // Qual o conteúdo?
        return (
          `📺 A TvON te dá acesso a:\n\n` +
          `• Todos os canais ao vivo (Globo, SBT, Record, SporTV, Premiere, Discovery, Cartoon, etc)\n` +
          `• Todos os filmes e séries das principais plataformas: Netflix, Prime Video, Disney+, Paramount+, HBO Max e outras\n` +
          `• Programação infantil, esportiva, documentários, realities, filmes em lançamento e muito mais\n` +
          `• Qualidade até 4K, sem travar\n` +
          `• Suporte 24 horas!\n\n` +
          `1️⃣ Assinar agora\n` +
          `2️⃣ Testar grátis por 6h\n` +
          `0️⃣ Voltar`
        );
      case "4": // Qual o valor?
        return (
          `💰 Planos TvON:\n\n` +
          `• 🔹 Mensal: R$ 29,90\n` +
          `• 🔹 Trimestral: R$ 79,90 (10% OFF)\n` +
          `• 🔹 Semestral: R$ 139,90 (20% OFF)\n` +
          `• 🔹 Anual: R$ 249,90 (30% OFF)\n\n` +
          `• ✅ Pode cancelar quando quiser\n` +
          `• ✅ Sem taxas extras\n` +
          `• ✅ Reembolso proporcional em caso de cancelamento, conforme nossas políticas\n\n` +
          `1️⃣ Assinar agora\n` +
          `2️⃣ Testar grátis por 6h\n` +
          `0️⃣ Voltar`
        );
      case "5": // Por onde consigo assistir?
        return (
          `Você pode usar a TvON em praticamente qualquer dispositivo com internet:\n\n` +
          `• 📱 Celulares Android e iPhone\n` +
          `• 📺 Todas as Smart TVs (Samsung, LG, Philips, AOC, TCL e outras)\n` +
          `• 🖥️ TV Box\n` +
          `• 💻 Notebooks e PCs\n` +
          `• 📦 Outros aparelhos conectados à internet\n\n` +
          `1️⃣ Assinar agora\n` +
          `2️⃣ Testar grátis por 6h\n` +
          `0️⃣ Voltar`
        );
      case "6": // Saber mais
        return (
          `A *TvON* é uma central de conteúdo que reúne:\n\n` +
          `• ✅ Canais ao vivo de todas as categorias (abertos e fechados)\n` +
          `• ✅ Filmes e séries completas de todas as plataformas\n` +
          `• ✅ Qualidade até 4K, sem travar\n` +
          `• ✅ Suporte técnico 24 horas\n` +
          `• ✅ Planos a partir de R$ 29,90\n` +
          `• ✅ Sem fidelidade, sem multa, com liberdade total\n` +
          `• ✅ Acesso por celular, Smart TV, TV Box, notebook, computador e muito mais!\n\n` +
          `Tudo isso por um preço justo, com estabilidade e facilidade.\n\n` +
          `1️⃣ Assinar agora\n` +
          `2️⃣ Testar grátis por 6h\n` +
          `0️⃣ Voltar`
        );
      default:
        return `1️⃣ Assinar agora\n2️⃣ Testar grátis por 6h\n0️⃣ Voltar ao menu principal`;
    }
  }

  private async resendSubmenu(telefone: string, submenu: string) {
    console.log(`Reenviando submenu ${submenu} para ${telefone}`);

    switch (submenu) {
      case "info_only":
        const state = this.conversaStates.get(telefone);
        const lastOption = state?.lastOption || "";
        await this.sendInteractiveMenu(telefone, this.getInfoOnlyMenuText(lastOption));
        break;
      case "teste_dispositivo":
        await this.sendInteractiveMenu(
          telefone,
          `Por qual dispositivo você quer fazer o teste?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ Smart TV\n` +
            `3️⃣ TV Box\n` +
            `4️⃣ Notebook/PC\n` +
            `5️⃣ Tablet/iPad\n` +
            `0️⃣ Voltar`,
        );
        break;
      case "assinar_codigo":
        await this.sendInteractiveMenu(
          telefone,
          `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
            `1️⃣ Sim, tenho código\n` +
            `2️⃣ Não tenho\n` +
            `0️⃣ Voltar`,
        );
        break;
      case "assinar_dispositivo":
        await this.sendInteractiveMenu(
          telefone,
          `Por qual dispositivo você quer usar?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ Smart TV\n` +
            `3️⃣ TV Box\n` +
            `4️⃣ Notebook/PC\n` +
            `5️⃣ Tablet/iPad\n` +
            `0️⃣ Voltar`,
        );
        break;
      case "celular_tipo":
        await this.sendInteractiveMenu(
          telefone,
          `Seu celular é:\n\n` + `1️⃣ Android\n` + `2️⃣ iPhone\n` + `0️⃣ Voltar`,
        );
        break;
      case "smart_tv_marca":
        await this.sendInteractiveMenu(
          telefone,
          `Qual é a marca da sua Smart TV?\n\n` +
            `1️⃣ Samsung\n` +
            `2️⃣ LG\n` +
            `3️⃣ Philips\n` +
            `4️⃣ AOC\n` +
            `5️⃣ TCL\n` +
            `6️⃣ Panasonic\n` +
            `7️⃣ Toshiba\n` +
            `8️⃣ Multilaser\n` +
            `9️⃣ BGH\n` +
            `🔟 Outras\n` +
            `0️⃣ Voltar`,
        );
        break;
    }
  }

  private async handleTesteDispositivo(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    switch (opcaoId) {
      case "1": // Celular
        await this.sendInteractiveMenu(
          telefone,
          `Seu celular é:\n\n` + `1️⃣ Android\n` + `2️⃣ iPhone\n` + `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "celular_tipo",
          lastActivity: new Date(),
        });
        break;

      case "2": // TV Box
        await this.sendMessage(
          telefone,
          `Vamos te ajudar a configurar sua TV Box.\n` +
            `Chamando um atendente...`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Novo teste grátis - Dispositivo: TV Box",
        );
        this.conversaStates.delete(telefone);
        break;

      case "3": // Smart TV
        await this.sendInteractiveMenu(
          telefone,
          `Qual é a marca da sua Smart TV?\n\n` +
            `1️⃣ Samsung\n` +
            `2️⃣ LG\n` +
            `3️⃣ Philips\n` +
            `4️⃣ AOC\n` +
            `5️⃣ TCL\n` +
            `6️⃣ Panasonic\n` +
            `7️⃣ Toshiba\n` +
            `8️⃣ Multilaser\n` +
            `9️⃣ BGH\n` +
            `🔟 Outras\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "smart_tv_marca",
          lastActivity: new Date(),
        });
        break;

      case "4": // Notebook ou Computador
        await this.sendMessage(
          telefone,
          `Beleza! A ativação para computador é feita manualmente.\n` +
            `Chamando um atendente...`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Novo teste grátis - Dispositivo: Notebook ou PC",
        );
        this.conversaStates.delete(telefone);
        break;

      case "5": // Outros
        await this.sendMessage(
          telefone,
          `Sem problema! Vamos te ajudar.\n` + `Chamando um atendente...`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Novo teste grátis - Dispositivo: Outro",
        );
        this.conversaStates.delete(telefone);
        break;
    }
  }

  private async handleCelularTipo(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    const tipo = opcaoId === "1" ? "Android" : "iPhone";
    await storage.updateConversa(conversa.id, { modoAtendimento: "humano" });
    await this.createTicket(
      conversa,
      null,
      `[Ticket] Novo teste grátis - Dispositivo: Celular (${tipo})`,
    );
    await this.sendMessage(
      telefone,
      `Perfeito! Vamos ativar seu teste para ${tipo}.\n` +
        `Um atendente entrará em contato em instantes!`,
    );
    this.conversaStates.delete(telefone);
  }

  private async handleSmartTvMarca(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    const marcas = [
      "Samsung",
      "LG",
      "Philips",
      "AOC",
      "TCL",
      "Panasonic",
      "Toshiba",
      "Multilaser",
      "BGH",
      "Outras",
    ];
    const marca =
      parseInt(opcaoId) === 10
        ? "Outras"
        : marcas[parseInt(opcaoId) - 1] || "Outras";

    await storage.updateConversa(conversa.id, { modoAtendimento: "humano" });
    await this.createTicket(
      conversa,
      null,
      `[Ticket] Novo teste grátis - Dispositivo: Smart TV (${marca})`,
    );
    await this.sendMessage(
      telefone,
      `Ótimo! Vamos configurar para Smart TV ${marca}.\n` +
        `Um atendente já vai te atender!`,
    );
    this.conversaStates.delete(telefone);
  }

  private async handleAssinarCodigo(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    if (opcaoId === "1") {
      // Tem código - pedir o código
      await this.sendMessage(
        telefone,
        `O código é o WhatsApp de quem te indicou!\n` +
        `Por favor, digite seu código de indicação:`,
      );
      this.conversaStates.set(telefone, {
        submenu: "aguardando_codigo",
        lastActivity: new Date(),
        previousMenu: "assinar_codigo",
      } as any);
    } else if (opcaoId === "2") {
      // Não tem código
      // Check if user already has a test with device information
      const teste = await storage.getAnyTesteByTelefone(telefone);
      
      if (teste && teste.dispositivo) {
        // User has test with device info - skip device selection
        console.log(`[BOT] Cliente com teste já tem dispositivo: ${teste.dispositivo}`);
        
        // Map device type to human-readable format
        let dispositivoFormatado = teste.dispositivo;
        if (teste.dispositivo === "smart_tv") {
          dispositivoFormatado = "Smart TV";
        } else if (teste.dispositivo === "tv_box") {
          dispositivoFormatado = "TV Box";
        } else if (teste.dispositivo === "celular") {
          dispositivoFormatado = `Celular (${teste.aplicativo === "ibo_player" ? "iPhone" : "Android"})`;
        } else if (teste.dispositivo === "notebook") {
          dispositivoFormatado = "Notebook ou Computador";
        }
        
        // Go directly to human signup with existing device info
        await this.completeSignupWithHuman(
          conversa,
          telefone,
          dispositivoFormatado,
          "Não",
          null,
        );
      } else {
        // No test or no device info - ask for device
        await this.sendInteractiveMenu(
          telefone,
          `Onde você vai assistir?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ TV Box (caixinha)\n` +
            `3️⃣ Smart TV\n` +
            `4️⃣ Notebook ou Computador\n` +
            `5️⃣ Outros\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "assinar_dispositivo",
          lastActivity: new Date(),
          codigoIndicacao: "Não",
          previousMenu: "assinar_codigo",
        } as any);
      }
    }
  }

  private async handleAssinarDispositivo(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    console.log("===== HANDLE ASSINAR DISPOSITIVO =====");
    console.log("Telefone:", telefone);
    console.log("OpcaoId:", opcaoId);
    console.log("Current state:", this.conversaStates.get(telefone));
    
    // Handle option 0 - go back
    if (opcaoId === "0") {
      this.conversaStates.set(telefone, {
        submenu: "assinar_codigo",
        lastActivity: new Date(),
        previousMenu: "assinar_dispositivo",
      });
      await this.sendInteractiveMenu(
        telefone,
        `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
          `1️⃣ Sim, tenho código\n` +
          `2️⃣ Não tenho\n` +
          `0️⃣ Voltar`,
      );
      return;
    }
    
    const state = this.conversaStates.get(telefone) as any;
    const codigoIndicacao = state?.codigoIndicacao || "Não informado";
    const nomeIndicador = state?.nomeIndicador || null;

    switch (opcaoId) {
      case "1": // Celular - ask for type
        await this.sendInteractiveMenu(
          telefone,
          `Seu celular é:\n\n` + `1️⃣ Android\n` + `2️⃣ iPhone\n` + `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "celular_tipo_assinar",
          lastActivity: new Date(),
          codigoIndicacao,
          nomeIndicador,
          previousMenu: "assinar_dispositivo",
        });
        break;

      case "2": // TV Box - direct to human
        await this.completeSignupWithHuman(
          conversa,
          telefone,
          "TV Box",
          codigoIndicacao,
          nomeIndicador,
        );
        break;

      case "3": // Smart TV - ask for brand
        await this.sendInteractiveMenu(
          telefone,
          `Qual é a marca da sua Smart TV?\n\n` +
            `1️⃣ Samsung\n` +
            `2️⃣ LG\n` +
            `3️⃣ Philips\n` +
            `4️⃣ AOC\n` +
            `5️⃣ TCL\n` +
            `6️⃣ Panasonic\n` +
            `7️⃣ Toshiba\n` +
            `8️⃣ Multilaser\n` +
            `9️⃣ BGH\n` +
            `🔟 Outras\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "smart_tv_marca_assinar",
          lastActivity: new Date(),
          codigoIndicacao,
          nomeIndicador,
          previousMenu: "assinar_dispositivo",
        });
        break;

      case "4": // Notebook ou Computador - direct to human
        await this.completeSignupWithHuman(
          conversa,
          telefone,
          "Notebook ou Computador",
          codigoIndicacao,
          nomeIndicador,
        );
        break;

      case "5": // Outros - direct to human
        await this.completeSignupWithHuman(
          conversa,
          telefone,
          "Outros",
          codigoIndicacao,
          nomeIndicador,
        );
        break;

      default:
        await this.sendMessage(
          telefone,
          `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
        );
    }
  }

  private async completeSignupWithHuman(
    conversa: any,
    telefone: string,
    dispositivo: string,
    codigoIndicacao: string,
    nomeIndicador: string | null,
  ) {
    // Validar código de indicação se fornecido
    let indicadorValido: any = null;
    let mensagemIndicacao = "";

    if (
      codigoIndicacao &&
      codigoIndicacao !== "Não" &&
      codigoIndicacao !== "Não informado"
    ) {
      // We already validated the code earlier, use the stored name
      if (nomeIndicador) {
        indicadorValido = { nome: nomeIndicador };
        mensagemIndicacao = `✅ Código de indicação válido! (${nomeIndicador})`;
      } else {
        // If we don't have the name stored, try to get it again
        const codigoNormalizado = codigoIndicacao.replace(/\D/g, "");
        // Buscar cliente pelo telefone (código de indicação)
        const cliente = await storage.getClienteByTelefone(codigoNormalizado);
        if (cliente) {
          indicadorValido = cliente;
          mensagemIndicacao = `✅ Código de indicação válido! (${cliente.nome})`;

          // Salvar na conversa que foi indicado
          await storage.updateConversa(conversa.id, {
            metadados: JSON.stringify({
              ...JSON.parse(conversa.metadados || "{}"),
              indicadoPor: cliente.id,
              codigoIndicacao: codigoNormalizado,
            }),
          });
        } else {
          mensagemIndicacao = `⚠️ Código de indicação não encontrado, mas vamos continuar!`;
        }
      }
    }

    await storage.updateConversa(conversa.id, { modoAtendimento: "humano" });

    // Criar ticket com informações de indicação
    const ticketInfo = indicadorValido
      ? `[Ticket] Compra direta - INDICADO POR: ${indicadorValido.nome} (${codigoIndicacao}) - Dispositivo: ${dispositivo}`
      : `[Ticket] Compra direta - Código: ${codigoIndicacao} - Dispositivo: ${dispositivo}`;

    await this.createTicket(conversa, null, ticketInfo);

    // Enviar mensagem de confirmação
    let mensagemFinal = `Perfeito! Vamos finalizar sua assinatura.\n`;
    if (mensagemIndicacao) {
      mensagemFinal += `${mensagemIndicacao}\n`;
    }
    mensagemFinal += `Um vendedor entrará em contato agora mesmo!`;

    await this.sendMessage(telefone, mensagemFinal);
    this.conversaStates.delete(telefone);
  }

  private async handleCelularTipoAssinar(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    if (opcaoId === "0") {
      // Voltar para dispositivos
      const state = this.conversaStates.get(telefone) as any;
      this.conversaStates.set(telefone, {
        submenu: "assinar_dispositivo",
        lastActivity: new Date(),
        codigoIndicacao: state?.codigoIndicacao,
        nomeIndicador: state?.nomeIndicador,
        previousMenu: "celular_tipo_assinar",
      });
      await this.sendInteractiveMenu(
        telefone,
        `Onde você vai assistir?\n\n` +
          `1️⃣ Celular\n` +
          `2️⃣ TV Box (caixinha)\n` +
          `3️⃣ Smart TV\n` +
          `4️⃣ Notebook ou Computador\n` +
          `5️⃣ Outros\n` +
          `0️⃣ Voltar`,
      );
      return;
    }

    const state = this.conversaStates.get(telefone) as any;
    const codigoIndicacao = state?.codigoIndicacao || "Não informado";
    const nomeIndicador = state?.nomeIndicador || null;
    const tipo = opcaoId === "1" ? "Android" : "iPhone";
    
    await this.completeSignupWithHuman(
      conversa,
      telefone,
      `Celular (${tipo})`,
      codigoIndicacao,
      nomeIndicador,
    );
  }

  private async handleSmartTvMarcaAssinar(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    if (opcaoId === "0") {
      // Voltar para dispositivos
      const state = this.conversaStates.get(telefone) as any;
      this.conversaStates.set(telefone, {
        submenu: "assinar_dispositivo",
        lastActivity: new Date(),
        codigoIndicacao: state?.codigoIndicacao,
        nomeIndicador: state?.nomeIndicador,
        previousMenu: "smart_tv_marca_assinar",
      });
      await this.sendInteractiveMenu(
        telefone,
        `Onde você vai assistir?\n\n` +
          `1️⃣ Celular\n` +
          `2️⃣ TV Box (caixinha)\n` +
          `3️⃣ Smart TV\n` +
          `4️⃣ Notebook ou Computador\n` +
          `5️⃣ Outros\n` +
          `0️⃣ Voltar`,
      );
      return;
    }

    const marcas = [
      "Samsung",
      "LG",
      "Philips",
      "AOC",
      "TCL",
      "Panasonic",
      "Toshiba",
      "Multilaser",
      "BGH",
      "Outras",
    ];
    const marca =
      parseInt(opcaoId) === 10
        ? "Outras"
        : marcas[parseInt(opcaoId) - 1] || "Outras";

    const state = this.conversaStates.get(telefone) as any;
    const codigoIndicacao = state?.codigoIndicacao || "Não informado";
    const nomeIndicador = state?.nomeIndicador || null;
    
    await this.completeSignupWithHuman(
      conversa,
      telefone,
      `Smart TV (${marca})`,
      codigoIndicacao,
      nomeIndicador,
    );
  }

  private async handleClientesSubmenu(
    conversa: any,
    opcaoId: string,
    telefone: string,
    submenu: string,
    cliente: any,
  ) {
    console.log(
      `handleClientesSubmenu - submenu: ${submenu}, opcaoId: ${opcaoId}`,
    );

    // Voltar ao menu anterior
    if (opcaoId === "0") {
      this.conversaStates.delete(telefone);
      // Check if user is a test client
      const teste = await storage.getTesteAtivoByTelefone(telefone);
      const botType = teste ? "testes" : "clientes";
      // Pass bot type directly as config
      await this.sendBotMenu(telefone, { tipo: botType });
      return;
    }

    switch (submenu) {
      case "vencimento_submenu":
        await this.handleVencimentoSubmenu(
          conversa,
          opcaoId,
          telefone,
          cliente,
        );
        break;
      case "renovar_periodo":
        await this.handleRenovarPeriodo(conversa, opcaoId, telefone);
        break;
      case "renovar_confirmar":
        await this.handleRenovarConfirmar(conversa, opcaoId, telefone);
        break;
      case "renovar_aguardando_pagamento":
        await this.handleRenovarAguardandoPagamento(
          conversa,
          opcaoId,
          telefone,
        );
        break;
      case "pontos_menu":
        await this.handlePontosMenu(conversa, opcaoId, telefone, cliente);
        break;
      case "ponto_dispositivo":
        await this.handlePontoDispositivo(conversa, opcaoId, telefone, cliente);
        break;
      case "ponto_celular_tipo":
        await this.handlePontoCelularTipo(conversa, opcaoId, telefone, cliente);
        break;
      case "ponto_smarttv_marca":
        await this.handlePontoSmartTvMarca(
          conversa,
          opcaoId,
          telefone,
          cliente,
        );
        break;
      case "suporte_tecnico":
        await this.handleSuporteTecnico(conversa, opcaoId, telefone, cliente);
        break;
      case "suporte_resultado":
        await this.handleSuporteResultado(conversa, opcaoId, telefone, cliente);
        break;
      case "cliente_vencido":
        await this.handleClienteVencido(conversa, opcaoId, telefone, cliente);
        break;
      default:
        console.log(`Submenu não reconhecido: ${submenu}`);
        await this.sendMessage(
          telefone,
          `❌ Erro interno. Por favor, digite 0 para voltar ao menu principal.`,
        );
        break;
    }
  }

  private async handleClientesBotOption(
    conversa: any,
    opcaoId: string,
    cliente: any,
    telefone: string,
  ) {
    // Validar opções do menu principal de clientes
    const validOptions = ["1", "2", "3", "4", "5", "6"];
    if (!validOptions.includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha uma das opções disponíveis.`,
      );
      return;
    }

    switch (opcaoId) {
      case "1": // Ver vencimento
        const vencimento = cliente.vencimento
          ? new Date(cliente.vencimento).toLocaleDateString("pt-BR")
          : "Não definido";
        const diasRestantes = cliente.vencimento
          ? Math.ceil(
              (new Date(cliente.vencimento).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

        // Calculate valorTotal from pontos
        const pontosCliente = await storage.getPontosByClienteId(cliente.id);
        const valorTotalCliente = pontosCliente.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || "0");
          return sum + valor;
        }, 0);

        // Store state to handle submenu options
        this.conversaStates.set(telefone, {
          submenu: "vencimento_submenu",
          lastActivity: new Date(),
          clienteId: cliente.id,
        });

        await this.sendInteractiveMenu(
          telefone,
          `*INFORMAÇÕES DO SEU PLANO*\n\n` +
            `Vencimento: ${vencimento}\n` +
            `Dias restantes: ${diasRestantes > 0 ? diasRestantes : 0}\n` +
            `Valor: R$ ${valorTotalCliente > 0 ? valorTotalCliente.toFixed(2).replace(".", ",") : "29,00"}\n` +
            `Total de pontos: ${pontosCliente.length || 1}\n\n` +
            `Escolha uma opção:\n\n` +
            `1️⃣ Renovar plano\n\n` +
            `0️⃣ Voltar para o menu anterior`,
        );
        break;

      case "2": // Renovar plano
        const venc2 = cliente.vencimento
          ? new Date(cliente.vencimento).toLocaleDateString("pt-BR")
          : "Não definido";
        const dias2 = cliente.vencimento
          ? Math.ceil(
              (new Date(cliente.vencimento).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

        // Calculate valorTotal from pontos
        const pontosRenovacao2 = await storage.getPontosByClienteId(cliente.id);
        const valorRenovacao2 = pontosRenovacao2.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || "0");
          return sum + valor;
        }, 0);

        // Pegar o valor mensal do cliente
        const valorMensal2 = valorRenovacao2 > 0 ? valorRenovacao2 : 29.0;

        // Calcular preços com descontos progressivos
        const precos2 = this.calcularPrecosRenovacao(valorMensal2);

        // Mostrar informações do plano e opções de renovação
        await this.sendInteractiveMenu(
          telefone,
          `*RENOVAR PLANO*\n\n` +
            `*Seu plano atual:*\n` +
            `• Valor: R$ ${valorMensal2.toFixed(2).replace(".", ",")}\n` +
            `• Pontos: ${pontosRenovacao2.length || 1}\n` +
            `• Vencimento: ${venc2}\n` +
            `• Dias restantes: ${dias2 > 0 ? dias2 : 0}\n\n` +
            `*Escolha o período:*\n\n` +
            `1️⃣ 1 mês - R$ ${precos2.mensal.toFixed(2).replace(".", ",")}\n` +
            `2️⃣ 3 meses - R$ ${precos2.trimestral.toFixed(2).replace(".", ",")} (-10%)\n` +
            `3️⃣ 6 meses - R$ ${precos2.semestral.toFixed(2).replace(".", ",")} (-20%)\n` +
            `4️⃣ 1 ano - R$ ${precos2.anual.toFixed(2).replace(".", ",")} (-30%)\n\n` +
            `0️⃣ Voltar ao menu principal`,
        );

        // Salvar estado para próxima interação
        this.conversaStates.set(telefone, {
          submenu: "renovar_periodo",
          lastActivity: new Date(),
          valorMensal: valorMensal2,
          precos: precos2,
          vencimentoAtual: cliente.vencimento,
          clienteId: cliente.id,
        } as any);
        break;

      case "3": // Ver pontos
        // Buscar pontos atuais do cliente
        const pontosAtuais = await storage.getPontosByClienteId(cliente.id);
        const valorTotalPontos = pontosAtuais.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || "0");
          return sum + valor;
        }, 0);

        // Criar lista de pontos
        let listaPontos = "";
        if (pontosAtuais.length > 0) {
          pontosAtuais.forEach((ponto, index) => {
            listaPontos += `${index + 1}. ${ponto.nome || `Ponto ${index + 1}`} - R$ ${parseFloat(
              ponto.valor || "0",
            )
              .toFixed(2)
              .replace(".", ",")}\n`;
          });
        } else {
          listaPontos = "Nenhum ponto cadastrado\n";
        }

        await this.sendInteractiveMenu(
          telefone,
          `*GERENCIAR PONTOS*\n\n` +
            `*Pontos ativos:* ${pontosAtuais.length}\n` +
            `*Valor total:* R$ ${valorTotalPontos.toFixed(2).replace(".", ",")}\n\n` +
            `*Lista de pontos:*\n${listaPontos}\n` +
            `*O que deseja fazer?*\n\n` +
            `1️⃣ Adicionar ponto\n` +
            `2️⃣ Remover ponto\n` +
            `0️⃣ Voltar ao menu principal`,
        );

        // Salvar estado para submenu de pontos
        this.conversaStates.set(telefone, {
          submenu: "pontos_menu",
          lastActivity: new Date(),
          clienteId: cliente.id,
        } as any);
        break;

      case "4": // Ganhar um mês grátis
        await this.handleIndicarAmigo(conversa, cliente, telefone);
        break;

      case "5": // Suporte técnico
        await this.sendInteractiveMenu(
          telefone,
          `*SUPORTE TÉCNICO*\n\n` +
            `*Escolha o problema que está enfrentando:*\n\n` +
            `1️⃣ App travando ou lento\n` +
            `2️⃣ Fora do ar\n` +
            `3️⃣ Outros problemas\n\n` +
            `0️⃣ Voltar ao menu principal`,
        );

        // Salvar estado para submenu de suporte técnico
        this.conversaStates.set(telefone, {
          submenu: "suporte_tecnico",
          lastActivity: new Date(),
          clienteId: cliente.id,
        } as any);
        break;

      case "6": // Falar com atendente
        await this.sendMessage(
          telefone,
          `*Atendimento Humano*\n\n` +
            `Estou transferindo você para um atendente humano, aguarde...\n\n` +
            `Por favor, descreva o que precisa.`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          cliente,
          "Cliente solicitou atendimento humano",
        );
        // Clear the state so bot stops responding
        this.conversaStates.delete(telefone);
        break;
    }
  }

  private calcularPrecosRenovacao(valorMensal: number) {
    // Cálculo de preços com descontos progressivos
    // Base: 1 mês = valor normal
    // 3 meses = 10% desconto
    // 6 meses = 20% desconto  
    // 1 ano = 30% desconto

    return {
      mensal: valorMensal,
      trimestral: valorMensal * 3 * 0.9,  // 3 meses com 10% desconto
      semestral: valorMensal * 6 * 0.8,   // 6 meses com 20% desconto
      anual: valorMensal * 12 * 0.7,      // 12 meses com 30% desconto
    };
  }

  private async handleIndicarAmigo(
    conversa: any,
    cliente: any,
    telefone: string,
  ) {
    try {
      // Verificar indicações existentes
      const indicacoes = await storage.getIndicacoesByIndicadorId(cliente.id);
      const indicacoesConfirmadas = indicacoes.filter(
        (i) => i.status === "confirmada",
      );
      const indicacoesPendentes = indicacoes.filter(
        (i) => i.status === "pendente",
      );

      // Verificar meses grátis acumulados
      const mesesGratis = cliente.mesesGratisAcumulados || 0;

      // Remove o código do país (55) do telefone para usar como código de indicação
      const codigoIndicacao = telefone.startsWith("55") ? telefone.substring(2) : telefone;

      // Criar mensagem com informações do programa
      let mensagem = `🎁 *INDIQUE E GANHE*\n\n`;
      mensagem += `*Como funciona:*\n`;
      mensagem += `• Indique usando seu código: *${codigoIndicacao}*\n`;
      mensagem += `• Quando ele assinar, você ganha 1 mês grátis!\n`;
      mensagem += `• Acumule meses grátis sem limite!\n`;
      mensagem += `• Ele ganha desconto no primeiro mês!\n\n`;

      mensagem += `*📊 Seus resultados:*\n`;
      mensagem += `Indicações confirmadas: ${indicacoesConfirmadas.length}\n`;
      mensagem += `Indicações pendentes: ${indicacoesPendentes.length}\n`;
      mensagem += `Meses grátis acumulados: ${mesesGratis}\n\n`;

      if (mesesGratis > 0) {
        mensagem += `💚 *Você tem ${mesesGratis} ${mesesGratis === 1 ? "mês" : "meses"} grátis!*\n`;
        mensagem += `Será aplicado automaticamente no próximo vencimento.\n\n`;
      }

      mensagem += `Ao indicado realizar a ativação do plano, fale para solicitar a opção "Tenho um código de indicação" e insira o seu telefone!\n\n`;

      if (indicacoesPendentes.length > 0) {
        mensagem += `*⏳ Indicações aguardando confirmação:*\n`;
        for (const ind of indicacoesPendentes) {
          const indicado = await storage.getClienteById(ind.indicadoId);
          if (indicado) {
            const diasRestantes = Math.ceil(
              (new Date(ind.dataIndicacao).getTime() +
                30 * 24 * 60 * 60 * 1000 -
                Date.now()) /
                (1000 * 60 * 60 * 24),
            );
            mensagem += `• ${indicado.nome} - faltam ${diasRestantes} dias\n`;
          }
        }
        mensagem += `\n`;
      }

      mensagem += `💡 *Dica:* Quanto mais amigos indicar, mais meses grátis você acumula!`;

      await this.sendMessage(telefone, mensagem);
    } catch (error) {
      console.error("Erro ao processar indicação:", error);
      await this.sendMessage(
        telefone,
        `❌ Erro ao processar indicação. Tente novamente mais tarde.`,
      );
    }
  }

  private async handlePontosMenu(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "pontos_menu") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar ao menu principal
    if (opcaoId === "0") {
      this.conversaStates.delete(telefone);
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Validar opções
    if (!["1", "2"].includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha 1, 2 ou 0 para voltar.`,
      );
      return;
    }

    switch (opcaoId) {
      case "1": // Adicionar ponto
        // Redirecionar para o menu de compra (similar ao de novos clientes)
        await this.sendInteractiveMenu(
          telefone,
          `Legal! 😄 Vamos adicionar um novo ponto.\n\n` +
            `Onde você vai assistir?\n\n` +
            `1️⃣ Celular\n` +
            `2️⃣ TV Box (caixinha)\n` +
            `3️⃣ Smart TV\n` +
            `4️⃣ Notebook ou Computador\n` +
            `5️⃣ Outros\n` +
            `0️⃣ Voltar`,
        );

        // Salvar estado para menu de dispositivo
        this.conversaStates.set(telefone, {
          submenu: "ponto_dispositivo",
          lastActivity: new Date(),
          clienteId: cliente.id,
          isAddingPoint: true,
        } as any);
        break;

      case "2": // Remover ponto - chamar atendente
        await this.sendMessage(
          telefone,
          `👤 *REMOVER PONTO*\n\n` +
            `Para remover um ponto do seu plano, é necessário falar com um atendente.\n\n` +
            `🔄 Transferindo para atendimento humano...`,
        );

        // Mudar para atendimento humano
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });

        // Criar ticket
        await this.createTicket(
          conversa,
          cliente,
          "Cliente deseja remover ponto do plano",
        );

        // Limpar estado
        this.conversaStates.delete(telefone);
        break;
    }
  }

  private async handlePontoDispositivo(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "ponto_dispositivo") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar
    if (opcaoId === "0") {
      // Voltar para o menu de pontos
      const pontosAtuais = await storage.getPontosByClienteId(cliente.id);
      const valorTotalPontos = pontosAtuais.reduce((sum, ponto) => {
        const valor = parseFloat(ponto.valor || "0");
        return sum + valor;
      }, 0);

      let listaPontos = "";
      if (pontosAtuais.length > 0) {
        pontosAtuais.forEach((ponto, index) => {
          listaPontos += `${index + 1}. ${ponto.nome || `Ponto ${index + 1}`} - R$ ${parseFloat(
            ponto.valor || "0",
          )
            .toFixed(2)
            .replace(".", ",")}\n`;
        });
      } else {
        listaPontos = "Nenhum ponto cadastrado\n";
      }

      await this.sendInteractiveMenu(
        telefone,
        `*GERENCIAR PONTOS*\n\n` +
          `*Pontos ativos:* ${pontosAtuais.length}\n` +
          `*Valor total:* R$ ${valorTotalPontos.toFixed(2).replace(".", ",")}\n\n` +
          `*Lista de pontos:*\n${listaPontos}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `*O que deseja fazer?*\n\n` +
          `1️⃣ Adicionar ponto\n` +
          `2️⃣ Remover ponto (atendente)\n` +
          `0️⃣ Voltar ao menu principal`,
      );

      this.conversaStates.set(telefone, {
        submenu: "pontos_menu",
        lastActivity: new Date(),
        clienteId: cliente.id,
      } as any);
      return;
    }

    // Validar opções
    if (!["1", "2", "3", "4", "5"].includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha entre 1 e 5 ou 0 para voltar.`,
      );
      return;
    }

    // Mapear dispositivos
    const dispositivos = {
      "1": "Celular",
      "2": "TV Box",
      "3": "Smart TV",
      "4": "Notebook ou Computador",
      "5": "Outros",
    };

    const dispositivoEscolhido = dispositivos[opcaoId];

    // Verificar se é celular e precisamos do tipo
    if (opcaoId === "1") {
      // Celular - perguntar se é Android ou iPhone
      await this.sendInteractiveMenu(
        telefone,
        `📱 *Qual o tipo do celular?*\n\n` +
          `1️⃣ Android\n` +
          `2️⃣ iPhone\n` +
          `0️⃣ Voltar`,
      );

      this.conversaStates.set(telefone, {
        submenu: "ponto_celular_tipo",
        lastActivity: new Date(),
        clienteId: cliente.id,
        isAddingPoint: true,
      } as any);
      return;
    }

    // Verificar se é Smart TV e precisamos da marca
    if (opcaoId === "3") {
      // Smart TV - perguntar a marca
      await this.sendInteractiveMenu(
        telefone,
        `📺 *Qual a marca da Smart TV?*\n\n` +
          `1️⃣ Samsung\n` +
          `2️⃣ LG\n` +
          `3️⃣ Philips\n` +
          `4️⃣ AOC\n` +
          `5️⃣ TCL\n` +
          `6️⃣ Panasonic\n` +
          `7️⃣ Toshiba\n` +
          `8️⃣ Multilaser\n` +
          `9️⃣ BGH\n` +
          `🔟 Outras\n` +
          `0️⃣ Voltar`,
      );

      this.conversaStates.set(telefone, {
        submenu: "ponto_smarttv_marca",
        lastActivity: new Date(),
        clienteId: cliente.id,
        isAddingPoint: true,
      } as any);
      return;
    }

    // Para outros dispositivos, criar ticket direto
    await this.sendMessage(
      telefone,
      `Perfeito! Vamos finalizar seu ponto.\nUm vendedor entrará em contato agora mesmo!`,
    );

    // Mudar para atendimento humano
    await storage.updateConversa(conversa.id, {
      modoAtendimento: "humano",
    });

    // Criar ticket
    await this.createTicket(
      conversa,
      cliente,
      `[Ticket] Cliente quer adicionar ponto - Dispositivo: ${dispositivoEscolhido}`,
    );

    // Limpar estado após conclusão
    this.conversaStates.delete(telefone);
  }

  private async handleVencimentoSubmenu(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "vencimento_submenu") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar ao menu principal
    if (opcaoId === "0") {
      this.conversaStates.delete(telefone);
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 1 - Renovar plano
    if (opcaoId === "1") {
      // Calculate pricing for renovation
      const pontosCliente = await storage.getPontosByClienteId(cliente.id);
      const valorTotal = pontosCliente.reduce((sum, ponto) => {
        const valor = parseFloat(ponto.valor || "0");
        return sum + valor;
      }, 0);

      const valorMensal = valorTotal > 0 ? valorTotal : 29.0;
      const precos = this.calcularPrecosRenovacao(valorMensal);

      await this.sendInteractiveMenu(
        telefone,
        `*RENOVAR PLANO*\n\n` +
          `Escolha o período:\n\n` +
          `1️⃣ 1 mês - R$ ${precos.mensal.toFixed(2).replace(".", ",")}\n` +
          `2️⃣ 3 meses - R$ ${precos.trimestral.toFixed(2).replace(".", ",")} (-10%)\n` +
          `3️⃣ 6 meses - R$ ${precos.semestral.toFixed(2).replace(".", ",")} (-20%)\n` +
          `4️⃣ 1 ano - R$ ${precos.anual.toFixed(2).replace(".", ",")} (-30%)\n\n` +
          `0️⃣ Voltar ao menu principal`,
      );

      this.conversaStates.set(telefone, {
        submenu: "renovar_periodo",
        lastActivity: new Date(),
        valorMensal: valorMensal,
        precos: precos,
        vencimentoAtual: cliente.vencimento,
        clienteId: cliente.id,
      } as any);
      return;
    }

    // Invalid option
    await this.sendInteractiveMenu(
      telefone,
      `❌ *Opção inválida!* Por favor, escolha:\n\n` +
        `1️⃣ Renovar plano\n` +
        `0️⃣ Voltar para o menu anterior`,
    );
  }

  private async handlePontoCelularTipo(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "ponto_celular_tipo") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar
    if (opcaoId === "0") {
      // Voltar para o menu de dispositivos
      await this.sendInteractiveMenu(
        telefone,
        `Legal! 😄 Vamos adicionar um novo ponto.\n\n` +
          `Onde você vai assistir?\n\n` +
          `1️⃣ Celular\n` +
          `2️⃣ TV Box (caixinha)\n` +
          `3️⃣ Smart TV\n` +
          `4️⃣ Notebook ou Computador\n` +
          `5️⃣ Outros\n` +
          `0️⃣ Voltar`,
      );

      this.conversaStates.set(telefone, {
        submenu: "ponto_dispositivo",
        lastActivity: new Date(),
        clienteId: cliente.id,
        isAddingPoint: true,
      } as any);
      return;
    }

    // Validar opções
    if (!["1", "2"].includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha 1 ou 2, ou 0 para voltar.`,
      );
      return;
    }

    const tipo = opcaoId === "1" ? "Android" : "iPhone";

    // Criar ticket para adicionar ponto
    await this.sendMessage(
      telefone,
      `Perfeito! Vamos finalizar seu ponto.\nUm vendedor entrará em contato agora mesmo!`,
    );

    // Mudar para atendimento humano
    await storage.updateConversa(conversa.id, {
      modoAtendimento: "humano",
    });

    // Criar ticket
    await this.createTicket(
      conversa,
      cliente,
      `[Ticket] Cliente quer adicionar ponto - Dispositivo: Celular (${tipo})`,
    );

    // Limpar estado
    this.conversaStates.delete(telefone);
  }

  private async handleSuporteTecnico(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "suporte_tecnico") {
      // Check if user is a test client
      const teste = await storage.getTesteAtivoByTelefone(telefone);
      const botType = teste ? "testes" : "clientes";
      await this.sendBotMenu(telefone, { tipo: botType });
      return;
    }

    // Opção 0 - Voltar ao menu principal
    if (opcaoId === "0") {
      this.conversaStates.delete(telefone);
      // Check if user is a test client
      const teste = await storage.getTesteAtivoByTelefone(telefone);
      const botType = teste ? "testes" : "clientes";
      await this.sendBotMenu(telefone, { tipo: botType });
      return;
    }

    let solucao = "";
    let problema = "";

    switch (opcaoId) {
      case "1": // App travando ou lento
        problema = "App travando ou lento";
        solucao =
          `*APP TRAVANDO OU LENTO*\n\n` +
          `Por favor, siga estes passos:\n\n` +
          `1. Reinicie seu aparelho ou TV\n` +
          `   - Desligue completamente\n` +
          `   - Aguarde 10 segundos\n` +
          `   - Ligue novamente\n\n` +
          `2. Teste sua conexão com a internet\n` +
          `   - Verifique se outros apps funcionam\n` +
          `   - Teste abrir um site no navegador\n` +
          `   - Se não funcionar, reinicie o modem\n\n` +
          `3. Abra o aplicativo novamente\n\n`;
        break;

      case "2": // Fora do ar
        problema = "Fora do ar";
        solucao =
          `*FORA DO AR*\n\n` +
          `Por favor, siga estes passos:\n\n` +
          `1. Reinicie seu aparelho ou TV\n` +
          `   - Desligue completamente\n` +
          `   - Aguarde 10 segundos\n` +
          `   - Ligue novamente\n\n` +
          `2. Teste sua conexão com a internet\n` +
          `   - Verifique se outros apps funcionam\n` +
          `   - Teste abrir um site no navegador\n` +
          `   - Se não funcionar, reinicie o modem\n\n` +
          `3. Abra o aplicativo novamente\n\n`;
        break;

      case "3": // Outros problemas
        await this.sendMessage(
          telefone,
          `*TRANSFERINDO PARA SUPORTE*\n\n` +
            `Vou transferir você para um técnico especializado, por favor, aguarde...`,
        );

        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });

        await this.createTicket(
          conversa,
          cliente,
          `[Suporte Técnico] Cliente com outros problemas`,
        );

        this.conversaStates.delete(telefone);
        return;

      default:
        await this.sendMessage(
          telefone,
          `Opção inválida! Por favor, escolha entre 1 e 3 ou 0 para voltar.`,
        );
        return;
    }

    // Enviar solução e perguntar se resolveu
    await this.sendInteractiveMenu(
      telefone,
      solucao +
        `*Resolveu?*\n\n` +
        `1️⃣ Sim, resolveu\n` +
        `2️⃣ Ainda não resolveu\n` +
        `0️⃣ Voltar ao menu principal`,
    );

    // Atualizar estado para aguardar resposta
    this.conversaStates.set(telefone, {
      submenu: "suporte_resultado",
      lastActivity: new Date(),
      clienteId: cliente?.id || null,
      problema: problema,
    } as any);
  }

  private async handleSuporteResultado(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "suporte_resultado") {
      // Check if user is a test client
      const teste = await storage.getTesteAtivoByTelefone(telefone);
      const botType = teste ? "testes" : "clientes";
      await this.sendBotMenu(telefone, { tipo: botType });
      return;
    }

    switch (opcaoId) {
      case "0": // Voltar ao menu principal
        this.conversaStates.delete(telefone);
        // Check if user is a test client
        const teste = await storage.getTesteAtivoByTelefone(telefone);
        const botType = teste ? "testes" : "clientes";
        await this.sendBotMenu(telefone, { tipo: botType });
        break;

      case "1": // Resolveu
        await this.sendMessage(
          telefone,
          `*Que bom!*\n\n` +
            `Problema resolvido.\n\n` +
            `Se precisar de algo mais, estamos aqui.`,
        );
        this.conversaStates.delete(telefone);
        break;

      case "2": // Não resolveu - chamar atendente
        await this.sendMessage(
          telefone,
          `*TRANSFERINDO PARA SUPORTE*\n\n` +
            `Entendi que as soluções não funcionaram.\n` +
            `Vou transferir você para um técnico especializado, por favor, aguarde...`,
        );

        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });

        await this.createTicket(
          conversa,
          cliente,
          `[Suporte Técnico] ${state.problema} - Soluções automáticas não funcionaram`,
        );

        this.conversaStates.delete(telefone);
        break;

      default:
        await this.sendInteractiveMenu(
          telefone,
          `Opção inválida! Por favor, escolha:\n\n` +
            `1️⃣ Sim, resolveu\n` +
            `2️⃣ Ainda não resolveu\n` +
            `0️⃣ Voltar`,
        );
        break;
    }
  }

  private async handleClienteVencido(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;
    
    if (!state || state.submenu !== "cliente_vencido") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }
    
    switch (opcaoId) {
      case "1": // Desbloqueio de confiança
        // Check if trust unlock was already used this month
        const lastUnlock = cliente.ultimoDesbloqueioConfianca 
          ? new Date(cliente.ultimoDesbloqueioConfianca) 
          : null;
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        if (lastUnlock && lastUnlock > thirtyDaysAgo) {
          // Already used this month
          const daysUntilAvailable = Math.ceil(
            (lastUnlock.getTime() + 30 * 24 * 60 * 60 * 1000 - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          await this.sendInteractiveMenu(
            telefone,
            `❌ *Desbloqueio não disponível*\n\n` +
            `Você já utilizou o desbloqueio de confiança este mês.\n` +
            `Último desbloqueio: ${lastUnlock.toLocaleDateString('pt-BR')}\n` +
            `Disponível novamente em: ${daysUntilAvailable} ${daysUntilAvailable === 1 ? 'dia' : 'dias'}\n\n` +
            `Escolha outra opção:\n\n` +
            `2️⃣ Pagar plano\n` +
            `3️⃣ Falar com atendente`,
          );
          
          // Keep the same state
          return;
        }
        
        // Can use trust unlock - extend vencimento by 2 days
        const newVencimento = new Date();
        newVencimento.setDate(newVencimento.getDate() + 2);
        // Ajustar para 23:59:59 do dia de vencimento
        newVencimento.setHours(23, 59, 59, 999);
        
        await storage.updateCliente(cliente.id, {
          vencimento: newVencimento,
          ultimoDesbloqueioConfianca: now,
        });
        
        await this.sendMessage(
          telefone,
          `✅ *DESBLOQUEIO ATIVADO!*\n\n` +
          `Seu plano foi liberado por 2 dias!\n` +
          `Novo vencimento: ${newVencimento.toLocaleDateString('pt-BR')}\n\n` +
          `Aproveite para regularizar sua situação!`,
        );
        
        // Clear state
        this.conversaStates.delete(telefone);
        break;
        
      case "2": // Pagar plano - redirect to renewal flow
        // Calculate valorTotal from pontos
        const pontosRenovacao = await storage.getPontosByClienteId(cliente.id);
        const valorRenovacao = pontosRenovacao.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || "0");
          return sum + valor;
        }, 0);

        // Get monthly value
        const valorMensal = valorRenovacao > 0 ? valorRenovacao : 29.0;

        // Calculate prices with progressive discounts
        const precos = this.calcularPrecosRenovacao(valorMensal);

        // Show renewal options
        await this.sendInteractiveMenu(
          telefone,
          `*RENOVAR PLANO*\n\n` +
          `*Escolha o período:*\n\n` +
          `1️⃣ *1 mês* - R$ ${precos.mensal.toFixed(2).replace(".", ",")}\n` +
          `2️⃣ *3 meses* - R$ ${precos.trimestral.toFixed(2).replace(".", ",")} (10% OFF)\n` +
          `3️⃣ *6 meses* - R$ ${precos.semestral.toFixed(2).replace(".", ",")} (20% OFF)\n` +
          `4️⃣ *12 meses* - R$ ${precos.anual.toFixed(2).replace(".", ",")} (30% OFF)\n\n` +
          `_Quanto maior o período, maior o desconto!_`,
        );
        
        // Set state for renewal period selection
        this.conversaStates.set(telefone, {
          submenu: "renovar_periodo",
          lastActivity: new Date(),
          clienteId: cliente.id,
          valorMensal: valorMensal,
          precos: precos,  // Save the prices object!
          vencimentoAtual: cliente.vencimento,
        } as any);
        break;
        
      case "3": // Falar com atendente
        await this.sendMessage(
          telefone,
          `*TRANSFERINDO PARA ATENDENTE*\n\n` +
          `Vou transferir você para um atendente humano.\n` +
          `Por favor, aguarde...`,
        );
        
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        
        await this.createTicket(
          conversa,
          cliente,
          "[Ticket] Cliente com plano vencido precisando de atendimento",
        );
        
        // Clear state
        this.conversaStates.delete(telefone);
        break;
        
      default:
        await this.sendInteractiveMenu(
          telefone,
          `❌ *Opção inválida!*\n\n` +
          `Por favor, escolha uma das opções disponíveis:\n\n` +
          `1️⃣ Desbloqueio de confiança\n` +
          `2️⃣ Pagar plano\n` +
          `3️⃣ Falar com atendente`,
        );
        break;
    }
  }

  private async handlePontoSmartTvMarca(
    conversa: any,
    opcaoId: string,
    telefone: string,
    cliente: any,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "ponto_smarttv_marca") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar
    if (opcaoId === "0") {
      // Voltar para o menu de dispositivos
      await this.sendInteractiveMenu(
        telefone,
        `Legal! 😄 Vamos adicionar um novo ponto.\n\n` +
          `Onde você vai assistir?\n\n` +
          `1️⃣ Celular\n` +
          `2️⃣ TV Box (caixinha)\n` +
          `3️⃣ Smart TV\n` +
          `4️⃣ Notebook ou Computador\n` +
          `5️⃣ Outros\n` +
          `0️⃣ Voltar`,
      );

      this.conversaStates.set(telefone, {
        submenu: "ponto_dispositivo",
        lastActivity: new Date(),
        clienteId: cliente.id,
        isAddingPoint: true,
      } as any);
      return;
    }

    // Validar opções
    if (
      !["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].includes(opcaoId)
    ) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha entre 1 e 10, ou 0 para voltar.`,
      );
      return;
    }

    const marcas = [
      "Samsung",
      "LG",
      "Philips",
      "AOC",
      "TCL",
      "Panasonic",
      "Toshiba",
      "Multilaser",
      "BGH",
      "Outras",
    ];

    const marca = marcas[parseInt(opcaoId) - 1] || "Outras";

    // Criar ticket para adicionar ponto
    await this.sendMessage(
      telefone,
      `Perfeito! Vamos finalizar seu ponto.\nUm vendedor entrará em contato agora mesmo!`,
    );

    // Mudar para atendimento humano
    await storage.updateConversa(conversa.id, {
      modoAtendimento: "humano",
    });

    // Criar ticket
    await this.createTicket(
      conversa,
      cliente,
      `[Ticket] Cliente quer adicionar ponto - Dispositivo: Smart TV (${marca})`,
    );

    // Limpar estado
    this.conversaStates.delete(telefone);
  }

  private async handleRenovarPeriodo(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "renovar_periodo") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar
    if (opcaoId === "0") {
      this.conversaStates.delete(telefone);
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Validar opções
    if (!["1", "2", "3", "4"].includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha entre 1 e 4 ou 0 para voltar.`,
      );
      return;
    }

    const periodos = {
      "1": { meses: 1, preco: state.precos.mensal, label: "1 mês" },
      "2": { meses: 3, preco: state.precos.trimestral, label: "3 meses" },
      "3": { meses: 6, preco: state.precos.semestral, label: "6 meses" },
      "4": { meses: 12, preco: state.precos.anual, label: "1 ano" },
    };

    const periodo = periodos[opcaoId];

    // Calcular novo vencimento
    const vencimentoAtual = state.vencimentoAtual
      ? new Date(state.vencimentoAtual)
      : new Date();
    
    // Check if plan is expired
    const hoje = new Date();
    const planoVencido = vencimentoAtual < hoje;
    
    // If expired, count from today. If not expired, count from current expiration
    const baseDate = planoVencido ? hoje : vencimentoAtual;
    // Usar date-fns para adicionar meses corretamente
    let novoVencimento = addMonths(baseDate, periodo.meses);
    
    // Ajustar para 23:59:59 do dia de vencimento
    novoVencimento.setHours(23, 59, 59, 999);

    // Mostrar confirmação
    await this.sendInteractiveMenu(
      telefone,
      `*CONFIRMAÇÃO DE RENOVAÇÃO*\n\n` +
        `*Período:* ${periodo.label}\n` +
        `*Valor Total:* R$ ${periodo.preco.toFixed(2).replace(".", ",")}\n\n` +
        `*Vencimento Atual:* ${vencimentoAtual.toLocaleDateString("pt-BR")}\n` +
        `*Novo Vencimento:* ${novoVencimento.toLocaleDateString("pt-BR")}\n\n` +
        `Escolha uma opção:\n\n` +
        `1️⃣ Pagar agora via PIX\n` +
        `0️⃣ Cancelar e voltar`,
    );

    // Atualizar estado para próxima etapa
    this.conversaStates.set(telefone, {
      submenu: "renovar_confirmar",
      lastActivity: new Date(),
      periodo: periodo,
      novoVencimento: novoVencimento,
      vencimentoAtual: vencimentoAtual,
      clienteId: state.clienteId,
      valorTotal: periodo.preco,
      meses: periodo.meses,
    } as any);
  }

  private async handleRenovarConfirmar(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "renovar_confirmar") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Voltar
    if (opcaoId === "0") {
      // Voltar para escolher período
      const cliente = await storage.getClienteById(state.clienteId);
      const valorMensal = parseFloat(cliente?.valorTotal) || 19.99;
      const precos = this.calcularPrecosRenovacao(valorMensal);

      await this.sendInteractiveMenu(
        telefone,
        `*RENOVAR PLANO*\n\n` +
          `Escolha o período:\n\n` +
          `1️⃣ 1 mês - R$ ${precos.mensal.toFixed(2).replace(".", ",")}\n` +
          `2️⃣ 3 meses - R$ ${precos.trimestral.toFixed(2).replace(".", ",")} (-10%)\n` +
          `3️⃣ 6 meses - R$ ${precos.semestral.toFixed(2).replace(".", ",")} (-20%)\n` +
          `4️⃣ 1 ano - R$ ${precos.anual.toFixed(2).replace(".", ",")} (-30%)\n\n` +
          `0️⃣ Voltar ao menu principal`,
      );

      this.conversaStates.set(telefone, {
        submenu: "renovar_periodo",
        lastActivity: new Date(),
        valorMensal: valorMensal,
        precos: precos,
        vencimentoAtual: state.vencimentoAtual,
        clienteId: state.clienteId,
      } as any);
      return;
    }

    // Opção 1 - Pagar agora
    if (opcaoId === "1") {
      try {
        const cliente = await storage.getClienteById(state.clienteId);
        if (!cliente) {
          await this.sendMessage(
            telefone,
            `❌ Erro ao buscar dados do cliente.`,
          );
          this.conversaStates.delete(telefone);
          return;
        }

        // Gerar PIX para renovação
        console.log("Gerando PIX para renovação:", {
          clienteId: state.clienteId,
          valorTotal: state.valorTotal,
          meses: state.meses,
          clienteNome: cliente.nome,
        });

        const pixService = new (await import("./pix.js")).PixService();
        const pixResult = await pixService.generatePix(
          state.clienteId,
          state.valorTotal,
          `Renovação ${state.meses} ${state.meses === 1 ? "mês" : "meses"} - ${cliente.nome}`,
          { meses: state.meses } // Adicionar metadata com número de meses
        );

        console.log("Resultado da geração do PIX:", pixResult);
        console.log("PIX Copia e Cola:", pixResult?.pixCopiaCola);
        console.log("Payment Link:", pixResult?.paymentLinkUrl);

        if (pixResult && pixResult.pixKey) {
          // Obter PIX copia e cola diretamente do resultado
          const pixCopiaCola = pixResult.pixCopiaCola || "";

          // 1. Primeiro: Enviar QR Code como imagem sem texto
          if (pixResult.qrCode) {
            try {
              await this.sendImage(telefone, pixResult.qrCode, "");
            } catch (error) {
              console.error("Erro ao enviar QR Code:", error);
            }
          }

          // 2. Segundo: Enviar PIX copia e cola em mensagem separada
          if (pixCopiaCola) {
            await this.sendMessage(telefone, `${pixCopiaCola}`);
          }

          // 3. Terceiro: Enviar menu com informações do PIX (sem link de pagamento)
          await this.sendInteractiveMenu(
            telefone,
            `*PIX PARA RENOVAÇÃO GERADO*\n\n` +
              `*Período:* ${state.meses} ${state.meses === 1 ? "mês" : "meses"}\n` +
              `*Valor:* R$ ${state.valorTotal.toFixed(2).replace(".", ",")}\n` +
              `*Novo Vencimento:* ${state.novoVencimento.toLocaleDateString("pt-BR")}\n\n` +
              `*Renovação automática após pagamento*\n` +
              `*Válido por 6 horas*\n\n` +
              `Escolha uma opção:\n` +
              `1️⃣ Já paguei\n` +
              `0️⃣ Cancelar e voltar`,
          );

          // Atualizar estado para aguardar confirmação
          this.conversaStates.set(telefone, {
            submenu: "renovar_aguardando_pagamento",
            lastActivity: new Date(),
            chargeId: pixResult.id,
            clienteId: state.clienteId,
            novoVencimento: state.novoVencimento,
            meses: state.meses,
          } as any);
        } else {
          // Verificar se o erro é de configuração do PIX
          const integracao = await storage.getIntegracaoByTipo("pix");
          if (
            !integracao ||
            !integracao.ativo ||
            !(integracao.configuracoes as any)?.appId
          ) {
            await this.sendInteractiveMenu(
              telefone,
              `⚠️ *SISTEMA PIX NÃO CONFIGURADO*\n\n` +
                `O sistema de pagamento PIX ainda não está configurado.\n` +
                `Por favor, entre em contato com um atendente para realizar o pagamento.\n\n` +
                `3️⃣ Falar com Atendente\n` +
                `0️⃣ Voltar ao menu`,
            );
          } else {
            await this.sendMessage(
              telefone,
              `❌ Erro ao gerar PIX. Por favor, tente novamente ou fale com um atendente.`,
            );
          }
          this.conversaStates.delete(telefone);
        }
      } catch (error: any) {
        console.error("Erro ao processar renovação:", error);

        // Verificar se é erro de configuração
        if (error.message?.includes("PIX não está configurado")) {
          await this.sendInteractiveMenu(
            telefone,
            `⚠️ *SISTEMA PIX NÃO CONFIGURADO*\n\n` +
              `O sistema de pagamento PIX ainda não está configurado.\n` +
              `Por favor, entre em contato com um atendente para realizar o pagamento.\n\n` +
              `3️⃣ Falar com Atendente\n` +
              `0️⃣ Voltar ao menu`,
          );
        } else {
          await this.sendMessage(
            telefone,
            `❌ Erro ao processar renovação. Um atendente entrará em contato.`,
          );
        }
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(conversa, null, "Erro ao processar renovação");
        this.conversaStates.delete(telefone);
      }
    } else {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Digite 1 para pagar ou 0 para voltar.`,
      );
    }
  }

  private async handleRenovarAguardandoPagamento(
    conversa: any,
    opcaoId: string,
    telefone: string,
  ) {
    const state = this.conversaStates.get(telefone) as any;

    if (!state || state.submenu !== "renovar_aguardando_pagamento") {
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 0 - Cancelar
    if (opcaoId === "0") {
      await this.sendMessage(
        telefone,
        `❌ *Renovação cancelada.*\n\nVocê pode renovar a qualquer momento pelo menu principal.`,
      );
      this.conversaStates.delete(telefone);
      await this.sendBotMenu(telefone, { tipo: "clientes" });
      return;
    }

    // Opção 2 - Falar com atendente
    if (opcaoId === "2") {
      await storage.updateConversa(conversa.id, {
        modoAtendimento: "humano",
      });

      await this.sendMessage(
        telefone,
        `👤 *Transferindo para atendimento humano...*\n\n` +
          `Um de nossos atendentes irá responder em breve.\n` +
          `Por favor, aguarde.`,
      );

      this.conversaStates.delete(telefone);
      return;
    }

    // Opção 1 - Já paguei
    if (opcaoId === "1") {
      try {
        // Verificar status do pagamento
        const pixService = new (await import("./pix.js")).PixService();
        const statusPagamento = await pixService.verificarStatusPagamento(
          state.chargeId,
        );

        if (statusPagamento === "COMPLETED") {
          // Pagamento confirmado - renovar plano
          const cliente = await storage.getClienteById(state.clienteId);
          if (cliente) {
            await storage.updateCliente(state.clienteId, {
              vencimento: state.novoVencimento,
              status: "ativo",
            });

            // Atualizar pagamento
            await storage.updatePagamentoByChargeId(state.chargeId, {
              status: "confirmado",
            });

            await this.sendMessage(
              telefone,
              `✅ *PAGAMENTO CONFIRMADO!*\n\n` +
                `🎉 Sua renovação foi processada com sucesso!\n\n` +
                `📅 *Novo vencimento:* ${state.novoVencimento.toLocaleDateString("pt-BR")}\n` +
                `✅ *Status:* Ativo\n\n` +
                `Obrigado por continuar com a TV ON! 🚀`,
            );

            this.conversaStates.delete(telefone);
            await this.sendBotMenu(telefone, { tipo: "clientes" });
          }
        } else if (statusPagamento === "ACTIVE") {
          await this.sendMessage(
            telefone,
            `⏳ *Pagamento ainda não confirmado.*\n\n` +
              `Por favor, aguarde alguns segundos após o pagamento.\n` +
              `Você receberá uma confirmação automática.\n\n` +
              `Digite 1 para verificar novamente\n` +
              `Digite 0 para cancelar`,
          );
        } else {
          await this.sendMessage(
            telefone,
            `❌ *Pagamento não encontrado.*\n\n` +
              `Verifique se você realizou o pagamento corretamente.\n` +
              `Se já pagou, aguarde alguns minutos.\n\n` +
              `Digite 1 para verificar novamente\n` +
              `Digite 0 para cancelar`,
          );
        }
      } catch (error) {
        console.error("Erro ao verificar pagamento:", error);
        await this.sendInteractiveMenu(
          telefone,
          `⚠️ *Pagamento ainda não confirmado*\n\n` +
            `Por favor, aguarde alguns instantes após o pagamento.\n\n` +
            `Escolha uma opção:\n` +
            `1️⃣ Confirmar novamente\n` +
            `2️⃣ Falar com atendente\n` +
            `0️⃣ Cancelar e voltar`,
        );
      }
    } else {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Digite 1 para confirmar, 2 para atendente ou 0 para cancelar.`,
      );
    }
  }

  private async handleTestesBotOption(
    conversa: any,
    opcaoId: string,
    teste: any,
    telefone: string,
  ) {
    // Check if user is in a submenu
    const state = this.conversaStates.get(telefone);
    
    // Handle submenu interactions for test bot
    if (state && state.submenu) {
      // Reuse novos bot submenu handling for "assinar_codigo" and all related subscription submenus
      if (state.submenu === "assinar_codigo" || 
          state.submenu === "aguardando_codigo" ||
          state.submenu === "codigo_invalido" ||
          state.submenu === "assinar_dispositivo" ||
          state.submenu === "celular_tipo_assinar" ||
          state.submenu === "smart_tv_marca_assinar" ||
          state.submenu === "cadastro_nome") {
        await this.handleNovosSubmenu(conversa, opcaoId, telefone, state.submenu);
        return;
      }
      return;
    }
    
    // Validar opções do menu principal de testes (agora apenas 2)
    const validOptions = ["1", "2"];
    if (!validOptions.includes(opcaoId)) {
      await this.sendMessage(
        telefone,
        `❌ *Opção inválida!* Por favor, escolha entre 1 e 2.`,
      );
      return;
    }

    switch (opcaoId) {
      case "1": // Ativar plano agora (igual novos bot opção 2)
        await this.sendInteractiveMenu(
          telefone,
          `Show! 🎉 Agora me diz, você tem um código de indicação?\n\n` +
            `1️⃣ Sim, tenho código\n` +
            `2️⃣ Não tenho\n` +
            `0️⃣ Voltar`,
        );
        this.conversaStates.set(telefone, {
          submenu: "assinar_codigo",
          lastActivity: new Date(),
          previousMenu: "main",
        });
        break;

      case "2": // Falar com atendente
        await this.sendMessage(
          telefone,
          `Chamando um atendente agora...\n` +
            `Por favor, aguarde um instante enquanto transferimos você para um atendente humano.`,
        );
        await storage.updateConversa(conversa.id, {
          modoAtendimento: "humano",
        });
        await this.createTicket(
          conversa,
          null,
          "[Ticket] Suporte manual solicitado - Cliente Teste",
        );
        // Clear the state so bot stops responding
        this.conversaStates.delete(telefone);
        break;
    }
  }

  async sendBotMenu(telefone: string, botConfig: any) {
    try {
      console.log("Enviando menu do bot para:", telefone);

      // Get greeting based on Brazilian time
      const now = new Date();
      const brazilTime = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
      );
      const hour = brazilTime.getHours();

      console.log("=== HORÁRIO BRASILEIRO DEBUG ===");
      console.log("Hora atual no Brasil:", hour);
      console.log("Data/hora completa Brasil:", brazilTime);

      let greeting = "Bom dia";
      if (hour >= 12 && hour < 18) {
        greeting = "Boa tarde";
      } else if (hour >= 18 || hour < 6) {
        greeting = "Boa noite";
      }

      console.log("Saudação escolhida:", greeting);

      // Verificar se é o bot de novos clientes
      if (botConfig.tipo === "novos") {
        const menu =
          `${greeting}, bem-vindo(a) à *TvON*!\n\n` +
          `Escolha uma opção:\n\n` +
          `1️⃣ Teste grátis por 6h\n` +
          `2️⃣ Quero assinar agora\n` +
          `3️⃣ Qual o conteúdo?\n` +
          `4️⃣ Qual o valor?\n` +
          `5️⃣ Por onde consigo assistir?\n` +
          `6️⃣ Saber mais\n` +
          `7️⃣ Falar com atendente\n` +
          `8️⃣ Já sou cliente`;

        console.log("Enviando menu de novos clientes:", menu);
        await this.sendInteractiveMenu(telefone, menu);

        // Limpar estado de submenu se existir
        this.conversaStates.delete(telefone);
        return;
      }

      // Verificar se é o bot de clientes
      if (botConfig.tipo === "clientes") {
        // Get cliente info to check if expired
        const cliente = await storage.getClienteByTelefone(telefone);
        
        // Check if client is expired
        if (cliente && cliente.vencimento && new Date(cliente.vencimento) < new Date()) {
          console.log("Cliente vencido detectado:", cliente.nome, cliente.vencimento);
          
          // Send expired client menu
          const daysExpired = Math.ceil((new Date().getTime() - new Date(cliente.vencimento).getTime()) / (1000 * 60 * 60 * 24));
          
          // Use apenas o primeiro nome
          const primeiroNome = cliente.nome.split(' ')[0];
          
          const expiredMenu =
            `⚠️ *PLANO VENCIDO*\n\n` +
            `${greeting}, *${primeiroNome}!*\n\n` +
            `Seu plano venceu há ${daysExpired} ${daysExpired === 1 ? 'dia' : 'dias'}.\n` +
            `Vencimento: ${new Date(cliente.vencimento).toLocaleDateString('pt-BR')}\n\n` +
            `Escolha uma opção:\n\n` +
            `1️⃣ Desbloqueio de confiança\n` +
            `2️⃣ Pagar plano\n` +
            `3️⃣ Falar com atendente`;
          
          console.log("Enviando menu de cliente vencido:", expiredMenu);
          await this.sendInteractiveMenu(telefone, expiredMenu);
          
          // Set state for expired client menu
          this.conversaStates.set(telefone, {
            submenu: "cliente_vencido",
            lastActivity: new Date(),
            clienteId: cliente.id,
          } as any);
          
          return;
        }
        
        // Process variables in welcome message for active clients
        const welcomeMessage = botConfig.mensagemBoasVindas || "*{{nome}}!*\n\nVencimento: {{vencimento}}\nValor: {{valorTotal}}";
        const processedMessage = await this.processVariables(
          welcomeMessage,
          telefone,
        );

        // Sempre usar as opções padrão corretas para clientes
        const menuOptions =
          `1️⃣ Ver vencimento\n` +
          `2️⃣ Renovar plano\n` +
          `3️⃣ Ver pontos\n` +
          `4️⃣ Ganhar um mês grátis\n` +
          `5️⃣ Suporte técnico\n` +
          `6️⃣ Falar com atendente`;

        const menu =
          `${greeting}! ${processedMessage}\n\n` +
          `Escolha uma opção:\n\n` +
          menuOptions;

        console.log("Enviando menu de clientes:", menu);
        await this.sendInteractiveMenu(telefone, menu);

        // Limpar estado de submenu se existir
        this.conversaStates.delete(telefone);
        return;
      }

      // Verificar se é o bot de testes
      if (botConfig.tipo === "testes") {
        // Get test info (including expired tests)
        const teste = await storage.getAnyTesteByTelefone(telefone);
        
        // Check if test is expired
        if (teste && teste.expiraEm) {
          const msRestantes = new Date(teste.expiraEm).getTime() - Date.now();
          const minutosRestantes = Math.ceil(msRestantes / (1000 * 60));
          
          if (minutosRestantes <= 0) {
            // Test is expired - send special expired menu
            const expiredMenu =
              `🔴 *Teste Expirado*\n\n` +
              `Seu teste expirou.\n\n` +
              `Escolha uma opção:\n\n` +
              `1️⃣ Ativar plano agora\n` +
              `2️⃣ Falar com atendente`;
            
            console.log("Enviando menu de teste expirado:", expiredMenu);
            await this.sendInteractiveMenu(telefone, expiredMenu);
            
            // Limpar estado de submenu se existir
            this.conversaStates.delete(telefone);
            return;
          }
          
          // Test is active - calculate remaining time
          let statusEmoji = "🟢";
          let statusText = "ATIVO";
          
          // Format time in days, hours, and minutes (abbreviated)
          const dias = Math.floor(minutosRestantes / (60 * 24));
          const horas = Math.floor((minutosRestantes % (60 * 24)) / 60);
          const minutos = minutosRestantes % 60;
          
          let partes = [];
          if (dias > 0) partes.push(`${dias}d`);
          if (horas > 0) partes.push(`${horas}h`);
          if (minutos > 0) partes.push(`${minutos}min`);
          
          const tempoRestanteFormatado = partes.join(', ');
          
          if (minutosRestantes <= 60) {
            statusEmoji = "🟡";
            statusText = "EXPIRANDO";
          }
          
          const activeTestMenu =
            `${statusEmoji} *TESTE ${statusText}*\n\n` +
            `Olá, ${greeting.toLowerCase()}!\n` +
            `⏱️ Tempo restante: ${tempoRestanteFormatado}\n\n` +
            `Escolha uma opção:\n\n` +
            `1️⃣ Ativar plano agora\n` +
            `2️⃣ Falar com atendente`;
          
          console.log("Enviando menu de teste ativo:", activeTestMenu);
          await this.sendInteractiveMenu(telefone, activeTestMenu);
          
          // Limpar estado de submenu se existir
          this.conversaStates.delete(telefone);
          return;
        }
        
        // No test found - send default menu
        const defaultTestMenu =
          `Olá, ${greeting.toLowerCase()}!\n\n` +
          `Escolha uma opção:\n\n` +
          `1️⃣ Ativar plano agora\n` +
          `2️⃣ Falar com atendente`;
        
        console.log("Enviando menu padrão (sem teste encontrado):", defaultTestMenu);
        await this.sendInteractiveMenu(telefone, defaultTestMenu);
        
        // Limpar estado de submenu se existir
        this.conversaStates.delete(telefone);
        return;
      }

      // Menu padrão para outros tipos de bot
      const opcoes = botConfig.opcoes as any[];

      // Process variables in welcome message
      const welcomeMessage = botConfig.mensagemBoasVindas || "Bem-vindo(a)!";
      const processedMessage = await this.processVariables(
        welcomeMessage,
        telefone,
      );
      console.log("Mensagem processada:", processedMessage);

      // Create menu with cleaner formatting
      let menu = `${greeting}! ${processedMessage}\n\n`;
      menu += `Escolha uma opção:\n\n`;

      opcoes.forEach((opcao: any) => {
        const numberEmoji = this.getNumberEmoji(opcao.id || opcao.numero);
        const textEmoji = this.getMenuEmoji(opcao.texto);
        menu += `${numberEmoji} ${textEmoji} ${opcao.texto}\n`;
      });

      console.log("Enviando menu de texto:", menu);
      await this.sendInteractiveMenu(telefone, menu);

      console.log("Menu enviado com sucesso");
    } catch (error) {
      console.error("Erro ao enviar menu do bot:", error);
      throw error;
    }
  }

  private getNumberEmoji(number: string | number): string {
    const numberMap: { [key: string]: string } = {
      "0": "0️⃣",
      "1": "1️⃣",
      "2": "2️⃣",
      "3": "3️⃣",
      "4": "4️⃣",
      "5": "5️⃣",
      "6": "6️⃣",
      "7": "7️⃣",
      "8": "8️⃣",
      "9": "9️⃣",
      "10": "🔟",
    };
    return numberMap[number.toString()] || number.toString();
  }

  private getMenuEmoji(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("plano") || lowerText.includes("conhecer"))
      return "📺";
    if (lowerText.includes("teste") || lowerText.includes("grátis"))
      return "🎁";
    if (lowerText.includes("vendedor") || lowerText.includes("falar"))
      return "👤";
    if (lowerText.includes("suporte") || lowerText.includes("técnico"))
      return "🛠️";
    if (lowerText.includes("vencimento") || lowerText.includes("ver"))
      return "📅";
    if (lowerText.includes("pagamento") || lowerText.includes("segunda"))
      return "💳";
    if (lowerText.includes("renovar") || lowerText.includes("upgrade"))
      return "🔄";
    if (lowerText.includes("status")) return "📊";
    if (lowerText.includes("configurar")) return "⚙️";
    if (lowerText.includes("virar") || lowerText.includes("cliente"))
      return "🎯";
    if (lowerText.includes("atendente") || lowerText.includes("humano"))
      return "🙋";
    return "▶️";
  }

  private async detectKeywordIntent(
    message: string,
    botType: string,
  ): Promise<any> {
    const keywords = {
      novos: {
        teste: { id: "1" },
        testar: { id: "1" },
        grátis: { id: "1" },
        gratuito: { id: "1" },
        "6h": { id: "1" },
        experimentar: { id: "1" },
        assinar: { id: "2" },
        comprar: { id: "2" },
        contratar: { id: "2" },
        quero: { id: "2" },
        conteúdo: { id: "3" },
        conteudo: { id: "3" },
        canais: { id: "3" },
        programação: { id: "3" },
        valor: { id: "4" },
        preço: { id: "4" },
        preco: { id: "4" },
        quanto: { id: "4" },
        planos: { id: "4" },
        assistir: { id: "5" },
        dispositivo: { id: "5" },
        aparelho: { id: "5" },
        onde: { id: "5" },
        saber: { id: "6" },
        informações: { id: "6" },
        informacoes: { id: "6" },
        atendente: { id: "7" },
        humano: { id: "7" },
        falar: { id: "7" },
        suporte: { id: "7" },
      },
      clientes: {
        vencimento: { id: "1" },
        "quando vence": { id: "1" },
        data: { id: "1" },
        pagar: { id: "2" },
        pagamento: { id: "2" },
        boleto: { id: "2" },
        pix: { id: "2" },
        "segunda via": { id: "2" },
        renovar: { id: "3" },
        upgrade: { id: "3" },
        "mudar plano": { id: "3" },
        suporte: { id: "4" },
        ajuda: { id: "4" },
        problema: { id: "4" },
        atendente: { id: "5" },
        humano: { id: "5" },
        pessoa: { id: "5" },
      },
      testes: {
        status: { id: "1" },
        "quanto tempo": { id: "1" },
        expira: { id: "1" },
        configurar: { id: "2" },
        "como usar": { id: "2" },
        tutorial: { id: "2" },
        "mais tempo": { id: "3" },
        estender: { id: "3" },
        prorrogar: { id: "3" },
        "virar cliente": { id: "4" },
        contratar: { id: "4" },
        assinar: { id: "4" },
        suporte: { id: "5" },
        ajuda: { id: "5" },
        problema: { id: "5" },
      },
    };

    const botKeywords = keywords[botType] || {};

    // Check for exact matches first
    for (const [keyword, option] of Object.entries(botKeywords)) {
      if (message.includes(keyword)) {
        console.log(`Keyword detected: ${keyword} -> option ${option.id}`);
        return option;
      }
    }

    // Check for partial matches
    for (const [keyword, option] of Object.entries(botKeywords)) {
      const keywordParts = keyword.split(" ");
      if (keywordParts.every((part) => message.includes(part))) {
        console.log(`Partial keyword match: ${keyword} -> option ${option.id}`);
        return option;
      }
    }

    return null;
  }

  async processVariables(text: string, telefone: string): Promise<string> {
    try {
      // Ensure text is not null or undefined
      if (!text) {
        text = "";
      }
      
      // Get client and test data
      const cliente = await storage.getClienteByTelefone(telefone);
      const teste = await storage.getTesteAtivoByTelefone(telefone);

      let processedText = text;

      // Client variables
      if (cliente) {
        // Get only the first name
        const firstName = cliente.nome ? cliente.nome.split(" ")[0] : "Cliente";

        // Calculate valorTotal from pontos
        const pontos = await storage.getPontosByClienteId(cliente.id);
        const valorTotal = pontos.reduce((sum, ponto) => {
          const valor = parseFloat(ponto.valor || "0");
          return sum + valor;
        }, 0);

        processedText = processedText.replace(/\{\{nome\}\}/g, firstName);
        processedText = processedText.replace(
          /\{\{telefone\}\}/g,
          cliente.telefone || telefone,
        );
        processedText = processedText.replace(
          /\{\{vencimento\}\}/g,
          cliente.vencimento
            ? new Date(cliente.vencimento).toLocaleDateString("pt-BR")
            : "Não definido",
        );
        processedText = processedText.replace(
          /\{\{status\}\}/g,
          cliente.status || "Ativo",
        );
        processedText = processedText.replace(
          /\{\{valorTotal\}\}/g,
          valorTotal > 0
            ? `R$ ${valorTotal.toFixed(2).replace(".", ",")}`
            : "R$ 29,00",
        );
        // Note: Cliente doesn't have ultimoAcesso field, only pontos have it
        processedText = processedText.replace(
          /\{\{ultimoAcesso\}\}/g,
          "Não disponível",
        );
      } else {
        // Default values for non-clients
        processedText = processedText.replace(/\{\{nome\}\}/g, "Visitante");
        processedText = processedText.replace(/\{\{telefone\}\}/g, telefone);
        processedText = processedText.replace(
          /\{\{vencimento\}\}/g,
          "Não é cliente",
        );
        processedText = processedText.replace(
          /\{\{status\}\}/g,
          "Não é cliente",
        );
        processedText = processedText.replace(
          /\{\{valorTotal\}\}/g,
          "Não é cliente",
        );
        processedText = processedText.replace(
          /\{\{ultimoAcesso\}\}/g,
          "Não é cliente",
        );
      }

      // Test variables
      if (teste) {
        processedText = processedText.replace(
          /\{\{teste_dispositivo\}\}/g,
          teste.dispositivo || "Não definido",
        );
        processedText = processedText.replace(
          /\{\{teste_aplicativo\}\}/g,
          teste.aplicativo || "Não definido",
        );
        processedText = processedText.replace(
          /\{\{teste_expiracao\}\}/g,
          teste.expiraEm
            ? new Date(teste.expiraEm).toLocaleString("pt-BR")
            : "Não definido",
        );
        processedText = processedText.replace(
          /\{\{teste_status\}\}/g,
          teste.status || "Ativo",
        );
      } else {
        // Default values for non-tests
        processedText = processedText.replace(
          /\{\{teste_dispositivo\}\}/g,
          "Sem teste ativo",
        );
        processedText = processedText.replace(
          /\{\{teste_aplicativo\}\}/g,
          "Sem teste ativo",
        );
        processedText = processedText.replace(
          /\{\{teste_expiracao\}\}/g,
          "Sem teste ativo",
        );
        processedText = processedText.replace(
          /\{\{teste_status\}\}/g,
          "Sem teste ativo",
        );
      }

      return processedText;
    } catch (error) {
      console.error("Erro ao processar variáveis:", error);
      return text; // Return original text if error
    }
  }

  private async gerarPagamentoPix(cliente: any, telefone: string) {
    try {
      // Calculate valorTotal from pontos
      const pontos = await storage.getPontosByClienteId(cliente.id);
      const valorTotal = pontos.reduce((sum, ponto) => {
        const valor = parseFloat(ponto.valor || "0");
        return sum + valor;
      }, 0);
      const valorFinal = valorTotal > 0 ? valorTotal.toFixed(2) : "29.00";

      const pagamento = await storage.createPagamento({
        clienteId: cliente.id,
        valor: valorFinal,
        status: "pendente",
        dataVencimento: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 horas
      });

      // Aqui você integraria com a API do PIX
      const pixCode = `00020126580014BR.GOV.BCB.PIX0136${cliente.telefone}0208TV ON ${cliente.nome}5204000053039865802BR5925TV ON STREAMING6009SAO PAULO62070503***6304`;

      await storage.updatePagamento(pagamento.id, {
        pixId: `PIX-${pagamento.id}`,
        qrCode: pixCode,
      });

      await this.sendMessage(
        telefone,
        `mp�� *Pagamento PIX*\n\nValor: R$ ${valorFinal.replace(".", ",")}\nVencimento: 6h\n\nCódigo PIX:\n\`\`\`${pixCode}\`\`\``,
      );
    } catch (error) {
      console.error("Erro ao gerar PIX:", error);
      await this.sendMessage(
        telefone,
        "Erro ao gerar pagamento. Tente novamente.",
      );
    }
  }

  private async createTicket(conversa: any, cliente: any, titulo: string) {
    const ticket = await storage.createTicket({
      clienteId: cliente?.id,
      conversaId: conversa.id,
      titulo,
      descricao: `Ticket aberto automaticamente pelo bot`,
      telefone: conversa.telefone,
      status: "aberto",
      prioridade: "media",
    });
    
    // Send Discord notification for new ticket
    try {
      const { discordNotificationService } = await import('./DiscordNotificationService');
      const clientName = cliente?.nome || null;
      await discordNotificationService.notifyTicketOpened(clientName, titulo);
      console.log(`🎫 Notificação Discord enviada para ticket automático: ${titulo}`);
    } catch (error) {
      console.error("Erro ao enviar notificação Discord para ticket automático:", error);
    }
    
    return ticket;
  }

  async checkIfNumberExists(phoneNumber: string): Promise<boolean> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return false;
    }

    try {
      // Remove country code prefix if present for the check
      const cleanNumber = phoneNumber.replace(/^\+/, "");
      console.log(`Verificando existência do número: ${cleanNumber}`);

      // Try checking without the @s.whatsapp.net suffix first
      const results = await this.sock.onWhatsApp(cleanNumber);

      console.log(`Resultado da verificação para ${cleanNumber}:`, results);

      // onWhatsApp returns an array, check if any result exists
      if (Array.isArray(results) && results.length > 0) {
        const exists = results.some((result) => result.exists);
        console.log(`Número ${cleanNumber} existe no WhatsApp: ${exists}`);
        return exists;
      }

      return false;
    } catch (error) {
      console.error("Erro ao verificar número:", error);
      // In case of error, return true to allow the conversation to proceed
      // This prevents blocking valid numbers due to API issues
      return true;
    }
  }

  async sendMessage(
    to: string,
    message: string,
    replyTo?: any,
    skipSaveMessage = false,
  ): Promise<string | null> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return null;
    }

    try {
      const jid = `${to}@s.whatsapp.net`;

      // Send message with simpler approach
      let result;

      try {
        result = replyTo
          ? await this.sock.sendMessage(
              jid,
              { text: message },
              { quoted: replyTo },
            )
          : await this.sock.sendMessage(jid, { text: message });
      } catch (sendError: any) {
        // Check if it's a timeout error
        if (sendError.message && sendError.message.includes("Timed Out")) {
          throw new Error(
            "Timeout ao enviar mensagem. Verifique a conexão do WhatsApp.",
          );
        }
        throw sendError;
      }

      console.log("Message sent result:", result?.key);

      // Get or create conversation using the mutex-protected method to prevent duplicates
      let conversa = await this.getOrCreateConversation(to, undefined, {
        from: to,
        id: result?.key?.id || "",
        message: message,
        type: "text",
        timestamp: new Date().toISOString(),
      });

      // Save message to database unless skipped (when already saved by WebSocket handler)
      const whatsappMessageId = result?.key?.id || null;
      
      if (!skipSaveMessage) {
        const savedMessage = await storage.createMensagem({
          conversaId: conversa.id,
          conteudo: message,
          tipo: "text",
          remetente: "sistema",
          lida: true,
          metadados: whatsappMessageId ? { whatsappMessageId } : undefined,
          whatsappMessageId: whatsappMessageId, // Also save as whatsappMessageId field
        });

        // Update conversation last message
        await storage.updateConversa(conversa.id, {
          ultimaMensagem: message,
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: "text",
          dataUltimaMensagem: new Date(),
          // Reset unread messages when system sends a message
          mensagensNaoLidas: 0,
        });

        // Notify WebSocket clients about the new message
        // Add ehRemetente field to indicate this is a sent message
        const messageWithSenderFlag = {
          ...savedMessage,
          conversaId: conversa.id, // Ensure conversaId is included
          ehRemetente: true, // Indicates message was sent by system
        };
        this.notifyWebSocketClients("whatsapp_message", messageWithSenderFlag);
      }

      await this.logActivity("info", "WhatsApp", `Mensagem enviada para ${to}`);
      return whatsappMessageId;
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao enviar mensagem: ${error}`,
      );

      // If it's a timeout, throw a more specific error
      if (error.message === "Message send timeout") {
        throw new Error(
          "Timeout ao enviar mensagem. Verifique a conexão do WhatsApp.",
        );
      }

      return null;
    }
  }

  setConversationState(telefone: string, state: any) {
    this.conversaStates.set(telefone, state);
  }

  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
    replyTo?: any,
    skipSaveMessage: boolean = false,
  ): Promise<string | null> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return null;
    }

    try {
      const jid = `${to}@s.whatsapp.net`;

      // Send image message
      let result;

      try {
        result = replyTo
          ? await this.sock.sendMessage(
              jid,
              {
                image: { url: imageUrl },
                caption: caption || "",
              },
              { quoted: replyTo },
            )
          : await this.sock.sendMessage(jid, {
              image: { url: imageUrl },
              caption: caption || "",
            });
      } catch (sendError: any) {
        // Check if it's a timeout error
        if (sendError.message && sendError.message.includes("Timed Out")) {
          throw new Error(
            "Timeout ao enviar imagem. Verifique a conexão do WhatsApp.",
          );
        }
        throw sendError;
      }

      console.log("Image sent result:", result?.key);

      const whatsappMessageId = result?.key?.id || null;

      // Only save message if not called from WebSocket handler (which already saved it)
      if (!skipSaveMessage) {
        // Get or create conversation
        let conversa = await storage.getConversaByTelefone(to);
        if (!conversa) {
          // Create conversation if it doesn't exist
          conversa = await storage.createConversa({
            telefone: to,
            ultimaMensagem: caption || "📷 Imagem",
            ultimoRemetente: "sistema",
            tipoUltimaMensagem: "image",
            mensagensNaoLidas: 0,
          });
        }

        // Save message to database
        // Convert full path to relative path for database storage
        let relativeMediaUrl = imageUrl;
        if (imageUrl.includes('/uploads/')) {
          // Extract just the relative path starting from /uploads/
          const uploadsIndex = imageUrl.indexOf('/uploads/');
          if (uploadsIndex !== -1) {
            relativeMediaUrl = imageUrl.substring(uploadsIndex);
          }
        }
        const savedMessage = await storage.createMensagem({
          conversaId: conversa.id,
          conteudo: caption || "📷 Imagem",
          tipo: "image",
          remetente: "sistema",
          lida: true,
          mediaUrl: relativeMediaUrl,
          metadados: whatsappMessageId ? { whatsappMessageId } : undefined,
          whatsappMessageId: whatsappMessageId, // Also save as whatsappMessageId field
        });

        // Update conversation last message
        await storage.updateConversa(conversa.id, {
          ultimaMensagem: caption || "📷 Imagem",
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: "image",
          dataUltimaMensagem: new Date(),
          // Reset unread messages when system sends an image
          mensagensNaoLidas: 0,
        });

        // Notify WebSocket clients about the new message
        const messageWithSenderFlag = {
          ...savedMessage,
          conversaId: conversa.id,
          ehRemetente: true,
        };
        this.notifyWebSocketClients("whatsapp_message", messageWithSenderFlag);
      }

      await this.logActivity("info", "WhatsApp", `Imagem enviada para ${to}`);
      return whatsappMessageId;
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao enviar imagem: ${error}`,
      );

      // If it's a timeout, throw a more specific error
      if (error.message === "Message send timeout") {
        throw new Error(
          "Timeout ao enviar imagem. Verifique a conexão do WhatsApp.",
        );
      }

      return null;
    }
  }

  async sendButtonMessage(
    telefone: string,
    text: string,
    buttons: Array<{ id: string; displayText: string }>,
    footer?: string,
  ): Promise<string | null> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return null;
    }

    try {
      const jid = `${telefone}@s.whatsapp.net`;

      // Use correct Itsukichann/Baileys button format
      const buttonMessage = {
        text: text,
        footer: footer || "TV ON Sistema - Atendimento 24/7",
        buttons: buttons.map((btn) => ({
          buttonId: btn.id,
          buttonText: {
            displayText: btn.displayText
          }
        }))
      };

      console.log(
        "Enviando mensagem com botões - formato Itsukichann/Baileys:",
        JSON.stringify(buttonMessage, null, 2),
      );

      const result = await this.sock.sendMessage(jid, buttonMessage);

      console.log("Resultado do envio dos botões:", result);

      // Get or create conversation
      let conversa = await storage.getConversaByTelefone(telefone);
      if (!conversa) {
        conversa = await storage.createConversa({
          telefone: telefone,
          ultimaMensagem: text,
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: "text",
          mensagensNaoLidas: 0,
        });
      }

      // Save message to database
      const whatsappMessageId = result?.key?.id || null;
      const savedMessage = await storage.createMensagem({
        conversaId: conversa.id,
        conteudo: text,
        tipo: "text",
        remetente: "sistema",
        lida: true,
        metadados: {
          whatsappMessageId,
          messageType: 'button',
          buttons: buttons,
          footer: footer || "TV ON Sistema - Atendimento 24/7"
        },
      });

      // Update conversation
      await storage.updateConversa(conversa.id, {
        ultimaMensagem: text,
        ultimoRemetente: "sistema",
        tipoUltimaMensagem: "text",
        dataUltimaMensagem: new Date(),
      });

      // Notify WebSocket clients
      // Add ehRemetente field to indicate this is a sent message
      const messageWithSenderFlag = {
        ...savedMessage,
        conversaId: conversa.id, // Ensure conversaId is included
        ehRemetente: true, // Indicates message was sent by system
      };
      this.notifyWebSocketClients("new_message", messageWithSenderFlag);

      await this.logActivity(
        "info",
        "WhatsApp",
        `Mensagem com botões enviada para ${telefone}`,
      );
      return whatsappMessageId;
    } catch (error) {
      console.error("Erro ao enviar mensagem com botões:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao enviar mensagem com botões: ${error}`,
      );
      // Fallback to text menu if buttons fail
      console.log(
        "Tentando enviar como menu de texto devido ao erro com botões",
      );
      return await this.sendMessage(telefone, text);
    }
  }

  async sendListMessage(
    telefone: string,
    title: string,
    text: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
  ): Promise<string | null> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return null;
    }

    try {
      const jid = `${telefone}@s.whatsapp.net`;

      // Use Baileys list message format
      const listMessage = {
        text: text,
        footer: "TV ON Sistema - Atendimento 24/7",
        title: title,
        buttonText: buttonText,
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            title: row.title,
            rowId: row.id,
            description: row.description || "",
          })),
        })),
      };

      const result = await this.sock.sendMessage(jid, listMessage);

      // Get or create conversation
      let conversa = await storage.getConversaByTelefone(telefone);
      if (!conversa) {
        conversa = await storage.createConversa({
          telefone: telefone,
          ultimaMensagem: text,
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: "text",
          mensagensNaoLidas: 0,
        });
      }

      // Save message to database
      const whatsappMessageId = result?.key?.id || null;
      const savedMessage = await storage.createMensagem({
        conversaId: conversa.id,
        conteudo: text,
        tipo: "text",
        remetente: "sistema",
        lida: true,
        metadados: {
          whatsappMessageId,
          messageType: 'list',
          title: title,
          buttonText: buttonText,
          sections: sections,
          footer: "TV ON Sistema - Atendimento 24/7"
        },
      });

      // Update conversation
      await storage.updateConversa(conversa.id, {
        ultimaMensagem: text,
        ultimoRemetente: "sistema",
        tipoUltimaMensagem: "text",
        dataUltimaMensagem: new Date(),
      });

      // Notify WebSocket clients
      // Add ehRemetente field to indicate this is a sent message
      const messageWithSenderFlag = {
        ...savedMessage,
        conversaId: conversa.id, // Ensure conversaId is included
        ehRemetente: true, // Indicates message was sent by system
      };
      this.notifyWebSocketClients("new_message", messageWithSenderFlag);

      await this.logActivity(
        "info",
        "WhatsApp",
        `Lista de opções enviada para ${telefone}`,
      );
      return whatsappMessageId;
    } catch (error) {
      console.error("Erro ao enviar lista:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao enviar lista: ${error}`,
      );
      return null;
    }
  }

  async sendInteractiveMenu(
    telefone: string,
    text: string,
    footer?: string
  ): Promise<string | null> {
    // Check if menu mode is enabled
    const settings = await storage.getWhatsAppSettings();
    if (!settings?.menuInterativoEnabled) {
      // Send as normal text message if menu mode is disabled
      return this.sendMessage(telefone, text);
    }

    // Parse menu options from text
    const menuOptions: Array<{ id: string; text: string }> = [];
    
    // Extract numbered options (1️⃣, 2️⃣, etc.)
    const numberPattern = /([0-9])️⃣\s*([^\n]+)/g;
    let match;
    while ((match = numberPattern.exec(text)) !== null) {
      const optionNumber = match[1];
      const optionText = match[2].trim();
      // Include all options, including "0️⃣ Voltar"
      menuOptions.push({
        id: `option_${optionNumber}`,
        text: `${optionNumber}️⃣ ${optionText}`
      });
    }

    // If no options found, send as regular message
    if (menuOptions.length === 0) {
      return this.sendMessage(telefone, text);
    }

    // Get the main text (before options)
    const mainTextMatch = text.match(/^([\s\S]*?)(?=[0-9]️⃣)/);
    const mainText = mainTextMatch ? mainTextMatch[1].trim() : text;

    try {
      if (menuOptions.length <= 3) {
        // Use buttons for 3 or fewer options
        const buttons = menuOptions.map(opt => ({
          id: opt.id,
          displayText: opt.text
        }));

        console.log(`📱 Enviando menu com ${buttons.length} botões para ${telefone}`);
        return await this.sendButtonMessage(
          telefone,
          mainText,
          buttons,
          footer || "TV ON Sistema - Atendimento 24/7"
        );
      } else {
        // Use list for more than 3 options
        const sections = [{
          title: "Escolha uma opção",
          rows: menuOptions.map(opt => ({
            id: opt.id,
            title: opt.text,
            description: ""
          }))
        }];

        console.log(`📋 Enviando menu com lista (${menuOptions.length} opções) para ${telefone}`);
        return await this.sendListMessage(
          telefone,
          "Menu de Opções",
          mainText,
          "Ver Opções",
          sections
        );
      }
    } catch (error) {
      console.error("Erro ao enviar menu interativo, usando fallback:", error);
      // Fallback to regular text message
      return this.sendMessage(telefone, text);
    }
  }

  async deleteMessage(to: string, messageId: string): Promise<boolean> {
    if (!this.sock || this.connectionState.connection !== "open") {
      console.error("WhatsApp não está conectado");
      return false;
    }

    try {
      const jid = `${to}@s.whatsapp.net`;
      await this.sock.sendMessage(jid, {
        delete: {
          remoteJid: jid,
          fromMe: true,
          id: messageId,
        },
      });

      console.log("Mensagem deletada com sucesso");
      return true;
    } catch (error) {
      console.error("Erro ao deletar mensagem:", error);
      return false;
    }
  }

  async editMessage(
    to: string,
    messageId: string,
    newText: string,
  ): Promise<boolean> {
    if (!this.sock || this.connectionState.connection !== "open") {
      console.error("WhatsApp não está conectado");
      return false;
    }

    try {
      const jid = `${to}@s.whatsapp.net`;
      await this.sock.sendMessage(jid, {
        text: newText,
        edit: {
          remoteJid: jid,
          fromMe: true,
          id: messageId,
        },
      });

      console.log("Mensagem editada com sucesso");
      return true;
    } catch (error) {
      console.error("Erro ao editar mensagem:", error);
      return false;
    }
  }

  async sendMedia(to: string, media: any): Promise<string | null> {
    if (!this.sock) {
      console.error("Socket WhatsApp não está conectado");
      return null;
    }

    try {
      const jid = `${to}@s.whatsapp.net`;
      console.log("Sending media to:", jid);
      console.log("Media object:", {
        hasAudio: !!media.audio,
        audioBufferSize: media.audio?.length,
        audioAsFile: !media.ptt,
        hasImage: !!media.image,
        hasVideo: !!media.video,
        hasDocument: !!media.document,
      });

      const result = await this.sock.sendMessage(jid, media);
      console.log("Media sent successfully, result:", result);

      // Determine media type for conversation update
      let mediaType = "document"; // default
      let lastMessage = "";

      if (media.image) {
        mediaType = "image";
        lastMessage = media.caption || "📷 Foto";
      } else if (media.video) {
        mediaType = "video";
        lastMessage = media.caption || "📹 Vídeo";
      } else if (media.audio) {
        mediaType = "audio";
        lastMessage = "🎵 Áudio";
      } else if (media.document) {
        mediaType = "document";
        lastMessage = `📎 ${media.fileName || "Documento"}`;
      }

      // Update conversation
      let conversa = await storage.getConversaByTelefone(to);
      if (conversa) {
        await storage.updateConversa(conversa.id, {
          ultimaMensagem: lastMessage,
          ultimoRemetente: "sistema",
          tipoUltimaMensagem: mediaType,
          // Reset unread messages when system sends media
          mensagensNaoLidas: 0,
        });
      }

      await this.logActivity("info", "WhatsApp", `Mídia enviada para ${to}`);
      return result?.key?.id || null; // Return the message ID
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao enviar mídia: ${error}`,
      );
      return null;
    }
  }

  getConnectionState() {
    return this.connectionState;
  }

  async getCurrentUserProfile() {
    if (!this.sock || !this.isConnected()) {
      return null;
    }

    try {
      // Get the current user's JID
      const userJid = this.sock.user?.id;
      if (!userJid) return null;

      // Fetch profile picture
      const ppUrl = await this.getProfilePicture(userJid);
      const name = this.sock.user?.name || "";

      return {
        jid: userJid,
        name,
        profilePicture: ppUrl,
      };
    } catch (error) {
      console.error("Error fetching current user profile:", error);
      return null;
    }
  }

  getQRCode() {
    return this.qrCode;
  }

  isConnected() {
    return this.connectionState?.connection === "open";
  }

  getCachedMessage(messageId: string) {
    return this.messageCache.get(messageId);
  }

  async markMessageAsRead(remoteJid: string, messageId: string): Promise<void> {
    if (!this.sock) {
      console.log("WhatsApp not connected, cannot mark message as read");
      return;
    }

    try {
      console.log(`Marking message ${messageId} as read for ${remoteJid}`);

      // Send read receipt using the proper format
      await this.sock.readMessages([
        {
          remoteJid: remoteJid,
          id: messageId,
          participant: undefined,
        },
      ]);

      console.log(`Message ${messageId} marked as read successfully`);
    } catch (error) {
      console.error(`Error marking message ${messageId} as read:`, error);
      throw error;
    }
  }

  async disconnect() {
    // Clear keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
  }

  private setupKeepAlive() {
    // Clear any existing interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Set up keep-alive ping every 30 seconds
    this.keepAliveInterval = setInterval(async () => {
      if (this.sock && this.connectionState.connection === "open") {
        try {
          // Only send presence update if markOnlineOnConnect is true
          if (this.settings?.markOnlineOnConnect) {
            await this.sock.sendPresenceUpdate("available");
            console.log("Keep-alive ping sent with presence update");
          } else {
            // Just send a simple ping without presence update
            // This keeps the connection alive without showing as online
            await this.sock.query({
              tag: "iq",
              attrs: {
                to: "@s.whatsapp.net",
                type: "get",
                xmlns: "w:ping",
              },
            });
            console.log("Keep-alive ping sent (no presence update)");
          }
        } catch (error) {
          console.error("Keep-alive ping failed:", error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  async applySettings(settings: any) {
    console.log("Applying WhatsApp settings:", settings);

    // Store settings internally for use during operations
    this.settings = settings;

    // Check if connected before applying settings
    if (!this.sock || this.connectionState.connection !== "open") {
      console.log(
        "WhatsApp not connected, settings saved but not applied to connection",
      );
      return;
    }

    try {
      // Apply online/presence settings
      if (settings.markOnlineOnConnect) {
        await this.sock.sendPresenceUpdate("available");
        console.log("Set presence to available");
      } else {
        await this.sock.sendPresenceUpdate("unavailable");
        console.log("Set presence to unavailable");
      }

      // Apply profile settings if available
      if (settings.profileName && this.sock.user) {
        try {
          await this.sock.updateProfileName(settings.profileName);
          console.log("Profile name updated to:", settings.profileName);
        } catch (error) {
          console.error("Error updating profile name:", error);
        }
      }

      if (settings.profileStatus) {
        try {
          await this.sock.updateProfileStatus(settings.profileStatus);
          console.log("Profile status updated to:", settings.profileStatus);
        } catch (error) {
          console.error("Error updating profile status:", error);
        }
      }
    } catch (error) {
      console.error("Error applying WhatsApp settings:", error);
    }
  }

  async updateProfilePicture(filePath: string): Promise<{ url: string }> {
    if (!this.sock) {
      throw new Error("WhatsApp not connected");
    }

    try {
      // Read file as buffer
      const fs = require("fs").promises;
      const imageBuffer = await fs.readFile(filePath);

      // Update profile picture
      await this.sock.updateProfilePicture(this.sock.user?.id!, imageBuffer);

      // Clean up temp file
      await fs.unlink(filePath).catch(() => {});

      // Return a success indicator (we don't get a URL back from WhatsApp)
      return { url: "updated" };
    } catch (error) {
      console.error("Error updating profile picture:", error);
      throw error;
    }
  }

  async getProfilePicture(jid: string): Promise<string | undefined> {
    if (!this.sock) {
      return undefined;
    }

    try {
      // Ensure JID is in the correct format
      const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;

      // Get profile picture URL
      const ppUrl = await this.sock.profilePictureUrl(formattedJid, "image");

      if (ppUrl) {
        console.log(`Profile picture found for ${formattedJid}: ${ppUrl}`);
        return ppUrl;
      }

      return undefined;
    } catch (error) {
      console.log(`Error getting profile picture for ${jid}:`, error);
      return undefined;
    }
  }

  async getContactName(phone: string): Promise<string | undefined> {
    if (!this.sock) {
      return undefined;
    }

    try {
      // Ensure phone is in the correct format
      const formattedPhone = phone.includes("@")
        ? extractPhoneFromJid(phone)
        : phone;

      // Try to get contact info from WhatsApp
      const [contact] = await this.sock.onWhatsApp(formattedPhone);
      if (contact && contact.exists) {
        // The onWhatsApp method might return the contact name in the response
        console.log(`Contact info for ${formattedPhone}:`, contact);

        // For now, return undefined as we need to receive a message from the contact
        // to get their pushName. The name will be updated when they send a message.
        return undefined;
      }

      return undefined;
    } catch (error) {
      console.log(`Error getting contact name for ${phone}:`, error);
      return undefined;
    }
  }

  // Public method to simulate incoming messages for testing
  async simulateMessage(telefone: string, mensagem: string): Promise<void> {
    console.log(`=== SIMULATING MESSAGE ===`);
    console.log(`From: ${telefone}`);
    console.log(`Message: ${mensagem}`);

    // Create a fake WhatsApp message structure
    const simulatedMessage: WhatsAppMessage = {
      id: `simulated_${Date.now()}`,
      from: telefone,
      message: mensagem,
      type: "text",
      mediaUrl: null,
      metadados: null,
      timestamp: new Date(),
    };

    // Get or create conversation
    let conversa = await storage.getConversaByTelefone(telefone);

    console.log(
      `Conversation found:`,
      conversa
        ? `ID ${conversa.id}, Mode: ${conversa.modoAtendimento}`
        : "None",
    );

    if (!conversa) {
      // Create new conversation
      console.log(`Creating new conversation for ${telefone} in bot mode`);
      conversa = await storage.createConversa({
        telefone,
        nome: telefone,
        status: "ativo",
        modoAtendimento: "bot",
        ultimaMensagem: mensagem,
        tipoUltimaMensagem: "text",
      });
    } else {
      // Update existing conversation WITHOUT forcing bot mode
      console.log(`Updating existing conversation ${conversa.id} in ${conversa.modoAtendimento} mode`);
      await storage.updateConversa(conversa.id, {
        ultimaMensagem: mensagem,
        tipoUltimaMensagem: "text",
      });
    }

    // Save the message to database
    const savedMessage = await storage.createMensagem({
      conversaId: conversa.id,
      conteudo: mensagem,
      tipo: "text",
      remetente: "cliente",
      lida: false,
      whatsappMessageId: simulatedMessage.id,
    });
    console.log(`Message saved with ID: ${savedMessage.id}`);

    // Emit the message via WebSocket to update the chat in real-time
    const messageData = {
      id: savedMessage.id,
      conversaId: conversa.id,
      conteudo: mensagem,
      tipo: "text",
      remetente: "cliente",
      timestamp: savedMessage.timestamp,
      lida: false,
      mediaUrl: null,
      metadados: null,
      deletada: false,
      deletadaEm: null,
      conteudoOriginal: null,
      editada: false,
      editadaEm: null,
      whatsappMessageId: simulatedMessage.id,
      ehRemetente: false, // This is from the client perspective
    };

    // Broadcast the message to connected clients using the proper notification method
    this.notifyWebSocketClients("whatsapp_message", messageData);
    console.log(
      `Message broadcasted via WebSocket using notifyWebSocketClients`,
    );

    // Only process through bot if conversation is in bot mode
    if (conversa.modoAtendimento === "bot") {
      console.log(`Conversation is in bot mode, processing message through bot...`);
      await this.processBot(conversa, simulatedMessage);
    } else {
      console.log(`Conversation is in ${conversa.modoAtendimento} mode, NOT processing through bot`);
    }

    console.log(`=== MESSAGE SIMULATED SUCCESSFULLY ===`);
  }

  private async logActivity(
    nivel: string,
    origem: string,
    mensagem: string,
    detalhes?: any,
  ) {
    try {
      await storage.createLog({
        nivel,
        origem,
        mensagem,
        detalhes: detalhes ? JSON.stringify(detalhes) : null,
      });
    } catch (error) {
      console.error("Erro ao criar log:", error);
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    try {
      // For now, we'll use the standard QR code approach
      // Phone number pairing requires a different authentication flow
      // that may not be fully supported by the current Baileys version

      console.log("Phone number pairing requested for:", phoneNumber);

      // Initialize standard connection
      await this.initialize();

      // Return a message indicating to use QR code for now
      await this.logActivity(
        "info",
        "WhatsApp",
        `Pareamento por número solicitado, mas usando QR code`,
      );

      return "USE_QR_CODE";
    } catch (error) {
      console.error("Error requesting pairing code:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao solicitar código de pareamento: ${error}`,
      );
      throw error;
    }
  }

  async connectWithPairingCode(
    phoneNumber: string,
    pairingCode: string,
  ): Promise<void> {
    try {
      // The pairing code connection is handled automatically by Baileys
      // when the user enters the code on their phone
      // We just need to wait for the connection update

      console.log("Attempting to connect with pairing code:", {
        phoneNumber,
        pairingCode,
      });

      // The connection will be established when the user enters the code
      // on their WhatsApp mobile app

      await this.logActivity(
        "info",
        "WhatsApp",
        `Tentando conectar com código de pareamento`,
      );
    } catch (error) {
      console.error("Error connecting with pairing code:", error);
      await this.logActivity(
        "error",
        "WhatsApp",
        `Erro ao conectar com código de pareamento: ${error}`,
      );
      throw error;
    }
  }
}

export const whatsappService = new WhatsAppService();
