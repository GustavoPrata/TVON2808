import { db } from '../db';
import { officeAutomationConfig, discordNotificationsSent, extensionStatus } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import fetch from 'node-fetch';

export class DiscordNotificationService {
  private webhookUrl: string | null = null;
  private enabled: boolean = false;

  async initialize() {
    try {
      const config = await db.select().from(officeAutomationConfig).limit(1);
      if (config.length > 0) {
        this.webhookUrl = config[0].discordWebhookUrl;
        this.enabled = config[0].discordNotificationsEnabled;
      }
    } catch (error) {
      console.error('Erro ao inicializar serviço Discord:', error);
    }
  }

  async updateConfig(webhookUrl: string | null, enabled: boolean) {
    this.webhookUrl = webhookUrl;
    this.enabled = enabled;
  }

  private async sendToDiscord(content: string) {
    if (!this.enabled || !this.webhookUrl) {
      return false;
    }

    try {
      const payload = {
        content: content
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('Erro ao enviar notificação Discord:', error);
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
      // Registrar notificação com expiração de 6 horas
      await this.recordNotification(notificationType, systemId, message, 360);
    }

    return sent;
  }

  async notifyExtensionOffline() {
    const notificationType = 'extension_offline';
    
    if (!await this.canSendNotification(notificationType, 'extension')) {
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
        
        if (sent) {
          // Registrar notificação com expiração de 30 minutos
          await this.recordNotification(notificationType, 'extension', message, 30);
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
            // Registrar notificação com expiração de 1 hora
            await this.recordNotification(notificationType, 'extension', message, 60);
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
      // Registrar notificação com expiração de 24 horas
      await this.recordNotification(notificationType, systemId, message, 1440);
    }

    return sent;
  }
}

// Instância singleton
export const discordNotificationService = new DiscordNotificationService();