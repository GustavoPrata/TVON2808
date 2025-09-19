import { db } from '../db';
import { storage } from '../storage';
import { sistemas as sistemasTable, officeCredentials } from '@shared/schema';
import { sql, and, eq, lte } from 'drizzle-orm';

// Referência para o WebSocket Server para broadcast
let wssRef: any = null;

export function setWebSocketServer(wss: any) {
  wssRef = wss;
}

// Interfaces para a fila de renovação
interface RenewalQueueItem {
  sistemaId: number;
  username: string;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  estimatedTime?: number; // Minutos até renovação
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  expiration: string;
  lastRenewalAt?: string | null;
  renewalCount?: number;
}

export class AutoRenewalService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRenewing: Set<number> = new Set(); // Evita renovações duplicadas
  private renewalQueue: Map<number, RenewalQueueItem> = new Map(); // Fila de renovação
  private nextCheckTime: Date | null = null;
  private lastCheckTime: Date | null = null;

  start() {
    // Parar intervalo anterior se existir
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Rodar a cada 60 segundos
    this.intervalId = setInterval(() => {
      this.nextCheckTime = new Date(Date.now() + 60000); // Próxima verificação em 60s
      this.checkAndRenewSystems().catch(error => {
        console.error('❌ Erro no serviço de renovação automática:', error);
      });
    }, 60000);

    console.log('🔄 Renovação automática ATIVADA - verificando a cada 60 segundos');
    
    // Executar primeira verificação imediatamente
    this.checkAndRenewSystems().catch(error => {
      console.error('❌ Erro na primeira verificação de renovação:', error);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Renovação automática DESATIVADA');
    }
  }

  async checkAndRenewSystems() {
    try {
      this.lastCheckTime = new Date();
      console.log('\n🔍 === INICIANDO VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===');
      console.log(`⏰ Horário da verificação: ${this.lastCheckTime.toISOString()}`);
      
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
        return;
      }

      const renewalAdvanceMinutes = config.renewalAdvanceTime || 60;

      // 2. Buscar sistemas com renovação automática habilitada
      const now = new Date();
      const checkTime = new Date(now.getTime() + renewalAdvanceMinutes * 60 * 1000);
      console.log(`📅 Verificando sistemas que expiram até: ${checkTime.toISOString()}`);
      console.log(`⏳ Antecedencia configurada: ${renewalAdvanceMinutes} minutos`);

      // Buscar todos os sistemas com renovação automática habilitada
      const sistemasAutoRenew = await db
        .select()
        .from(sistemasTable)
        .where(eq(sistemasTable.autoRenewalEnabled, true));
      
      console.log(`📋 Total de sistemas com autoRenewal habilitado: ${sistemasAutoRenew.length}`);
      
      if (sistemasAutoRenew.length === 0) {
        console.log('ℹ️ Nenhum sistema com renovação automática habilitada');
        return;
      }
      
      // Log de verificação
      console.log(`🔍 Analisando ${sistemasAutoRenew.length} sistemas com renovação automática...`);
      console.log('\n📋 Detalhes dos sistemas:');
      sistemasAutoRenew.forEach(sistema => {
        const expiracaoDate = sistema.expiracao ? new Date(sistema.expiracao) : null;
        const minutosAteExpiracao = expiracaoDate ? 
          (expiracaoDate.getTime() - now.getTime()) / (1000 * 60) : null;
        console.log(`  • ID: ${sistema.id} | User: ${sistema.username}`);
        console.log(`    - Expiração: ${sistema.expiracao || 'NÃO DEFINIDA'}`);
        console.log(`    - Minutos até expirar: ${minutosAteExpiracao ? minutosAteExpiracao.toFixed(0) : 'N/A'}`);
        console.log(`    - Status: ${sistema.status}`);
        console.log(`    - AutoRenewal: ${sistema.autoRenewalEnabled}`);
        console.log(`    - LastRenewal: ${sistema.lastRenewalAt || 'NUNCA'}`);
      });

      // Atualizar fila com todos os sistemas elegíveis
      for (const sistema of sistemasAutoRenew) {
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        
        // Adicionar ou atualizar na fila se não estiver processando
        if (!this.renewalQueue.has(sistema.id) || this.renewalQueue.get(sistema.id)?.status === 'completed' || this.renewalQueue.get(sistema.id)?.status === 'error') {
          const queueItem: RenewalQueueItem = {
            sistemaId: sistema.id,
            username: sistema.username,
            status: 'waiting',
            estimatedTime: minutosAteExpiracao > 0 ? Math.floor(minutosAteExpiracao) : 0,
            addedAt: new Date(),
            expiration: sistema.expiracao,
            lastRenewalAt: sistema.lastRenewalAt,
            renewalCount: sistema.renewalCount || 0
          };
          
          this.renewalQueue.set(sistema.id, queueItem);
        }
      }
      
      // Filtrar sistemas que precisam de renovação
      console.log('\n🎯 Aplicando filtros de renovação...');
      const sistemasParaRenovar = sistemasAutoRenew.filter(sistema => {
        // Verificar se já está sendo renovado
        if (this.isRenewing.has(sistema.id)) {
          console.log(`⏭️ Sistema ${sistema.id} (${sistema.username}) já está em processo de renovação`);
          return false;
        }

        // Verificar se já foi renovado recentemente (últimas 4 horas)
        if (sistema.lastRenewalAt) {
          const horasSinceLastRenewal = (now.getTime() - new Date(sistema.lastRenewalAt).getTime()) / (1000 * 60 * 60);
          if (horasSinceLastRenewal < 4) {
            console.log(`⏰ Sistema ${sistema.id} (${sistema.username}) foi renovado há ${horasSinceLastRenewal.toFixed(1)}h (aguardar 4h)`);
            return false;
          }
        }
        
        // Verificar se está vencido ou próximo do vencimento
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        
        // Renovar se:
        // 1. Já está vencido (expiracao <= now)
        // 2. Está próximo do vencimento (dentro do renewalAdvanceTime)
        if (expiracaoDate <= now) {
          console.log(`❗ Sistema ${sistema.id} (${sistema.username}) VENCIDO - expiracao: ${expiracaoDate.toISOString()}`);
          return true;
        } else if (minutosAteExpiracao <= renewalAdvanceMinutes) {
          console.log(`⚠️ Sistema ${sistema.id} (${sistema.username}) próximo do vencimento - ${minutosAteExpiracao.toFixed(0)}min restantes`);
          return true;
        } else {
          console.log(`✅ Sistema ${sistema.id} (${sistema.username}) ainda válido - ${(minutosAteExpiracao/60).toFixed(1)}h restantes`);
          return false;
        }
      });
      
      if (sistemasParaRenovar.length === 0) {
        console.log('✨ Nenhum sistema precisa de renovação no momento');
        console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===\n');
        return;
      }

      console.log(`\n✅ ${sistemasParaRenovar.length} sistema(s) prontos para renovação!`);
      console.log(`🔄 Iniciando processo de renovação sequencial...`);

      // 3. Processar cada sistema SEQUENCIALMENTE (não em paralelo)
      for (const sistema of sistemasParaRenovar) {
        console.log(`\n========================================`);
        console.log(`🎯 Iniciando renovação do sistema ${sistema.id}`);
        console.log(`👤 Usuário: ${sistema.username}`);
        console.log(`📅 Expiração: ${new Date(sistema.expiracao).toISOString()}`);
        console.log(`========================================\n`);
        
        // Marcar como renovando
        this.isRenewing.add(sistema.id);
        
        // Atualizar status na fila
        const queueItem = this.renewalQueue.get(sistema.id);
        if (queueItem) {
          queueItem.status = 'processing';
          queueItem.startedAt = new Date();
        }

        try {
          // Renovar sistema e aguardar conclusão antes de processar o próximo
          await this.renewSystem(sistema);
          
          // Aguardar 5 segundos entre renovações para não sobrecarregar
          console.log(`⏳ Aguardando 5 segundos antes da próxima renovação...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`❌ Erro ao renovar sistema ${sistema.id}:`, error);
          // Remover flag de renovação em caso de erro
          this.isRenewing.delete(sistema.id);
          
          // Atualizar status na fila
          const queueItem = this.renewalQueue.get(sistema.id);
          if (queueItem) {
            queueItem.status = 'error';
            queueItem.error = error instanceof Error ? error.message : 'Erro desconhecido';
            queueItem.completedAt = new Date();
          }
        }
      }
      
      console.log(`✅ Processo de renovação sequencial concluído`);
      console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ===\n');
    } catch (error) {
      console.error('❌ Erro ao verificar sistemas para renovação:', error);
      console.log('🔍 === FIM DA VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA (COM ERRO) ===\n');
    }
  }

  async renewSystem(sistema: any) {
    try {
      console.log(`🔄 Iniciando processo de renovação para sistema ${sistema.id} - ${sistema.username}`);

      // 1. Criar task pendente no banco com sistemaId no metadata
      const [task] = await db
        .insert(officeCredentials)
        .values({
          username: `renovacao_${Date.now()}`,
          password: 'pending',
          source: 'renewal',
          status: 'pending',
          generatedAt: new Date(),
          sistemaId: sistema.id, // Adicionar sistemaId diretamente no registro
          metadata: {
            taskType: 'renewal',
            sistemaId: sistema.id, // Garantir que sistemaId está no metadata
            systemId: sistema.id, // Manter ambas as chaves por compatibilidade
            originalUsername: sistema.username,
            systemUsername: sistema.username,
            systemExpiration: sistema.expiracao,
            status: 'pending',
            requestedAt: new Date().toISOString()
          }
        })
        .returning();

      console.log(`📝 Task de renovação criada:`, {
        taskId: task.id,
        sistemaId: sistema.id,
        username: sistema.username,
        metadata: task.metadata
      });

      // 2. Marcar sistema como em renovação no banco
      await db
        .update(sistemasTable)
        .set({
          updatedAt: new Date(),
          lastRenewalAt: new Date(),
          renewalCount: sql`COALESCE(renewal_count, 0) + 1`
        })
        .where(eq(sistemasTable.id, sistema.id));

      console.log(`📊 Sistema ${sistema.id} marcado como renovado no banco`);
      console.log(`✅ Task de renovação para sistema ${sistema.id} - ${sistema.username} criada e aguardando processamento pela extensão`);
      
      // Atualizar status na fila
      const queueItem = this.renewalQueue.get(sistema.id);
      if (queueItem) {
        queueItem.status = 'completed';
        queueItem.completedAt = new Date();
      }

      // 3. Agendar remoção da flag de renovação após 5 minutos
      setTimeout(() => {
        this.isRenewing.delete(sistema.id);
        console.log(`🗑️ Flag de renovação removida para sistema ${sistema.id}`);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error(`❌ Erro ao criar task de renovação para sistema ${sistema.id}:`, error);
      // Remover flag de renovação em caso de erro
      this.isRenewing.delete(sistema.id);
      throw error; // Re-throw para que o erro seja tratado no nível superior
    }
  }

  // Limpar itens antigos da fila
  private cleanupQueue() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [sistemaId, item] of this.renewalQueue.entries()) {
      // Remover itens completados ou com erro há mais de 1 hora
      if ((item.status === 'completed' || item.status === 'error') && 
          item.completedAt && item.completedAt < oneHourAgo) {
        this.renewalQueue.delete(sistemaId);
      }
    }
  }
  
  // Obter status da fila de renovação
  getRenewalQueue() {
    const queue = Array.from(this.renewalQueue.values())
      .sort((a, b) => {
        // Priorizar por status: processing > waiting > completed/error
        const statusOrder = { processing: 0, waiting: 1, completed: 2, error: 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        // Depois ordenar por tempo estimado
        return (a.estimatedTime || 999) - (b.estimatedTime || 999);
      });
    
    return {
      queue,
      nextCheckTime: this.nextCheckTime,
      lastCheckTime: this.lastCheckTime,
      isRunning: this.intervalId !== null,
      processingCount: queue.filter(item => item.status === 'processing').length,
      waitingCount: queue.filter(item => item.status === 'waiting').length,
      completedCount: queue.filter(item => item.status === 'completed').length,
      errorCount: queue.filter(item => item.status === 'error').length
    };
  }
  
  // Obter informações sobre sistemas programados para renovação
  async getScheduledRenewals() {
    try {
      const sistemas = await db
        .select()
        .from(sistemasTable)
        .where(eq(sistemasTable.autoRenewalEnabled, true));
      
      const now = new Date();
      
      return sistemas.map(sistema => {
        const expiracaoDate = new Date(sistema.expiracao);
        const minutosAteExpiracao = (expiracaoDate.getTime() - now.getTime()) / (1000 * 60);
        
        return {
          sistemaId: sistema.id,
          username: sistema.username,
          expiration: sistema.expiracao,
          minutesUntilExpiration: Math.floor(minutosAteExpiracao),
          isExpired: expiracaoDate <= now,
          lastRenewalAt: sistema.lastRenewalAt,
          renewalCount: sistema.renewalCount || 0,
          autoRenewalEnabled: sistema.autoRenewalEnabled,
          renewalAdvanceTime: sistema.renewalAdvanceTime
        };
      }).sort((a, b) => a.minutesUntilExpiration - b.minutesUntilExpiration);
    } catch (error) {
      console.error('Erro ao obter renovações programadas:', error);
      return [];
    }
  }

  // Método para forçar renovação de um sistema específico
  async forceRenew(systemId: number) {
    try {
      const [sistema] = await db
        .select()
        .from(sistemasTable)
        .where(eq(sistemasTable.id, systemId))
        .limit(1);

      if (!sistema) {
        throw new Error(`Sistema ${systemId} não encontrado`);
      }

      console.log(`🔄 Forçando renovação do sistema ${systemId}`);
      await this.renewSystem(sistema);
      return { success: true, message: `Renovação do sistema ${systemId} iniciada` };
    } catch (error) {
      console.error(`❌ Erro ao forçar renovação do sistema ${systemId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Instância singleton do serviço
export const autoRenewalService = new AutoRenewalService();