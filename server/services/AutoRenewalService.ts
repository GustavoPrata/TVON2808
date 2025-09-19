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

      // 2. Buscar sistemas com renovação automática habilitada e expirando
      const now = new Date();
      const checkTime = new Date(now.getTime() + renewalAdvanceMinutes * 60 * 1000);

      // Buscar todos os sistemas
      const allSystems = await db.select().from(sistemasTable);
      
      // Log de verificação
      console.log(`🔍 Verificando ${allSystems.length} sistemas para renovação...`);

      // Filtrar sistemas que precisam de renovação
      const sistemasExpirando = await db
        .select()
        .from(sistemasTable)
        .where(
          and(
            eq(sistemasTable.autoRenewalEnabled, true),
            lte(sistemasTable.expiracao, checkTime)
          )
        );
      
      if (sistemasExpirando.length === 0) {
        // Nenhum sistema para renovar - sem log para evitar spam
        return;
      }

      console.log(`⚠️ ${sistemasExpirando.length} sistema(s) precisam de renovação`);

      // 3. Processar cada sistema
      for (const sistema of sistemasExpirando) {
        // Evitar renovação duplicada
        if (this.isRenewing.has(sistema.id)) {
          continue;
        }

        // Verificar se já foi renovado recentemente (últimas 4 horas)
        if (sistema.lastRenewalAt) {
          const horasSinceLastRenewal = (now.getTime() - new Date(sistema.lastRenewalAt).getTime()) / (1000 * 60 * 60);
          if (horasSinceLastRenewal < 4) {
            continue;
          }
        }
        
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
      console.log(`🔄 Renovando sistema ${sistema.id} - ${sistema.username}`);

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

      // 2. Marcar sistema como em renovação no banco
      await db
        .update(sistemasTable)
        .set({
          updatedAt: new Date(),
          lastRenewalAt: new Date(),
          renewalCount: sql`COALESCE(renewal_count, 0) + 1`
        })
        .where(eq(sistemasTable.id, sistema.id));

      console.log(`✅ Sistema ${sistema.id} - ${sistema.username} renovado com sucesso`);

      // 3. Agendar remoção da flag de renovação após 5 minutos
      setTimeout(() => {
        this.isRenewing.delete(sistema.id);
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