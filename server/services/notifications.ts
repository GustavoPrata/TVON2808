import { storage } from '../storage';
import { whatsappService } from './whatsapp';
import cron, { ScheduledTask } from 'node-cron';

export class NotificationService {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

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
      console.log('🔍 Iniciando verificação profissional de vencimentos com recorrência...');
      
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
      let notificacoesRecorrentes = 0;
      
      for (const cliente of clientesComVencimento) {
        const vencimento = new Date(cliente.vencimento!);
        vencimento.setHours(0, 0, 0, 0);
        
        const diffTime = vencimento.getTime() - hoje.getTime();
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const primeiroNome = cliente.nome.split(' ')[0];
        console.log(`📅 Cliente: ${primeiroNome} - Dias para vencimento: ${diasRestantes}`);
        
        // Verificar se existe notificação recorrente para este cliente
        const notificacaoRecorrente = await storage.getNotificacaoRecorrenteByClienteId(cliente.id);
        
        // Lógica profissional de avisos
        let deveEnviarAviso = false;
        let tipoAviso = '';
        
        // 1. No dia do vencimento (diasRestantes = 0) - SEMPRE envia
        if (diasRestantes === 0) {
          deveEnviarAviso = true;
          tipoAviso = 'vence_hoje';
          console.log(`⏰ ${primeiroNome}: Vence HOJE - enviando aviso obrigatório`);
        }
        // 2. No dia seguinte ao vencimento (diasRestantes = -1) - SEMPRE envia
        else if (diasRestantes === -1) {
          deveEnviarAviso = true;
          tipoAviso = 'venceu_ontem';
          console.log(`📛 ${primeiroNome}: Venceu ONTEM - enviando aviso obrigatório com opção de desbloqueio`);
          
          // Criar registro de notificação recorrente se ainda não existe e está configurado
          if (!notificacaoRecorrente && config.notificacoesRecorrentes) {
            await this.criarNotificacaoRecorrente(cliente.id, config.intervaloRecorrente || 3);
            console.log(`🔄 ${primeiroNome}: Criada notificação recorrente a cada ${config.intervaloRecorrente || 3} dias`);
          }
        }
        // 3. Notificações recorrentes (após o segundo dia de vencimento)
        else if (diasRestantes < -1 && config.notificacoesRecorrentes) {
          const diasVencido = Math.abs(diasRestantes);
          
          if (notificacaoRecorrente && notificacaoRecorrente.ativo) {
            // Verificar se é hora de enviar com base no registro de recorrência
            const proximoEnvio = new Date(notificacaoRecorrente.proximoEnvio);
            proximoEnvio.setHours(0, 0, 0, 0);
            
            // Verificar se já atingiu o limite de notificações
            const limiteAtingido = config.limiteNotificacoes > 0 && 
                                   notificacaoRecorrente.totalEnviado >= config.limiteNotificacoes;
            
            if (!limiteAtingido && hoje.getTime() >= proximoEnvio.getTime()) {
              deveEnviarAviso = true;
              tipoAviso = 'vencido_recorrente';
              console.log(`🔄 ${primeiroNome}: Vencido há ${diasVencido} dias - enviando notificação recorrente #${notificacaoRecorrente.totalEnviado + 1}`);
              notificacoesRecorrentes++;
            } else if (limiteAtingido) {
              console.log(`🚫 ${primeiroNome}: Limite de ${config.limiteNotificacoes} notificações atingido`);
            } else {
              const diasProximoEnvio = Math.ceil((proximoEnvio.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
              console.log(`⏭️ ${primeiroNome}: Próxima notificação em ${diasProximoEnvio} dias`);
            }
          } else if (!notificacaoRecorrente && config.notificacoesRecorrentes) {
            // Criar registro retroativo se não existe mas deveria existir
            await this.criarNotificacaoRecorrente(cliente.id, config.intervaloRecorrente || 3);
            console.log(`🔄 ${primeiroNome}: Criada notificação recorrente retroativa`);
          }
        } else if (diasRestantes > 0) {
          console.log(`✅ ${primeiroNome}: Vence em ${diasRestantes} dias - sem aviso necessário`);
        }
        
        if (deveEnviarAviso) {
          // Verificar se já enviou aviso hoje para este cliente (para evitar duplicatas)
          const avisoExistente = await storage.getAvisoByClienteId(cliente.id, vencimento);
          
          if (!avisoExistente) {
            // Enviar notificação específica baseada no tipo
            const sucesso = await this.sendProfessionalExpirationNotification(cliente, diasRestantes, tipoAviso);
            
            if (sucesso) {
              clientesNotificados++;
              
              // Atualizar registro de notificação recorrente se for o caso
              if (tipoAviso === 'vencido_recorrente' && notificacaoRecorrente) {
                await this.atualizarNotificacaoRecorrente(notificacaoRecorrente.id, config.intervaloRecorrente || 3);
              }
            }
          } else {
            console.log(`⏭️ ${primeiroNome}: Já foi notificado hoje`);
            clientesJaNotificados++;
          }
        }
      }

      console.log(`\n✅ Verificação profissional com recorrência concluída:`);
      console.log(`   📤 ${clientesNotificados} avisos enviados`);
      console.log(`   🔄 ${notificacoesRecorrentes} notificações recorrentes`);
      console.log(`   ⏭️ ${clientesJaNotificados} já notificados hoje\n`);
      
      await this.logActivity('info', `Verificação de vencimentos - ${clientesNotificados} avisos (${notificacoesRecorrentes} recorrentes)`);
    } catch (error) {
      console.error('❌ Erro ao verificar vencimentos:', error);
      await this.logActivity('error', `Erro ao verificar vencimentos: ${error}`);
    }
  }

  private async sendProfessionalExpirationNotification(cliente: any, diasRestantes: number, tipoAviso: string): Promise<boolean> {
    try {
      // Pegar apenas o primeiro nome
      const primeiroNome = cliente.nome.split(' ')[0];
      
      // Definir mensagem específica baseada no tipo de aviso
      let mensagem = '';
      
      switch (tipoAviso) {
        case 'vence_hoje':
          // Mensagem para o dia do vencimento
          mensagem = `Olá ${primeiroNome}! 👋\n` +
                    `Seu plano vencerá hoje. Renove agora para continuar aproveitando nossos serviços!\n\n` +
                    `2️⃣ Renovar agora\n` +
                    `0️⃣ Menu Principal`;
          break;
          
        case 'venceu_ontem':
          // Mensagem para o dia seguinte ao vencimento
          mensagem = `Olá ${primeiroNome}! 👋\n` +
                    `Seu plano venceu. Renove agora para continuar aproveitando nossos serviços!\n\n` +
                    `1️⃣ Desbloqueio de confiança\n` +
                    `2️⃣ Renovar agora\n` +
                    `0️⃣ Menu Principal`;
          break;
          
        case 'vencido_recorrente':
          // Mensagem para lembretes a cada 3 dias
          const diasVencido = Math.abs(diasRestantes);
          mensagem = `Olá ${primeiroNome}! 👋\n` +
                    `Seu plano está vencido há ${diasVencido} dias. Renove agora para continuar aproveitando nossos serviços!\n\n` +
                    `1️⃣ Desbloqueio de confiança\n` +
                    `2️⃣ Renovar agora\n` +
                    `0️⃣ Menu Principal`;
          break;
          
        default:
          console.error(`❌ Tipo de aviso desconhecido: ${tipoAviso}`);
          return;
      }

      // Garantir que o telefone tem código do Brasil (55)
      let phoneNumber = cliente.telefone.replace(/\D/g, ''); // Remove non-digits
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      console.log(`📱 Enviando aviso profissional (${tipoAviso}) para ${primeiroNome} (${phoneNumber})...`);
      const sucesso = await whatsappService.sendMessage(phoneNumber, mensagem);
      
      if (sucesso) {
        // Registrar aviso enviado
        const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dataVencimento = new Date(cliente.vencimento);
        
        await storage.createAvisoVencimento({
          clienteId: cliente.id,
          telefone: phoneNumber,
          dataVencimento: dataVencimento,
          tipoAviso: tipoAviso,
          mensagemEnviada: mensagem
        });
        
        console.log(`✅ Notificação profissional (${tipoAviso}) enviada para ${primeiroNome}`);
        await this.logActivity('info', `Notificação profissional de vencimento (${tipoAviso}) enviada para ${primeiroNome}`);
        return true;
      } else {
        console.log(`❌ Falha ao enviar notificação profissional para ${primeiroNome}`);
        await this.logActivity('error', `Falha ao enviar notificação profissional para ${primeiroNome}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao enviar notificação profissional:', error);
      await this.logActivity('error', `Erro ao enviar notificação profissional: ${error}`);
      return false;
    }
  }

  // Métodos auxiliares para notificações recorrentes
  private async criarNotificacaoRecorrente(clienteId: number, intervalo: number) {
    try {
      const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const hoje = new Date(nowBrazil);
      hoje.setHours(0, 0, 0, 0);
      
      // Calcular próximo envio (intervalo dias após hoje)
      const proximoEnvio = new Date(hoje);
      proximoEnvio.setDate(proximoEnvio.getDate() + intervalo);
      
      await storage.createNotificacaoRecorrente({
        clienteId: clienteId,
        dataUltimoEnvio: hoje,
        totalEnviado: 0, // Começará em 0, será incrementado no primeiro envio recorrente
        proximoEnvio: proximoEnvio,
        dataInicioRecorrencia: hoje,
        ativo: true
      });
      
      console.log(`📌 Criado registro de notificação recorrente para cliente ${clienteId} - Próximo envio: ${proximoEnvio.toLocaleDateString('pt-BR')}`);
      await this.logActivity('info', `Notificação recorrente criada para cliente ${clienteId}`);
    } catch (error) {
      console.error('❌ Erro ao criar notificação recorrente:', error);
      await this.logActivity('error', `Erro ao criar notificação recorrente: ${error}`);
    }
  }

  private async atualizarNotificacaoRecorrente(notificacaoId: number, intervalo: number) {
    try {
      const nowBrazil = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const hoje = new Date(nowBrazil);
      hoje.setHours(0, 0, 0, 0);
      
      // Buscar notificação atual
      const notificacoes = await storage.getNotificacoesRecorrentes();
      const notificacao = notificacoes.find(n => n.id === notificacaoId);
      
      if (!notificacao) {
        console.error(`❌ Notificação recorrente ${notificacaoId} não encontrada`);
        return;
      }
      
      // Calcular próximo envio
      const proximoEnvio = new Date(hoje);
      proximoEnvio.setDate(proximoEnvio.getDate() + intervalo);
      
      // Atualizar registro
      await storage.updateNotificacaoRecorrente(notificacaoId, {
        dataUltimoEnvio: hoje,
        totalEnviado: notificacao.totalEnviado + 1,
        proximoEnvio: proximoEnvio
      });
      
      console.log(`✅ Atualizado registro de notificação recorrente ${notificacaoId} - Próximo envio: ${proximoEnvio.toLocaleDateString('pt-BR')}`);
      await this.logActivity('info', `Notificação recorrente ${notificacaoId} atualizada - Total enviado: ${notificacao.totalEnviado + 1}`);
    } catch (error) {
      console.error('❌ Erro ao atualizar notificação recorrente:', error);
      await this.logActivity('error', `Erro ao atualizar notificação recorrente: ${error}`);
    }
  }

  private async desativarNotificacaoRecorrente(clienteId: number) {
    try {
      const notificacao = await storage.getNotificacaoRecorrenteByClienteId(clienteId);
      
      if (notificacao) {
        await storage.updateNotificacaoRecorrente(notificacao.id, {
          ativo: false
        });
        
        console.log(`🔕 Notificação recorrente desativada para cliente ${clienteId}`);
        await this.logActivity('info', `Notificação recorrente desativada para cliente ${clienteId}`);
      }
    } catch (error) {
      console.error('❌ Erro ao desativar notificação recorrente:', error);
      await this.logActivity('error', `Erro ao desativar notificação recorrente: ${error}`);
    }
  }

  // Método público para reativar notificações recorrentes quando cliente renovar
  async reativarNotificacoesRecorrentes(clienteId: number) {
    try {
      const notificacao = await storage.getNotificacaoRecorrenteByClienteId(clienteId);
      
      if (notificacao) {
        // Deletar registro antigo
        await storage.deleteNotificacaoRecorrente(notificacao.id);
        
        console.log(`♻️ Registro de notificação recorrente removido para cliente ${clienteId} (renovação)`);
        await this.logActivity('info', `Notificação recorrente resetada para cliente ${clienteId} após renovação`);
      }
    } catch (error) {
      console.error('❌ Erro ao reativar notificações recorrentes:', error);
      await this.logActivity('error', `Erro ao reativar notificações recorrentes: ${error}`);
    }
  }

  // Método para verificar status de notificações recorrentes
  async getStatusNotificacoesRecorrentes(): Promise<any> {
    try {
      const notificacoes = await storage.getNotificacoesRecorrentesAtivas();
      const config = await storage.getConfigAvisos();
      
      const status = {
        ativo: config?.notificacoesRecorrentes || false,
        intervalo: config?.intervaloRecorrente || 3,
        limite: config?.limiteNotificacoes || 0,
        totalClientesComRecorrencia: notificacoes.length,
        notificacoesProximas: notificacoes.map(n => ({
          clienteId: n.clienteId,
          totalEnviado: n.totalEnviado,
          proximoEnvio: n.proximoEnvio,
          diasRestantes: Math.ceil((new Date(n.proximoEnvio).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        })).sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 10)
      };
      
      return status;
    } catch (error) {
      console.error('❌ Erro ao obter status de notificações recorrentes:', error);
      return null;
    }
  }

  // Método legado mantido para compatibilidade
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
          tipoAviso: 'automatico',
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
