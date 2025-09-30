import { db } from "./db";
import { 
  clientes, pontos, pagamentos, pagamentosManual, conversas, mensagens, tickets, 
  botConfig, notificacoesConfig, integracoes, logs, users, sistemas, redirectUrls, whatsappSettings, testes, indicacoes, mensagensRapidas, pixState,
  avisosVencimento, configAvisos, anotacoes, notificacoesRecorrentes,
  officeAutomationConfig, officeAutomationLogs, officeCredentials, extensionStatus, campaignTemplates,
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
  type Anotacao, type InsertAnotacao,
  type NotificacaoRecorrente, type InsertNotificacaoRecorrente,
  type OfficeAutomationConfig, type InsertOfficeAutomationConfig,
  type OfficeAutomationLogs, type InsertOfficeAutomationLogs,
  type OfficeCredentials, type InsertOfficeCredentials,
  type ExtensionStatus, type InsertExtensionStatus, type UpdateExtensionStatus,
  type CampaignTemplate, type InsertCampaignTemplate
} from "@shared/schema";
import { eq, desc, asc, sql, and, or, gte, lte, ilike, ne, count } from "drizzle-orm";

// Helper function to normalize system IDs (removes "sistema" prefix if present)
export function normalizeSystemId(systemId: string | null | undefined): string | null {
  if (!systemId) return null;
  
  // Remove "sistema" prefix if present, otherwise return as-is
  if (systemId.startsWith('sistema')) {
    return systemId.replace('sistema', '');
  }
  
  return systemId;
}

// Helper functions para mapeamento snake_case <-> camelCase
function mapSistemaToFrontend(sistema: Sistema): any {
  if (!sistema) return sistema;
  
  return {
    ...sistema,
    // Normalize systemId to always return numeric ID only
    systemId: normalizeSystemId(sistema.systemId),
    expiracao: sistema.expiracao, // map expiracao to expiracao for backward compatibility
    pontosAtivos: sistema.pontosAtivos,
    maxPontosAtivos: sistema.maxPontosAtivos,
    criadoEm: sistema.criadoEm,
    atualizadoEm: sistema.atualizadoEm
  };
}

function mapSistemaFromFrontend(data: any): any {
  if (!data) return data;
  
  // Map camelCase from frontend to snake_case for database
  const mapped: any = { ...data };
  
  if ('expiracao' in data) {
    mapped.expiracao = data.expiracao; // keep expiracao as is for database
  }
  
  // IMPORTANTE: Mapear o campo 'system' ou 'systemId' para persistir no banco
  if ('system' in data && data.system !== undefined) {
    mapped.systemId = normalizeSystemId(String(data.system));
  } else if ('systemId' in data && data.systemId !== undefined) {
    mapped.systemId = normalizeSystemId(String(data.systemId));
  }
  
  // Mapear outros campos relevantes
  if ('username' in data) {
    mapped.username = data.username;
  }
  if ('password' in data) {
    mapped.password = data.password;
  }
  if ('maxPontosAtivos' in data) {
    mapped.maxPontosAtivos = data.maxPontosAtivos;
  }
  if ('pontosAtivos' in data) {
    mapped.pontosAtivos = data.pontosAtivos;
  }
  
  return mapped;
}

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
  getAllPontos(): Promise<any[]>;
  getPontoById(id: number): Promise<Ponto | undefined>;
  createPonto(ponto: InsertPonto): Promise<Ponto>;
  updatePonto(id: number, ponto: Partial<InsertPonto>): Promise<Ponto>;
  deletePonto(id: number): Promise<void>;
  getPontosWithoutSistema(): Promise<Ponto[]>;
  updatePontoSistema(pontoId: number, sistemaId: number | null): Promise<Ponto>;
  bulkUpdatePontosSistema(updates: Array<{pontoId: number; sistemaId: number | null}>): Promise<void>;

  // Pagamentos
  getPagamentosByClienteId(clienteId: number): Promise<Pagamento[]>;
  createPagamento(pagamento: InsertPagamento): Promise<Pagamento>;
  updatePagamento(id: number, pagamento: Partial<InsertPagamento>): Promise<Pagamento>;
  getPagamentoByPixId(pixId: string): Promise<Pagamento | undefined>;
  getPagamentosWithClientes(): Promise<(Pagamento & { cliente?: Cliente })[]>;
  
  // Pagamentos Manuais
  createPagamentoManual(pagamento: any): Promise<any>;
  getPagamentoManualById(id: number): Promise<any | undefined>;
  getPagamentoManualByChargeId(chargeId: string): Promise<any | undefined>;
  updatePagamentoManualByChargeId(chargeId: string, pagamento: any): Promise<any | undefined>;

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
  getTicketsByConversaId(conversaId: number): Promise<Ticket[]>;
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
  
  // Campaign Templates
  getCampaignTemplates(): Promise<CampaignTemplate[]>;
  getCampaignTemplateById(id: number): Promise<CampaignTemplate | undefined>;
  getCampaignTemplateByKey(key: string): Promise<CampaignTemplate | undefined>;
  createCampaignTemplate(template: InsertCampaignTemplate): Promise<CampaignTemplate>;
  updateCampaignTemplate(id: number, template: Partial<InsertCampaignTemplate>): Promise<CampaignTemplate>;
  deleteCampaignTemplate(id: number): Promise<void>;
  incrementTemplateUsage(id: number): Promise<void>;

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
  syncSistemasToApi(externalApiService: any): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
  }>;
  // Métodos para gerenciamento de validade
  getSistemasParaRenovar(): Promise<Sistema[]>;
  getSistemasVencidos(): Promise<Sistema[]>;
  getSistemasProximoVencimento(dias: number): Promise<Sistema[]>;
  getSistemasExpirandoEm(minutos: number): Promise<Sistema[]>; // Sistemas expirando em X minutos
  updateSistemaRenewal(systemId: string, username: string, password: string): Promise<Sistema>;
  marcarSistemaComoRenovando(id: number): Promise<void>;
  getNextSistemaId(): Promise<string>;
  createSistemaAutoGenerated(data: { username: string; password: string; nome?: string; url?: string; expiracao?: Date }): Promise<Sistema>;
  marcarRenovacaoFalhou(id: number, erro: string): Promise<void>;
  registrarRenovacaoAutomatica(sistemaId: number, novaCredencial: {username: string; password: string}): Promise<void>;
  renovarSistema(systemId: string, data: any): Promise<void>; // Atualiza sistema com novos dados
  getAvailablePoints(): Promise<number>; // Retorna pontos disponíveis

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
  markTesteAsNotificado(id: number): Promise<void>; // Marca teste como notificado
  
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
  getAvisosVencimentoByClienteId(clienteId: number): Promise<AvisoVencimento[]>;
  
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
  
  // Conversas - Correção
  corrigirTelefoneConversa(telefoneIncorreto: string, telefoneCorreto: string): Promise<number>;
  
  // Notificações Recorrentes
  getNotificacoesRecorrentes(): Promise<NotificacaoRecorrente[]>;
  getNotificacaoRecorrenteByClienteId(clienteId: number): Promise<NotificacaoRecorrente | undefined>;
  createNotificacaoRecorrente(notificacao: InsertNotificacaoRecorrente): Promise<NotificacaoRecorrente>;
  updateNotificacaoRecorrente(id: number, notificacao: Partial<InsertNotificacaoRecorrente>): Promise<NotificacaoRecorrente>;
  deleteNotificacaoRecorrente(id: number): Promise<void>;
  getNotificacoesRecorrentesAtivas(): Promise<NotificacaoRecorrente[]>;
  getNotificacoesRecorrentesParaEnviar(): Promise<NotificacaoRecorrente[]>;
  resetNotificacaoRecorrente(clienteId: number): Promise<void>;

  // Office Automation Config
  getOfficeAutomationConfig(): Promise<OfficeAutomationConfig | null>;
  createOfficeAutomationConfig(config: InsertOfficeAutomationConfig): Promise<OfficeAutomationConfig>;
  updateOfficeAutomationConfig(config: Partial<InsertOfficeAutomationConfig>): Promise<OfficeAutomationConfig>;
  updateExistingFixedSystemsExpiry(): Promise<void>;
  
  // Office Automation Logs
  getOfficeAutomationLogs(limit?: number): Promise<OfficeAutomationLogs[]>;
  createOfficeAutomationLog(log: InsertOfficeAutomationLogs): Promise<OfficeAutomationLogs>;
  getOfficeAutomationLogsByAction(action: string, limit?: number): Promise<OfficeAutomationLogs[]>;
  
  // Task Management
  createPendingTask(taskType: string, data?: any): Promise<OfficeAutomationLogs>;
  getNextPendingTask(): Promise<OfficeAutomationLogs | null>;
  getNextPendingRenewalTask(): Promise<OfficeCredentials | null>;
  updateTaskStatus(taskId: number, status: string, result?: { username?: string; password?: string; errorMessage?: string }): Promise<OfficeAutomationLogs>;
  updateRenewalTaskStatus(taskId: number, username: string, password: string): Promise<OfficeCredentials>;
  getOfficeAutomationTaskById(taskId: number): Promise<OfficeAutomationLogs | null>;
  
  // Office Credentials
  getOfficeCredentials(limit?: number): Promise<OfficeCredentials[]>;
  createOfficeCredentials(credentials: InsertOfficeCredentials): Promise<OfficeCredentials>;
  getOfficeCredentialsByStatus(status: string): Promise<OfficeCredentials[]>;
  deleteOfficeCredential(id: number): Promise<void>;
  deleteAllOfficeCredentials(): Promise<void>;
  
  // Extension Status
  getExtensionStatus(): Promise<ExtensionStatus | undefined>;
  updateExtensionStatus(status: UpdateExtensionStatus): Promise<ExtensionStatus>;
  
  // Sync user systems to API
  syncUserSystemsToApi(externalApiService: any, dryRun?: boolean): Promise<{
    verificados: number;
    atualizados: number;
    ignorados: number;
    comErro: number;
    detalhes: Array<{
      usuario: string;
      sistemaAtual: number | null;
      sistemaCorreto: number;
      atualizado: boolean;
      motivo?: string;
      erro?: string;
    }>;
  }>;
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

  async getAllPontos(): Promise<any[]> {
    const result = await db
      .select()
      .from(pontos)
      .leftJoin(clientes, eq(pontos.clienteId, clientes.id))
      .orderBy(desc(pontos.expiracao));
    
    // Transform the result to include cliente data in ponto object
    return result.map(row => ({
      ...row.pontos,
      cliente: row.clientes || undefined
    }));
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

  async getPontosWithoutSistema(): Promise<Ponto[]> {
    const result = await db.select()
      .from(pontos)
      .where(sql`${pontos.sistemaId} IS NULL`)
      .orderBy(asc(pontos.id));
    return result;
  }

  async updatePontoSistema(pontoId: number, sistemaId: number | null): Promise<Ponto> {
    const result = await db.update(pontos)
      .set({ sistemaId })
      .where(eq(pontos.id, pontoId))
      .returning();
    return result[0];
  }

  async bulkUpdatePontosSistema(updates: Array<{pontoId: number; sistemaId: number | null}>): Promise<void> {
    // Use a transação para garantir atomicidade
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(pontos)
          .set({ sistemaId: update.sistemaId })
          .where(eq(pontos.id, update.pontoId));
      }
    });
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

  // Métodos para Pagamentos Manuais
  async createPagamentoManual(pagamento: any): Promise<any> {
    console.log('🔧 Criando pagamento manual com dados:', pagamento);
    
    try {
      // Usar SQL direto para incluir todos os campos necessários
      const result = await db.execute(sql`
        INSERT INTO pagamentos_manual (
          telefone, 
          valor, 
          status, 
          charge_id, 
          pix_id,
          pix_copia_e_cola,
          qr_code,
          payment_link_url,
          expires_in,
          metadata,
          data_vencimento,
          origem
        )
        VALUES (
          ${pagamento.telefone}, 
          ${pagamento.valor}, 
          ${pagamento.status || 'pendente'},
          ${pagamento.chargeId || null},
          ${pagamento.pixId || null},
          ${pagamento.pixCopiaECola || null},
          ${pagamento.qrCode || null},
          ${pagamento.paymentLinkUrl || null},
          ${pagamento.expiresIn || null},
          ${pagamento.metadata ? JSON.stringify(pagamento.metadata) : null},
          ${pagamento.dataVencimento || null},
          ${pagamento.origem || 'chat'}
        )
        RETURNING *
      `);
      
      // O Drizzle retorna um array direto, não um objeto com rows
      const inserted = Array.isArray(result) ? result[0] : result;
      console.log('✅ Pagamento manual criado com ID:', inserted?.id, 'e chargeId:', inserted?.charge_id);
      return inserted;
    } catch (error) {
      console.error('❌ Erro ao criar pagamento manual:', error);
      throw error;
    }
  }

  async getPagamentoManualById(id: number): Promise<any | undefined> {
    const result = await db.select().from(pagamentosManual).where(eq(pagamentosManual.id, id)).limit(1);
    return result[0];
  }

  async getPagamentoManualByChargeId(chargeId: string): Promise<any | undefined> {
    console.log('🔍 Buscando pagamento manual por chargeId:', chargeId);
    const result = await db.select().from(pagamentosManual).where(eq(pagamentosManual.chargeId, chargeId)).limit(1);
    console.log('📦 Pagamento encontrado:', result[0] ? `ID ${result[0].id}, Status: ${result[0].status}` : 'Não encontrado');
    return result[0];
  }

  async updatePagamentoManualByChargeId(chargeId: string, pagamento: any): Promise<any | undefined> {
    console.log('🔄 Atualizando pagamento manual com chargeId:', chargeId, 'Dados:', pagamento);
    const result = await db.update(pagamentosManual)
      .set({
        ...pagamento,
        dataPagamento: pagamento.status === 'pago' ? new Date() : undefined
      })
      .where(eq(pagamentosManual.chargeId, chargeId))
      .returning();
    console.log('✅ Pagamento atualizado:', result[0] ? `ID ${result[0].id}, Novo status: ${result[0].status}` : 'Falha na atualização');
    return result[0];
  }

  async getConversas(limit: number = 50): Promise<Conversa[]> {
    try {
      const result = await db.select()
        .from(conversas)
        .orderBy(desc(conversas.dataUltimaMensagem))
        .limit(limit);
      
      // No need to convert timestamps - they're already correct in DB
      // Just ensure we return them as-is
      return result;
    } catch (error) {
      console.error('Error fetching conversas:', error);
      // Return empty array on error to avoid blocking the UI
      return [];
    }
  }

  async getConversaById(id: number): Promise<Conversa | undefined> {
    try {
      const result = await db.select().from(conversas).where(eq(conversas.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching conversa by id:', error);
      return undefined;
    }
  }

  async getConversaByTelefone(telefone: string): Promise<Conversa | undefined> {
    try {
      const result = await db.select().from(conversas).where(eq(conversas.telefone, telefone)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching conversa by telefone:', error);
      return undefined;
    }
  }

  async createConversa(conversa: InsertConversa): Promise<Conversa> {
    try {
      const result = await db.insert(conversas).values(conversa).returning();
      return result[0];
    } catch (error: any) {
      // Se houver conflito de telefone único, busca a conversa existente
      if (error.code === '23505' && error.constraint === 'conversas_telefone_unique') {
        console.log(`Conversa já existe para telefone ${conversa.telefone}, retornando conversa existente`);
        const existing = await this.getConversaByTelefone(conversa.telefone);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
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

  async corrigirTelefoneConversa(telefoneIncorreto: string, telefoneCorreto: string): Promise<number> {
    try {
      const result = await db
        .update(conversas)
        .set({ telefone: telefoneCorreto })
        .where(eq(conversas.telefone, telefoneIncorreto))
        .returning();
      
      if (result.length > 0) {
        console.log(`Corrigido telefone de conversa: ${telefoneIncorreto} -> ${telefoneCorreto}`);
        
        // Also update messages if necessary
        await db
          .update(mensagens)
          .set({ remetente: telefoneCorreto })
          .where(eq(mensagens.remetente, telefoneIncorreto));
      }
      
      return result.length;
    } catch (error) {
      console.error('Error fixing phone number:', error);
      throw error;
    }
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

  async getTicketsByConversaId(conversaId: number): Promise<Ticket[]> {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.conversaId, conversaId));
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

  // Campaign Templates CRUD
  async getCampaignTemplates(): Promise<CampaignTemplate[]> {
    const templates = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.isActive, true))
      .orderBy(asc(campaignTemplates.title));
    return templates;
  }

  async getCampaignTemplateById(id: number): Promise<CampaignTemplate | undefined> {
    const result = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, id));
    return result[0];
  }

  async getCampaignTemplateByKey(key: string): Promise<CampaignTemplate | undefined> {
    const result = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.key, key));
    return result[0];
  }

  async createCampaignTemplate(template: InsertCampaignTemplate): Promise<CampaignTemplate> {
    const result = await db
      .insert(campaignTemplates)
      .values({
        ...template,
        updatedAt: new Date()
      })
      .returning();
    return result[0];
  }

  async updateCampaignTemplate(id: number, template: Partial<InsertCampaignTemplate>): Promise<CampaignTemplate> {
    const result = await db
      .update(campaignTemplates)
      .set({
        ...template,
        updatedAt: new Date()
      })
      .where(eq(campaignTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteCampaignTemplate(id: number): Promise<void> {
    // Soft delete by setting isActive to false
    await db
      .update(campaignTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(campaignTemplates.id, id));
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db
      .update(campaignTemplates)
      .set({
        usageCount: sql`${campaignTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(campaignTemplates.id, id));
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
      const result = await db.select().from(sistemas).orderBy(asc(sistemas.systemId));
      return result.map(mapSistemaToFrontend);
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
    return result[0] ? mapSistemaToFrontend(result[0]) : undefined;
  }

  async getSistemaBySystemId(systemId: string): Promise<Sistema | undefined> {
    const result = await db.select().from(sistemas).where(eq(sistemas.systemId, systemId)).limit(1);
    return result[0] ? mapSistemaToFrontend(result[0]) : undefined;
  }

  async createSistema(sistema: InsertSistema): Promise<Sistema> {
    const mapped = mapSistemaFromFrontend(sistema);
    
    // Se for um sistema fixo (ID >= 1000), definir expiração para 365 dias
    const systemId = parseInt(mapped.systemId) || 0;
    if (systemId >= 1000) {
      const expiracaoFixo = new Date();
      expiracaoFixo.setDate(expiracaoFixo.getDate() + 365);
      mapped.expiracao = expiracaoFixo;
      console.log(`🔒 Sistema fixo ${mapped.systemId} criado com validade de 365 dias`);
    }
    
    const result = await db.insert(sistemas).values(mapped).returning();
    return mapSistemaToFrontend(result[0]);
  }

  async updateSistema(id: number, sistema: Partial<InsertSistema>): Promise<Sistema> {
    const mapped = mapSistemaFromFrontend(sistema);
    const result = await db.update(sistemas)
      .set({ ...mapped, atualizadoEm: new Date() })
      .where(eq(sistemas.id, id))
      .returning();
    return mapSistemaToFrontend(result[0]);
  }

  async deleteSistema(id: number): Promise<void> {
    await db.delete(sistemas).where(eq(sistemas.id, id));
  }

  // Get next available system ID (fills gaps in the sequence)
  async getNextAvailableSistemaId(): Promise<number> {
    const existingSistemas = await this.getSistemas();
    
    // Extract numeric IDs from systemId (handle both "1" and "sistema1" formats)
    const numericIds = existingSistemas.map(s => {
      const sid = s.systemId || '';
      if (sid.startsWith('sistema')) {
        return parseInt(sid.replace('sistema', ''));
      }
      return parseInt(sid);
    }).filter(id => !isNaN(id)).sort((a, b) => a - b);

    // If no systems exist, start with 1
    if (numericIds.length === 0) {
      return 1;
    }

    // Find the first gap in the sequence
    for (let i = 0; i < numericIds.length; i++) {
      const expectedId = i + 1;
      if (numericIds[i] !== expectedId) {
        // Found a gap, return the missing number
        return expectedId;
      }
    }

    // No gaps found, return the next number after the highest
    return numericIds[numericIds.length - 1] + 1;
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
        // Create new com validade padrão de 30 dias
        await this.createSistema({
          systemId: apiSystem.system_id,
          username: apiSystem.username,
          password: apiSystem.password,
          expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
        });
      }
    }

    // Remove systems that don't exist in API anymore (only if they don't have pontos)
    const apiSystemIds = new Set(apiSystems.map(s => s.system_id));
    for (const existing of existingSystems) {
      if (!apiSystemIds.has(existing.systemId)) {
        // Check if this system has pontos associated
        const pontosCount = await db
          .select({ count: count() })
          .from(pontos)
          .where(eq(pontos.sistemaId, existing.id));
        
        const hasPoints = Number(pontosCount[0]?.count || 0) > 0;
        
        if (hasPoints) {
          console.log(`⚠️ Sistema ${existing.systemId} (ID: ${existing.id}) tem ${pontosCount[0].count} pontos associados - não será deletado`);
          // Optionally, you could mark the system as expired or inactive
          // await this.updateSistema(existing.id, { expiracao: new Date() });
        } else {
          console.log(`🗑️ Deletando sistema ${existing.systemId} (ID: ${existing.id}) que não existe mais na API`);
          await this.deleteSistema(existing.id);
        }
      }
    }
  }

  // Novo método para sincronizar do banco local para a API
  async syncSistemasToApi(externalApiService: any): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
    usersUpdated: number;
  }> {
    const errors: string[] = [];
    let created = 0;
    let updated = 0;
    let deleted = 0;

    try {
      // 1. Buscar sistemas locais
      const localSystems = await this.getSistemas();
      console.log(`📊 Sincronizando ${localSystems.length} sistemas locais para a API...`);

      // 2. Buscar sistemas da API
      const apiSystems = await externalApiService.getSystemCredentials();
      const apiSystemsMap = new Map<string, {system_id: string; username: string; password: string}>(
        apiSystems.map((s: any) => [s.system_id, s])
      );

      // 3. Para cada sistema local, criar ou atualizar na API
      for (const localSystem of localSystems) {
        const apiSystem = apiSystemsMap.get(localSystem.systemId);
        
        try {
          if (!apiSystem) {
            // Sistema não existe na API - criar
            console.log(`➕ Criando sistema ${localSystem.systemId} na API...`);
            await externalApiService.createSystemCredential({
              system_id: localSystem.systemId,
              username: localSystem.username,
              password: localSystem.password
            });
            created++;
          } else {
            // Sistema existe - verificar se precisa atualizar
            if (apiSystem.username !== localSystem.username || apiSystem.password !== localSystem.password) {
              console.log(`🔄 Atualizando sistema ${localSystem.systemId} na API...`);
              // API espera o ID numérico do sistema
              const numericId = parseInt(localSystem.systemId);
              if (!isNaN(numericId)) {
                await externalApiService.updateSystemCredential(numericId, {
                  username: localSystem.username,
                  password: localSystem.password
                });
                updated++;
              } else {
                errors.push(`Sistema ${localSystem.systemId} tem ID inválido`);
              }
            }
          }
        } catch (error) {
          const errorMsg = `Erro ao sincronizar sistema ${localSystem.systemId}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // 4. Deletar da API sistemas que não existem localmente
      const localSystemIds = new Set(localSystems.map(s => s.systemId));
      for (const apiSystem of apiSystems) {
        if (!localSystemIds.has(apiSystem.system_id)) {
          try {
            console.log(`🗑️ Deletando sistema ${apiSystem.system_id} da API (não existe localmente)...`);
            const numericId = parseInt(apiSystem.system_id);
            if (!isNaN(numericId)) {
              await externalApiService.deleteSystemCredential(numericId);
              deleted++;
            }
          } catch (error) {
            const errorMsg = `Erro ao deletar sistema ${apiSystem.system_id} da API: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      // 5. Atualizar os system_ids dos usuários na API externa
      console.log(`🔄 Atualizando system dos usuários na API externa...`);
      const allPontos = await this.getAllPontos();
      let usersUpdated = 0;
      
      // Buscar todos os usuários da API para mapear username -> ID
      const apiUsers = await externalApiService.getUsers();
      const apiUsersMap = new Map<string, any>(
        apiUsers.map((u: any) => [u.username, u])
      );
      
      // Buscar todos os sistemas locais de uma vez para evitar múltiplas queries
      const localSistemasMap = new Map<number, Sistema>(
        localSystems.map(s => [s.id, s])
      );
      
      for (const ponto of allPontos) {
        if (ponto.sistemaId) {
          try {
            // Buscar o sistema local para pegar o systemId
            const sistema = localSistemasMap.get(ponto.sistemaId);
            if (sistema) {
              // Encontrar o usuário na API pelo username
              const apiUser = apiUsersMap.get(ponto.usuario);
              if (apiUser) {
                // Converter systemId para número (está no formato "1", "2", etc)
                const systemIdNumber = parseInt(sistema.systemId);
                
                // Debug: mostrar comparação
                console.log(`📊 Usuário ${ponto.usuario}: API system=${apiUser.system} (tipo: ${typeof apiUser.system}), Local systemId=${systemIdNumber} (tipo: ${typeof systemIdNumber})`);
                
                // IMPORTANTE: Comparar convertendo ambos para número para garantir que está comparando corretamente
                const apiSystemNumber = apiUser.system ? parseInt(String(apiUser.system)) : null;
                
                // Sempre atualizar se o campo system não estiver definido ou for diferente
                if (apiSystemNumber !== systemIdNumber) {
                  console.log(`🔄 Atualizando usuário ${ponto.usuario} (API ID: ${apiUser.id}) - system: ${apiSystemNumber} → ${systemIdNumber}`);
                  await externalApiService.updateUser(apiUser.id, {
                    system: systemIdNumber
                  });
                  usersUpdated++;
                } else {
                  console.log(`✅ Usuário ${ponto.usuario} já tem system correto: ${systemIdNumber}`);
                }
              } else {
                console.log(`⚠️ Usuário ${ponto.usuario} não encontrado na API`);
              }
            } else {
              console.log(`⚠️ Sistema ID ${ponto.sistemaId} não encontrado no banco local`);
            }
          } catch (error) {
            console.error(`⚠️ Erro ao atualizar usuário ${ponto.usuario} na API:`, error);
            // Continua com os próximos usuários mesmo se houver erro
          }
        } else {
          // Debug para entender pontos sem sistema
          console.log(`🔍 Ponto ${ponto.id} (usuário: ${ponto.usuario}) não tem sistemaId definido`);
        }
      }

      console.log(`✅ Sincronização concluída: ${created} criados, ${updated} atualizados, ${deleted} deletados`);
      console.log(`✅ ${usersUpdated} usuários atualizados com system_id correto na API`);
      if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} erros durante sincronização`);
      }

      return { created, updated, deleted, errors, usersUpdated };
    } catch (error) {
      const errorMsg = `Erro geral na sincronização: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { created, updated, deleted, errors, usersUpdated: 0 };
    }
  }

  // Métodos para gerenciamento de validade
  async getSistemasParaRenovar(): Promise<Sistema[]> {
    // Buscar sistemas que precisam ser renovados
    // Usa configuração global de tempo de antecedência
    const now = new Date();
    const config = await this.getOfficeAutomationConfig();
    const renewalTime = (config?.renewalAdvanceTime || 60) * 60 * 1000; // Em milissegundos
    
    // Buscar TODOS os sistemas agora
    const result = await db
      .select()
      .from(sistemas);
    
    // Filtrar sistemas que estão dentro do tempo de renovação antecipada
    const filteredResult = result.filter((sistema) => {
      if (!sistema.expiracao) return false;
      const timeToExpire = sistema.expiracao.getTime() - now.getTime();
      return timeToExpire <= renewalTime && timeToExpire > 0;
    });
    
    return filteredResult.map(mapSistemaToFrontend);
  }

  async getSistemasVencidos(): Promise<Sistema[]> {
    const now = new Date();
    const result = await db
      .select()
      .from(sistemas)
      .where(
        lte(sistemas.expiracao, now)
      );
    return result.map(mapSistemaToFrontend);
  }

  async getSistemasProximoVencimento(dias: number): Promise<Sistema[]> {
    const now = new Date();
    const futureDate = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const result = await db
      .select()
      .from(sistemas)
      .where(
        and(
          gte(sistemas.expiracao, now),
          lte(sistemas.expiracao, futureDate)
        )
      )
      .orderBy(asc(sistemas.expiracao));
    return result.map(mapSistemaToFrontend);
  }

  async updateSistemaRenewal(systemId: string, username: string, password: string): Promise<Sistema> {
    const traceId = `renewal_${systemId}_${Date.now()}`;
    console.log(`🔄 [Storage] INICIANDO updateSistemaRenewal - TraceId: ${traceId}`);
    console.log(`   Sistema SystemID: ${systemId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ***`);
    
    // VALIDAÇÃO: Username deve ser apenas números
    if (!/^\d+$/.test(username)) {
      console.log(`⚠️ [Storage] Username inválido (não é apenas números): ${username} [${traceId}]`);
      console.log(`🚫 [Storage] Renovação cancelada - username corrompido`);
      console.log(`💡 [Storage] Sistema permanecerá vencido para nova tentativa de renovação`);
      
      // Retornar o sistema atual sem alterações
      const [sistemaAtual] = await db
        .select()
        .from(sistemas)
        .where(eq(sistemas.systemId, systemId));
      
      if (sistemaAtual) {
        // Log da tentativa falha
        await this.createLog({
          nivel: 'warn',
          origem: 'sistema_renewal',
          mensagem: `Renovação rejeitada - username inválido: ${username}`,
          detalhes: JSON.stringify({
            systemId,
            usernameRecebido: username,
            motivo: 'Username não é apenas números',
            traceId
          })
        });
        
        return mapSistemaToFrontend(sistemaAtual);
      }
      throw new Error(`Sistema ${systemId} não encontrado`);
    }
    
    // Busca estado ANTES da atualização
    const [sistemaBefore] = await db
      .select()
      .from(sistemas)
      .where(eq(sistemas.systemId, systemId));
    
    if (sistemaBefore) {
      console.log(`🔍 [Storage] Estado ANTES da atualização [${traceId}]:`);
      console.log(`   - Username atual: ${sistemaBefore.username}`);
      console.log(`   - Expiração atual: ${sistemaBefore.expiracao}`);
    } else {
      console.log(`⚠️ [Storage] Sistema ${systemId} não encontrado! [${traceId}]`);
      throw new Error(`Sistema ${systemId} não encontrado`);
    }
    
    // Calcula nova expiração - SEMPRE adiciona 6 horas ao momento atual
    const agora = new Date();
    const novaExpiracao = new Date(agora.getTime() + 6 * 60 * 60 * 1000); // 6 horas a partir de AGORA
    
    console.log(`🕰️ [Storage] Cálculo de expiração [${traceId}]:`);
    console.log(`   - Momento atual: ${agora.toISOString()}`);
    console.log(`   - Nova expiração (+6h): ${novaExpiracao.toISOString()}`);
    console.log(`   - Diferença em horas: ${(novaExpiracao.getTime() - agora.getTime()) / (1000 * 60 * 60)}h`);
    
    // Executa UPDATE no banco
    console.log(`💾 [Storage] Executando UPDATE no banco [${traceId}]...`);
    
    try {
      const [result] = await db
        .update(sistemas)
        .set({
          username,
          password,
          expiracao: novaExpiracao,
          atualizadoEm: agora
        })
        .where(eq(sistemas.systemId, systemId))
        .returning();
      
      if (result) {
        console.log(`✅ [Storage] UPDATE executado com sucesso [${traceId}]`);
        console.log(`🔍 [Storage] Estado DEPOIS da atualização:`);
        console.log(`   - Username novo: ${result.username}`);
        console.log(`   - Expiração nova: ${result.expiracao}`);
        
        // Verifica se a expiração realmente mudou
        if (sistemaBefore.expiracao && result.expiracao) {
          const expiracaoMudou = sistemaBefore.expiracao.getTime() !== result.expiracao.getTime();
          console.log(`🎯 [Storage] Expiração mudou? ${expiracaoMudou ? '✅ SIM' : '❌ NÃO'} [${traceId}]`);
          
          if (!expiracaoMudou) {
            console.error(`🔴 [Storage] ERRO CRÍTICO: Expiração não mudou após UPDATE! [${traceId}]`);
            console.error(`   - Expiração esperada: ${novaExpiracao.toISOString()}`);
            console.error(`   - Expiração retornada: ${result.expiracao}`);
          }
        }
        
        // Log activity
        await this.createLog({
          nivel: 'info',
          origem: 'sistema_renewal',
          mensagem: `Sistema ${systemId} renovado com sucesso`,
          detalhes: JSON.stringify({
            systemId: systemId,
            username,
            novaExpiracao: novaExpiracao.toISOString(),
            traceId
          })
        });
        
        return mapSistemaToFrontend(result);
      } else {
        console.error(`❌ [Storage] UPDATE retornou vazio [${traceId}]`);
        throw new Error('UPDATE retornou vazio');
      }
    } catch (error) {
      console.error(`🔴 [Storage] ERRO ao executar UPDATE [${traceId}]:`, error);
      console.error(`   Stack: ${(error as any).stack}`);
      throw error;
    }
  }

  async marcarSistemaComoRenovando(id: number): Promise<void> {
    await db
      .update(sistemas)
      .set({
        atualizadoEm: new Date()
      })
      .where(eq(sistemas.id, id));
  }

  async getNextSistemaId(): Promise<string> {
    // Get all existing sistemas to find the next available ID
    const allSistemas = await this.getSistemas();
    
    // Extract numeric parts from existing systemIds (handle both formats)
    const existingNumbers = allSistemas
      .map(s => {
        // Handle both "sistema1" and "1" formats
        if (s.systemId.startsWith('sistema')) {
          const match = s.systemId.match(/sistema(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }
        return parseInt(s.systemId) || 0;
      })
      .filter(n => n > 0);
    
    // Find the next available number (filling gaps)
    const sortedNumbers = existingNumbers.sort((a, b) => a - b);
    
    // If no systems exist, start with 1
    if (sortedNumbers.length === 0) {
      return '1';
    }
    
    // Find the first gap in the sequence
    for (let i = 0; i < sortedNumbers.length; i++) {
      const expectedNum = i + 1;
      if (sortedNumbers[i] !== expectedNum) {
        // Found a gap, return the missing number
        return expectedNum.toString();
      }
    }
    
    // No gaps found, return the next number after the highest
    return (sortedNumbers[sortedNumbers.length - 1] + 1).toString();
  }

  async createSistemaAutoGenerated(data: { 
    username: string; 
    password: string; 
    nome?: string; 
    url?: string; 
    expiracao?: Date;
    sistemaId?: number; // ID do sistema para atualizar (renovação) 
  }): Promise<Sistema> {
    // Se sistemaId fornecido, está renovando um sistema existente
    if (data.sistemaId) {
      console.log(`🔄 Atualizando sistema ${data.sistemaId} com novas credenciais`);
      
      // Buscar o sistema existente
      const existingSistema = await this.getSistemaById(data.sistemaId);
      if (!existingSistema) {
        throw new Error(`Sistema ${data.sistemaId} não encontrado`);
      }
      
      // Atualizar validade para 6 horas
      const expiracao = new Date(Date.now() + 6 * 60 * 60 * 1000);
      
      // Atualizar o sistema local
      const result = await db.update(sistemas)
        .set({
          username: data.username,
          password: data.password,
          expiracao: expiracao,
          atualizadoEm: new Date()
        })
        .where(eq(sistemas.id, data.sistemaId))
        .returning();
      
      const updatedSistema = result[0];
      
      // Atualizar na API externa se configurada
      try {
        const { externalApiService } = await import('./services/externalApi');
        const integracaoConfig = await this.getIntegracaoByTipo('iptv');
        
        // Removida verificação de apiUserId pois o campo não existe no tipo Sistema
        // A integração com API externa pode ser feita de outra forma se necessário
        if (false) { // Desabilitado temporariamente
          console.log(`🔄 Atualizando sistema na API externa`);
          
          const expTimestamp = Math.floor(expiracao.getTime() / 1000);
          // await externalApiService.updateUser para ser implementado de outra forma
          await Promise.resolve({
            username: data.username,
            password: data.password,
            exp_date: expTimestamp.toString(),
            status: 'Active'
          });
          
          console.log('✅ Sistema atualizado na API externa');
        }
      } catch (error) {
        console.error('Erro ao atualizar sistema na API externa:', error);
        // Continue mesmo se falhar na API externa
      }
      
      return mapSistemaToFrontend(updatedSistema);
    }
    
    // Código original para criar novo sistema
    const systemId = await this.getNextSistemaId(); // Now returns numeric string like "7", not "sistema7"
    const nome = data.nome || `Sistema Auto ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
    const url = data.url || 'https://onlineoffice.zip/iptv/';
    const expiracao = data.expiracao || new Date(Date.now() + 6 * 60 * 60 * 1000);
    
    const sistema = await this.createSistema({
      systemId,
      username: data.username,
      password: data.password,
      maxPontosAtivos: 100,
      pontosAtivos: 0,
      expiracao: expiracao
    });
    
    // Try to create in external API if available
    try {
      const { externalApiService } = await import('./services/externalApi');
      const integracaoConfig = await this.getIntegracaoByTipo('iptv');
      
      if (integracaoConfig?.ativo) {
        const apiResponse = await externalApiService.createSystemCredential({
          system_id: systemId,
          username: data.username,
          password: data.password
        });
        
        // Update with API ID if returned
        if (apiResponse?.id) {
          await this.updateSistema(sistema.id, {
            // Store API ID in metadata or a new field if needed
            // For now we just have the system created
          });
        }
      }
    } catch (error) {
      console.error('Error creating system in external API:', error);
      // Continue even if external API fails
    }
    
    return mapSistemaToFrontend(sistema);
  }

  async marcarRenovacaoFalhou(id: number, erro: string): Promise<void> {
    await db
      .update(sistemas)
      .set({
        atualizadoEm: new Date()
      })
      .where(eq(sistemas.id, id));
    
    // Registrar erro no log
    await db.insert(logs).values({
      nivel: 'error',
      origem: 'sistema_renewal',
      mensagem: `Falha ao renovar sistema ${id}: ${erro}`,
      detalhes: { sistemaId: id, erro },
      timestamp: new Date()
    });
  }

  async registrarRenovacaoAutomatica(sistemaId: number, novaCredencial: {username: string; password: string}): Promise<void> {
    await db.transaction(async (tx) => {
      // Atualizar o sistema
      await tx
        .update(sistemas)
        .set({
          username: novaCredencial.username,
          password: novaCredencial.password,
          expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          atualizadoEm: new Date()
        })
        .where(eq(sistemas.id, sistemaId));
      
      // Registrar no log
      await tx.insert(logs).values({
        nivel: 'info',
        origem: 'sistema_renewal',
        mensagem: `Sistema ${sistemaId} renovado automaticamente`,
        detalhes: {
          sistemaId,
          novoUsername: novaCredencial.username
        },
        timestamp: new Date()
      });
    });
  }

  // Sincronizar o campo 'system' dos usuários na API externa com base no sistema_id dos pontos locais
  async syncUserSystemsToApi(externalApiService: any, dryRun: boolean = false): Promise<{
    verificados: number;
    atualizados: number;
    ignorados: number;
    comErro: number;
    detalhes: Array<{
      usuario: string;
      sistemaAtual: number | null;
      sistemaCorreto: number;
      atualizado: boolean;
      motivo?: string;
      erro?: string;
    }>;
  }> {
    let verificados = 0;
    let atualizados = 0;
    let ignorados = 0;
    let comErro = 0;
    const detalhes: any[] = [];

    try {
      console.log('🔄 Iniciando sincronização do campo system dos usuários na API...');
      
      // 1. Buscar todos os pontos locais com sistema_id não nulo
      console.log('📋 Iniciando busca de pontos...');
      
      // Primeiro buscar todos os pontos para debug
      const todosPontos = await db.select().from(pontos);
      console.log(`📊 Total de pontos no banco: ${todosPontos.length}`);
      
      // Agora buscar pontos com sistema_id não nulo
      // Usar isNotNull ao invés de ne para evitar problemas
      const pontosComSistema = todosPontos.filter(p => p.sistemaId !== null && p.sistemaId !== undefined);
      
      console.log(`📊 Encontrados ${pontosComSistema.length} pontos com sistema_id não nulo`);
      
      // Debug: mostrar alguns pontos
      if (todosPontos.length > 0) {
        const primeiroPonto = todosPontos[0];
        console.log(`🔍 Primeiro ponto:`, {
          id: primeiroPonto.id,
          usuario: primeiroPonto.usuario,
          sistemaId: primeiroPonto.sistemaId,
          sistemaIdType: typeof primeiroPonto.sistemaId,
          isNull: primeiroPonto.sistemaId === null,
          isUndefined: primeiroPonto.sistemaId === undefined
        });
      }
      
      if (pontosComSistema.length === 0) {
        console.log('⚠️ Nenhum ponto com sistema_id encontrado');
        return { verificados, atualizados, ignorados, comErro, detalhes };
      }

      // 2. Buscar todos os sistemas locais para mapear id -> systemId
      const sistemasLocais = await this.getSistemas();
      const sistemaMap = new Map<number, string>();
      
      for (const sistema of sistemasLocais) {
        if (sistema.id && sistema.systemId) {
          sistemaMap.set(sistema.id, sistema.systemId);
        }
      }
      
      console.log(`📋 Mapeamento de sistemas carregado: ${sistemaMap.size} sistemas`);
      
      // 3. Buscar todos os usuários da API
      const apiUsers = await externalApiService.getUsers();
      const apiUserMap = new Map<string, any>();
      
      for (const user of apiUsers) {
        apiUserMap.set(user.username, user);
      }
      
      console.log(`👥 Usuários da API carregados: ${apiUserMap.size} usuários`);
      
      // 4. Para cada ponto local, verificar e atualizar o usuário na API
      for (const ponto of pontosComSistema) {
        verificados++;
        
        const sistemaId = ponto.sistemaId;
        if (!sistemaId) {
          console.log(`⚠️ Ponto ${ponto.usuario} não tem sistemaId`);
          comErro++;
          detalhes.push({
            usuario: ponto.usuario,
            sistemaAtual: null,
            sistemaCorreto: null,
            atualizado: false,
            motivo: 'Ponto sem sistema associado',
            erro: `Ponto não tem sistemaId`
          });
          continue;
        }
        const sistemaSystemId = sistemaMap.get(sistemaId);
        
        if (!sistemaSystemId) {
          console.log(`⚠️ Sistema ID ${sistemaId} não encontrado no mapeamento`);
          comErro++;
          detalhes.push({
            usuario: ponto.usuario,
            sistemaAtual: null,
            sistemaCorreto: sistemaId,
            atualizado: false,
            motivo: 'Sistema não encontrado no mapeamento local',
            erro: `Sistema ID ${sistemaId} não encontrado`
          });
          continue;
        }
        
        // Converter systemId string para número
        const sistemaCorreto = parseInt(sistemaSystemId);
        if (isNaN(sistemaCorreto)) {
          console.log(`⚠️ SystemId '${sistemaSystemId}' não é um número válido`);
          comErro++;
          detalhes.push({
            usuario: ponto.usuario,
            sistemaAtual: null,
            sistemaCorreto: sistemaId,
            atualizado: false,
            motivo: 'SystemId inválido',
            erro: `SystemId '${sistemaSystemId}' não é numérico`
          });
          continue;
        }
        
        // Encontrar o usuário correspondente na API
        const apiUser = apiUserMap.get(ponto.usuario);
        
        if (!apiUser) {
          console.log(`⚠️ Usuário '${ponto.usuario}' não encontrado na API`);
          comErro++;
          detalhes.push({
            usuario: ponto.usuario,
            sistemaAtual: null,
            sistemaCorreto,
            atualizado: false,
            motivo: 'Usuário não encontrado na API',
            erro: 'Usuário não existe na API externa'
          });
          continue;
        }
        
        // Converter o campo system atual do usuário para número (pode vir como string)
        const sistemaAtual = typeof apiUser.system === 'string' ? parseInt(apiUser.system) : apiUser.system;
        
        console.log(`\n🔍 Processando usuário: ${ponto.usuario}`);
        console.log(`   - Sistema atual na API: ${sistemaAtual}`);
        console.log(`   - Sistema correto (do ponto local): ${sistemaCorreto}`);
        
        // Verificar se precisa atualizar
        if (sistemaAtual !== sistemaCorreto) {
          console.log(`   ✅ Sistema diferente, ${dryRun ? 'SIMULANDO' : 'atualizando'}...`);
          
          if (!dryRun) {
            try {
              // Usar o ID do usuário da API para atualizar
              const userId = typeof apiUser.id === 'string' ? parseInt(apiUser.id) : apiUser.id;
              await externalApiService.updateUser(userId, {
                system: sistemaCorreto
              });
              
              console.log(`   ✅ Usuário '${ponto.usuario}' atualizado: system ${sistemaAtual} -> ${sistemaCorreto}`);
              atualizados++;
              
              detalhes.push({
                usuario: ponto.usuario,
                sistemaAtual,
                sistemaCorreto,
                atualizado: true,
                motivo: 'Sistema atualizado com sucesso'
              });
            } catch (error) {
              console.error(`   ❌ Erro ao atualizar usuário '${ponto.usuario}':`, error);
              comErro++;
              
              detalhes.push({
                usuario: ponto.usuario,
                sistemaAtual,
                sistemaCorreto,
                atualizado: false,
                motivo: 'Erro na atualização',
                erro: String(error)
              });
            }
          } else {
            // Modo dry-run
            atualizados++;
            detalhes.push({
              usuario: ponto.usuario,
              sistemaAtual,
              sistemaCorreto,
              atualizado: false,
              motivo: 'Simulação (dry-run) - seria atualizado'
            });
          }
        } else {
          console.log(`   ⏩ Sistema já está correto, ignorando`);
          ignorados++;
          
          detalhes.push({
            usuario: ponto.usuario,
            sistemaAtual,
            sistemaCorreto,
            atualizado: false,
            motivo: 'Sistema já está correto'
          });
        }
      }
      
      const resultado = {
        verificados,
        atualizados: dryRun ? 0 : atualizados,
        simulados: dryRun ? atualizados : 0,
        ignorados,
        comErro,
        detalhes
      };
      
      console.log('\n✅ Sincronização concluída!');
      console.log(`📊 Estatísticas:`);
      console.log(`   - Verificados: ${verificados}`);
      console.log(`   - ${dryRun ? 'Simulados' : 'Atualizados'}: ${dryRun ? atualizados : atualizados}`);
      console.log(`   - Ignorados (já corretos): ${ignorados}`);
      console.log(`   - Com erro: ${comErro}`);
      
      return resultado as any;
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      throw error;
    }
  }

  // Método para obter sistemas expirando em X minutos
  async getSistemasExpirandoEm(minutos: number): Promise<Sistema[]> {
    const now = new Date();
    const futureTime = new Date(now.getTime() + minutos * 60 * 1000);
    
    const result = await db
      .select()
      .from(sistemas)
      .where(
        and(
          lte(sistemas.expiracao, futureTime),
          gte(sistemas.expiracao, now)
        )
      )
      .orderBy(asc(sistemas.expiracao));
    
    return result.map(mapSistemaToFrontend);
  }

  // Método para renovar sistema (atualizar expiração e outros dados)
  async renovarSistema(systemId: string, data: any): Promise<void> {
    await db
      .update(sistemas)
      .set({
        ...data,
        atualizadoEm: new Date()
      })
      .where(eq(sistemas.systemId, systemId));
  }

  // Método para obter pontos disponíveis (pontos não atribuídos a sistemas)
  async getAvailablePoints(): Promise<number> {
    // Contar pontos que não estão associados a nenhum sistema
    const result = await db
      .select({ count: count() })
      .from(pontos)
      .where(
        and(
          or(
            eq(pontos.sistemaId, sql`NULL`),
            eq(pontos.status, 'inativo')
          )
        )
      );
    
    return Number(result[0]?.count || 0);
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

  // Get available systems (not at max capacity OR fixed systems)
  async getAvailableSistemas(): Promise<Sistema[]> {
    const result = await db.select()
      .from(sistemas)
      .where(or(
        // Normal systems that have capacity
        sql`${sistemas.pontosAtivos} < ${sistemas.maxPontosAtivos}`,
        // Always include fixed systems (ID >= 1000)
        sql`CAST(${sistemas.systemId} AS INTEGER) >= 1000`
      ))
      .orderBy(asc(sistemas.pontosAtivos));
    return result.map(mapSistemaToFrontend);
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
    // Normalize phone number for search - try multiple formats
    const normalizedPhone = telefone.replace(/\D/g, ''); // Remove all non-digits
    
    // Try different phone formats
    const phoneVariants = [
      telefone, // Original format
      normalizedPhone, // Just digits
      normalizedPhone.replace(/^55/, ''), // Without country code
      '55' + normalizedPhone.replace(/^55/, ''), // With country code
    ];
    
    console.log(`[STORAGE DEBUG] Searching for test with phone variants:`, phoneVariants);
    
    const result = await db.select().from(testes)
      .where(and(
        or(...phoneVariants.map(p => eq(testes.telefone, p))),
        ne(testes.status, 'deletado')
      ))
      .orderBy(desc(testes.criadoEm))
      .limit(1);
    
    console.log(`[STORAGE DEBUG] Test search result:`, result[0] ? `Found test ID ${result[0].id}` : 'No test found');
    return result[0];
  }
  
  async createTeste(teste: InsertTeste): Promise<Teste> {
    // Os campos apiUsername e apiPassword são obrigatórios no banco mas não no InsertTeste
    // Adicionar valores padrão para esses campos
    const testeCompleto = {
      ...teste,
      apiUsername: '',  // Valor padrão vazio
      apiPassword: ''   // Valor padrão vazio
    };
    const result = await db.insert(testes).values(testeCompleto as any).returning();
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
    // Return tests with status 'ativo' or 'notificado' that are not expired by time
    return await db.select().from(testes)
      .where(and(
        or(
          eq(testes.status, 'ativo'),
          eq(testes.status, 'notificado')
        ),
        gte(testes.expiraEm, now)
      ))
      .orderBy(desc(testes.criadoEm));
  }
  
  async getTestesExpirados(): Promise<Teste[]> {
    const now = new Date();
    // Return tests that are either:
    // 1. Status is 'expirado' (regardless of actual expiration time)
    // 2. Actually expired (expiraEm < now) regardless of status, except 'deletado'
    return await db.select().from(testes)
      .where(and(
        ne(testes.status, 'deletado'),
        or(
          eq(testes.status, 'expirado'),
          lte(testes.expiraEm, now)
        )
      ))
      .orderBy(desc(testes.criadoEm));
  }
  
  async getTestesExpiradosNaoNotificados(): Promise<Teste[]> {
    const now = new Date();
    // Busca testes que já expiraram mas não foram notificados
    // Busca testes com status 'ativo' ou 'expirado' que não foram notificados
    return await db.select().from(testes)
      .where(and(
        lte(testes.expiraEm, now),
        or(
          eq(testes.status, 'ativo'),
          eq(testes.status, 'expirado')
        ),
        ne(testes.status, 'notificado')
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

  async markTesteAsNotificado(id: number): Promise<void> {
    await db.update(testes)
      .set({ 
        status: 'notificado'
      })
      .where(eq(testes.id, id));
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

  async getAvisosVencimentoByClienteId(clienteId: number): Promise<AvisoVencimento[]> {
    return await db.select().from(avisosVencimento)
      .where(eq(avisosVencimento.clienteId, clienteId))
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
        .set(config)
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

  // Notificações Recorrentes implementation
  async getNotificacoesRecorrentes(): Promise<NotificacaoRecorrente[]> {
    return await db.select().from(notificacoesRecorrentes)
      .orderBy(desc(notificacoesRecorrentes.dataUltimoEnvio));
  }

  async getNotificacaoRecorrenteByClienteId(clienteId: number): Promise<NotificacaoRecorrente | undefined> {
    const result = await db.select().from(notificacoesRecorrentes)
      .where(eq(notificacoesRecorrentes.clienteId, clienteId))
      .limit(1);
    return result[0];
  }

  async createNotificacaoRecorrente(notificacao: InsertNotificacaoRecorrente): Promise<NotificacaoRecorrente> {
    const result = await db.insert(notificacoesRecorrentes).values(notificacao).returning();
    return result[0];
  }

  async updateNotificacaoRecorrente(id: number, notificacao: Partial<InsertNotificacaoRecorrente>): Promise<NotificacaoRecorrente> {
    const result = await db.update(notificacoesRecorrentes)
      .set(notificacao)
      .where(eq(notificacoesRecorrentes.id, id))
      .returning();
    return result[0];
  }

  async deleteNotificacaoRecorrente(id: number): Promise<void> {
    await db.delete(notificacoesRecorrentes).where(eq(notificacoesRecorrentes.id, id));
  }

  async getNotificacoesRecorrentesAtivas(): Promise<NotificacaoRecorrente[]> {
    return await db.select().from(notificacoesRecorrentes)
      .where(eq(notificacoesRecorrentes.ativo, true))
      .orderBy(asc(notificacoesRecorrentes.proximoEnvio));
  }

  async getNotificacoesRecorrentesParaEnviar(): Promise<NotificacaoRecorrente[]> {
    const now = new Date();
    return await db.select().from(notificacoesRecorrentes)
      .where(and(
        eq(notificacoesRecorrentes.ativo, true),
        lte(notificacoesRecorrentes.proximoEnvio, now)
      ))
      .orderBy(asc(notificacoesRecorrentes.proximoEnvio));
  }

  async resetNotificacaoRecorrente(clienteId: number): Promise<void> {
    // Delete the notification record to reset it
    await db.delete(notificacoesRecorrentes)
      .where(eq(notificacoesRecorrentes.clienteId, clienteId));
  }

  // Office Automation Config implementation
  async getOfficeAutomationConfig(): Promise<OfficeAutomationConfig | null> {
    const result = await db.select().from(officeAutomationConfig).limit(1);
    if (result.length === 0) {
      // Create default config if not exists
      const defaultConfig = await db.insert(officeAutomationConfig)
        .values({
          isEnabled: false,
          batchSize: 10,
          intervalMinutes: 60,
          singleGeneration: false,
          renewalAdvanceTime: 60  // Adicionar valor padrão
        })
        .returning();
      return defaultConfig[0];
    }
    return result[0];
  }

  async createOfficeAutomationConfig(config: InsertOfficeAutomationConfig): Promise<OfficeAutomationConfig> {
    const result = await db.insert(officeAutomationConfig).values(config).returning();
    return result[0];
  }

  async updateOfficeAutomationConfig(config: Partial<InsertOfficeAutomationConfig>): Promise<OfficeAutomationConfig> {
    const existing = await this.getOfficeAutomationConfig();
    if (existing) {
      const result = await db.update(officeAutomationConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(officeAutomationConfig.id, existing.id))
        .returning();
      return result[0];
    }
    // Create if not exists
    const result = await db.insert(officeAutomationConfig)
      .values({
        isEnabled: false,
        batchSize: 10,
        intervalMinutes: 60,
        singleGeneration: false,
        renewalAdvanceTime: 60,  // Adicionar valor padrão
        ...config
      } as InsertOfficeAutomationConfig)
      .returning();
    return result[0];
  }

  // Função de manutenção para atualizar sistemas fixos existentes com 365 dias
  async updateExistingFixedSystemsExpiry(): Promise<void> {
    const allSistemas = await db.select().from(sistemas);
    const sistemasFixos = allSistemas.filter(s => {
      const systemId = parseInt(s.systemId) || 0;
      return systemId >= 1000;
    });
    
    if (sistemasFixos.length === 0) {
      console.log('ℹ️ Nenhum sistema fixo encontrado para atualizar');
      return;
    }
    
    // Definir expiração para 365 dias a partir de hoje
    const expiracao = new Date();
    expiracao.setDate(expiracao.getDate() + 365);
    
    console.log(`📅 Atualizando ${sistemasFixos.length} sistemas fixos com expiração em 365 dias: ${expiracao.toISOString()}`);
    
    for (const sistema of sistemasFixos) {
      await db.update(sistemas)
        .set({ 
          expiracao: expiracao,
          atualizadoEm: new Date()
        })
        .where(eq(sistemas.id, sistema.id));
      
      console.log(`✅ Sistema fixo ${sistema.systemId} atualizado com nova expiração`);
    }
    
    await this.createLog({
      nivel: 'info',
      origem: 'Maintenance',
      mensagem: 'Sistemas fixos atualizados com 365 dias de expiração',
      detalhes: {
        totalSistemas: sistemasFixos.length,
        novaExpiracao: expiracao.toISOString(),
        sistemasAtualizados: sistemasFixos.map(s => s.systemId)
      }
    });
  }

  // Office Automation Logs implementation
  async getOfficeAutomationLogs(limit: number = 100): Promise<OfficeAutomationLogs[]> {
    return await db.select().from(officeAutomationLogs)
      .orderBy(desc(officeAutomationLogs.createdAt))
      .limit(limit);
  }

  async createOfficeAutomationLog(log: InsertOfficeAutomationLogs): Promise<OfficeAutomationLogs> {
    const result = await db.insert(officeAutomationLogs).values(log).returning();
    return result[0];
  }

  async getOfficeAutomationLogsByAction(action: string, limit: number = 100): Promise<OfficeAutomationLogs[]> {
    return await db.select().from(officeAutomationLogs)
      .where(eq(officeAutomationLogs.taskType, action))
      .orderBy(desc(officeAutomationLogs.createdAt))
      .limit(limit);
  }

  // Office Credentials implementation
  async getOfficeCredentials(limit: number = 10000): Promise<OfficeCredentials[]> {
    // Buscar credenciais de renovação com sistema associado
    const result = await db
      .select({
        id: officeCredentials.id,
        username: officeCredentials.username,
        password: officeCredentials.password,
        sistemaId: officeCredentials.sistemaId,
        systemId: sistemas.systemId, // SystemId do sistema para exibir no lugar do id interno
        generatedAt: officeCredentials.generatedAt,
        source: officeCredentials.source,
        status: officeCredentials.status,
        usedByPontoId: officeCredentials.usedByPontoId,
        usedAt: officeCredentials.usedAt,
        expiresAt: officeCredentials.expiresAt
      })
      .from(officeCredentials)
      .leftJoin(sistemas, eq(officeCredentials.sistemaId, sistemas.id))
      .where(eq(officeCredentials.source, 'renewal')) // Apenas credenciais de renovação
      .orderBy(desc(officeCredentials.generatedAt))
      .limit(limit);

    // Função para validar credenciais
    const isValidCredential = (username: string, password: string): boolean => {
      // Username deve ter pelo menos 3 caracteres e ser composto por alfanuméricos
      // Password deve ter pelo menos 3 caracteres
      // Não deve conter "SENHA:", "VENCIMENTO:" ou outros valores inválidos
      if (!username || !password) return false;
      if (username.length < 3 || password.length < 3) return false;
      if (username.includes(':') || password.includes(':')) return false;
      if (username === 'SENHA' || username === 'VENCIMENTO' || 
          password === 'SENHA' || password === 'VENCIMENTO') return false;
      // Username deve ser composto por dígitos e letras
      if (!/^[a-zA-Z0-9]+$/.test(username)) return false;
      return true;
    };

    // Filtrar para mostrar apenas a mais recente de cada sistema e validar credenciais
    const seenSystems = new Set<number>();
    const uniqueCredentials = [];
    
    for (const row of result) {
      // Validar credenciais antes de adicionar
      if (!isValidCredential(row.username, row.password)) {
        console.warn(`🚫 Credencial inválida detectada e ignorada: username="${row.username}", password="${row.password}"`);
        continue;
      }

      const sistemaId = row.sistemaId;
      if (sistemaId && !seenSystems.has(sistemaId)) {
        seenSystems.add(sistemaId);
        // Usar systemId ao invés do sistemaId interno para exibição
        uniqueCredentials.push({
          ...row,
          sistemaId: row.systemId ? parseInt(row.systemId) : sistemaId
        });
      }
    }

    return uniqueCredentials as OfficeCredentials[];
  }

  async createOfficeCredentials(credentials: InsertOfficeCredentials): Promise<OfficeCredentials> {
    const result = await db.insert(officeCredentials).values(credentials).returning();
    return result[0];
  }

  async getOfficeCredentialById(id: number): Promise<OfficeCredentials | undefined> {
    const result = await db.select().from(officeCredentials)
      .where(eq(officeCredentials.id, id))
      .limit(1);
    return result[0];
  }

  async getOfficeCredentialsByStatus(status: string): Promise<OfficeCredentials[]> {
    return await db.select().from(officeCredentials)
      .where(eq(officeCredentials.status, status))
      .orderBy(desc(officeCredentials.generatedAt));
  }

  async deleteOfficeCredential(id: number): Promise<void> {
    await db.delete(officeCredentials).where(eq(officeCredentials.id, id));
  }

  async deleteAllOfficeCredentials(): Promise<void> {
    await db.delete(officeCredentials);
  }

  // Task Management implementation
  async createPendingTask(taskType: string, data?: any): Promise<OfficeAutomationLogs> {
    const result = await db.insert(officeAutomationLogs)
      .values({
        taskType: taskType,
        status: 'pending'
      })
      .returning();
    return result[0];
  }

  async getNextPendingTask(): Promise<OfficeAutomationLogs | null> {
    const result = await db.select()
      .from(officeAutomationLogs)
      .where(eq(officeAutomationLogs.status, 'pending'))
      .orderBy(asc(officeAutomationLogs.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async getNextPendingRenewalTask(): Promise<OfficeCredentials | null> {
    // IMPORTANTE: Filtrar apenas tarefas com credenciais completas (username E password não nulos)
    const result = await db.select()
      .from(officeCredentials)
      .where(and(
        eq(officeCredentials.status, 'pending'),
        eq(officeCredentials.source, 'renewal'),
        sql`${officeCredentials.username} IS NOT NULL AND ${officeCredentials.username} != ''`,
        sql`${officeCredentials.password} IS NOT NULL AND ${officeCredentials.password} != ''`
      ))
      .orderBy(asc(officeCredentials.generatedAt))  // Processar tarefas mais antigas primeiro
      .limit(1);
    
    if (result[0]) {
      console.log('📋 Task de renovação selecionada do banco:', {
        id: result[0].id,
        sistemaId: result[0].sistemaId,
        hasUsername: !!result[0].username,
        hasPassword: !!result[0].password,
        generatedAt: result[0].generatedAt
      });
    }
    
    return result[0] || null;
  }

  async updateTaskStatus(taskId: number, status: string, result?: { username?: string; password?: string; errorMessage?: string }): Promise<OfficeAutomationLogs> {
    const updateData: any = {
      status
    };
    
    // Update fields if provided in result
    if (result) {
      if (result.username) {
        updateData.username = result.username;
      }
      if (result.password) {
        updateData.password = result.password;
      }
      if (result.errorMessage) {
        updateData.errorMessage = result.errorMessage;
      }
    }
    
    const updated = await db.update(officeAutomationLogs)
      .set(updateData)
      .where(eq(officeAutomationLogs.id, taskId))
      .returning();
    return updated[0];
  }

  async updateRenewalTaskStatus(taskId: number, username: string, password: string): Promise<OfficeCredentials> {
    const updated = await db.update(officeCredentials)
      .set({
        username,
        password,
        status: 'completed',
        generatedAt: new Date()
      })
      .where(eq(officeCredentials.id, taskId))
      .returning();
    return updated[0];
  }

  async getOfficeAutomationTaskById(taskId: number): Promise<OfficeAutomationLogs | null> {
    const results = await db.select().from(officeAutomationLogs)
      .where(eq(officeAutomationLogs.id, taskId))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }


  async updateOfficeCredential(id: number, data: Partial<OfficeCredentials>): Promise<OfficeCredentials> {
    const updated = await db.update(officeCredentials)
      .set(data)
      .where(eq(officeCredentials.id, id))
      .returning();
    return updated[0];
  }
  
  // Extension Status
  async getExtensionStatus(): Promise<ExtensionStatus | undefined> {
    const [status] = await db
      .select()
      .from(extensionStatus)
      .orderBy(desc(extensionStatus.id))
      .limit(1);
    return status;
  }
  
  async updateExtensionStatus(status: UpdateExtensionStatus): Promise<ExtensionStatus> {
    const existing = await this.getExtensionStatus();
    
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(extensionStatus)
        .set({
          ...status,
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(extensionStatus.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record if none exists
      const [created] = await db
        .insert(extensionStatus)
        .values({
          ...status,
          lastActivity: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
