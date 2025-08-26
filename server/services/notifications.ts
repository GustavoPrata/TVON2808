import { storage } from '../storage';
import { whatsappService } from './whatsapp';
import cron from 'node-cron';

export class NotificationService {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeScheduledNotifications();
  }

  private async initializeScheduledNotifications() {
    try {
      // Notificações de vencimento - verificar diariamente às 9h
      cron.schedule('0 9 * * *', async () => {
        await this.checkExpiringClients();
      });

      // Notificações de pagamento - verificar a cada hora
      cron.schedule('0 * * * *', async () => {
        await this.checkPaymentNotifications();
      });

      await this.logActivity('info', 'Serviço de notificações inicializado');
    } catch (error) {
      console.error('Erro ao inicializar notificações:', error);
      await this.logActivity('error', `Erro ao inicializar notificações: ${error}`);
    }
  }

  private async checkExpiringClients() {
    try {
      const notificationConfig = await storage.getNotificacaoConfigByTipo('vencimento');
      if (!notificationConfig || !notificationConfig.ativo) return;

      const diasAntes = notificationConfig.diasAntes || 3;
      const clientesVencendo = await storage.getVencimentosProximos(diasAntes);

      for (const cliente of clientesVencendo) {
        const vencimento = new Date(cliente.vencimento!);
        const hoje = new Date();
        const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes <= diasAntes && diasRestantes > 0) {
          await this.sendExpirationNotification(cliente, diasRestantes, notificationConfig.mensagem);
        }
      }

      await this.logActivity('info', `Verificação de vencimentos executada - ${clientesVencendo.length} clientes verificados`);
    } catch (error) {
      console.error('Erro ao verificar vencimentos:', error);
      await this.logActivity('error', `Erro ao verificar vencimentos: ${error}`);
    }
  }

  private async sendExpirationNotification(cliente: any, diasRestantes: number, templateMessage: string) {
    try {
      const mensagem = templateMessage
        .replace('{nome}', cliente.nome)
        .replace('{dias}', diasRestantes.toString())
        .replace('{vencimento}', new Date(cliente.vencimento).toLocaleDateString('pt-BR'));

      const sucesso = await whatsappService.sendMessage(cliente.telefone, mensagem);
      
      if (sucesso) {
        await this.logActivity('info', `Notificação de vencimento enviada para ${cliente.nome}`);
      } else {
        await this.logActivity('error', `Falha ao enviar notificação para ${cliente.nome}`);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de vencimento:', error);
      await this.logActivity('error', `Erro ao enviar notificação: ${error}`);
    }
  }

  private async checkPaymentNotifications() {
    try {
      const notificationConfig = await storage.getNotificacaoConfigByTipo('pagamento');
      if (!notificationConfig || !notificationConfig.ativo) return;

      // Verificar pagamentos pendentes que expiraram
      const pagamentos = await storage.getPagamentosByClienteId(0);
      const pagamentosExpirados = pagamentos.filter(p => 
        p.status === 'pendente' && 
        p.dataVencimento && 
        new Date(p.dataVencimento) < new Date()
      );

      for (const pagamento of pagamentosExpirados) {
        await storage.updatePagamento(pagamento.id, { status: 'cancelado' });
        
        const cliente = await storage.getClienteById(pagamento.clienteId);
        if (cliente) {
          await whatsappService.sendMessage(
            cliente.telefone,
            `Olá ${cliente.nome}! Seu pagamento PIX expirou. Entre em contato para gerar um novo.`
          );
        }
      }

      await this.logActivity('info', `Verificação de pagamentos executada - ${pagamentosExpirados.length} pagamentos expirados`);
    } catch (error) {
      console.error('Erro ao verificar pagamentos:', error);
      await this.logActivity('error', `Erro ao verificar pagamentos: ${error}`);
    }
  }

  async sendWelcomeMessage(clienteId: number) {
    try {
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) return;

      const notificationConfig = await storage.getNotificacaoConfigByTipo('boas_vindas');
      if (!notificationConfig || !notificationConfig.ativo) return;

      const mensagem = notificationConfig.mensagem
        .replace('{nome}', cliente.nome)
        .replace('{telefone}', cliente.telefone);

      await whatsappService.sendMessage(cliente.telefone, mensagem);
      await this.logActivity('info', `Mensagem de boas-vindas enviada para ${cliente.nome}`);
    } catch (error) {
      console.error('Erro ao enviar mensagem de boas-vindas:', error);
      await this.logActivity('error', `Erro ao enviar boas-vindas: ${error}`);
    }
  }

  async sendPaymentConfirmation(pagamentoId: number) {
    try {
      const pagamentos = await storage.getPagamentosByClienteId(0);
      const pagamento = pagamentos.find(p => p.id === pagamentoId);
      if (!pagamento) return;

      const cliente = await storage.getClienteById(pagamento.clienteId);
      if (!cliente) return;

      const notificationConfig = await storage.getNotificacaoConfigByTipo('pagamento');
      if (!notificationConfig || !notificationConfig.ativo) return;

      const mensagem = notificationConfig.mensagem
        .replace('{nome}', cliente.nome)
        .replace('{valor}', `R$ ${pagamento.valor}`)
        .replace('{data}', new Date().toLocaleDateString('pt-BR'));

      await whatsappService.sendMessage(cliente.telefone, mensagem);
      await this.logActivity('info', `Confirmação de pagamento enviada para ${cliente.nome}`);
    } catch (error) {
      console.error('Erro ao enviar confirmação de pagamento:', error);
      await this.logActivity('error', `Erro ao enviar confirmação: ${error}`);
    }
  }

  async sendCustomMessage(telefone: string, mensagem: string) {
    try {
      const sucesso = await whatsappService.sendMessage(telefone, mensagem);
      if (sucesso) {
        await this.logActivity('info', `Mensagem personalizada enviada para ${telefone}`);
      } else {
        await this.logActivity('error', `Falha ao enviar mensagem para ${telefone}`);
      }
      return sucesso;
    } catch (error) {
      console.error('Erro ao enviar mensagem personalizada:', error);
      await this.logActivity('error', `Erro ao enviar mensagem: ${error}`);
      return false;
    }
  }

  async scheduleCustomNotification(clienteId: number, mensagem: string, dataEnvio: Date) {
    try {
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) return false;

      const cronExpression = this.dateToChron(dataEnvio);
      const taskId = `custom-${clienteId}-${Date.now()}`;

      const task = cron.schedule(cronExpression, async () => {
        await whatsappService.sendMessage(cliente.telefone, mensagem);
        await this.logActivity('info', `Notificação agendada enviada para ${cliente.nome}`);
        
        // Remover tarefa após execução
        this.scheduledTasks.delete(taskId);
      }, {
        scheduled: false
      });

      this.scheduledTasks.set(taskId, task);
      task.start();

      await this.logActivity('info', `Notificação agendada para ${cliente.nome} - ${dataEnvio.toISOString()}`);
      return true;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      await this.logActivity('error', `Erro ao agendar notificação: ${error}`);
      return false;
    }
  }

  private dateToChron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return `${minute} ${hour} ${day} ${month} *`;
  }

  async cancelScheduledNotification(taskId: string) {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(taskId);
      await this.logActivity('info', `Notificação agendada cancelada: ${taskId}`);
      return true;
    }
    return false;
  }

  async getScheduledNotifications(): Promise<string[]> {
    return Array.from(this.scheduledTasks.keys());
  }

  private async logActivity(nivel: string, mensagem: string, detalhes?: any) {
    try {
      await storage.createLog({
        nivel,
        origem: 'Notifications',
        mensagem,
        detalhes: detalhes ? JSON.stringify(detalhes) : null
      });
    } catch (error) {
      console.error('Erro ao criar log:', error);
    }
  }
}

export const notificationService = new NotificationService();
