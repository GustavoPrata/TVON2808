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
  private isRenewing: Set<number> = new Set(); // Evita renovações duplicadas

  start() {
    // Parar intervalo anterior se existir
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Rodar a cada 60 segundos
    this.intervalId = setInterval(() => {
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
      // 1. Buscar configuração global
      const config = await storage.getOfficeAutomationConfig();
      
      if (!config || !config.isEnabled) {
        // Serviço desabilitado - retornar silenciosamente
        return;
      }

      const renewalAdvanceMinutes = config.renewalAdvanceTime || 60;

      // 2. Buscar sistemas com renovação automática habilitada
      const now = new Date();
      const checkTime = new Date(now.getTime() + renewalAdvanceMinutes * 60 * 1000);

      // Buscar todos os sistemas com renovação automática habilitada
      const sistemasAutoRenew = await db
        .select()
        .from(sistemasTable)
        .where(eq(sistemasTable.autoRenewalEnabled, true));
      
      if (sistemasAutoRenew.length === 0) {
        // Nenhum sistema com renovação automática - sem log para evitar spam
        return;
      }
      
      // Log de verificação
      console.log(`🔍 Verificando ${sistemasAutoRenew.length} sistemas com renovação automática...`);

      // Filtrar sistemas que precisam de renovação
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
        return;
      }

      console.log(`🔄 ${sistemasParaRenovar.length} sistema(s) serão renovados sequencialmente`);

      // 3. Processar cada sistema SEQUENCIALMENTE (não em paralelo)
      for (const sistema of sistemasParaRenovar) {
        console.log(`\n========================================`);
        console.log(`🎯 Iniciando renovação do sistema ${sistema.id}`);
        console.log(`👤 Usuário: ${sistema.username}`);
        console.log(`📅 Expiração: ${new Date(sistema.expiracao).toISOString()}`);
        console.log(`========================================\n`);
        
        // Marcar como renovando
        this.isRenewing.add(sistema.id);

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
        }
      }
      
      console.log(`✅ Processo de renovação sequencial concluído`);
    } catch (error) {
      console.error('❌ Erro ao verificar sistemas para renovação:', error);
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