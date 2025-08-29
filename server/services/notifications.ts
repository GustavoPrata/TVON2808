import { storage } from '../storage';
import { whatsappService } from './whatsapp';
import cron from 'node-cron';

export class NotificationService {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeScheduledNotifications();
    
    // Log hora atual do Brasil ao iniciar
    const nowBrazil = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    console.log(`\n🕐 Sistema de notificações iniciado - Hora atual no Brasil: ${nowBrazil}\n`);
  }

  private async initializeScheduledNotifications() {
    try {
      // Verificar a cada minuto se é hora de enviar avisos de vencimento
      cron.schedule('* * * * *', async () => {
        await this.checkIfTimeToSendExpirationNotifications();
      }, {
        timezone: "America/Sao_Paulo"  // Usar timezone do Brasil
      });

      // Notificações de pagamento - verificar a cada hora
      cron.schedule('0 * * * *', async () => {
        await this.checkPaymentNotifications();
      }, {
        timezone: "America/Sao_Paulo"  // Usar timezone do Brasil
      });

      await this.logActivity('info', 'Serviço de notificações inicializado com timezone Brasil (São Paulo)');
    } catch (error) {
      console.error('Erro ao inicializar notificações:', error);
      await this.logActivity('error', `Erro ao inicializar notificações: ${error}`);
    }
  }

  private async checkIfTimeToSendExpirationNotifications() {
    try {
      // Obter configuração de avisos
      const config = await storage.getConfigAvisos();
      
      // Obter hora atual no Brasil
      const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const currentTime = new Date(nowBrazil);
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      // Log apenas a cada 5 minutos ou quando for a hora configurada
      if (currentMinute % 5 === 0 || currentTimeStr === config?.horaAviso) {
        console.log(`⏱️ Verificando avisos: ${currentTimeStr} (Brasil) - Configurado: ${config?.horaAviso || 'não configurado'} - Ativo: ${config?.ativo ? 'Sim' : 'Não'}`);
      }

      if (!config || !config.ativo) return;

      // Verificar se é a hora configurada
      if (currentTimeStr === config.horaAviso) {
        // Verificar se já enviou avisos hoje
        const hoje = new Date(nowBrazil);
        hoje.setHours(0, 0, 0, 0);
        
        const avisosHoje = await storage.getAvisosHoje();
        const jaEnviouHoje = avisosHoje && avisosHoje.length > 0;
        
        console.log(`\n⏰ HORA CONFIGURADA ATINGIDA: ${currentTimeStr} (Brasil)`);
        console.log(`📋 Avisos já enviados hoje: ${jaEnviouHoje ? `Sim (${avisosHoje.length} avisos)` : 'Não'}`);
        
        if (!jaEnviouHoje) {
          console.log(`📤 INICIANDO ENVIO DE AVISOS DE VENCIMENTO...`);
          await this.checkExpiringClients();
        } else {
          console.log(`⏭️ Pulando envio - avisos já foram enviados hoje`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar hora de avisos:', error);
    }
  }

  private async checkExpiringClients() {
    try {
      console.log('🔍 Iniciando verificação de vencimentos...');
      
      // Obter configuração de avisos
      const config = await storage.getConfigAvisos();
      if (!config || !config.ativo) {
        console.log('❌ Avisos de vencimento desativados');
        return;
      }

      // Obter clientes com vencimento
      const clientes = await storage.getClientes();
      const clientesComVencimento = clientes.filter(c => c.vencimento);
      
      // Data atual no Brasil
      const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const hoje = new Date(nowBrazil);
      hoje.setHours(0, 0, 0, 0);
      
      let clientesNotificados = 0;
      let clientesJaNotificados = 0;
      
      for (const cliente of clientesComVencimento) {
        const vencimento = new Date(cliente.vencimento!);
        vencimento.setHours(0, 0, 0, 0);
        
        const diffTime = vencimento.getTime() - hoje.getTime();
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const primeiroNome = cliente.nome.split(' ')[0];
        console.log(`📅 Cliente: ${primeiroNome} - Vencimento em ${diasRestantes} dias`);
        
        // Verificar se está dentro do período de aviso (vencido ou vencendo)
        if (diasRestantes <= config.diasAntecedencia || diasRestantes === 0 || diasRestantes < 0) {
          // Verificar se já enviou aviso hoje
          const avisoExistente = await storage.getAvisoByClienteId(cliente.id, vencimento);
          
          if (!avisoExistente) {
            await this.sendExpirationNotification(cliente, diasRestantes, config.mensagemPadrao);
            clientesNotificados++;
          } else {
            clientesJaNotificados++;
          }
        }
      }

      console.log(`✅ Verificação concluída: ${clientesNotificados} avisos enviados, ${clientesJaNotificados} já notificados hoje`);
      await this.logActivity('info', `Verificação de vencimentos - ${clientesNotificados} avisos enviados`);
    } catch (error) {
      console.error('❌ Erro ao verificar vencimentos:', error);
      await this.logActivity('error', `Erro ao verificar vencimentos: ${error}`);
    }
  }

  private async sendExpirationNotification(cliente: any, diasRestantes: number, templateMessage: string) {
    try {
      // Pegar apenas o primeiro nome
      const primeiroNome = cliente.nome.split(' ')[0];
      
      // Formatar mensagem
      let mensagem = templateMessage || 'Olá {nome}! Seu plano vence em {dias} dias. Entre em contato para renovar.';
      
      // Determinar texto de dias
      let textoDias = '';
      if (diasRestantes === 0) {
        textoDias = 'hoje';
      } else if (diasRestantes === 1) {
        textoDias = 'amanhã';
      } else if (diasRestantes < 0) {
        textoDias = `há ${Math.abs(diasRestantes)} dias`;
      } else {
        textoDias = `em ${diasRestantes} dias`;
      }
      
      mensagem = mensagem
        .replace('{nome}', primeiroNome)
        .replace('{dias}', diasRestantes.toString())
        .replace('{vencimento}', new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
        .replace('{textoDias}', textoDias);

      // Garantir que o telefone tem código do Brasil (55)
      let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      console.log(`📱 Enviando aviso para ${primeiroNome} (${phoneNumber})...`);
      const sucesso = await whatsappService.sendMessage(phoneNumber, mensagem);
      
      if (sucesso) {
        // Registrar aviso enviado
        const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dataVencimento = new Date(cliente.vencimento);
        
        await storage.createAvisoVencimento({
          clienteId: cliente.id,
          telefone: phoneNumber,
          dataVencimento: dataVencimento,
          dataAviso: new Date(nowBrazil),
          tipoAviso: 'automatico',
          statusEnvio: 'enviado',
          mensagemEnviada: mensagem
        });
        
        console.log(`✅ Notificação enviada para ${primeiroNome}`);
        await this.logActivity('info', `Notificação de vencimento enviada para ${primeiroNome}`);
      } else {
        console.log(`❌ Falha ao enviar para ${primeiroNome}`);
        await this.logActivity('error', `Falha ao enviar notificação para ${primeiroNome}`);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
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
          // Ensure phone number has country code (Brazil 55)
          let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
          if (!phoneNumber.startsWith('55')) {
            phoneNumber = '55' + phoneNumber;
          }

          const primeiroNome = cliente.nome.split(' ')[0];
          await whatsappService.sendMessage(
            phoneNumber,
            `Olá ${primeiroNome}! Seu pagamento PIX expirou. Entre em contato para gerar um novo.`
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

      // Ensure phone number has country code (Brazil 55)
      let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      await whatsappService.sendMessage(phoneNumber, mensagem);
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

      // Ensure phone number has country code (Brazil 55)
      let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      await whatsappService.sendMessage(phoneNumber, mensagem);
      await this.logActivity('info', `Confirmação de pagamento enviada para ${cliente.nome}`);
    } catch (error) {
      console.error('Erro ao enviar confirmação de pagamento:', error);
      await this.logActivity('error', `Erro ao enviar confirmação: ${error}`);
    }
  }

  async sendCustomMessage(telefone: string, mensagem: string) {
    try {
      // Ensure phone number has country code (Brazil 55)
      let phoneNumber = telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      const sucesso = await whatsappService.sendMessage(phoneNumber, mensagem);
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
        // Ensure phone number has country code (Brazil 55)
        let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
        if (!phoneNumber.startsWith('55')) {
          phoneNumber = '55' + phoneNumber;
        }

        await whatsappService.sendMessage(phoneNumber, mensagem);
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
