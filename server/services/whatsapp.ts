// WhatsApp Service TypeScript Wrapper
// This wraps the JavaScript module to avoid ESM/CommonJS compatibility issues

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WhatsAppModule = require("./whatsapp-module.js");

export interface WhatsAppMessage {
  key: any;
  message: any;
  pushName?: string;
  messageTimestamp?: number;
  from: string;
  text: string;
  type: string;
  isGroup: boolean;
  media?: {
    buffer: Buffer;
    mimetype: string;
  };
}

export interface WhatsAppStatus {
  isConnected: boolean;
  isConnecting: boolean;
  qr: string | null;
  userProfile?: any;
  queueSize?: number;
}

class WhatsAppService {
  private module: any;
  private static instance: WhatsAppService | null = null;

  constructor() {
    console.log("🚀 WhatsApp Service Constructor Called");
    this.module = new WhatsAppModule();
  }

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.module.initialize();
    } catch (error) {
      console.error("Error initializing WhatsApp:", error);
      throw error;
    }
  }

  async sendMessage(to: string, content: any, options: any = {}): Promise<any> {
    return this.module.sendMessage(to, content, options);
  }

  async sendTextMessage(to: string, text: string): Promise<any> {
    return this.sendMessage(to, text);
  }

  async sendMediaMessage(to: string, media: Buffer, mimetype: string, caption?: string): Promise<any> {
    if (mimetype.startsWith("image/")) {
      return this.sendMessage(to, {
        image: media,
        caption: caption || ""
      });
    } else if (mimetype.startsWith("audio/")) {
      return this.sendMessage(to, {
        audio: media
      });
    } else if (mimetype.startsWith("video/")) {
      return this.sendMessage(to, {
        video: media,
        caption: caption || ""
      });
    } else {
      return this.sendMessage(to, {
        document: media,
        fileName: "document",
        mimetype
      });
    }
  }

  async markAsRead(jid: string, messageIds: string[]): Promise<void> {
    await this.module.markAsRead(jid, messageIds);
  }

  async getProfilePicture(jid: string): Promise<string | null> {
    return this.module.getProfilePicture(jid);
  }

  async checkNumberExists(number: string): Promise<boolean> {
    return this.module.checkNumberExists(number);
  }

  getStatus(): WhatsAppStatus {
    return this.module.getStatus();
  }

  async disconnect(): Promise<void> {
    await this.module.disconnect();
  }

  async deleteAuthInfo(): Promise<boolean> {
    return this.module.deleteAuthInfo();
  }

  onMessage(handler: (message: WhatsAppMessage) => void): () => void {
    return this.module.onMessage(handler);
  }

  onStatusChange(handler: (status: WhatsAppStatus) => void): () => void {
    return this.module.onStatusChange(handler);
  }

  formatPhoneNumber(number: string): string {
    return this.module.formatPhoneNumber(number);
  }

  get isConnected(): boolean {
    const status = this.getStatus();
    return status.isConnected;
  }

  get isConnecting(): boolean {
    const status = this.getStatus();
    return status.isConnecting;
  }

  get qr(): string | null {
    const status = this.getStatus();
    return status.qr;
  }

  get sock(): any {
    return this.module.sock;
  }
}

// Create and export singleton instance
const whatsappService = WhatsAppService.getInstance();
export default whatsappService;
export { whatsappService };