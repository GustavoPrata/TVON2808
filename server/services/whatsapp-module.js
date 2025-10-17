const { Boom } = require("@hapi/boom");
const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  isJidBroadcast,
  isJidStatusBroadcast,
  downloadMediaMessage,
  proto
} = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs").promises;
const { db } = require("../db");
const qrcode = require("qrcode");
const pino = require("pino");

class WhatsAppModule {
  constructor() {
    this.sock = null;
    this.qr = null;
    this.isConnecting = false;
    this.userProfile = null;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectRetries = 5;
    this.reconnectDelay = 5000;
    this.settings = null;
    this.authState = null;
    this.saveCreds = null;
    this.messageHandlers = new Set();
    this.statusHandlers = new Set();
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  emitMessage(message) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  emitStatusChange(status) {
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error("Error in status handler:", error);
      }
    });
  }

  async initialize() {
    try {
      console.log("📱 Starting WhatsApp initialization...");
      
      if (this.isConnecting) {
        console.log("⚠️ WhatsApp já está conectando...");
        return;
      }

      this.isConnecting = true;
      this.qr = null;

      const authDir = path.join(process.cwd(), "auth_info_baileys");
      console.log("📂 Creating auth directory...");
      await fs.mkdir(authDir, { recursive: true });
      console.log("✅ Auth directory ready");

      await this.loadSettings();

      console.log("🔐 Loading authentication state...");
      const authState = await useMultiFileAuthState(authDir);
      this.authState = authState.state;
      this.saveCreds = authState.saveCreds;
      console.log("✅ Authentication state loaded");

      console.log("🔌 Creating WhatsApp socket connection...");
      
      const logger = pino({
        level: this.settings?.logLevel || "silent"
      });

      this.sock = makeWASocket({
        auth: this.authState,
        printQRInTerminal: false,
        logger,
        browser: ["TV ON Sistema", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: this.settings?.markOnlineOnConnect ?? true,
        getMessage: async (key) => {
          return { conversation: "placeholder" };
        }
      });

      this.setupEventHandlers();
      this.reconnectAttempts = 0;
      
      return true;
    } catch (error) {
      console.error("❌ Erro ao inicializar WhatsApp:", error);
      console.error("Stack trace:", error.stack);
      this.isConnecting = false;
      
      if (this.reconnectAttempts < this.maxReconnectRetries) {
        console.log(`🔄 Retrying WhatsApp initialization in ${this.reconnectDelay / 1000} seconds...`);
        setTimeout(() => this.initialize(), this.reconnectDelay);
        this.reconnectAttempts++;
      }
      
      throw error;
    }
  }

  async loadSettings() {
    try {
      console.log("🔧 Loading WhatsApp settings from database...");
      const settings = await db.query.whatsappSettings.findFirst();
      
      if (settings) {
        this.settings = settings;
        console.log("✅ Loaded WhatsApp settings from database:", {
          ...settings,
          profilePicture: settings.profilePicture ? "[SET]" : "[NOT SET]"
        });

        this.maxReconnectRetries = settings.maxReconnectRetries || 5;
        this.reconnectDelay = settings.reconnectInterval || 5000;
      } else {
        console.log("⚠️ No WhatsApp settings found, using defaults");
        this.settings = {
          markOnlineOnConnect: true,
          markMessagesRead: true,
          sendReadReceipts: true,
          autoDownloadMedia: true,
          autoDownloadDocuments: true,
          saveChatHistory: true,
          fetchClientPhotos: true,
          cacheClientPhotos: true,
          showClientStatus: true,
          showProfilePhotosChat: true,
          showProfilePhotosClientes: false,
          reconnectInterval: 5000,
          maxReconnectRetries: 5,
          logLevel: "info"
        };
      }
    } catch (error) {
      console.error("❌ Error loading WhatsApp settings:", error);
    }
  }

  setupEventHandlers() {
    if (!this.sock) return;

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 QR Code recebido");
        try {
          this.qr = await qrcode.toDataURL(qr);
          this.emitStatusChange({
            isConnected: false,
            isConnecting: true,
            qr: this.qr
          });
        } catch (error) {
          console.error("❌ Erro ao gerar QR Code:", error);
        }
      }

      if (connection === "close") {
        console.log("❌ Conexão fechada");
        const shouldReconnect = 
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log("🔄 Tentando reconectar...");
          this.isConnecting = false;
          setTimeout(() => this.initialize(), this.reconnectDelay);
        } else {
          console.log("📴 Desconectado permanentemente");
          this.cleanup();
        }

        this.emitStatusChange({
          isConnected: false,
          isConnecting: false,
          qr: null
        });
      }

      if (connection === "open") {
        console.log("✅ WhatsApp conectado com sucesso!");
        this.isConnecting = false;
        this.qr = null;
        
        this.userProfile = {
          id: this.sock.user?.id,
          name: this.sock.user?.name || this.sock.user?.verifiedName,
          phoneNumber: this.sock.user?.id?.replace("@s.whatsapp.net", "")
        };

        await this.applySettings();
        
        this.emitStatusChange({
          isConnected: true,
          isConnecting: false,
          qr: null,
          userProfile: this.userProfile
        });

        this.processMessageQueue();
      }

      if (connection === "connecting") {
        console.log("🔄 Conectando ao WhatsApp...");
        this.emitStatusChange({
          isConnected: false,
          isConnecting: true,
          qr: this.qr
        });
      }
    });

    this.sock.ev.on("creds.update", async () => {
      if (this.saveCreds) {
        await this.saveCreds();
      }
    });

    this.sock.ev.on("messages.upsert", async (m) => {
      try {
        const messages = m.messages;
        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          
          const from = msg.key.remoteJid;
          if (!from || isJidBroadcast(from) || isJidStatusBroadcast(from)) {
            continue;
          }

          await this.handleIncomingMessage(msg);
        }
      } catch (error) {
        console.error("❌ Erro ao processar mensagem:", error);
      }
    });

    this.sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        if (update.update?.status) {
          console.log(`📨 Status da mensagem ${update.key.id}: ${update.update.status}`);
        }
      }
    });
  }

  async handleIncomingMessage(msg) {
    try {
      const messageData = {
        key: msg.key,
        message: msg.message,
        pushName: msg.pushName,
        messageTimestamp: msg.messageTimestamp,
        from: msg.key.remoteJid,
        text: msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || 
              msg.message?.imageMessage?.caption || 
              msg.message?.videoMessage?.caption || 
              "",
        type: Object.keys(msg.message || {})[0],
        isGroup: msg.key.remoteJid?.endsWith("@g.us"),
        media: null
      };

      if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.documentMessage) {
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          messageData.media = {
            buffer,
            mimetype: msg.message.imageMessage?.mimetype || 
                     msg.message.videoMessage?.mimetype || 
                     msg.message.audioMessage?.mimetype || 
                     msg.message.documentMessage?.mimetype
          };
        } catch (error) {
          console.error("❌ Erro ao baixar mídia:", error);
        }
      }

      this.emitMessage(messageData);
    } catch (error) {
      console.error("❌ Erro ao processar mensagem:", error);
    }
  }

  async sendMessage(to, content, options = {}) {
    try {
      if (!this.sock || this.sock.ws.readyState !== 1) {
        console.log("⚠️ WhatsApp não conectado, adicionando à fila...");
        this.messageQueue.push({ to, content, options });
        return null;
      }

      const jid = this.formatPhoneNumber(to);
      
      let message;
      if (typeof content === "string") {
        message = { text: content };
      } else if (content.image) {
        message = {
          image: content.image,
          caption: content.caption
        };
      } else if (content.audio) {
        message = {
          audio: content.audio,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      } else if (content.document) {
        message = {
          document: content.document,
          fileName: content.fileName || "document",
          mimetype: content.mimetype || "application/octet-stream"
        };
      } else {
        message = content;
      }

      const result = await this.sock.sendMessage(jid, message, options);
      console.log("✅ Mensagem enviada:", result.key.id);
      return result;
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      throw error;
    }
  }

  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`📤 Processando fila de mensagens (${this.messageQueue.length} mensagens)...`);

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      try {
        await this.sendMessage(msg.to, msg.content, msg.options);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("❌ Erro ao processar mensagem da fila:", error);
      }
    }

    this.isProcessingQueue = false;
    console.log("✅ Fila de mensagens processada");
  }

  formatPhoneNumber(number) {
    const cleaned = number.toString().replace(/\D/g, "");
    
    if (cleaned.startsWith("55") && cleaned.length === 13) {
      const ddd = cleaned.substring(2, 4);
      const numero = cleaned.substring(4);
      
      if (numero.length === 9 && numero[0] === "9") {
        return `${cleaned}@s.whatsapp.net`;
      } else if (numero.length === 8) {
        return `${cleaned.substring(0, 4)}9${numero}@s.whatsapp.net`;
      }
    }
    
    return `${cleaned}@s.whatsapp.net`;
  }

  async applySettings() {
    if (!this.sock || !this.settings) return;

    try {
      console.log("⚙️ Aplicando configurações do WhatsApp...");
      
      if (this.settings.profileName && this.sock.user) {
        await this.sock.updateProfileName(this.settings.profileName);
      }
      
      if (this.settings.profileStatus) {
        await this.sock.updateProfileStatus(this.settings.profileStatus);
      }

      if (this.settings.profilePicture) {
        try {
          await this.sock.updateProfilePicture(this.sock.user.id, this.settings.profilePicture);
        } catch (error) {
          console.error("❌ Erro ao atualizar foto de perfil:", error);
        }
      }

      if (this.settings.markMessagesRead) {
        console.log("✅ Marcação automática de mensagens como lidas ativada");
      }

      if (this.settings.sendReadReceipts !== undefined) {
        await this.sock.sendReceipts([], [], this.settings.sendReadReceipts ? "read" : "played");
      }

      console.log("✅ Configurações aplicadas com sucesso");
    } catch (error) {
      console.error("❌ Erro ao aplicar configurações:", error);
    }
  }

  async markAsRead(jid, messageIds) {
    if (!this.sock || !this.settings?.markMessagesRead) return;

    try {
      await this.sock.readMessages([{
        remoteJid: this.formatPhoneNumber(jid),
        id: messageIds
      }]);
      console.log(`✅ Mensagens marcadas como lidas para ${jid}`);
    } catch (error) {
      console.error("❌ Erro ao marcar mensagens como lidas:", error);
    }
  }

  async getProfilePicture(jid) {
    if (!this.sock) return null;

    try {
      const url = await this.sock.profilePictureUrl(this.formatPhoneNumber(jid), "image");
      return url;
    } catch (error) {
      console.error("❌ Erro ao obter foto de perfil:", error);
      return null;
    }
  }

  async checkNumberExists(number) {
    if (!this.sock) return false;

    try {
      const jid = this.formatPhoneNumber(number);
      const [result] = await this.sock.onWhatsApp(jid.replace("@s.whatsapp.net", ""));
      return result?.exists || false;
    } catch (error) {
      console.error("❌ Erro ao verificar número:", error);
      return false;
    }
  }

  getStatus() {
    return {
      isConnected: this.sock?.ws?.readyState === 1,
      isConnecting: this.isConnecting,
      qr: this.qr,
      userProfile: this.userProfile,
      queueSize: this.messageQueue.length
    };
  }

  async disconnect() {
    try {
      console.log("📴 Desconectando WhatsApp...");
      
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      if (this.sock) {
        this.sock.end();
        this.sock = null;
      }

      this.cleanup();
      console.log("✅ WhatsApp desconectado");
    } catch (error) {
      console.error("❌ Erro ao desconectar:", error);
    }
  }

  cleanup() {
    this.sock = null;
    this.qr = null;
    this.isConnecting = false;
    this.userProfile = null;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.reconnectAttempts = 0;
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }

  async deleteAuthInfo() {
    try {
      console.log("🗑️ Deletando informações de autenticação...");
      const authDir = path.join(process.cwd(), "auth_info_baileys");
      await fs.rmdir(authDir, { recursive: true });
      console.log("✅ Informações de autenticação deletadas");
      this.cleanup();
      return true;
    } catch (error) {
      console.error("❌ Erro ao deletar informações de autenticação:", error);
      return false;
    }
  }
}

module.exports = WhatsAppModule;