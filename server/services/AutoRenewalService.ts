import { db } from '../db';
import { storage } from '../storage';
import { sistemas as sistemasTable, officeCredentials } from '@shared/schema';
import { sql, and, eq, lte } from 'drizzle-orm';

// Referência para o WebSocket Server para broadcast
let wssRef: any = null;

export function setWebSocketServer(wss: any) {
  wssRef = wss;
}

export class AutoRenewalService {
  private intervalId: NodeJS.Timeout | null = null;
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
      
      // Não precisa mais limpar itens da fila pois estamos usando o banco
      
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

      // Criar tasks de renovação no banco para sistemas vencidos ou próximos do vencimento
      for (const sistema of sistemasAutoRenew) {
        // Pular sistemas sem data de expiração
        if (!sistema.expiracao) {
          console.log(`⚠️ Sistema ${sistema.systemId} sem data de expiração definida`);
          continue;
        }
        
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        const isExpired = expiracaoDate <= now;
        
        // APENAS adicionar se está vencido ou próximo do vencimento
        if (isExpired || minutosAteExpiracao <= renewalAdvanceMinutes) {
          // Verificar se já existe task pendente para este sistema
          const existingTasks = await storage.getTasksBySystemId(sistema.systemId);
          const hasPendingTask = existingTasks.some(task => task.status === 'pending' || task.status === 'processing');
          
          if (!hasPendingTask) {
            // Criar task no banco
            const payload = {
              systemId: sistema.systemId,
              username: sistema.username,
              expiracao: sistema.expiracao,
              pontosAtivos: sistema.pontosAtivos,
              maxPontosAtivos: sistema.maxPontosAtivos
            };
            
            const taskId = await storage.createRenewalTask(sistema.systemId, payload);
            
            if (isExpired) {
              console.log(`🚨 Sistema ${sistema.systemId} task criada (ID: ${taskId}) - VENCIDO há ${Math.abs(minutosAteExpiracao).toFixed(0)} minutos`);
            } else {
              console.log(`⚠️ Sistema ${sistema.systemId} task criada (ID: ${taskId}) - ${minutosAteExpiracao.toFixed(0)}min até vencer`);
            }
          }
        }
      }
      
      // Filtrar sistemas que precisam de renovação
      console.log('\n🎯 Aplicando filtros de renovação...');
      const sistemasParaRenovar = sistemasAutoRenew.filter(sistema => {
        // Verificar se está vencido ou próximo do vencimento
        if (!sistema.expiracao) {
          return false; // Pular sistemas sem data de expiração
        }
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        const isExpired = expiracaoDate <= now;
        
        // SE ESTÁ VENCIDO, renovar imediatamente
        if (isExpired) {
          console.log(`🚨 Sistema ${sistema.systemId} (${sistema.username}) VENCIDO há ${Math.abs(minutosAteExpiracao).toFixed(0)} minutos - renovação IMEDIATA`);
          return true;
        }
        
        // Verificar se está próximo do vencimento (dentro do tempo configurado)
        if (minutosAteExpiracao <= renewalAdvanceMinutes) {
          console.log(`⚠️ Sistema ${sistema.systemId} (${sistema.username}) próximo do vencimento - ${minutosAteExpiracao.toFixed(0)}min restantes`);
          return true;
        } else {
          console.log(`✅ Sistema ${sistema.systemId} (${sistema.username}) ainda válido - ${(minutosAteExpiracao/60).toFixed(1)}h restantes`);
          return false;
        }
      });
      
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
        
        // Buscar task pendente para este sistema e marcar como processing
        const existingTasks = await storage.getTasksBySystemId(sistema.systemId);
        const pendingTask = existingTasks.find(task => task.status === 'pending');
        
        if (pendingTask) {
          await storage.updateRenewalTaskStatus(pendingTask.id, 'processing');
        }

        try {
          // Renovar sistema e aguardar conclusão antes de processar o próximo
          await this.renewSystem(sistema);
          
          await storage.createLog({
            nivel: 'info',
            origem: 'AutoRenewal',
            mensagem: 'Sistema renovado com sucesso',
            detalhes: {
              systemId: sistema.id,
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
              systemId: sistema.id,
              systemId: sistema.systemId,
              username: sistema.username,
              error: error instanceof Error ? error.message : String(error)
            }
          });
          
          // Marcar task como failed no banco
          const existingTasks = await storage.getTasksBySystemId(sistema.systemId);
          const processingTask = existingTasks.find(task => task.status === 'processing');
          
          if (processingTask) {
            await storage.updateRenewalTaskStatus(
              processingTask.id, 
              'failed', 
              null,
              error instanceof Error ? error.message : 'Erro desconhecido'
            );
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
          systemId: sistema.id,
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
            eq(officeCredentials.systemId, sistema.id)
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
            systemId: sistema.id,
            systemId: sistema.systemId,
            existingTaskId: existingPendingTasks[0].id,
            existingTaskUsername: existingPendingTasks[0].username,
            existingTasksCount: existingPendingTasks.length
          }
        });
        
        return; // Retornar sem criar nova task
      }

      // 2. Criar task pendente no banco com systemId no metadata
      console.log(`💾 [AutoRenewal] Nenhuma task pendente encontrada - criando nova task de renovação [${traceId}]...`);
      
      const taskData = {
        username: `renovacao_${Date.now()}`,
        password: 'pending',
        source: 'renewal',
        status: 'pending',
        generatedAt: new Date(),
        systemId: sistema.id // Adicionar systemId diretamente no registro
      };
      
      console.log(`🔍 [AutoRenewal] Dados da task a criar [${traceId}]:`, JSON.stringify(taskData, null, 2));
      
      const [task] = await db
        .insert(officeCredentials)
        .values(taskData)
        .returning();

      console.log(`✅ [AutoRenewal] Task criada com sucesso [${traceId}]:`);
      console.log(`  Task ID: ${task.id}`);
      console.log(`  Sistema ID: ${task.systemId}`);
      console.log(`  Username da task: ${task.username}`);
      
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Task de renovação criada com sucesso',
        detalhes: {
          traceId,
          taskId: task.id,
          systemId: task.systemId,
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
          systemId: sistema.id,
          systemId: sistema.systemId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'N/A'
        }
      });
      
      throw error; // Re-throw para que o erro seja tratado no nível superior
    }
  }

  // Obter status da fila de renovação
  async getQueueStatus() {
    try {
      // Buscar todas as tasks do banco
      const allTasks = await storage.getAllRenewalTasks();
      
      // Contar por status
      const pendingCount = allTasks.filter(task => task.status === 'pending').length;
      const processingCount = allTasks.filter(task => task.status === 'processing').length;
      const completedCount = allTasks.filter(task => task.status === 'completed').length;
      const failedCount = allTasks.filter(task => task.status === 'failed').length;
      
      return {
        nextCheckTime: this.nextCheckTime,
        lastCheckTime: this.lastCheckTime,
        isRunning: this.intervalId !== null,
        pendingCount,
        processingCount,
        completedCount,
        failedCount,
        totalTasks: allTasks.length
      };
    } catch (error) {
      console.error('Erro ao obter status da fila:', error);
      return {
        nextCheckTime: this.nextCheckTime,
        lastCheckTime: this.lastCheckTime,
        isRunning: this.intervalId !== null,
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0,
        totalTasks: 0
      };
    }
  }
  
  // Obter itens da fila de renovação
  async getQueueItems() {
    try {
      // Buscar todas as tasks pendentes e em processamento
      const allTasks = await storage.getAllRenewalTasks();
      
      // Filtrar apenas as tasks pendentes e em processamento
      const queueItems = allTasks.filter(task => 
        task.status === 'pending' || task.status === 'processing'
      );
      
      // Ordenar por prioridade e data de criação
      queueItems.sort((a, b) => {
        // Priorizar por status: processing > pending
        if (a.status === 'processing' && b.status !== 'processing') return -1;
        if (b.status === 'processing' && a.status !== 'processing') return 1;
        
        // Depois ordenar por prioridade (menor valor = maior prioridade)
        const priorityDiff = (a.priority || 999) - (b.priority || 999);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Por último, ordenar por data de criação (mais antigo primeiro)
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });
      
      return queueItems;
    } catch (error) {
      console.error('Erro ao obter itens da fila:', error);
      return [];
    }
  }
  
  // Backward compatibility - mantém getRenewalQueue mas usa o novo método
  async getRenewalQueue() {
    const queueItems = await this.getQueueItems();
    const status = await this.getQueueStatus();
    
    return {
      queue: queueItems.map(item => ({
        ...item,
        sistemaName: item.systemId,
        estimatedTime: item.createdAt
      })),
      ...status
    };
  }
  
  // Método para adicionar task à fila
  async addToQueue(systemId: string, payload: any): Promise<number> {
    try {
      const taskId = await storage.createRenewalTask(systemId, payload);
      console.log(`✅ Task ${taskId} adicionada à fila para sistema ${systemId}`);
      return taskId;
    } catch (error) {
      console.error(`Erro ao adicionar task à fila para sistema ${systemId}:`, error);
      throw error;
    }
  }
  
  // Método para obter próxima task da fila
  async getNextTask() {
    try {
      const task = await storage.getNextPendingRenewalTaskFromQueue();
      if (task) {
        console.log(`📦 Próxima task obtida da fila: ID ${task.id} para sistema ${task.systemId}`);
      }
      return task;
    } catch (error) {
      console.error('Erro ao obter próxima task da fila:', error);
      return null;
    }
  }
  
  // Método para marcar task como completa
  async completeTask(taskId: number, result: any) {
    try {
      await storage.updateRenewalTaskStatus(taskId, 'completed', result);
      console.log(`✅ Task ${taskId} marcada como concluída`);
    } catch (error) {
      console.error(`Erro ao marcar task ${taskId} como concluída:`, error);
      throw error;
    }
  }
  
  // Método para marcar task como falhada
  async failTask(taskId: number, error: string) {
    try {
      await storage.updateRenewalTaskStatus(taskId, 'failed', null, error);
      console.log(`❌ Task ${taskId} marcada como falhada: ${error}`);
    } catch (error) {
      console.error(`Erro ao marcar task ${taskId} como falhada:`, error);
      throw error;
    }
  }
  
  // Obter informações sobre sistemas programados para renovação
  async getScheduledRenewals() {
    try {
      // Buscar TODOS os sistemas agora
      const sistemas = await db
        .select()
        .from(sistemasTable);
      
      const now = new Date();
      
      return sistemas.map(sistema => {
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        
        return {
          internalId: sistema.id,  // ID interno do banco (número)
          systemId: sistema.systemId,  // systemId externo (string)
          expiration: sistema.expiracao,
          minutesUntilExpiration: Math.floor(minutosAteExpiracao),
          isExpired: expiracaoDate <= now
        };
      }).sort((a, b) => a.minutesUntilExpiration - b.minutesUntilExpiration);
    } catch (error) {
      console.error('Erro ao obter renovações programadas:', error);
      return [];
    }
  }


  // Método para marcar uma task de renovação como falhada
  async failTask(taskId: number, errorMessage: string) {
    try {
      console.log(`❌ [AutoRenewal] Marcando task ${taskId} como falhada`);
      console.log(`  Motivo: ${errorMessage}`);
      
      // Atualizar status da task no banco
      await storage.updateRenewalTaskStatus(taskId, 'failed', null, errorMessage);
      
      // Log do erro
      await storage.createLog({
        nivel: 'error',
        origem: 'AutoRenewal',
        mensagem: 'Task de renovação falhada',
        detalhes: {
          taskId: taskId,
          error: errorMessage
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao marcar task ${taskId} como falhada:`, error);
      throw error;
    }
  }
  
  // Método para completar uma task de renovação com sucesso
  async completeTask(taskId: number, credentials: { username?: string, password?: string, systemId?: string, metadata?: any }) {
    try {
      console.log(`✅ [AutoRenewal] Completando task ${taskId}`);
      console.log(`  Username: ${credentials.username || 'não informado'}`);
      console.log(`  SystemId: ${credentials.systemId || 'não informado'} (tipo: ${typeof credentials.systemId})`);  // Log para confirmar tipo
      
      // Validação importante: username é obrigatório para renovação
      if (!credentials.username || !credentials.password) {
        throw new Error('Username e password são obrigatórios para completar renovação');
      }
      
      // Verificar se username é apenas numérico (userId)
      if (/^\d+$/.test(credentials.username)) {
        throw new Error(`Username inválido (apenas userId): ${credentials.username}`);
      }
      
      // Atualizar status da task no banco como completed
      await storage.updateRenewalTaskStatus(taskId, 'completed', {
        username: credentials.username,
        password: credentials.password,
        systemId: credentials.systemId,
        completedAt: new Date().toISOString()
      });
      
      // Se temos systemId, atualizar o sistema
      if (credentials.systemId) {
        console.log(`🔍 Buscando sistema por systemId string: ${credentials.systemId}`);
        const sistema = await storage.getSistemaBySystemId(credentials.systemId);  // Usar método correto para buscar por string
        if (sistema) {
          // Atualizar credenciais do sistema
          await storage.updateSistemaRenewal(
            sistema.systemId,
            credentials.username,
            credentials.password
          );
          
          console.log(`✅ Sistema ${sistema.systemId} atualizado com novas credenciais`);
        }
      }
      
      // Log de sucesso
      await storage.createLog({
        nivel: 'info',
        origem: 'AutoRenewal',
        mensagem: 'Task de renovação completada com sucesso',
        detalhes: {
          taskId: taskId,
          systemId: credentials.systemId,
          username: credentials.username
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao completar task ${taskId}:`, error);
      
      // Em caso de erro, marcar task como falhada
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await this.failTask(taskId, errorMessage);
      
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
  
  // Método para limpar estado de renovação de um sistema  
  clearRenewalState(systemId: string) {
    console.log(`🧹 Limpando estado de renovação para systemId: ${systemId}`);
    // Este método pode ser expandido futuramente se mantivermos estado in-memory
    // Por enquanto, apenas log para debugging
  }

}

// Instância singleton do serviço
export const autoRenewalService = new AutoRenewalService();