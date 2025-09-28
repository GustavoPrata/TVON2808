import { db } from '../db';
import { officeAutomationConfig, discordNotificationsSent, extensionStatus } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import fetch from 'node-fetch';

export class DiscordNotificationService {
  private systemWebhookUrl: string | null = null;
  private ticketsWebhookUrl: string | null = null;
  private enabled: boolean = false;

  async initialize() {
    try {
      const config = await db.select().from(officeAutomationConfig).limit(1);
      if (config.length > 0) {
        this.systemWebhookUrl = config[0].discordWebhookUrl;
        this.ticketsWebhookUrl = config[0].discordTicketsWebhookUrl;
        this.enabled = config[0].discordNotificationsEnabled;
        console.log(`🔔 Discord inicializado - Webhook Sistemas: ${this.systemWebhookUrl ? 'Configurado' : 'Não configurado'}, Webhook Tickets: ${this.ticketsWebhookUrl ? 'Configurado' : 'Não configurado'}, Habilitado: ${this.enabled}`);
      } else {
        console.log('⚠️ Nenhuma configuração Discord encontrada');
      }
    } catch (error) {
      console.error('Erro ao inicializar serviço Discord:', error);
    }
  }

  async updateConfig(systemWebhookUrl: string | null, ticketsWebhookUrl: string | null, enabled: boolean) {
    this.systemWebhookUrl = systemWebhookUrl;
    this.ticketsWebhookUrl = ticketsWebhookUrl;
    this.enabled = enabled;
  }

  private async sendToDiscord(content: string, useTicketsWebhook: boolean = false) {
    if (!this.enabled) {
      console.log('❌ Discord desabilitado');
      return false;
    }
    
    const webhookUrl = useTicketsWebhook ? this.ticketsWebhookUrl : this.systemWebhookUrl;
    
    if (!webhookUrl) {
      console.log(`❌ Webhook ${useTicketsWebhook ? 'tickets' : 'sistemas'} não configurado`);
      return false;
    }

    try {
      console.log(`📤 Enviando para Discord ${useTicketsWebhook ? 'Tickets' : 'Sistemas'}:`, content);
      console.log(`📌 Webhook URL: ${webhookUrl.substring(0, 50)}...`);
      
      const payload = {
        content: content
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(`📬 Resposta Discord: Status ${response.status}, OK: ${response.ok}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro Discord: ${errorText}`);
      }
      
      return response.ok;
    } catch (error) {
      console.error('❌ Erro ao enviar notificação Discord:', error);
      return false;
    }
  }

  private async canSendNotification(type: string, entityId: string): Promise<boolean> {
    try {
      // Verificar se já existe uma notificação não expirada
      const existing = await db
        .select()
        .from(discordNotificationsSent)
        .where(
          and(
            eq(discordNotificationsSent.notificationType, type),
            eq(discordNotificationsSent.entityId, entityId),
            gte(discordNotificationsSent.expiresAt, new Date())
          )
        );

      return existing.length === 0;
    } catch (error) {
      console.error('Erro ao verificar notificação:', error);
      return false;
    }
  }

  private async recordNotification(type: string, entityId: string, message: string, expiresInMinutes: number = 60) {
    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      
      await db.insert(discordNotificationsSent).values({
        notificationType: type,
        entityId: entityId,
        message: message,
        expiresAt: expiresAt,
        metadata: {},
      });
    } catch (error) {
      console.error('Erro ao registrar notificação:', error);
    }
  }

  async notifySystemExpiring(systemId: string, username: string, minutesUntilExpiry: number) {
    const notificationType = 'system_expiring';
    
    if (!await this.canSendNotification(notificationType, systemId)) {
      return false;
    }

    const message = `⚠️ Sistema vencendo em ${minutesUntilExpiry} minutos`;

    const sent = await this.sendToDiscord(message);
    
    if (sent) {
      // Registrar notificação com expiração de 10 minutos
      await this.recordNotification(notificationType, systemId, message, 10);
    }

    return sent;
  }

  async notifyExtensionOffline() {
    const notificationType = 'extension_offline';
    
    console.log(`🔔 Tentando enviar notificação Discord: Extensão offline`);
    console.log(`   Webhook: ${this.systemWebhookUrl ? 'Configurado' : 'Não configurado'}`);
    console.log(`   Habilitado: ${this.enabled}`);
    
    if (!await this.canSendNotification(notificationType, 'extension')) {
      console.log(`   ⚠️ Notificação já enviada recentemente, ignorando...`);
      return false;
    }

    try {
      // Verificar status da extensão
      const status = await db.select().from(extensionStatus).limit(1);
      const extensionData = status[0];
      
      // Se não está ativa ou não está logada
      if (!extensionData || !extensionData.isActive || !extensionData.isLoggedIn) {
        const message = `🔴 Extensão offline`;

        const sent = await this.sendToDiscord(message);
        console.log(`   Resultado do envio: ${sent ? '✅ Enviado' : '❌ Falhou'}`);
        
        if (sent) {
          // Registrar notificação com expiração de 5 minutos (aumentado de 2)
          await this.recordNotification(notificationType, 'extension', message, 5);
        }

        return sent;
      }
    } catch (error) {
      console.error('Erro ao verificar extensão:', error);
    }

    return false;
  }

  async notifyExtensionStuck() {
    const notificationType = 'extension_stuck';
    
    if (!await this.canSendNotification(notificationType, 'extension')) {
      return false;
    }

    try {
      const status = await db.select().from(extensionStatus).limit(1);
      const extensionData = status[0];
      
      if (extensionData && extensionData.isActive && extensionData.isLoggedIn) {
        // Verificar se está travada no login (URL contém login mas está marcada como logada)
        if (extensionData.currentUrl && extensionData.currentUrl.includes('login')) {
          const message = `⚠️ Extensão travada no login`;

          const sent = await this.sendToDiscord(message);
          
          if (sent) {
            // Registrar notificação com expiração de 2 minutos
            await this.recordNotification(notificationType, 'extension', message, 2);
          }

          return sent;
        }
      }
    } catch (error) {
      console.error('Erro ao verificar se extensão está travada:', error);
    }

    return false;
  }

  async notifySystemExpired(systemId: string, username: string, clientName?: string) {
    const notificationType = 'system_expired';
    
    if (!await this.canSendNotification(notificationType, systemId)) {
      return false;
    }

    const message = `❌ Sistema expirado`;

    const sent = await this.sendToDiscord(message);
    
    if (sent) {
      // Registrar notificação com expiração de 30 minutos
      await this.recordNotification(notificationType, systemId, message, 30);
    }

    return sent;
  }

  async notifyTicketOpened(clientName: string | null, ticketTitle: string) {
    // Para tickets não usamos limitação de frequência, sempre enviamos
    // Formato simples de mensagem
    const clientInfo = clientName || 'Não identificado';
    const message = `🎫 Novo ticket: ${clientInfo} - ${ticketTitle}`;

    // Usar webhook de tickets (segundo parâmetro true)
    const sent = await this.sendToDiscord(message, true);
    
    if (sent) {
      console.log(`🎫 Notificação de ticket enviada: ${clientInfo} - ${ticketTitle}`);
    }
    
    return sent;
  }
}

// Instância singleton
export const discordNotificationService = new DiscordNotificationService();