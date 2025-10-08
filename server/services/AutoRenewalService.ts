import { db } from '../db';
import { storage } from '../storage';
import { sistemas as sistemasTable, officeCredentials, pontos, clientes, extensionStatus } from '@shared/schema';
import { sql, and, eq, lte } from 'drizzle-orm';
import { discordNotificationService } from './DiscordNotificationService';

// Referência para o WebSocket Server para broadcast
let wssRef: any = null;

export function setWebSocketServer(wss: any) {
  wssRef = wss;
}

// Interfaces para a fila de renovação
interface RenewalQueueItem {
  sistemaId: string; // systemId é string, não number
  status: 'waiting' | 'processing' | 'completed' | 'error';
  estimatedTime?: Date; // Data de expiração (não mais minutos)
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  expiration: string;
}

export class AutoRenewalService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRenewing: Set<string> = new Set(); // Evita renovações duplicadas (usa systemId como chave)
  private renewalQueue: Map<string, RenewalQueueItem> = new Map(); // Fila de renovação (usa systemId como chave)
  private nextCheckTime: Date | null = null;
  private lastCheckTime: Date | null = null;

  async start() {
    // Parar intervalo anterior se existir
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Rodar a cada 60 segundos
    this.intervalId = setInterval(async () => {
      this.nextCheckTime = new Date(Date.now() + 60000); // Próxima verificação em 60s
      try {
        await this.checkAndRenewSystems();
      } catch (error) {
        console.error('❌ Erro no serviço de renovação automática:', error);
        await storage.createLog({
          nivel: 'error',
          origem: 'AutoRenewal',
          mensagem: 'Erro no serviço de renovação automática',
          detalhes: { error: error instanceof Error ? error.message : String(error) }
        });
      }
    }, 60000);

    console.log('🔄 Renovação automática ATIVADA - verificando a cada 60 segundos');
    await storage.createLog({
      nivel: 'info',
      origem: 'AutoRenewal',
      mensagem: 'Serviço de renovação automática ATIVADO',
      detalhes: { interval: '60 segundos' }
    });
    
    // Executar primeira verificação imediatamente
    this.checkAndRenewSystems().catch(async error => {
      console.error('❌ Erro na primeira verificação de renovação:', error);
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Erro na primeira verificação de renovação',
        detalhes: { error: error instanceof Error ? error.message : String(error) }
      });
    });
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Renovação automática DESATIVADA');
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Serviço de renovação automática DESATIVADO',
        detalhes: null
      });
    }
  }

  async checkAndRenewSystems() {
    try {
      this.lastCheckTime = new Date();
      console.log('\n🔍 === INICIANDO VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===');
      console.log(`⏰ Horário da verificação: ${this.lastCheckTime.toISOString()}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Iniciando verificação de renovação automática',
        detalhes: { checkTime: this.lastCheckTime.toISOString() }
      });
      
      // Verificar status da extensão e notificar se houver problemas
      try {
        const extensionStatusData = await db.select().from(extensionStatus).limit(1);
        if (extensionStatusData.length > 0) {
          const status = extensionStatusData[0];
          const now = new Date();
          const lastHeartbeat = status.lastHeartbeat ? new Date(status.lastHeartbeat) : null;
          const minutesSinceLastHeartbeat = lastHeartbeat ? 
            (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60) : 999;
          
          // Se não recebeu heartbeat há mais de 5 minutos, considera offline
          if (minutesSinceLastHeartbeat > 5 || !status.isActive || !status.isLoggedIn) {
            console.log(`⚠️ Extensão com problema - Última atividade: ${minutesSinceLastHeartbeat.toFixed(0)}min atrás`);
            await discordNotificationService.notifyExtensionOffline();
          }
          
          // Se está ativa mas travada no login
          if (status.isActive && status.isLoggedIn && status.currentUrl && status.currentUrl.includes('login')) {
            console.log(`⚠️ Extensão possivelmente travada no login`);
            await discordNotificationService.notifyExtensionStuck();
          }
        } else {
          // Sem dados da extensão
          console.log(`⚠️ Nenhum dado de status da extensão encontrado`);
          await discordNotificationService.notifyExtensionOffline();
        }
      } catch (error) {
        console.error('Erro ao verificar status da extensão:', error);
      }
      
      // Limpar itens antigos da fila (mais de 1 hora)
      this.cleanupQueue();
      
      // 1. Buscar configuração global
      const config = await storage.getOfficeAutomationConfig();
      console.log(`📋 Configuração:`, {
        isEnabled: config?.isEnabled || false,
        renewalAdvanceTime: config?.renewalAdvanceTime || 60
      });
      
      if (!config || !config.isEnabled) {
        console.log('⚠️ Serviço de renovação desabilitado na configuração');
        await storage.createLog({
          nivel: 'warn',
          origem: 'AutoRenewal',
          mensagem: 'Serviço de renovação desabilitado na configuração',
          detalhes: null
        });
        return;
      }
      
      // Verificar modo de distribuição na configuração
      if (config.distributionMode === 'fixed-points') {
        console.log('🔒 === RENOVAÇÃO AUTOMÁTICA PAUSADA ===');
        console.log('📊 Modo fixo configurado: distributionMode = fixed-points');
        console.log('⏸️ Renovação pausada para proteger configuração de pontos fixos');
        await storage.createLog({
          nivel: 'info',
          origem: 'AutoRenewal',
          mensagem: 'Renovação automática pausada: Modo fixo está ativo',
          detalhes: { 
            reason: 'Fixed mode configured',
            distributionMode: 'fixed-points'
          }
        });
        return;
      }

      const renewalAdvanceMinutes = config.renewalAdvanceTime || 60;

      // 2. Buscar sistemas com renovação automática habilitada
      const now = new Date();
      const checkTime = new Date(now.getTime() + renewalAdvanceMinutes * 60 * 1000);
      console.log(`📅 Verificando sistemas que expiram até: ${checkTime.toISOString()}`);
      console.log(`⏳ Antecedencia configurada: ${renewalAdvanceMinutes} minutos`);

      // Buscar TODOS os sistemas (renovação automática para todos agora)
      const sistemasAutoRenew = await db
        .select()
        .from(sistemasTable);
      
      console.log(`📋 Total de sistemas encontrados: ${sistemasAutoRenew.length}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Sistemas verificados para renovação',
        detalhes: {
          totalSistemas: sistemasAutoRenew.length,
          renewalAdvanceMinutes: renewalAdvanceMinutes
        }
      });
      
      if (sistemasAutoRenew.length === 0) {
        console.log('ℹ️ Nenhum sistema encontrado no banco');
        await storage.createLog({
          nivel: 'info',
          origem: 'AutoRenewal',
          mensagem: 'Nenhum sistema encontrado no banco',
          detalhes: null
        });
        return;
      }
      
      // Log de verificação
      console.log(`🔍 Analisando ${sistemasAutoRenew.length} sistemas...`);
      console.log('\n📋 Detalhes dos sistemas:');
      sistemasAutoRenew.forEach(sistema => {
        const expiracaoDate = sistema.expiracao ? new Date(sistema.expiracao) : null;
        const minutosAteExpiracao = expiracaoDate ? 
          (expiracaoDate.getTime() - now.getTime()) / (1000 * 60) : null;
        console.log(`  • ID: ${sistema.id} | SystemID: ${sistema.systemId} | User: ${sistema.username}`);
        console.log(`    - Expiração: ${sistema.expiracao || 'NÃO DEFINIDA'}`);
        console.log(`    - Minutos até expirar: ${minutosAteExpiracao ? minutosAteExpiracao.toFixed(0) : 'N/A'}`);
        console.log(`    - Pontos ativos: ${sistema.pontosAtivos}/${sistema.maxPontosAtivos}`);
      });

      // Atualizar fila APENAS com sistemas vencidos ou próximos do vencimento
      for (const sistema of sistemasAutoRenew) {
        // Pular sistemas sem data de expiração
        if (!sistema.expiracao) {
          console.log(`⚠️ Sistema ${sistema.systemId} sem data de expiração definida`);
          continue;
        }
        
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        const isExpired = expiracaoDate <= now;
        
        // VERIFICAR SE CLIENTE ESTÁ VENCIDO HÁ MAIS DE 2 DIAS
        // Buscar pontos associados a este sistema
        const pontosDoSistema = await db
          .select({
            clienteId: pontos.clienteId,
            clienteVencimento: clientes.vencimento
          })
          .from(pontos)
          .leftJoin(clientes, eq(pontos.clienteId, clientes.id))
          .where(eq(pontos.sistemaId, sistema.id));
        
        // Verificar se algum cliente está vencido há mais de 2 dias
        let clienteVencidoHaMuitoTempo = false;
        for (const ponto of pontosDoSistema) {
          if (ponto.clienteVencimento) {
            const clienteVencimento = new Date(ponto.clienteVencimento);
            const diasVencido = (now.getTime() - clienteVencimento.getTime()) / (1000 * 60 * 60 * 24);
            
            if (diasVencido > 2) {
              console.log(`🚫 Sistema ${sistema.systemId} NÃO será renovado - Cliente vencido há ${diasVencido.toFixed(0)} dias`);
              clienteVencidoHaMuitoTempo = true;
              break;
            }
          }
        }
        
        // Pular sistema se cliente está vencido há mais de 2 dias
        if (clienteVencidoHaMuitoTempo) {
          continue;
        }
        
        // APENAS adicionar se está vencido ou próximo do vencimento
        if (isExpired || minutosAteExpiracao <= renewalAdvanceMinutes) {
          // Adicionar à fila APENAS se não existe ou está em erro (pode tentar novamente)
          // NUNCA re-adicionar itens completed ou processing
          const existingItem = this.renewalQueue.get(sistema.systemId);
          const shouldAddToQueue = !existingItem || existingItem.status === 'error';
          
          if (shouldAddToQueue) {
            const queueItem: RenewalQueueItem = {
              sistemaId: sistema.systemId,
              status: 'waiting',
              estimatedTime: sistema.expiracao ? new Date(sistema.expiracao) : undefined,
              addedAt: new Date(),
              expiration: sistema.expiracao ? new Date(sistema.expiracao).toISOString() : ''
            };
            
            this.renewalQueue.set(sistema.systemId, queueItem);
            
            if (isExpired) {
              console.log(`🚨 Sistema ${sistema.systemId} adicionado à fila - VENCIDO há ${Math.abs(minutosAteExpiracao).toFixed(0)} minutos`);
              // Notificar Discord sobre sistema vencido
              await discordNotificationService.notifySystemExpired(sistema.systemId, sistema.username);
            } else {
              console.log(`⚠️ Sistema ${sistema.systemId} adicionado à fila - ${minutosAteExpiracao.toFixed(0)}min até vencer`);
              // Se está a 5 minutos ou menos de vencer, notificar Discord
              if (minutosAteExpiracao <= 5) {
                await discordNotificationService.notifySystemExpiring(sistema.systemId, sistema.username, Math.round(minutosAteExpiracao));
              }
            }
          }
        }
      }
      
      // Filtrar sistemas que precisam de renovação
      console.log('\n🎯 Aplicando filtros de renovação...');
      const sistemasParaRenovar = [];
      
      for (const sistema of sistemasAutoRenew) {
        // Verificar se já está sendo renovado
        if (this.isRenewing.has(sistema.systemId)) {
          console.log(`⏭️ Sistema ${sistema.systemId} (${sistema.username}) já está em processo de renovação`);
          continue;
        }

        // Verificar se está vencido ou próximo do vencimento
        if (!sistema.expiracao) {
          continue; // Pular sistemas sem data de expiração
        }
        
        // VERIFICAR SE CLIENTE ESTÁ VENCIDO HÁ MAIS DE 2 DIAS (mesmo filtro da fila)
        const pontosDoSistema = await db
          .select({
            clienteId: pontos.clienteId,
            clienteVencimento: clientes.vencimento
          })
          .from(pontos)
          .leftJoin(clientes, eq(pontos.clienteId, clientes.id))
          .where(eq(pontos.sistemaId, sistema.id));
        
        let clienteVencidoHaMuitoTempo = false;
        for (const ponto of pontosDoSistema) {
          if (ponto.clienteVencimento) {
            const clienteVencimento = new Date(ponto.clienteVencimento);
            const diasVencido = (now.getTime() - clienteVencimento.getTime()) / (1000 * 60 * 60 * 24);
            
            if (diasVencido > 2) {
              console.log(`🚫 Sistema ${sistema.systemId} NÃO será renovado - Cliente vencido há ${diasVencido.toFixed(0)} dias`);
              clienteVencidoHaMuitoTempo = true;
              break;
            }
          }
        }
        
        // Pular sistema se cliente está vencido há mais de 2 dias
        if (clienteVencidoHaMuitoTempo) {
          continue;
        }
        
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        const isExpired = expiracaoDate <= now;
        
        // SE ESTÁ VENCIDO, renovar imediatamente
        if (isExpired) {
          console.log(`🚨 Sistema ${sistema.systemId} (${sistema.username}) VENCIDO há ${Math.abs(minutosAteExpiracao).toFixed(0)} minutos - renovação IMEDIATA`);
          sistemasParaRenovar.push(sistema);
        }
        // Verificar se está próximo do vencimento (dentro do tempo configurado)
        else if (minutosAteExpiracao <= renewalAdvanceMinutes) {
          console.log(`⚠️ Sistema ${sistema.systemId} (${sistema.username}) próximo do vencimento - ${minutosAteExpiracao.toFixed(0)}min restantes`);
          sistemasParaRenovar.push(sistema);
        } else {
          console.log(`✅ Sistema ${sistema.systemId} (${sistema.username}) ainda válido - ${(minutosAteExpiracao/60).toFixed(1)}h restantes`);
        }
      }
      
      if (sistemasParaRenovar.length === 0) {
        console.log('✨ Nenhum sistema precisa de renovação no momento');
        console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===\n');
        await storage.createLog({
          nivel: 'info',
          origem: 'AutoRenewal',
          mensagem: 'Nenhum sistema precisa de renovação no momento',
          detalhes: { sistemasAnalisados: sistemasAutoRenew.length }
        });
        return;
      }

      console.log(`\n✅ ${sistemasParaRenovar.length} sistema(s) prontos para renovação!`);
      console.log(`🔄 Iniciando processo de renovação sequencial...`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Iniciando renovação de sistemas',
        detalhes: {
          totalParaRenovar: sistemasParaRenovar.length,
          sistemas: sistemasParaRenovar.map(s => ({ id: s.id, systemId: s.systemId, username: s.username, expiracao: s.expiracao }))
        }
      });

      // 3. Processar cada sistema SEQUENCIALMENTE (não em paralelo)
      for (const sistema of sistemasParaRenovar) {
        console.log(`\n========================================`);
        console.log(`🎯 Iniciando renovação do sistema ${sistema.systemId}`);
        console.log(`👤 Usuário: ${sistema.username}`);
        console.log(`📅 Expiração: ${new Date(sistema.expiracao).toISOString()}`);
        console.log(`========================================\n`);
        
        // Marcar como renovando
        this.isRenewing.add(sistema.systemId);
        
        // Atualizar status na fila
        const queueItem = this.renewalQueue.get(sistema.systemId);
        if (queueItem) {
          queueItem.status = 'processing';
          queueItem.startedAt = new Date();
        }

        try {
          // Renovar sistema e aguardar conclusão antes de processar o próximo
          await this.renewSystem(sistema);
          
          await storage.createLog({
            nivel: 'info',
            origem: 'AutoRenewal',
            mensagem: 'Sistema renovado com sucesso',
            detalhes: {
              sistemaId: sistema.id,
              systemId: sistema.systemId,
              username: sistema.username
            }
          });
          
          // Aguardar 5 segundos entre renovações para não sobrecarregar
          console.log(`⏳ Aguardando 5 segundos antes da próxima renovação...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`❌ Erro ao renovar sistema ${sistema.systemId}:`, error);
          
          await storage.createLog({
            nivel: 'error',
            origem: 'AutoRenewal',
            mensagem: 'Erro ao renovar sistema',
            detalhes: {
              sistemaId: sistema.id,
              systemId: sistema.systemId,
              username: sistema.username,
              error: error instanceof Error ? error.message : String(error)
            }
          });
          
          // Remover flag de renovação em caso de erro
          this.isRenewing.delete(sistema.systemId);
          
          // Atualizar status na fila
          const queueItem = this.renewalQueue.get(sistema.systemId);
          if (queueItem) {
            queueItem.status = 'error';
            queueItem.error = error instanceof Error ? error.message : 'Erro desconhecido';
            queueItem.completedAt = new Date();
          }
        }
      }
      
      console.log(`✅ Processo de renovação sequencial concluído`);
      console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===\n');
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Verificação de renovação automática concluída',
        detalhes: {
          sistemasRenovados: sistemasParaRenovar.length
        }
      });
    } catch (error) {
      console.error('❌ Erro ao verificar sistemas para renovação:', error);
      console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA (COM ERRO) ===\n');
      
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Erro ao verificar sistemas para renovação',
        detalhes: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  async renewSystem(sistema: any) {
    const traceId = `renewal_${sistema.systemId}_${Date.now()}`;
    try {
      console.log(`🔄 [AutoRenewal] INICIANDO renovação - TraceId: ${traceId}`);
      console.log(`  Sistema ID: ${sistema.id}`);
      console.log(`  Sistema SystemID: ${sistema.systemId}`);
      console.log(`  Username: ${sistema.username}`);
      console.log(`  Expiração atual: ${sistema.expiracao}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Iniciando renovação de sistema individual',
        detalhes: {
          traceId,
          sistemaId: sistema.id,
          systemId: sistema.systemId,
          username: sistema.username,
          expiracaoAtual: sistema.expiracao
        }
      });

      // 1. Verificar se já existe uma task pendente para este sistema
      console.log(`🔍 [AutoRenewal] Verificando se já existe task pendente para o sistema ${sistema.id} [${traceId}]...`);
      
      const existingPendingTasks = await db
        .select()
        .from(officeCredentials)
        .where(
          and(
            eq(officeCredentials.status, 'pending'),
            eq(officeCredentials.sistemaId, sistema.id)
          )
        );
      
      if (existingPendingTasks.length > 0) {
        console.log(`⚠️ [AutoRenewal] Já existe task pendente para o sistema ${sistema.id} [${traceId}]`);
        console.log(`  Tasks encontradas: ${existingPendingTasks.length}`);
        console.log(`  Task ID: ${existingPendingTasks[0].id}`);
        console.log(`  Task Username: ${existingPendingTasks[0].username}`);
        console.log(`  Task Criada em: ${existingPendingTasks[0].generatedAt}`);
        
        await storage.createLog({
          nivel: 'info',
          origem: 'AutoRenewal',
          mensagem: 'Task de renovação já existe para este sistema - pulando criação',
          detalhes: {
            traceId,
            sistemaId: sistema.id,
            systemId: sistema.systemId,
            existingTaskId: existingPendingTasks[0].id,
            existingTaskUsername: existingPendingTasks[0].username,
            existingTasksCount: existingPendingTasks.length
          }
        });
        
        // Atualizar status na fila
        const queueItem = this.renewalQueue.get(sistema.systemId);
        if (queueItem) {
          queueItem.status = 'completed';
          queueItem.completedAt = new Date();
        }
        
        // Agendar remoção da flag de renovação após 5 minutos
        setTimeout(() => {
          this.isRenewing.delete(sistema.systemId);
          console.log(`🗑️ Flag de renovação removida para sistema ${sistema.systemId}`);
        }, 5 * 60 * 1000);
        
        return; // Retornar sem criar nova task
      }

      // 2. Criar task pendente no banco com sistemaId no metadata
      console.log(`💾 [AutoRenewal] Nenhuma task pendente encontrada - criando nova task de renovação [${traceId}]...`);
      
      // IMPORTANTE: Usar as credenciais reais do sistema para a extensão poder fazer login
      const taskData = {
        username: sistema.username,  // Username real do sistema
        password: sistema.password,  // Password real do sistema  
        source: 'renewal',
        status: 'pending',
        generatedAt: new Date(),
        sistemaId: sistema.id, // Adicionar sistemaId diretamente no registro
        metadata: JSON.stringify({
          sistemaId: sistema.id,
          systemId: sistema.systemId,
          originalUsername: sistema.username,
          originalPassword: sistema.password,
          currentExpiration: sistema.expiracao,
          traceId: traceId
        })
      };
      
      console.log(`🔍 [AutoRenewal] Dados da task a criar [${traceId}]:`, {
        ...taskData,
        password: '***hidden***' // Ocultar senha no log
      });
      
      const [task] = await db
        .insert(officeCredentials)
        .values(taskData)
        .returning();

      console.log(`✅ [AutoRenewal] Task criada com sucesso [${traceId}]:`);
      console.log(`  Task ID: ${task.id}`);
      console.log(`  Sistema ID: ${task.sistemaId}`);
      console.log(`  Username da task: ${task.username}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Task de renovação criada com sucesso',
        detalhes: {
          traceId,
          taskId: task.id,
          sistemaId: task.sistemaId,
          taskUsername: task.username
        }
      });

      // 3. Marcar sistema como em renovação no banco
      console.log(`📊 [AutoRenewal] Atualizando sistema no banco [${traceId}]...`);
      
      const updateResult = await db
        .update(sistemasTable)
        .set({
          atualizadoEm: new Date()
        })
        .where(eq(sistemasTable.id, sistema.id))
        .returning();

      if (updateResult && updateResult.length > 0) {
        console.log(`✅ [AutoRenewal] Sistema atualizado no banco [${traceId}]:`);
        console.log(`  Timestamp atualizado`);
        console.log(`  Task criada - aguardando processamento pela extensão`);
      } else {
        console.warn(`⚠️ [AutoRenewal] Sistema não retornou dados após update [${traceId}]`);
      }
      
      console.log(`📝 [AutoRenewal] Task ${task.id} criada e aguardando extensão [${traceId}]`);
      console.log(`🎯 [AutoRenewal] A extensão deverá processar a task e chamar updateSistemaRenewal`);
      
      // Atualizar status na fila
      const queueItem = this.renewalQueue.get(sistema.systemId);
      if (queueItem) {
        queueItem.status = 'completed';
        queueItem.completedAt = new Date();
      }

      // 3. Agendar remoção da flag de renovação após 5 minutos
      setTimeout(() => {
        this.isRenewing.delete(sistema.systemId);
        console.log(`🗑️ Flag de renovação removida para sistema ${sistema.systemId}`);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error(`🔴 [AutoRenewal] ERRO ao criar task de renovação [${traceId}]:`, error);
      console.error(`  Sistema ID: ${sistema.id}`);
      console.error(`  Sistema SystemID: ${sistema.systemId}`);
      console.error(`  Mensagem: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`  Stack:`, error instanceof Error ? error.stack : 'N/A');
      
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Erro ao criar task de renovação',
        detalhes: {
          traceId,
          sistemaId: sistema.id,
          systemId: sistema.systemId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'N/A'
        }
      });
      
      // Remover flag de renovação em caso de erro
      this.isRenewing.delete(sistema.systemId);
      throw error; // Re-throw para que o erro seja tratado no nível superior
    }
  }

  // Limpar itens antigos da fila
  private cleanupQueue() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const [sistemaId, item] of this.renewalQueue.entries()) {
      // Remover imediatamente itens completados
      // Manter itens com erro por 5 minutos para análise antes de remover
      if (item.status === 'completed' || 
          (item.status === 'error' && item.completedAt && item.completedAt < fiveMinutesAgo)) {
        this.renewalQueue.delete(sistemaId);
        console.log(`🗑️ Item removido da fila de renovação: ${sistemaId} (status: ${item.status})`);
      }
    }
  }
  
  // Obter status da fila de renovação
  getRenewalQueue() {
    // FILTRAR apenas itens que precisam de ação (waiting ou processing)
    // NÃO incluir itens completed ou error na fila retornada
    const activeQueue = Array.from(this.renewalQueue.values())
      .filter(item => item.status === 'waiting' || item.status === 'processing') // APENAS itens ativos
      .map(item => ({
        ...item,
        sistemaName: item.sistemaId, // Adicionar sistemaName com o valor do systemId
        sistemaId: item.sistemaId // Manter sistemaId como está (é o systemId real)
      }))
      .sort((a, b) => {
        // Priorizar por status: processing > waiting
        const statusOrder = { processing: 0, waiting: 1 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        // Depois ordenar por tempo estimado (data de expiração)
        const aTime = a.estimatedTime ? new Date(a.estimatedTime).getTime() : Date.now() + 999999999;
        const bTime = b.estimatedTime ? new Date(b.estimatedTime).getTime() : Date.now() + 999999999;
        return aTime - bTime;
      });
    
    // Contar todos os itens para estatísticas (incluindo completed/error)
    const allItems = Array.from(this.renewalQueue.values());
    
    return {
      queue: activeQueue, // Retornar APENAS itens ativos
      nextCheckTime: this.nextCheckTime,
      lastCheckTime: this.lastCheckTime,
      isRunning: this.intervalId !== null,
      processingCount: allItems.filter(item => item.status === 'processing').length,
      waitingCount: allItems.filter(item => item.status === 'waiting').length,
      completedCount: allItems.filter(item => item.status === 'completed').length,
      errorCount: allItems.filter(item => item.status === 'error').length
    };
  }
  
  // Obter informações sobre sistemas programados para renovação
  async getScheduledRenewals() {
    try {
      // Buscar configuração para obter renewalAdvanceTime
      const config = await storage.getOfficeAutomationConfig();
      const renewalAdvanceMinutes = config?.renewalAdvanceTime || 60;
      
      // Buscar TODOS os sistemas agora
      const sistemas = await db
        .select()
        .from(sistemasTable);
      
      const now = new Date();
      
      // Filtrar apenas sistemas que realmente precisam de renovação
      const sistemasFilteredForRenewal = sistemas
        .filter(sistema => {
          if (!sistema.expiracao) return false; // Pular sistemas sem data de expiração
          
          const expiracaoDate = new Date(sistema.expiracao);
          const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
          const isExpired = expiracaoDate <= now;
          
          // Incluir apenas se está vencido OU dentro do tempo de renovação antecipada
          return isExpired || minutosAteExpiracao <= renewalAdvanceMinutes;
        })
        .map(sistema => {
          const expiracaoDate = new Date(sistema.expiracao);
          const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
          
          return {
            sistemaId: sistema.id,
            systemId: sistema.systemId,
            expiration: sistema.expiracao,
            minutesUntilExpiration: Math.floor(minutosAteExpiracao),
            isExpired: expiracaoDate <= now
          };
        })
        .sort((a, b) => a.minutesUntilExpiration - b.minutesUntilExpiration);
      
      return sistemasFilteredForRenewal;
    } catch (error) {
      console.error('Erro ao obter renovações programadas:', error);
      return [];
    }
  }

  // Método para limpar a fila de renovação
  async clearQueue() {
    try {
      // Contar apenas itens que podem ser removidos (não em processamento)
      let itemsRemoved = 0;
      const itemsToRemove: string[] = [];
      
      // Identificar itens que podem ser removidos (waiting, completed, error)
      for (const [sistemaId, item] of this.renewalQueue.entries()) {
        if (item.status !== 'processing') {
          itemsToRemove.push(sistemaId);
          itemsRemoved++;
        }
      }
      
      // Remover apenas itens não em processamento
      for (const sistemaId of itemsToRemove) {
        this.renewalQueue.delete(sistemaId);
      }
      
      // NÃO limpar isRenewing - isso evita renovações duplicadas
      // Os sistemas em processamento devem continuar protegidos
      
      console.log(`🗑️ Fila de renovação limpa - ${itemsRemoved} itens removidos`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Fila de renovação limpa',
        detalhes: {
          itemsRemoved: itemsRemoved,
          itemsPreserved: this.renewalQueue.size
        }
      });
      
      return {
        success: true,
        itemsRemoved: itemsRemoved,
        message: `Fila limpa com sucesso - ${itemsRemoved} itens removidos`
      };
    } catch (error) {
      console.error('❌ Erro ao limpar fila de renovação:', error);
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Erro ao limpar fila de renovação',
        detalhes: { error: error instanceof Error ? error.message : String(error) }
      });
      
      throw error;
    }
  }

  // Método para forçar renovação de um sistema específico
  async forceRenew(systemId: string) {
    try {
      const [sistema] = await db
        .select()
        .from(sistemasTable)
        .where(eq(sistemasTable.systemId, systemId))
        .limit(1);

      if (!sistema) {
        await storage.createLog({
          nivel: 'warn',
          origem: 'AutoRenewal',
          mensagem: 'Sistema não encontrado para renovação forçada',
          detalhes: {
            systemId: systemId
          }
        });
        throw new Error(`Sistema ${systemId} não encontrado`);
      }

      console.log(`🔄 Forçando renovação do sistema ${systemId}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Renovação forçada iniciada',
        detalhes: {
          systemId: systemId,
          username: sistema.username
        }
      });
      
      await this.renewSystem(sistema);
      return { success: true, message: `Renovação do sistema ${systemId} iniciada` };
    } catch (error) {
      console.error(`❌ Erro ao forçar renovação do sistema ${systemId}:`, error);
      
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Erro ao forçar renovação',
        detalhes: {
          systemId: systemId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Método para limpar o estado de renovação de um sistema
  clearRenewalState(systemId: string) {
    console.log(`🧹 Limpando estado de renovação para sistema ${systemId}`);
    
    // Remove o sistema da lista de isRenewing
    if (this.isRenewing.has(systemId)) {
      this.isRenewing.delete(systemId);
      console.log(`✅ Sistema ${systemId} removido da lista isRenewing`);
    }
    
    // Remove o sistema da fila de renovação
    if (this.renewalQueue.has(systemId)) {
      this.renewalQueue.delete(systemId);
      console.log(`✅ Sistema ${systemId} removido da fila de renovação`);
    }
    
    console.log(`✨ Estado de renovação limpo para sistema ${systemId}`);
  }
}

// Instância singleton do serviço
export const autoRenewalService = new AutoRenewalService();