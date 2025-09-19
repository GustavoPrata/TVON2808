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

    console.log('🔄 Auto-renewal service started - checking every 60 seconds');
    
    // Executar primeira verificação imediatamente
    this.checkAndRenewSystems().catch(error => {
      console.error('❌ Erro na primeira verificação de renovação:', error);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Auto-renewal service stopped');
    }
  }

  async checkAndRenewSystems() {
    try {
      const verificationTime = new Date().toISOString();
      console.log('🔍 Verificando sistemas IPTV para renovação automática...');
      console.log(`📅 Horário da verificação: ${verificationTime}`);

      // 1. Buscar configuração global
      const config = await storage.getOfficeAutomationConfig();
      console.log('📋 Configuração atual:', JSON.stringify(config));
      
      if (!config || !config.isEnabled) {
        console.log('⚠️ Renovação automática desabilitada ou configuração não encontrada');
        console.log(`   - Config existe: ${!!config}`);
        console.log(`   - isEnabled: ${config?.isEnabled}`);
        console.log(`   - renewalAdvanceTime: ${config?.renewalAdvanceTime}`);
        return;
      }

      const renewalAdvanceMinutes = config.renewalAdvanceTime || 60;
      console.log(`⏰ Renovação configurada para ${renewalAdvanceMinutes} minutos antes do vencimento`);

      // 2. Buscar sistemas com renovação automática habilitada e expirando
      const now = new Date();
      const checkTime = new Date(now.getTime() + renewalAdvanceMinutes * 60 * 1000);
      console.log(`🔎 Buscando sistemas que expiram antes de: ${checkTime.toISOString()}`);

      const sistemasExpirando = await db
        .select()
        .from(sistemasTable)
        .where(
          and(
            eq(sistemasTable.autoRenewalEnabled, true),
            lte(sistemasTable.expiracao, checkTime)
          )
        );

      console.log(`🔍 Query executada: sistemas com autoRenewalEnabled=true e expiracao <= ${checkTime.toISOString()}`);
      console.log(`📊 Resultado: ${sistemasExpirando.length} sistema(s) encontrado(s)`);
      
      if (sistemasExpirando.length === 0) {
        console.log('✅ Nenhum sistema precisa de renovação no momento');
        
        // Log adicional para debug
        const allSystems = await db.select().from(sistemasTable);
        console.log(`📊 Total de sistemas no banco: ${allSystems.length}`);
        const autoRenewEnabled = allSystems.filter(s => s.autoRenewalEnabled);
        console.log(`📊 Sistemas com renovação automática habilitada: ${autoRenewEnabled.length}`);
        if (autoRenewEnabled.length > 0) {
          console.log('📅 Datas de expiração dos sistemas com auto-renovação:');
          autoRenewEnabled.forEach(s => {
            console.log(`   - Sistema ${s.id} (${s.username}): ${s.expiracao ? s.expiracao.toISOString() : 'sem data'}`);
          });
        }
        return;
      }

      console.log(`📋 ${sistemasExpirando.length} sistema(s) encontrado(s) para renovação`);

      // 3. Processar cada sistema
      for (const sistema of sistemasExpirando) {
        // Evitar renovação duplicada
        if (this.isRenewing.has(sistema.id)) {
          console.log(`⏭️ Sistema ${sistema.id} já está sendo renovado, pulando...`);
          continue;
        }

        // Verificar se já foi renovado recentemente (últimas 4 horas)
        if (sistema.lastRenewalAt) {
          const horasSinceLastRenewal = (now.getTime() - new Date(sistema.lastRenewalAt).getTime()) / (1000 * 60 * 60);
          if (horasSinceLastRenewal < 4) {
            console.log(`⏰ Sistema ${sistema.id} foi renovado há ${horasSinceLastRenewal.toFixed(1)} horas, aguardando...`);
            continue;
          }
        }

        console.log(`🔄 Iniciando renovação do sistema ${sistema.id} (${sistema.username})`);
        
        // Marcar como renovando
        this.isRenewing.add(sistema.id);

        // Renovar sistema
        await this.renewSystem(sistema);
      }
    } catch (error) {
      console.error('❌ Erro ao verificar sistemas para renovação:', error);
    }
  }

  async renewSystem(sistema: any) {
    try {
      console.log(`🔧 Renovando sistema ${sistema.id} - Usuário: ${sistema.username}`);

      // 1. Criar task pendente no banco
      const [task] = await db
        .insert(officeCredentials)
        .values({
          username: `renovacao_${Date.now()}`,
          password: 'pending',
          source: 'renewal',
          status: 'pending',
          generatedAt: new Date(),
          metadata: {
            taskType: 'renewal',
            systemId: sistema.id,
            originalUsername: sistema.username,
            status: 'pending'
          }
        })
        .returning();

      console.log(`📝 Task de renovação criada: ${task.id}`);

      // 2. Task criada - a extensão Chrome irá buscar via polling
      // A extensão faz polling no endpoint /api/office/automation/next-task
      // e processará esta renovação quando detectar a task pendente

      console.log(`📡 Task de renovação disponível para extensão Chrome processar`);

      // 3. Marcar sistema como em renovação no banco
      await db
        .update(sistemasTable)
        .set({
          updatedAt: new Date(),
          notes: sql`COALESCE(notes, '') || ' | Renovação iniciada em ' || ${new Date().toISOString()}`
        })
        .where(eq(sistemasTable.id, sistema.id));

      // 4. Agendar remoção da flag de renovação após 5 minutos
      setTimeout(() => {
        this.isRenewing.delete(sistema.id);
        console.log(`✅ Flag de renovação removida para sistema ${sistema.id}`);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error(`❌ Erro ao renovar sistema ${sistema.id}:`, error);
      // Remover flag de renovação em caso de erro
      this.isRenewing.delete(sistema.id);
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