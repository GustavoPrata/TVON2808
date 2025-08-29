import { db } from "./db";
import { 
  clientes, pontos, pagamentos, conversas, mensagens, tickets, 
  botConfig, notificacoesConfig, integracoes, logs, users, sistemas, redirectUrls, whatsappSettings, testes, indicacoes, mensagensRapidas, pixState,
  avisosVencimento, configAvisos, anotacoes,
  type Cliente, type InsertCliente, type Ponto, type InsertPonto,
  type Pagamento, type InsertPagamento, type Conversa, type InsertConversa,
  type Mensagem, type InsertMensagem, type Ticket, type InsertTicket,
  type BotConfig, type InsertBotConfig, type NotificacaoConfig, type InsertNotificacaoConfig,
  type Integracao, type InsertIntegracao, type Log, type InsertLog,
  type User, type InsertUser, type Sistema, type InsertSistema,
  type RedirectUrl, type InsertRedirectUrl, type WhatsappSettings, type InsertWhatsappSettings,
  type Teste, type InsertTeste, type Indicacao, type InsertIndicacao,
  type MensagemRapida, type InsertMensagemRapida,
  type AvisoVencimento, type InsertAvisoVencimento,
  type ConfigAvisos, type InsertConfigAvisos,
  type Anotacao, type InsertAnotacao
} from "@shared/schema";
import { eq, desc, asc, sql, and, or, gte, lte, ilike, ne, count } from "drizzle-orm";

export interface IStorage {
  // Clientes
  getClientes(): Promise<Cliente[]>;
  getClienteById(id: number): Promise<Cliente | undefined>;
  getClienteByTelefone(telefone: string): Promise<Cliente | undefined>;
  getClienteByNome(nome: string): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente>;
  deleteCliente(id: number): Promise<void>;
  searchClientes(term: string, tipo?: string): Promise<Cliente[]>;

  // Pontos
  getPontos(): Promise<Ponto[]>;
  getPontosByClienteId(clienteId: number): Promise<Ponto[]>;
  getAllPontos(): Promise<Ponto[]>;
  getPontoById(id: number): Promise<Ponto | undefined>;
  createPonto(ponto: InsertPonto): Promise<Ponto>;
  updatePonto(id: number, ponto: Partial<InsertPonto>): Promise<Ponto>;
  deletePonto(id: number): Promise<void>;

  // Pagamentos
  getPagamentosByClienteId(clienteId: number): Promise<Pagamento[]>;
  createPagamento(pagamento: InsertPagamento): Promise<Pagamento>;
  updatePagamento(id: number, pagamento: Partial<InsertPagamento>): Promise<Pagamento>;
  getPagamentoByPixId(pixId: string): Promise<Pagamento | undefined>;
  getPagamentosWithClientes(): Promise<(Pagamento & { cliente?: Cliente })[]>;

  // Conversas
  getConversas(): Promise<Conversa[]>;
  getConversaById(id: number): Promise<Conversa | undefined>;
  getConversaByTelefone(telefone: string): Promise<Conversa | undefined>;
  createConversa(conversa: InsertConversa): Promise<Conversa>;
  updateConversa(id: number, conversa: Partial<InsertConversa>): Promise<Conversa>;
  deleteConversa(id: number): Promise<void>;
  mergeConversasDuplicadas(): Promise<number>;

  // Mensagens
  getMensagensByConversaId(conversaId: number, limit?: number, offset?: number): Promise<Mensagem[]>;
  countMensagensByConversaId(conversaId: number): Promise<number>;
  getMensagemById(id: number): Promise<Mensagem | undefined>;
  createMensagem(mensagem: InsertMensagem): Promise<Mensagem>;
  updateMensagem(id: number, mensagem: Partial<InsertMensagem>): Promise<Mensagem>;
  deleteMessagesByConversaId(conversaId: number): Promise<void>;

  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicketById(id: number): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, ticket: Partial<InsertTicket>): Promise<Ticket>;

  // Bot Config
  getBotConfig(): Promise<BotConfig[]>;
  getBotConfigByTipo(tipo: string): Promise<BotConfig | undefined>;
  createBotConfig(config: InsertBotConfig): Promise<BotConfig>;
  updateBotConfig(id: number, config: Partial<InsertBotConfig>): Promise<BotConfig>;

  // Notificações Config
  getNotificacoesConfig(): Promise<NotificacaoConfig[]>;
  getNotificacaoConfigByTipo(tipo: string): Promise<NotificacaoConfig | undefined>;
  createNotificacaoConfig(config: InsertNotificacaoConfig): Promise<NotificacaoConfig>;
  updateNotificacaoConfig(id: number, config: Partial<InsertNotificacaoConfig>): Promise<NotificacaoConfig>;

  // Integrações
  getIntegracoes(): Promise<Integracao[]>;
  getIntegracaoByTipo(tipo: string): Promise<Integracao | undefined>;
  createIntegracao(integracao: InsertIntegracao): Promise<Integracao>;
  updateIntegracao(id: number, integracao: Partial<InsertIntegracao>): Promise<Integracao>;

  // Logs
  getLogs(limit?: number): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  clearLogs(): Promise<void>;
  getPixLogs(limit?: number): Promise<Log[]>;

  // Dashboard
  getDashboardStats(): Promise<{
    totalClientes: number;
    clientesAtivos: number;
    vencendo5Dias: number;
    receitaMensal: number;
    clientesPorApp: Array<{ aplicativo: string; count: number }>;
    vencimentosProximos: Array<Cliente & { diasRestantes: number }>;
  }>;

  // Vencimentos
  getVencimentosProximos(dias: number): Promise<Cliente[]>;
  getVencimentosVencidos(): Promise<Cliente[]>;

  // Users (for compatibility)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sistemas
  getSistemas(): Promise<Sistema[]>;
  getSistemaById(id: number): Promise<Sistema | undefined>;
  getSistemaBySystemId(systemId: string): Promise<Sistema | undefined>;
  createSistema(sistema: InsertSistema): Promise<Sistema>;
  updateSistema(id: number, sistema: Partial<InsertSistema>): Promise<Sistema>;
  deleteSistema(id: number): Promise<void>;
  syncSistemasFromApi(apiSystems: Array<{system_id: string; username: string; password: string}>): Promise<void>;

  // Redirect URLs
  getRedirectUrls(): Promise<RedirectUrl[]>;
  getRedirectUrlById(id: number): Promise<RedirectUrl | undefined>;
  createRedirectUrl(url: InsertRedirectUrl): Promise<RedirectUrl>;
  updateRedirectUrl(id: number, url: Partial<InsertRedirectUrl>): Promise<RedirectUrl>;
  deleteRedirectUrl(id: number): Promise<void>;
  setPrincipalUrl(id: number): Promise<void>;
  
  // WhatsApp Settings
  getWhatsAppSettings(): Promise<WhatsappSettings>;
  updateWhatsAppSettings(settings: Partial<InsertWhatsappSettings>): Promise<WhatsappSettings>;
  
  // Testes
  getTestes(): Promise<Teste[]>;
  getTesteById(id: number): Promise<Teste | undefined>;
  getTesteByTelefone(telefone: string): Promise<Teste[]>;
  getTesteAtivoByTelefone(telefone: string): Promise<Teste | undefined>;
  getAnyTesteByTelefone(telefone: string): Promise<Teste | undefined>;
  createTeste(teste: InsertTeste): Promise<Teste>;
  updateTeste(id: number, teste: Partial<InsertTeste>): Promise<Teste>;
  deleteTeste(id: number): Promise<void>;
  getTestesAtivos(): Promise<Teste[]>;
  getTestesExpirados(): Promise<Teste[]>;
  getTestesExpiradosNaoNotificados(): Promise<Teste[]>;
  expireOldTestes(): Promise<void>;
  
  // Indicações (Referral System)
  getIndicacoesByIndicadorId(indicadorId: number): Promise<Indicacao[]>;
  getIndicacoesByIndicadoId(indicadoId: number): Promise<Indicacao | undefined>;
  getIndicacaoById(id: number): Promise<Indicacao | undefined>;
  createIndicacao(indicacao: InsertIndicacao): Promise<Indicacao>;
  updateIndicacao(id: number, indicacao: Partial<InsertIndicacao>): Promise<Indicacao>;
  confirmarIndicacao(id: number): Promise<void>;
  getIndicacoesPendentes(): Promise<Indicacao[]>;
  getIndicacoesConfirmadas(indicadorId?: number): Promise<Indicacao[]>;
  
  // Mensagens Rápidas
  getMensagensRapidas(): Promise<MensagemRapida[]>;
  getMensagemRapidaById(id: number): Promise<MensagemRapida | undefined>;
  createMensagemRapida(mensagem: InsertMensagemRapida): Promise<MensagemRapida>;
  updateMensagemRapida(id: number, mensagem: Partial<InsertMensagemRapida>): Promise<MensagemRapida>;
  deleteMensagemRapida(id: number): Promise<void>;
  getMensagensRapidasAtivas(): Promise<MensagemRapida[]>;

  // PIX State
  getPixState(conversaId: number): Promise<any | undefined>;
  createPixState(data: any): Promise<any>;
  updatePixState(id: number, data: any): Promise<any>;
  deletePixState(conversaId: number): Promise<void>;

  // Avisos de Vencimento
  getAvisosVencimento(): Promise<AvisoVencimento[]>;
  getAvisoByClienteId(clienteId: number, dataVencimento: Date): Promise<AvisoVencimento | undefined>;
  createAvisoVencimento(aviso: InsertAvisoVencimento): Promise<AvisoVencimento>;
  getAvisosHoje(): Promise<AvisoVencimento[]>;
  
  // Configuração de Avisos
  getConfigAvisos(): Promise<ConfigAvisos | undefined>;
  updateConfigAvisos(config: Partial<InsertConfigAvisos>): Promise<ConfigAvisos>;
  
  // Anotações
  getAnotacoes(): Promise<Anotacao[]>;
  getAnotacaoById(id: number): Promise<Anotacao | undefined>;
  createAnotacao(anotacao: InsertAnotacao): Promise<Anotacao>;
  updateAnotacao(id: number, anotacao: Partial<InsertAnotacao>): Promise<Anotacao>;
  deleteAnotacao(id: number): Promise<void>;
  reorderAnotacoes(ids: number[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getClientes(): Promise<Cliente[]> {
    return await db.select().from(clientes).orderBy(desc(clientes.dataCadastro));
  }

  async getClienteById(id: number): Promise<Cliente | undefined> {
    const result = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
    return result[0];
  }

  async getClienteByTelefone(telefone: string): Promise<Cliente | undefined> {
    // Validate input
    if (!telefone || telefone.length < 8) {
      return undefined;
    }
    
    // Normaliza o telefone removendo caracteres não numéricos
    const phoneClean = telefone.replace(/\D/g, '');
    
    // If phone is too short after cleaning, return undefined
    if (phoneClean.length < 8) {
      return undefined;
    }
    
    // Tenta buscar com o número exato
    let result = await db.select().from(clientes).where(eq(clientes.telefone, telefone)).limit(1);
    
    if (!result[0] && phoneClean.length >= 10) {
      // Se não encontrou, tenta com/sem código 55
      if (phoneClean.startsWith('55') && phoneClean.length > 11) {
        // Remove o 55 e tenta novamente
        const phoneWithout55 = phoneClean.substring(2);
        if (phoneWithout55.length >= 10) {
          result = await db.select().from(clientes).where(
            or(
              eq(clientes.telefone, phoneWithout55),
              eq(clientes.telefone, phoneClean)
            )
          ).limit(1);
        }
      } else {
        // Adiciona o 55 e tenta novamente
        const phoneWith55 = '55' + phoneClean;
        result = await db.select().from(clientes).where(
          or(
            eq(clientes.telefone, phoneWith55),
            eq(clientes.telefone, phoneClean)
          )
        ).limit(1);
      }
    }
    
    return result[0];
  }

  async getClienteByNome(nome: string): Promise<Cliente | undefined> {
    const result = await db.select().from(clientes).where(eq(clientes.nome, nome)).limit(1);
    return result[0];
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    // Ajustar vencimento para 23:59:59 se fornecido
    const clienteData = { ...cliente };
    if (clienteData.vencimento) {
      const vencimentoDate = new Date(clienteData.vencimento);
      vencimentoDate.setHours(23, 59, 59, 999);
      clienteData.vencimento = vencimentoDate;
    }
    
    const result = await db.insert(clientes).values(clienteData).returning();
    return result[0];
  }

  async updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente> {
    // Ajustar vencimento para 23:59:59 se fornecido
    const clienteData = { ...cliente };
    if (clienteData.vencimento) {
      const vencimentoDate = new Date(clienteData.vencimento);
      vencimentoDate.setHours(23, 59, 59, 999);
      clienteData.vencimento = vencimentoDate;
    }
    
    const result = await db.update(clientes).set(clienteData).where(eq(clientes.id, id)).returning();
    return result[0];
  }

  async deleteCliente(id: number): Promise<void> {
    // Delete all related data first
    // Delete indicacoes where this client is either indicador or indicado
    await db.delete(indicacoes).where(
      or(
        eq(indicacoes.indicadorId, id),
        eq(indicacoes.indicadoId, id)
      )
    );
    
    // Delete pontos
    await db.delete(pontos).where(eq(pontos.clienteId, id));
    
    // Delete pagamentos
    await db.delete(pagamentos).where(eq(pagamentos.clienteId, id));
    
    // Delete conversas
    await db.delete(conversas).where(eq(conversas.clienteId, id));
    
    // Delete tickets
    await db.delete(tickets).where(eq(tickets.clienteId, id));
    
    // Finally delete the cliente
    await db.delete(clientes).where(eq(clientes.id, id));
  }

  async searchClientes(term: string, tipo?: string): Promise<Cliente[]> {
    if (tipo) {
      return await db.select().from(clientes).where(and(
        eq(clientes.tipo, tipo),
        or(
          ilike(clientes.nome, `%${term}%`),
          ilike(clientes.telefone, `%${term}%`)
        )
      )).orderBy(desc(clientes.dataCadastro));
    } else {
      return await db.select().from(clientes).where(
        or(
          ilike(clientes.nome, `%${term}%`),
          ilike(clientes.telefone, `%${term}%`)
        )
      ).orderBy(desc(clientes.dataCadastro));
    }
  }

  async getPontos(): Promise<Ponto[]> {
    return await db.select().from(pontos).orderBy(desc(pontos.expiracao));
  }

  async getPontosByClienteId(clienteId: number): Promise<Ponto[]> {
    return await db.select().from(pontos).where(eq(pontos.clienteId, clienteId));
  }

  async getAllPontos(): Promise<Ponto[]> {
    return await db.select().from(pontos).orderBy(desc(pontos.expiracao));
  }

  async getPontoById(id: number): Promise<Ponto | undefined> {
    const result = await db.select().from(pontos).where(eq(pontos.id, id)).limit(1);
    return result[0];
  }

  async createPonto(ponto: InsertPonto): Promise<Ponto> {
    const result = await db.insert(pontos).values(ponto).returning();
    return result[0];
  }

  async updatePonto(id: number, ponto: Partial<InsertPonto>): Promise<Ponto> {
    const result = await db.update(pontos).set(ponto).where(eq(pontos.id, id)).returning();
    return result[0];
  }

  async deletePonto(id: number): Promise<void> {
    await db.delete(pontos).where(eq(pontos.id, id));
  }

  async getPagamentosByClienteId(clienteId: number): Promise<Pagamento[]> {
    return await db.select().from(pagamentos).where(eq(pagamentos.clienteId, clienteId)).orderBy(desc(pagamentos.dataCriacao));
  }

  async createPagamento(pagamento: InsertPagamento): Promise<Pagamento> {
    const result = await db.insert(pagamentos).values(pagamento).returning();
    return result[0];
  }

  async updatePagamento(id: number, pagamento: Partial<InsertPagamento>): Promise<Pagamento> {
    const result = await db.update(pagamentos).set(pagamento).where(eq(pagamentos.id, id)).returning();
    return result[0];
  }

  async getPagamentoByPixId(pixId: string): Promise<Pagamento | undefined> {
    const result = await db.select().from(pagamentos).where(eq(pagamentos.pixId, pixId)).limit(1);
    return result[0];
  }

  async getPagamentoByChargeId(chargeId: string): Promise<Pagamento | undefined> {
    const result = await db.select().from(pagamentos).where(eq(pagamentos.chargeId, chargeId)).limit(1);
    return result[0];
  }

  async updatePagamentoByChargeId(chargeId: string, pagamento: Partial<InsertPagamento>): Promise<Pagamento | undefined> {
    const result = await db.update(pagamentos).set(pagamento).where(eq(pagamentos.chargeId, chargeId)).returning();
    return result[0];
  }

  async getPagamentosWithClientes(): Promise<(Pagamento & { cliente?: Cliente })[]> {
    const result = await db.select()
      .from(pagamentos)
      .leftJoin(clientes, eq(pagamentos.clienteId, clientes.id))
      .orderBy(desc(pagamentos.dataCriacao));
    
    return result.map(row => ({
      ...row.pagamentos,
      cliente: row.clientes || undefined
    }));
  }

  async getLastPagamentoByClienteId(clienteId: number): Promise<Pagamento | undefined> {
    const result = await db.select()
      .from(pagamentos)
      .where(eq(pagamentos.clienteId, clienteId))
      .orderBy(desc(pagamentos.dataCriacao))
      .limit(1);
    return result[0];
  }

  async getConversas(): Promise<Conversa[]> {
    return await db.select().from(conversas).orderBy(desc(conversas.dataUltimaMensagem));
  }

  async getConversaById(id: number): Promise<Conversa | undefined> {
    const result = await db.select().from(conversas).where(eq(conversas.id, id)).limit(1);
    return result[0];
  }

  async getConversaByTelefone(telefone: string): Promise<Conversa | undefined> {
    const result = await db.select().from(conversas).where(eq(conversas.telefone, telefone)).limit(1);
    return result[0];
  }

  async createConversa(conversa: InsertConversa): Promise<Conversa> {
    const result = await db.insert(conversas).values(conversa).returning();
    return result[0];
  }

  async updateConversa(id: number, conversa: Partial<InsertConversa>): Promise<Conversa> {
    const result = await db.update(conversas).set(conversa).where(eq(conversas.id, id)).returning();
    return result[0];
  }

  async getMensagensByConversaId(conversaId: number, limit = 50, offset = 0): Promise<Mensagem[]> {
    console.log(`getMensagensByConversaId: conversaId=${conversaId}, limit=${limit}, offset=${offset}`);
    
    // Order by desc to get newest messages first, then reverse in frontend
    const messages = await db.select()
      .from(mensagens)
      .where(eq(mensagens.conversaId, conversaId))
      .orderBy(desc(mensagens.timestamp))
      .limit(limit)
      .offset(offset);
    
    console.log(`Retrieved ${messages.length} messages from database`);
    return messages;
  }
  
  async countMensagensByConversaId(conversaId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(mensagens)
      .where(eq(mensagens.conversaId, conversaId));
    return Number(result[0]?.count || 0);
  }

  async getMensagemById(id: number): Promise<Mensagem | undefined> {
    const [mensagem] = await db.select().from(mensagens).where(eq(mensagens.id, id));
    return mensagem;
  }

  async getMensagemByWhatsappId(whatsappMessageId: string): Promise<Mensagem | undefined> {
    const [mensagem] = await db.select()
      .from(mensagens)
      .where(sql`${mensagens.metadados}->>'whatsappMessageId' = ${whatsappMessageId}`)
      .limit(1);
    return mensagem;
  }

  async createMensagem(mensagem: InsertMensagem): Promise<Mensagem> {
    const result = await db.insert(mensagens).values(mensagem).returning();
    return result[0];
  }

  async updateMensagem(id: number, mensagem: Partial<InsertMensagem>): Promise<Mensagem> {
    const result = await db.update(mensagens).set(mensagem).where(eq(mensagens.id, id)).returning();
    return result[0];
  }

  async deleteConversa(id: number): Promise<void> {
    // First delete all messages from this conversation
    await db.delete(mensagens).where(eq(mensagens.conversaId, id));
    
    // Delete all tickets related to this conversation
    await db.delete(tickets).where(eq(tickets.conversaId, id));
    
    // Try to delete PIX state - ignore if table doesn't exist
    try {
      await db.delete(pixState).where(eq(pixState.conversaId, id));
    } catch (error: any) {
      // Ignore error if table doesn't exist
      if (!error.message?.includes('does not exist')) {
        console.error('Error deleting PIX state:', error);
      }
    }
    
    // Then delete the conversation itself
    await db.delete(conversas).where(eq(conversas.id, id));
  }

  async mergeConversasDuplicadas(): Promise<number> {
    try {
      // Busca todos os telefones com conversas duplicadas
      const duplicados = await db.select({
        telefone: conversas.telefone,
        count: sql<number>`count(*)`,
      })
        .from(conversas)
        .groupBy(conversas.telefone)
        .having(sql`count(*) > 1`);

      let totalMerged = 0;

      for (const { telefone } of duplicados) {
        // Busca todas as conversas deste telefone ordenadas por data (mais recente primeiro)
        const conversasDuplicadas = await db.select()
          .from(conversas)
          .where(eq(conversas.telefone, telefone))
          .orderBy(desc(conversas.dataUltimaMensagem), desc(conversas.id));

        if (conversasDuplicadas.length > 1) {
          const conversaPrincipal = conversasDuplicadas[0]; // Mantém a mais recente
          const conversasParaDeletar = conversasDuplicadas.slice(1);

          // Move todas as mensagens das conversas duplicadas para a conversa principal
          for (const conversaDup of conversasParaDeletar) {
            await db.update(mensagens)
              .set({ conversaId: conversaPrincipal.id })
              .where(eq(mensagens.conversaId, conversaDup.id));

            // Move tickets se houver
            await db.update(tickets)
              .set({ conversaId: conversaPrincipal.id })
              .where(eq(tickets.conversaId, conversaDup.id));

            // Move PIX state se houver
            const pixStateRows = await db.select()
              .from(pixState)
              .where(eq(pixState.conversaId, conversaDup.id))
              .limit(1);
              
            if (pixStateRows.length > 0) {
              // Verifica se já existe um PIX state para a conversa principal
              const existingPixState = await db.select()
                .from(pixState)
                .where(eq(pixState.conversaId, conversaPrincipal.id))
                .limit(1);
                
              if (existingPixState.length === 0) {
                // Move o PIX state para a conversa principal
                await db.update(pixState)
                  .set({ conversaId: conversaPrincipal.id })
                  .where(eq(pixState.conversaId, conversaDup.id));
              } else {
                // Se já existe, deleta o duplicado
                await db.delete(pixState)
                  .where(eq(pixState.conversaId, conversaDup.id));
              }
            }

            // Deleta a conversa duplicada
            await db.delete(conversas).where(eq(conversas.id, conversaDup.id));
            totalMerged++;
          }

          console.log(`Merged ${conversasParaDeletar.length} duplicate conversations for ${telefone}`);
        }
      }

      return totalMerged;
    } catch (error) {
      console.error('Error merging duplicate conversations:', error);
      throw error;
    }
  }

  async deleteMessagesByConversaId(conversaId: number): Promise<void> {
    await db.delete(mensagens).where(eq(mensagens.conversaId, conversaId));
  }

  async markConversationMessagesAsRead(conversaId: number): Promise<void> {
    await db.update(mensagens)
      .set({ lida: true })
      .where(and(
        eq(mensagens.conversaId, conversaId),
        eq(mensagens.remetente, 'cliente'),
        eq(mensagens.lida, false)
      ));
  }

  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.dataCriacao));
  }

  async getTicketById(id: number): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0];
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const result = await db.insert(tickets).values(ticket).returning();
    return result[0];
  }

  async updateTicket(id: number, ticket: Partial<InsertTicket>): Promise<Ticket> {
    const result = await db.update(tickets).set(ticket).where(eq(tickets.id, id)).returning();
    return result[0];
  }
  
  async getOpenTicketByConversaId(conversaId: number): Promise<Ticket | undefined> {
    const result = await db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.conversaId, conversaId),
        eq(tickets.status, 'aberto')
      ))
      .limit(1);
    return result[0];
  }
  
  async getTicket(id: number): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0];
  }

  async getBotConfig(): Promise<BotConfig[]> {
    return await db.select().from(botConfig);
  }

  async getBotConfigByTipo(tipo: string): Promise<BotConfig | undefined> {
    const result = await db.select().from(botConfig)
      .where(and(eq(botConfig.tipo, tipo), eq(botConfig.ativo, true)))
      .limit(1);
    return result[0];
  }

  async createBotConfig(config: InsertBotConfig): Promise<BotConfig> {
    // Se a nova configuração estiver ativa, desativa as outras do mesmo tipo
    if (config.ativo) {
      await db.update(botConfig)
        .set({ ativo: false })
        .where(eq(botConfig.tipo, config.tipo));
    }
    
    const result = await db.insert(botConfig).values(config).returning();
    return result[0];
  }

  async updateBotConfig(id: number, config: Partial<InsertBotConfig>): Promise<BotConfig> {
    // Se estiver ativando esta configuração, desativa as outras do mesmo tipo
    if (config.ativo === true) {
      const currentConfig = await db.select().from(botConfig).where(eq(botConfig.id, id)).limit(1);
      if (currentConfig[0]) {
        await db.update(botConfig)
          .set({ ativo: false })
          .where(and(eq(botConfig.tipo, currentConfig[0].tipo), ne(botConfig.id, id)));
      }
    }
    
    const result = await db.update(botConfig).set(config).where(eq(botConfig.id, id)).returning();
    return result[0];
  }

  async getNotificacoesConfig(): Promise<NotificacaoConfig[]> {
    return await db.select().from(notificacoesConfig);
  }

  async getNotificacaoConfigByTipo(tipo: string): Promise<NotificacaoConfig | undefined> {
    const result = await db.select().from(notificacoesConfig).where(eq(notificacoesConfig.tipo, tipo)).limit(1);
    return result[0];
  }

  async createNotificacaoConfig(config: InsertNotificacaoConfig): Promise<NotificacaoConfig> {
    const result = await db.insert(notificacoesConfig).values(config).returning();
    return result[0];
  }

  async updateNotificacaoConfig(id: number, config: Partial<InsertNotificacaoConfig>): Promise<NotificacaoConfig> {
    const result = await db.update(notificacoesConfig).set(config).where(eq(notificacoesConfig.id, id)).returning();
    return result[0];
  }

  async getIntegracoes(): Promise<Integracao[]> {
    return await db.select().from(integracoes);
  }

  async getIntegracaoByTipo(tipo: string): Promise<Integracao | undefined> {
    const result = await db.select().from(integracoes).where(eq(integracoes.tipo, tipo)).limit(1);
    return result[0];
  }

  async createIntegracao(integracao: InsertIntegracao): Promise<Integracao> {
    const result = await db.insert(integracoes).values(integracao).returning();
    return result[0];
  }

  async updateIntegracao(id: number, integracao: Partial<InsertIntegracao>): Promise<Integracao> {
    const result = await db.update(integracoes).set(integracao).where(eq(integracoes.id, id)).returning();
    return result[0];
  }

  async getLogs(limit = 100): Promise<Log[]> {
    return await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
  }

  async createLog(log: InsertLog): Promise<Log> {
    const result = await db.insert(logs).values(log).returning();
    return result[0];
  }

  async clearLogs(): Promise<void> {
    await db.delete(logs);
  }

  async getPixLogs(limit = 100): Promise<any[]> {
    // Map the database columns to match frontend expectations
    const result = await db.execute(sql`
      SELECT 
        id,
        nivel as tipo,
        mensagem as acao,
        detalhes,
        timestamp
      FROM logs
      WHERE 
        LOWER(origem) LIKE '%pix%' OR 
        LOWER(mensagem) LIKE '%pix%' OR 
        LOWER(detalhes::text) LIKE '%pix%' OR 
        LOWER(detalhes::text) LIKE '%woovi%' OR 
        LOWER(detalhes::text) LIKE '%webhook%'
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);
    return result as any[];
  }

  async getDashboardStats() {
    const [totalClientes] = await db.select({ count: sql<number>`count(*)` }).from(clientes);
    const [clientesAtivos] = await db.select({ count: sql<number>`count(*)` }).from(clientes).where(eq(clientes.status, 'ativo'));
    
    const vencendo5Dias = await db.select({ count: sql<number>`count(*)` })
      .from(clientes)
      .where(and(
        eq(clientes.status, 'ativo'),
        lte(clientes.vencimento, sql`now() + interval '5 days'`),
        gte(clientes.vencimento, sql`now()`)
      ));

    // Calcula receita mensal somando os valores de todos os pontos ativos
    const receitaMensal = await db.select({ 
      total: sql<number>`COALESCE(sum(CAST(${pontos.valor} AS DECIMAL)), 0)` 
    })
    .from(pontos)
    .innerJoin(clientes, eq(pontos.clienteId, clientes.id))
    .where(eq(clientes.status, 'ativo'));

    const clientesPorApp = await db.select({
      aplicativo: pontos.aplicativo,
      count: sql<number>`count(distinct ${pontos.clienteId})`
    })
    .from(pontos)
    .groupBy(pontos.aplicativo);

    const vencimentosProximos = await db.select()
      .from(clientes)
      .where(and(
        eq(clientes.status, 'ativo'),
        lte(clientes.vencimento, sql`now() + interval '7 days'`),
        gte(clientes.vencimento, sql`now()`)
      ))
      .orderBy(asc(clientes.vencimento))
      .limit(10);

    // Buscar Top Indicadores
    const topIndicadores = await db.select({
      id: clientes.id,
      nome: clientes.nome,
      telefone: clientes.telefone,
      totalIndicacoes: clientes.totalIndicacoes,
      indicacoesConfirmadas: clientes.indicacoesConfirmadas,
      mesesGratisAcumulados: clientes.mesesGratisAcumulados
    })
    .from(clientes)
    .where(sql`${clientes.totalIndicacoes} > 0`)
    .orderBy(desc(clientes.indicacoesConfirmadas), desc(clientes.totalIndicacoes))
    .limit(5);

    // Estatísticas de indicações
    const [totalIndicacoes] = await db.select({ count: sql<number>`count(*)` }).from(indicacoes);
    const [indicacoesConfirmadas] = await db.select({ count: sql<number>`count(*)` })
      .from(indicacoes)
      .where(eq(indicacoes.status, 'confirmada'));
    const [indicacoesPendentes] = await db.select({ count: sql<number>`count(*)` })
      .from(indicacoes)
      .where(eq(indicacoes.status, 'pendente'));

    return {
      totalClientes: totalClientes.count,
      clientesAtivos: clientesAtivos.count,
      vencendo5Dias: vencendo5Dias[0]?.count || 0,
      receitaMensal: Number(receitaMensal[0]?.total || 0),
      clientesPorApp: clientesPorApp.map(item => ({
        aplicativo: item.aplicativo,
        count: item.count
      })),
      vencimentosProximos: vencimentosProximos.map(cliente => ({
        ...cliente,
        diasRestantes: 0 // Será calculado no frontend
      })),
      topIndicadores: topIndicadores || [],
      indicacoesStats: {
        total: totalIndicacoes.count || 0,
        confirmadas: indicacoesConfirmadas.count || 0,
        pendentes: indicacoesPendentes.count || 0
      }
    };
  }

  async getVencimentosProximos(dias: number): Promise<Cliente[]> {
    try {
      const hoje = new Date();
      const dataLimite = new Date(hoje.getTime() + dias * 24 * 60 * 60 * 1000);
      
      return await db.select()
        .from(clientes)
        .where(and(
          eq(clientes.status, 'ativo'),
          lte(clientes.vencimento, dataLimite),
          gte(clientes.vencimento, hoje)
        ))
        .orderBy(asc(clientes.vencimento));
    } catch (error) {
      console.error('Erro ao buscar vencimentos próximos:', error);
      return [];
    }
  }

  async getVencimentosVencidos(): Promise<Cliente[]> {
    try {
      const hoje = new Date();
      
      return await db.select()
        .from(clientes)
        .where(and(
          eq(clientes.status, 'ativo'),
          lte(clientes.vencimento, hoje)
        ))
        .orderBy(asc(clientes.vencimento));
    } catch (error) {
      console.error('Erro ao buscar vencimentos vencidos:', error);
      return [];
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getSistemas(): Promise<Sistema[]> {
    try {
      return await db.select().from(sistemas).orderBy(asc(sistemas.systemId));
    } catch (error: any) {
      if (error.code === '42P01') {
        // Table doesn't exist, create it
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS sistemas (
            id SERIAL PRIMARY KEY,
            system_id TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            criado_em TIMESTAMP DEFAULT NOW(),
            atualizado_em TIMESTAMP DEFAULT NOW()
          )
        `);
        // Try again
        return await db.select().from(sistemas).orderBy(asc(sistemas.systemId));
      }
      throw error;
    }
  }

  async getSistemaById(id: number): Promise<Sistema | undefined> {
    const result = await db.select().from(sistemas).where(eq(sistemas.id, id)).limit(1);
    return result[0];
  }

  async getSistemaBySystemId(systemId: string): Promise<Sistema | undefined> {
    const result = await db.select().from(sistemas).where(eq(sistemas.systemId, systemId)).limit(1);
    return result[0];
  }

  async createSistema(sistema: InsertSistema): Promise<Sistema> {
    const result = await db.insert(sistemas).values(sistema).returning();
    return result[0];
  }

  async updateSistema(id: number, sistema: Partial<InsertSistema>): Promise<Sistema> {
    const result = await db.update(sistemas)
      .set({ ...sistema, atualizadoEm: new Date() })
      .where(eq(sistemas.id, id))
      .returning();
    return result[0];
  }

  async deleteSistema(id: number): Promise<void> {
    await db.delete(sistemas).where(eq(sistemas.id, id));
  }

  async syncSistemasFromApi(apiSystems: Array<{system_id: string; username: string; password: string}>): Promise<void> {
    // Get existing systems
    const existingSystems = await this.getSistemas();
    const existingSystemIds = new Set(existingSystems.map(s => s.systemId));

    // Add or update systems from API
    for (const apiSystem of apiSystems) {
      const existing = existingSystems.find(s => s.systemId === apiSystem.system_id);
      
      if (existing) {
        // Update if different
        if (existing.username !== apiSystem.username || existing.password !== apiSystem.password) {
          await this.updateSistema(existing.id, {
            username: apiSystem.username,
            password: apiSystem.password
          });
        }
      } else {
        // Create new
        await this.createSistema({
          systemId: apiSystem.system_id,
          username: apiSystem.username,
          password: apiSystem.password
        });
      }
    }

    // Remove systems that don't exist in API anymore
    const apiSystemIds = new Set(apiSystems.map(s => s.system_id));
    for (const existing of existingSystems) {
      if (!apiSystemIds.has(existing.systemId)) {
        await this.deleteSistema(existing.id);
      }
    }
  }

  // Update system active points count
  async updateSistemaActivePontos(sistemaId: number): Promise<void> {
    const [result] = await db.select({ count: count() })
      .from(pontos)
      .where(and(
        eq(pontos.sistemaId, sistemaId),
        eq(pontos.status, 'ativo')
      ));
    
    await db.update(sistemas)
      .set({ pontosAtivos: Number(result?.count || 0) })
      .where(eq(sistemas.id, sistemaId));
  }

  // Get available systems (not at max capacity)
  async getAvailableSistemas(): Promise<Sistema[]> {
    return await db.select()
      .from(sistemas)
      .where(sql`${sistemas.pontosAtivos} < ${sistemas.maxPontosAtivos}`)
      .orderBy(asc(sistemas.pontosAtivos));
  }

  // Redirect URLs methods
  async getRedirectUrls(): Promise<RedirectUrl[]> {
    return await db.select().from(redirectUrls).orderBy(desc(redirectUrls.isPrincipal), asc(redirectUrls.nome));
  }

  async getRedirectUrlById(id: number): Promise<RedirectUrl | undefined> {
    const [url] = await db.select().from(redirectUrls).where(eq(redirectUrls.id, id));
    return url;
  }

  async createRedirectUrl(url: InsertRedirectUrl): Promise<RedirectUrl> {
    const [created] = await db.insert(redirectUrls).values(url).returning();
    return created;
  }

  async updateRedirectUrl(id: number, url: Partial<InsertRedirectUrl>): Promise<RedirectUrl> {
    const [updated] = await db.update(redirectUrls).set(url).where(eq(redirectUrls.id, id)).returning();
    return updated;
  }

  async deleteRedirectUrl(id: number): Promise<void> {
    await db.delete(redirectUrls).where(eq(redirectUrls.id, id));
  }

  async setPrincipalUrl(id: number): Promise<void> {
    // First set all to false
    await db.update(redirectUrls).set({ isPrincipal: false });
    // Then set the selected one to true
    await db.update(redirectUrls).set({ isPrincipal: true }).where(eq(redirectUrls.id, id));
  }
  
  // WhatsApp Settings methods
  async getWhatsAppSettings(): Promise<WhatsappSettings> {
    const [settings] = await db.select().from(whatsappSettings).where(eq(whatsappSettings.id, 1));
    if (!settings) {
      // Create default settings if none exist
      const [created] = await db.insert(whatsappSettings).values({ id: 1 }).returning();
      return created;
    }
    return settings;
  }
  
  async updateWhatsAppSettings(settings: Partial<InsertWhatsappSettings>): Promise<WhatsappSettings> {
    const [updated] = await db.update(whatsappSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(whatsappSettings.id, 1))
      .returning();
    return updated;
  }
  
  // Test methods
  async getTestes(): Promise<Teste[]> {
    return await db.select().from(testes).orderBy(desc(testes.criadoEm));
  }
  
  async getTesteById(id: number): Promise<Teste | undefined> {
    const result = await db.select().from(testes).where(eq(testes.id, id)).limit(1);
    return result[0];
  }
  
  async getTesteByTelefone(telefone: string): Promise<Teste[]> {
    return await db.select().from(testes).where(eq(testes.telefone, telefone));
  }
  
  async getTesteAtivoByTelefone(telefone: string): Promise<Teste | undefined> {
    const now = new Date();
    const result = await db.select().from(testes)
      .where(and(
        eq(testes.telefone, telefone),
        eq(testes.status, 'ativo'),
        gte(testes.expiraEm, now)
      ))
      .orderBy(desc(testes.criadoEm))
      .limit(1);
    return result[0];
  }
  
  async getAnyTesteByTelefone(telefone: string): Promise<Teste | undefined> {
    // Get any test (active or expired) for this phone number
    const result = await db.select().from(testes)
      .where(and(
        eq(testes.telefone, telefone),
        ne(testes.status, 'deletado')
      ))
      .orderBy(desc(testes.criadoEm))
      .limit(1);
    return result[0];
  }
  
  async createTeste(teste: InsertTeste): Promise<Teste> {
    const result = await db.insert(testes).values(teste).returning();
    return result[0];
  }
  
  async updateTeste(id: number, teste: Partial<InsertTeste>): Promise<Teste> {
    const result = await db.update(testes).set(teste).where(eq(testes.id, id)).returning();
    return result[0];
  }
  
  async deleteTeste(id: number): Promise<void> {
    await db.delete(testes).where(eq(testes.id, id));
  }
  
  async getTestesAtivos(): Promise<Teste[]> {
    const now = new Date();
    return await db.select().from(testes)
      .where(and(
        eq(testes.status, 'ativo'),
        gte(testes.expiraEm, now)
      ))
      .orderBy(desc(testes.criadoEm));
  }
  
  async getTestesExpirados(): Promise<Teste[]> {
    const now = new Date();
    return await db.select().from(testes)
      .where(and(
        eq(testes.status, 'expirado'),
        lte(testes.expiraEm, now)
      ))
      .orderBy(desc(testes.criadoEm));
  }
  
  async getTestesExpiradosNaoNotificados(): Promise<Teste[]> {
    const now = new Date();
    // Busca testes ativos que já expiraram
    // Quando notificamos, mudamos o status para 'expirado'
    return await db.select().from(testes)
      .where(and(
        eq(testes.status, 'ativo'),
        lte(testes.expiraEm, now)
      ))
      .orderBy(desc(testes.criadoEm));
  }
  
  async getTestesDeletados(): Promise<Teste[]> {
    return await db.select().from(testes)
      .where(eq(testes.status, 'deletado'))
      .orderBy(desc(testes.criadoEm));
  }
  
  async expireOldTestes(): Promise<void> {
    const now = new Date();
    await db.update(testes)
      .set({ status: 'expirado' })
      .where(and(
        eq(testes.status, 'ativo'),
        lte(testes.expiraEm, now)
      ));
  }

  // Referral System Methods
  async getIndicacoesByIndicadorId(indicadorId: number): Promise<Indicacao[]> {
    return await db.select().from(indicacoes)
      .where(eq(indicacoes.indicadorId, indicadorId))
      .orderBy(desc(indicacoes.dataIndicacao));
  }

  async getIndicacoesByIndicadoId(indicadoId: number): Promise<Indicacao | undefined> {
    const result = await db.select().from(indicacoes)
      .where(eq(indicacoes.indicadoId, indicadoId))
      .limit(1);
    return result[0];
  }

  async getIndicacaoById(id: number): Promise<Indicacao | undefined> {
    const result = await db.select().from(indicacoes)
      .where(eq(indicacoes.id, id))
      .limit(1);
    return result[0];
  }

  async createIndicacao(indicacao: InsertIndicacao): Promise<Indicacao> {
    const result = await db.insert(indicacoes).values(indicacao).returning();
    return result[0];
  }

  async updateIndicacao(id: number, indicacao: Partial<InsertIndicacao>): Promise<Indicacao> {
    const result = await db.update(indicacoes)
      .set(indicacao)
      .where(eq(indicacoes.id, id))
      .returning();
    return result[0];
  }

  async confirmarIndicacao(id: number): Promise<void> {
    const indicacao = await this.getIndicacaoById(id);
    if (!indicacao) throw new Error('Indicação não encontrada');
    
    // Atualizar status da indicação
    await db.update(indicacoes)
      .set({ 
        status: 'confirmada', 
        dataConfirmacao: new Date(),
        mesGratisAplicado: true 
      })
      .where(eq(indicacoes.id, id));
    
    // Adicionar mês grátis ao indicador
    const indicador = await this.getClienteById(indicacao.indicadorId);
    if (indicador) {
      const mesesGratis = (indicador.mesesGratisAcumulados || 0) + 1;
      const indicacoesConfirmadas = (indicador.indicacoesConfirmadas || 0) + 1;
      
      await db.update(clientes)
        .set({ 
          mesesGratisAcumulados: mesesGratis,
          indicacoesConfirmadas: indicacoesConfirmadas
        })
        .where(eq(clientes.id, indicacao.indicadorId));
    }
  }

  async getIndicacoesPendentes(): Promise<Indicacao[]> {
    return await db.select().from(indicacoes)
      .where(eq(indicacoes.status, 'pendente'))
      .orderBy(desc(indicacoes.dataIndicacao));
  }

  async getIndicacoesConfirmadas(indicadorId?: number): Promise<Indicacao[]> {
    if (indicadorId) {
      return await db.select().from(indicacoes)
        .where(and(
          eq(indicacoes.indicadorId, indicadorId),
          eq(indicacoes.status, 'confirmada')
        ))
        .orderBy(desc(indicacoes.dataConfirmacao));
    }
    
    return await db.select().from(indicacoes)
      .where(eq(indicacoes.status, 'confirmada'))
      .orderBy(desc(indicacoes.dataConfirmacao));
  }

  // Mensagens Rápidas Implementation
  async getMensagensRapidas(): Promise<MensagemRapida[]> {
    return await db.select().from(mensagensRapidas).orderBy(mensagensRapidas.ordem);
  }

  async getMensagemRapidaById(id: number): Promise<MensagemRapida | undefined> {
    const result = await db.select().from(mensagensRapidas).where(eq(mensagensRapidas.id, id)).limit(1);
    return result[0];
  }

  async createMensagemRapida(mensagem: InsertMensagemRapida): Promise<MensagemRapida> {
    const result = await db.insert(mensagensRapidas).values(mensagem).returning();
    return result[0];
  }

  async updateMensagemRapida(id: number, mensagem: Partial<InsertMensagemRapida>): Promise<MensagemRapida> {
    const result = await db
      .update(mensagensRapidas)
      .set({ ...mensagem, atualizadoEm: new Date() })
      .where(eq(mensagensRapidas.id, id))
      .returning();
    return result[0];
  }

  async deleteMensagemRapida(id: number): Promise<void> {
    await db.delete(mensagensRapidas).where(eq(mensagensRapidas.id, id));
  }

  async getMensagensRapidasAtivas(): Promise<MensagemRapida[]> {
    return await db
      .select()
      .from(mensagensRapidas)
      .where(eq(mensagensRapidas.ativo, true))
      .orderBy(mensagensRapidas.ordem);
  }

  // PIX State Implementation
  async getPixState(conversaId: number): Promise<any | undefined> {
    const result = await db.select().from(pixState).where(eq(pixState.conversaId, conversaId)).limit(1);
    return result[0];
  }

  async createPixState(data: any): Promise<any> {
    const result = await db.insert(pixState).values(data).returning();
    return result[0];
  }

  async updatePixState(id: number, data: any): Promise<any> {
    const result = await db.update(pixState).set(data).where(eq(pixState.id, id)).returning();
    return result[0];
  }

  async deletePixState(conversaId: number): Promise<void> {
    await db.delete(pixState).where(eq(pixState.conversaId, conversaId));
  }

  // Avisos de Vencimento Implementation
  async getAvisosVencimento(): Promise<AvisoVencimento[]> {
    return await db.select().from(avisosVencimento).orderBy(desc(avisosVencimento.dataAviso));
  }

  async getAvisoByClienteId(clienteId: number, dataVencimento: Date): Promise<AvisoVencimento | undefined> {
    // Check if alert was sent today for this client
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await db.select().from(avisosVencimento)
      .where(and(
        eq(avisosVencimento.clienteId, clienteId),
        gte(avisosVencimento.dataAviso, today),
        lte(avisosVencimento.dataAviso, tomorrow)
      ))
      .limit(1);
    return result[0];
  }

  async createAvisoVencimento(aviso: InsertAvisoVencimento): Promise<AvisoVencimento> {
    const result = await db.insert(avisosVencimento).values(aviso).returning();
    return result[0];
  }

  async getAvisosHoje(): Promise<AvisoVencimento[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await db.select().from(avisosVencimento)
      .where(and(
        gte(avisosVencimento.dataAviso, today),
        lte(avisosVencimento.dataAviso, tomorrow)
      ))
      .orderBy(desc(avisosVencimento.dataAviso));
  }

  // Configuração de Avisos Implementation
  async getConfigAvisos(): Promise<ConfigAvisos | undefined> {
    const result = await db.select().from(configAvisos).limit(1);
    if (result.length === 0) {
      // Create default config if not exists
      const defaultConfig = await db.insert(configAvisos)
        .values({
          horaAviso: '09:00',
          diasAntecedencia: 0,
          ativo: true,
          mensagemPadrao: 'Olá {nome}! 👋\n\nSeu plano vence hoje. Renove agora para continuar aproveitando nossos serviços!\n\n💳 PIX disponível para pagamento rápido.'
        })
        .returning();
      return defaultConfig[0];
    }
    return result[0];
  }

  async updateConfigAvisos(config: Partial<InsertConfigAvisos>): Promise<ConfigAvisos> {
    const existing = await this.getConfigAvisos();
    if (existing) {
      const result = await db.update(configAvisos)
        .set({
          ...config,
          ultimaExecucao: config.ultimaExecucao || existing.ultimaExecucao
        })
        .where(eq(configAvisos.id, existing.id))
        .returning();
      return result[0];
    }
    // Create if not exists
    const result = await db.insert(configAvisos).values(config as InsertConfigAvisos).returning();
    return result[0];
  }

  // Anotações implementation
  async getAnotacoes(): Promise<Anotacao[]> {
    return await db.select().from(anotacoes).orderBy(anotacoes.ordem, anotacoes.criadoEm);
  }

  async getAnotacaoById(id: number): Promise<Anotacao | undefined> {
    const result = await db.select().from(anotacoes).where(eq(anotacoes.id, id)).limit(1);
    return result[0];
  }

  async createAnotacao(anotacao: InsertAnotacao): Promise<Anotacao> {
    const result = await db.insert(anotacoes).values(anotacao).returning();
    return result[0];
  }

  async updateAnotacao(id: number, anotacao: Partial<InsertAnotacao>): Promise<Anotacao> {
    const result = await db.update(anotacoes)
      .set({
        ...anotacao,
        atualizadoEm: new Date()
      })
      .where(eq(anotacoes.id, id))
      .returning();
    return result[0];
  }

  async deleteAnotacao(id: number): Promise<void> {
    await db.delete(anotacoes).where(eq(anotacoes.id, id));
  }

  async reorderAnotacoes(ids: number[]): Promise<void> {
    // Update order for each note
    const updates = ids.map((id, index) => 
      db.update(anotacoes)
        .set({ ordem: index, atualizadoEm: new Date() })
        .where(eq(anotacoes.id, id))
    );
    
    await Promise.all(updates);
  }
}

export const storage = new DatabaseStorage();
