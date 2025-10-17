import { whatsappService, WhatsAppMessage } from "./whatsapp";
import { storage } from "../storage";
import { pixService } from "./pix";
import { externalApiService } from "./externalApi";
import { notificationService } from "./notifications";
import { clientes, testes, conversas, pontos } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

// Conversation state interface
interface ConversationState {
  submenu?: string;
  lastActivity?: Date;
  previousMenu?: string;
  data?: any;
}

// Map to store conversation states
const conversationStates = new Map<string, ConversationState>();

class WhatsAppBot {
  private isInitialized = false;

  constructor() {
    console.log("🤖 WhatsApp Bot initialized");
  }

  // Initialize the bot and register handlers
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("⚠️ WhatsApp Bot already initialized");
      return;
    }

    console.log("🤖 Initializing WhatsApp Bot...");

    // Register message handler with WhatsApp service
    whatsappService.on("new_message", async (message: WhatsAppMessage) => {
      await this.handleMessage(message);
    });

    // Add conversation state methods to WhatsApp service
    this.attachConversationStateMethods();

    this.isInitialized = true;
    console.log("✅ WhatsApp Bot initialized successfully");
  }

  // Attach conversation state methods to WhatsApp service
  private attachConversationStateMethods(): void {
    // Add setConversationState method
    (whatsappService as any).setConversationState = (phoneNumber: string, state: ConversationState) => {
      conversationStates.set(phoneNumber, state);
      console.log(`📝 Conversation state set for ${phoneNumber}:`, state);
    };

    // Add resetConversationState method
    (whatsappService as any).resetConversationState = (phoneNumber: string) => {
      conversationStates.delete(phoneNumber);
      console.log(`🗑️ Conversation state reset for ${phoneNumber}`);
    };

    // Add getConversationState method
    (whatsappService as any).getConversationState = (phoneNumber: string): ConversationState | undefined => {
      return conversationStates.get(phoneNumber);
    };

    console.log("✅ Conversation state methods attached to WhatsApp service");
  }

  // Main message handler
  async handleMessage(message: WhatsAppMessage): Promise<void> {
    try {
      const { from, text, pushName } = message;
      
      // Normalize phone number
      const phoneNumber = from.replace("@s.whatsapp.net", "");
      
      console.log(`📨 Received message from ${phoneNumber} (${pushName}): ${text}`);

      // Get or create conversation
      let conversa = await storage.getConversaByTelefone(phoneNumber);
      if (!conversa) {
        conversa = await storage.createConversa({
          telefone: phoneNumber,
          nome: pushName || "Cliente",
        });
      }

      // Save message to database
      await storage.createMensagem({
        conversaId: conversa.id,
        tipo: "recebida",
        conteudo: text,
        remetente: phoneNumber,
      });

      // Check if conversation is in bot mode
      const tickets = await storage.getTicketsByConversaId(conversa.id);
      const activeTicket = tickets.find(t => t.status === "aberto" || t.status === "em_andamento");
      
      // Skip bot if there's an active ticket (human mode)
      if (activeTicket) {
        console.log(`📋 Conversation ${phoneNumber} has active ticket, skipping bot`);
        return;
      }

      // Get conversation state
      const state = conversationStates.get(phoneNumber);

      // Process the message based on state
      await this.processMessage(phoneNumber, text, state, conversa);

    } catch (error) {
      console.error("❌ Error handling WhatsApp message:", error);
    }
  }

  // Process message based on conversation state
  private async processMessage(
    phoneNumber: string,
    text: string,
    state: ConversationState | undefined,
    conversa: any
  ): Promise<void> {
    const normalizedText = text.toLowerCase().trim();

    // Handle menu navigation
    if (state?.submenu === "teste_expirado_menu") {
      await this.handleTesteExpiradoMenu(phoneNumber, normalizedText);
      return;
    }

    if (state?.submenu === "cliente_menu") {
      await this.handleClienteMenu(phoneNumber, normalizedText, conversa);
      return;
    }

    if (state?.submenu === "teste_menu") {
      await this.handleTesteMenu(phoneNumber, normalizedText, conversa);
      return;
    }

    // Check for keywords and main menu
    if (normalizedText === "menu" || normalizedText === "0") {
      await this.sendMainMenu(phoneNumber, conversa);
      return;
    }

    // Handle main menu options
    if (normalizedText === "1" || normalizedText.includes("cliente")) {
      await this.handleClienteOption(phoneNumber, conversa);
      return;
    }

    if (normalizedText === "2" || normalizedText.includes("teste")) {
      await this.handleTesteOption(phoneNumber, conversa);
      return;
    }

    if (normalizedText === "3" || normalizedText.includes("suporte") || normalizedText.includes("atendente")) {
      await this.handleSupportOption(phoneNumber, conversa);
      return;
    }

    // Check for automated responses from bot config
    const botConfig = await storage.getBotConfig();
    for (const config of botConfig) {
      if (config.ativo) {
        // Check if message matches any configured trigger
        // For now, just send welcome message if no specific menu matched
        // We can expand this later with more sophisticated matching
        console.log(`Bot config ${config.tipo} is active`);
      }
    }

    // Default response - send main menu
    await this.sendMainMenu(phoneNumber, conversa);
  }

  // Send main menu
  private async sendMainMenu(phoneNumber: string, conversa: any): Promise<void> {
    const menuText = `📱 *Menu Principal*
Escolha uma das opções abaixo:

1️⃣ Menu Cliente
2️⃣ Solicitar Teste
3️⃣ Falar com Atendente

Digite o número da opção desejada`;

    await whatsappService.sendMessage(phoneNumber, menuText);
    
    // Clear conversation state
    conversationStates.delete(phoneNumber);
  }

  // Handle expired test menu
  private async handleTesteExpiradoMenu(phoneNumber: string, text: string): Promise<void> {
    if (text === "1") {
      // Activate plan
      await whatsappService.sendMessage(
        phoneNumber,
        `💳 *Ativação de Plano*\n\n` +
        `Para ativar seu plano, faça o PIX de R$ 19,90 para:\n\n` +
        `📱 Chave PIX: tvon@sistema.com\n\n` +
        `Após o pagamento, envie o comprovante aqui e seu plano será ativado automaticamente!`
      );
      
      // Set state to wait for payment
      conversationStates.set(phoneNumber, {
        submenu: "aguardando_pagamento",
        lastActivity: new Date(),
      });
    } else if (text === "2") {
      // Contact support
      await this.handleSupportOption(phoneNumber, null);
    } else {
      // Invalid option
      await whatsappService.sendMessage(
        phoneNumber,
        `❌ Opção inválida! Por favor, escolha:\n\n` +
        `1️⃣ Ativar plano agora\n` +
        `2️⃣ Falar com um atendente`
      );
    }
  }

  // Handle client menu
  private async handleClienteMenu(phoneNumber: string, text: string, conversa: any): Promise<void> {
    if (text === "1") {
      // Show client info
      const cliente = conversa.clienteId 
        ? await storage.getClienteById(conversa.clienteId)
        : null;

      if (cliente) {
        const pontosList = await storage.getPontosByClienteId(cliente.id);
        const pontosInfo = pontosList.map(p => `• ${p.usuario}`).join("\n");

        await whatsappService.sendMessage(
          phoneNumber,
          `👤 *Informações do Cliente*\n\n` +
          `Nome: ${cliente.nome}\n` +
          `Status: ${cliente.status}\n` +
          `Vencimento: ${cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString("pt-BR") : "N/A"}\n\n` +
          `📍 Seus Pontos:\n${pontosInfo || "Nenhum ponto cadastrado"}`
        );
      } else {
        await whatsappService.sendMessage(
          phoneNumber,
          `❌ Cliente não encontrado. Entre em contato com o suporte.`
        );
      }
    } else if (text === "2") {
      // Payment options
      await whatsappService.sendMessage(
        phoneNumber,
        `💳 *Opções de Pagamento*\n\n` +
        `PIX: tvon@sistema.com\n` +
        `Valor mensal: R$ 19,90\n\n` +
        `Após o pagamento, envie o comprovante aqui.`
      );
    } else if (text === "3" || text === "0") {
      // Back to main menu
      await this.sendMainMenu(phoneNumber, conversa);
    } else {
      // Invalid option
      await whatsappService.sendMessage(
        phoneNumber,
        `❌ Opção inválida! Digite:\n` +
        `1 - Ver minhas informações\n` +
        `2 - Formas de pagamento\n` +
        `0 - Voltar ao menu principal`
      );
    }
  }

  // Handle test menu
  private async handleTesteMenu(phoneNumber: string, text: string, conversa: any): Promise<void> {
    if (text === "1") {
      // Request test
      const existingTeste = await db
        .select()
        .from(testes)
        .where(eq(testes.telefone, phoneNumber))
        .limit(1);

      if (existingTeste.length > 0 && existingTeste[0].status === "ativo") {
        await whatsappService.sendMessage(
          phoneNumber,
          `⚠️ Você já possui um teste ativo!\n\n` +
          `Aproveite seu teste até o vencimento.`
        );
      } else {
        // Create new test
        await storage.createTeste({
          telefone: phoneNumber,
          aplicativo: "TV ON",
          dispositivo: "mobile",
          mac: "",
          deviceKey: "",
          duracaoHoras: 24,
          expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await whatsappService.sendMessage(
          phoneNumber,
          `✅ *Teste Solicitado!*\n\n` +
          `Seu teste será ativado em breve.\n` +
          `Você receberá os dados de acesso aqui no WhatsApp.`
        );
      }
    } else if (text === "2" || text === "0") {
      // Back to main menu
      await this.sendMainMenu(phoneNumber, conversa);
    } else {
      // Invalid option
      await whatsappService.sendMessage(
        phoneNumber,
        `❌ Opção inválida! Digite:\n` +
        `1 - Solicitar teste grátis\n` +
        `0 - Voltar ao menu principal`
      );
    }
  }

  // Handle client option
  private async handleClienteOption(phoneNumber: string, conversa: any): Promise<void> {
    const menuText = `👤 *Menu Cliente*

1 - Ver minhas informações
2 - Formas de pagamento  
0 - Voltar ao menu principal

Digite o número da opção desejada`;

    await whatsappService.sendMessage(phoneNumber, menuText);
    
    // Set conversation state
    conversationStates.set(phoneNumber, {
      submenu: "cliente_menu",
      lastActivity: new Date(),
      previousMenu: "main",
    });
  }

  // Handle test option
  private async handleTesteOption(phoneNumber: string, conversa: any): Promise<void> {
    const menuText = `🎮 *Menu Teste*

1 - Solicitar teste grátis
0 - Voltar ao menu principal

Digite o número da opção desejada`;

    await whatsappService.sendMessage(phoneNumber, menuText);
    
    // Set conversation state
    conversationStates.set(phoneNumber, {
      submenu: "teste_menu",
      lastActivity: new Date(),
      previousMenu: "main",
    });
  }

  // Handle support option
  private async handleSupportOption(phoneNumber: string, conversa: any): Promise<void> {
    // Create or update ticket to human mode
    if (conversa) {
      const tickets = await storage.getTicketsByConversaId(conversa.id);
      let activeTicket = tickets.find(t => t.status === "aberto" || t.status === "em_andamento");

      if (!activeTicket) {
        // Create new ticket
        await storage.createTicket({
          conversaId: conversa.id,
          clienteId: conversa.clienteId,
          titulo: "Solicitação de Atendimento",
          descricao: "Cliente solicitou atendimento humano",
          prioridade: "media",
          status: "aberto",
        });
      } else {
        // Update existing ticket status
        await storage.updateTicket(activeTicket.id, {
          status: "em_andamento",
        });
      }
    }

    await whatsappService.sendMessage(
      phoneNumber,
      `👨‍💼 *Atendimento Humano*\n\n` +
      `Você será atendido por um de nossos atendentes em breve.\n` +
      `Horário de atendimento: Segunda a Sexta, 9h às 18h.`
    );

    // Clear conversation state
    conversationStates.delete(phoneNumber);
  }

  // Clean up old conversation states (call periodically)
  cleanupOldStates(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    conversationStates.forEach((state, phoneNumber) => {
      if (state.lastActivity) {
        const age = now.getTime() - state.lastActivity.getTime();
        if (age > maxAge) {
          conversationStates.delete(phoneNumber);
          console.log(`🧹 Cleaned up old conversation state for ${phoneNumber}`);
        }
      }
    });
  }
}

// Create and export singleton instance
const whatsappBot = new WhatsAppBot();
export default whatsappBot;
export { whatsappBot, ConversationState };