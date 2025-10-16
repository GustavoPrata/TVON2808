import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, numeric, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clientes
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  telefone: varchar("telefone", { length: 20 }).notNull().unique(),
  tipo: varchar("tipo", { length: 10 }).notNull().default("regular"), // regular, familia
  dataCadastro: timestamp("data_cadastro").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("ativo"), // ativo, inativo, suspenso, cancelado
  observacoes: text("observacoes"),
  valorTotal: numeric("valor_total", { precision: 10, scale: 2 }).default("0.00"),
  vencimento: timestamp("vencimento"),
  indicadoPor: varchar("indicado_por", { length: 20 }), // Telefone de quem indicou
  mesesGratisAcumulados: integer("meses_gratis_acumulados").default(0), // Meses grátis ganhos por indicação
  totalIndicacoes: integer("total_indicacoes").default(0), // Total de indicações feitas
  indicacoesConfirmadas: integer("indicacoes_confirmadas").default(0), // Indicações que completaram 1 mês
  ultimoDesbloqueioConfianca: timestamp("ultimo_desbloqueio_confianca"), // Data do último desbloqueio de confiança
});

// Pontos/Usuários dos clientes
export const pontos = pgTable("pontos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(),
  aplicativo: varchar("aplicativo", { length: 20 }).notNull(), // ibo_pro, ibo_player, shamel
  dispositivo: varchar("dispositivo", { length: 20 }).notNull(), // smart_tv, tv_box, celular, notebook
  usuario: varchar("usuario", { length: 50 }).notNull(),
  senha: varchar("senha", { length: 100 }).notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull().default("0.00"),
  expiracao: timestamp("expiracao").notNull(),
  ultimoAcesso: timestamp("ultimo_acesso"),
  macAddress: varchar("mac_address", { length: 17 }),
  deviceKey: varchar("device_key", { length: 100 }),
  descricao: text("descricao"),
  status: varchar("status", { length: 20 }).notNull().default("ativo"),
  apiUserId: integer("api_user_id"), // ID do usuário na API externa
  sistemaId: integer("sistema_id").references(() => sistemas.id), // Sistema assigned to this point
});

// Sistema de Indicações
export const indicacoes = pgTable("indicacoes", {
  id: serial("id").primaryKey(),
  indicadorId: integer("indicador_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(), // Quem indicou
  indicadoId: integer("indicado_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(), // Quem foi indicado
  codigoIndicacao: varchar("codigo_indicacao", { length: 20 }).notNull(), // Telefone usado como código
  dataIndicacao: timestamp("data_indicacao").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, confirmada, expirada
  dataConfirmacao: timestamp("data_confirmacao"), // Quando completou 1 mês
  mesGratisAplicado: boolean("mes_gratis_aplicado").default(false), // Se já aplicou o mês grátis
  observacoes: text("observacoes"),
});

// Avisos de Vencimento
export const avisosVencimento = pgTable("avisos_vencimento", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  dataVencimento: timestamp("data_vencimento").notNull(),
  dataAviso: timestamp("data_aviso").notNull().defaultNow(),
  tipoAviso: varchar("tipo_aviso", { length: 20 }).notNull(), // automatico, manual
  statusEnvio: varchar("status_envio", { length: 20 }).notNull().default("enviado"), // enviado, erro
  mensagemErro: text("mensagem_erro"),
  mensagemEnviada: text("mensagem_enviada"),
});

// Configuração de Avisos de Vencimento
export const configAvisos = pgTable("config_avisos", {
  id: serial("id").primaryKey(),
  horaAviso: varchar("hora_aviso", { length: 5 }).notNull().default("09:00"), // HH:MM
  diasAntecedencia: integer("dias_antecedencia").notNull().default(0), // 0 = no dia do vencimento
  ativo: boolean("ativo").notNull().default(true),
  mensagemPadrao: text("mensagem_padrao").notNull().default("Olá {nome}! 👋\n\nSeu plano vence hoje. Renove agora para continuar aproveitando nossos serviços!\n\n💳 PIX disponível para pagamento rápido."),
  // Campos para notificações recorrentes
  notificacoesRecorrentes: boolean("notificacoes_recorrentes").notNull().default(false), // Ativa/desativa notificações recorrentes
  intervaloRecorrente: integer("intervalo_recorrente").notNull().default(3), // Intervalo em dias para notificações recorrentes
  limiteNotificacoes: integer("limite_notificacoes").notNull().default(10), // Limite máximo de notificações recorrentes
});

// Tabela para rastrear notificações recorrentes enviadas
export const notificacoesRecorrentes = pgTable("notificacoes_recorrentes", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(),
  dataUltimoEnvio: timestamp("data_ultimo_envio").notNull().defaultNow(),
  totalEnviado: integer("total_enviado").notNull().default(1),
  proximoEnvio: timestamp("proximo_envio").notNull(),
  dataInicioRecorrencia: timestamp("data_inicio_recorrencia").notNull().defaultNow(),
  ativo: boolean("ativo").notNull().default(true), // Permite pausar a recorrência para um cliente específico
});

// Mensagens Rápidas para Suporte
export const mensagensRapidas = pgTable("mensagens_rapidas", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 100 }).notNull(), // Título da mensagem rápida
  texto: text("texto").notNull(), // Texto da mensagem
  imagemUrl: text("imagem_url"), // URL da imagem opcional
  tipo: varchar("tipo", { length: 50 }).notNull().default("suporte"), // suporte, saudacao, instalacao, etc
  ordem: integer("ordem").notNull().default(0), // Ordem de exibição
  ativo: boolean("ativo").notNull().default(true), // Se está ativa
  teclaAtalho: varchar("tecla_atalho", { length: 10 }), // Atalho de teclado opcional
  variavel: boolean("variavel").default(false), // Se usa variáveis (como hora do dia)
  categoria: varchar("categoria", { length: 50 }), // Categoria da mensagem
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

// Pagamentos PIX
export const pagamentos = pgTable("pagamentos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, pago, confirmado, cancelado, expirado, devolvido
  tipo: varchar("tipo", { length: 20 }).default("mensalidade"), // mensalidade, renovacao, teste
  pixId: varchar("pix_id", { length: 100 }),
  pixCopiaECola: text("pix_copia_e_cola"),
  qrCode: text("qr_code"),
  chargeId: varchar("charge_id", { length: 100 }), // ID da cobrança no Woovi
  paymentLinkUrl: text("payment_link_url"), // Link de pagamento do Woovi
  expiresIn: integer("expires_in"), // Tempo de expiração em segundos
  metadata: json("metadata"), // Informações adicionais (meses, novoVencimento, etc)
  dataCriacao: timestamp("data_criacao").notNull().defaultNow(),
  dataPagamento: timestamp("data_pagamento"),
  dataVencimento: timestamp("data_vencimento"),
});

// Tabela para pagamentos gerados manualmente (sem cliente associado)
export const pagamentosManual = pgTable("pagamentos_manual", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }), // Opcional
  telefone: varchar("telefone", { length: 20 }).notNull(), // Telefone de quem é o pagamento
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pendente"), // pendente, pago, confirmado, cancelado, expirado, devolvido
  tipo: varchar("tipo", { length: 20 }).default("manual"), // manual, teste, outros
  pixId: varchar("pix_id", { length: 100 }),
  pixCopiaECola: text("pix_copia_e_cola"),
  qrCode: text("qr_code"),
  chargeId: varchar("charge_id", { length: 100 }), // ID da cobrança no Woovi
  paymentLinkUrl: text("payment_link_url"), // Link de pagamento do Woovi
  expiresIn: integer("expires_in"), // Tempo de expiração em segundos
  metadata: json("metadata"), // Informações adicionais
  dataCriacao: timestamp("data_criacao").notNull().defaultNow(),
  dataPagamento: timestamp("data_pagamento"),
  dataVencimento: timestamp("data_vencimento"),
  origem: varchar("origem", { length: 20 }).notNull().default("chat"), // chat, admin, api
});

// Estado do PIX por conversa
export const pixState = pgTable("pix_state", {
  id: serial("id").primaryKey(),
  conversaId: integer("conversa_id").references(() => conversas.id, { onDelete: "cascade" }).notNull().unique(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  activePixData: json("active_pix_data"), // Dados do PIX ativo
  pixHistory: json("pix_history"), // Histórico de PIX da conversa
  pixAmount: varchar("pix_amount", { length: 10 }), // Valor atual no formulário
  pixDescription: text("pix_description"), // Descrição atual no formulário
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Conversas do chat
export const conversas = pgTable("conversas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 100 }),
  ultimaMensagem: text("ultima_mensagem"),
  dataUltimaMensagem: timestamp("data_ultima_mensagem").defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("ativo"), // ativo, arquivado
  modoAtendimento: varchar("modo_atendimento", { length: 20 }).notNull().default("bot"), // bot, humano
  mensagensNaoLidas: integer("mensagens_nao_lidas").default(0),
  lastSeen: timestamp("last_seen"), // Último visto online
  isOnline: boolean("is_online").default(false), // Status online/offline
  ultimoRemetente: varchar("ultimo_remetente", { length: 20 }), // cliente, sistema, bot
  mensagemLida: boolean("mensagem_lida").default(false), // Status de leitura da última mensagem
  profilePicture: text("profile_picture"), // URL da foto de perfil do cliente
  tipoUltimaMensagem: varchar("tipo_ultima_mensagem", { length: 20 }), // texto, imagem, video, audio, arquivo, sticker
  metadados: text("metadados"), // JSON string para armazenar metadados adicionais
  iniciadoPorAnuncio: boolean("iniciado_por_anuncio").default(false), // Se a conversa foi iniciada por anúncio do Facebook/Instagram
}, (table) => ({
  telefoneIdx: index("idx_conversas_telefone").on(table.telefone),
  telefoneUnique: unique("conversas_telefone_unique").on(table.telefone),
}));

// Mensagens do chat
export const mensagens = pgTable("mensagens", {
  id: serial("id").primaryKey(),
  conversaId: integer("conversa_id").references(() => conversas.id, { onDelete: "cascade" }).notNull(),
  conteudo: text("conteudo").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull().default("texto"), // texto, imagem, video, audio, arquivo, sticker
  remetente: varchar("remetente", { length: 20 }).notNull(), // cliente, sistema, bot
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  lida: boolean("lida").default(false),
  mediaUrl: text("media_url"), // URL da mídia (imagem, vídeo, áudio, etc)
  metadados: json("metadados"), // Para armazenar dados adicionais como nome do arquivo, etc.
  // Campos para deletar e editar mensagens
  deletada: boolean("deletada").default(false), // Se a mensagem foi deletada
  deletadaEm: timestamp("deletada_em"), // Quando foi deletada
  conteudoOriginal: text("conteudo_original"), // Conteúdo antes de ser deletada/editada
  editada: boolean("editada").default(false), // Se a mensagem foi editada
  editadaEm: timestamp("editada_em"), // Quando foi editada
  whatsappMessageId: text("whatsapp_message_id"), // ID da mensagem no WhatsApp
});

// Tickets de suporte
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  conversaId: integer("conversa_id").references(() => conversas.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  descricao: text("descricao").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("aberto"), // aberto, em_atendimento, fechado
  prioridade: varchar("prioridade", { length: 20 }).notNull().default("media"), // baixa, media, alta
  dataCriacao: timestamp("data_criacao").notNull().defaultNow(),
  dataFechamento: timestamp("data_fechamento"),
  telefone: varchar("telefone", { length: 20 }).notNull(),
});

// Configurações do bot
export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // novos, clientes, testes
  mensagemBoasVindas: text("mensagem_boas_vindas").notNull(),
  opcoes: json("opcoes").notNull(), // Array de opções do menu
  ativo: boolean("ativo").default(true),
  rodape: text("rodape").default("TV ON Sistema - Atendimento 24/7"), // Footer text for button messages
  usarBotoes: boolean("usar_botoes").default(true), // Whether to use buttons or text menu
  detectarNovosClientes: boolean("detectar_novos_clientes").default(true), // Auto-detect new clients
  tempoResposta: integer("tempo_resposta").default(30), // Response timeout in seconds
  // Novas configurações para variáveis dinâmicas
  variaveisDisponiveis: json("variaveis_disponiveis").default('["{{nome}}", "{{telefone}}", "{{vencimento}}", "{{status}}", "{{valorTotal}}", "{{ultimoAcesso}}", "{{teste_dispositivo}}", "{{teste_aplicativo}}", "{{teste_expiracao}}", "{{teste_status}}"]'),
  mensagemErro: text("mensagem_erro").default("Desculpe, não entendi sua solicitação. Por favor, escolha uma das opções disponíveis."),
  mensagemTimeout: text("mensagem_timeout").default("Tempo esgotado! Você levou muito tempo para responder. Digite qualquer coisa para continuar."),
  // Configurações específicas por tipo
  permitirTextoLivre: boolean("permitir_texto_livre").default(false), // Permite mensagens de texto fora do menu
  redirecionarHumano: boolean("redirecionar_humano").default(true), // Redirecionar para atendimento humano
  opcaoAtendimentoHumano: boolean("opcao_atendimento_humano").default(true), // Mostrar opção "Falar com atendente"
  // Configurações avançadas de menu
  maxBotoesMenu: integer("max_botoes_menu").default(3), // Max buttons before using list
  mostrarNumeracao: boolean("mostrar_numeracao").default(true), // Show numbering in options
  permitirVoltar: boolean("permitir_voltar").default(true), // Allow "back" option in submenus
  menuPrincipalTexto: text("menu_principal_texto").default("📱 *Menu Principal*\nEscolha uma das opções abaixo:"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

// Notificações automáticas
export const notificacoesConfig = pgTable("notificacoes_config", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 30 }).notNull(), // vencimento, pagamento, boas_vindas
  ativo: boolean("ativo").default(true),
  diasAntes: integer("dias_antes").default(3),
  horarioEnvio: varchar("horario_envio", { length: 5 }).default("09:00"),
  mensagem: text("mensagem").notNull(),
  configuracoes: json("configuracoes"), // Configurações específicas para cada tipo
});

// Configurações de integração
export const integracoes = pgTable("integracoes", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 30 }).notNull(), // whatsapp, pix, api_externa
  configuracoes: json("configuracoes").notNull(),
  ativo: boolean("ativo").default(true),
  ultimaAtualizacao: timestamp("ultima_atualizacao").defaultNow(),
});

// Campaign Templates
export const campaignTemplates = pgTable("campaign_templates", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(), // Template identifier
  title: varchar("title", { length: 200 }).notNull(), // Template name
  content: text("content").notNull(), // Message template content
  icon: varchar("icon", { length: 50 }).notNull().default("MessageSquare"), // Lucide icon name
  category: varchar("category", { length: 50 }).default("general"), // Template category
  isActive: boolean("is_active").notNull().default(true), // Active status
  usageCount: integer("usage_count").notNull().default(0), // Track usage for analytics
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Logs do sistema
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  nivel: varchar("nivel", { length: 10 }).notNull(), // info, warn, error
  origem: varchar("origem", { length: 50 }).notNull(),
  mensagem: text("mensagem").notNull(),
  detalhes: json("detalhes"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Schemas para validação
export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  dataCadastro: true,
}).extend({
  vencimento: z.coerce.date().optional().nullable(),
});

export const insertPontoSchema = createInsertSchema(pontos).omit({
  id: true,
}).extend({
  expiracao: z.coerce.date(),
  ultimoAcesso: z.coerce.date().optional().nullable(),
  valor: z.string().optional(),
});

export const insertPagamentoSchema = createInsertSchema(pagamentos).omit({
  id: true,
  dataCriacao: true,
}).extend({
  dataPagamento: z.coerce.date().optional().nullable(),
  dataVencimento: z.coerce.date().optional().nullable(),
});

export const insertIndicacaoSchema = createInsertSchema(indicacoes).omit({
  id: true,
  dataIndicacao: true,
  dataConfirmacao: true,
});

export const insertConversaSchema = createInsertSchema(conversas).omit({
  id: true,
  dataUltimaMensagem: true,
});

export const insertMensagemSchema = createInsertSchema(mensagens).omit({
  id: true,
  timestamp: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  dataCriacao: true,
}).extend({
  dataResolucao: z.coerce.date().optional().nullable(),
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({
  id: true,
});

export const insertNotificacaoConfigSchema = createInsertSchema(notificacoesConfig).omit({
  id: true,
});

export const insertIntegracaoSchema = createInsertSchema(integracoes).omit({
  id: true,
  ultimaAtualizacao: true,
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

export const insertCampaignTemplateSchema = createInsertSchema(campaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

// External API Systems table
export const sistemas = pgTable("sistemas", {
  id: serial("id").primaryKey(),
  systemId: text("system_id").notNull().unique(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  maxPontosAtivos: integer("max_pontos_ativos").default(100).notNull(), // Maximum active points per system
  pontosAtivos: integer("pontos_ativos").default(0).notNull(), // Current active points count
  expiracao: timestamp("expiracao"), // Data de validade do sistema
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export const insertSistemaSchema = createInsertSchema(sistemas).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
}).extend({
  expiracao: z.coerce.date().optional().nullable(),
});

// URLs de redirecionamento
export const redirectUrls = pgTable("redirect_urls", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  nome: text("nome").notNull(),
  isPrincipal: boolean("is_principal").default(false).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull()
});

export const insertRedirectUrlSchema = createInsertSchema(redirectUrls).omit({
  id: true,
  criadoEm: true
});

export const insertMensagemRapidaSchema = createInsertSchema(mensagensRapidas).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true
});

// Types
export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;

export type Ponto = typeof pontos.$inferSelect;
export type InsertPonto = z.infer<typeof insertPontoSchema>;

export type Pagamento = typeof pagamentos.$inferSelect;
export type InsertPagamento = z.infer<typeof insertPagamentoSchema>;

export type Indicacao = typeof indicacoes.$inferSelect;
export type InsertIndicacao = z.infer<typeof insertIndicacaoSchema>;

export type Conversa = typeof conversas.$inferSelect;
export type InsertConversa = z.infer<typeof insertConversaSchema>;

export type Mensagem = typeof mensagens.$inferSelect;
export type InsertMensagem = z.infer<typeof insertMensagemSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;

export type NotificacaoConfig = typeof notificacoesConfig.$inferSelect;
export type InsertNotificacaoConfig = z.infer<typeof insertNotificacaoConfigSchema>;

export type Integracao = typeof integracoes.$inferSelect;
export type InsertIntegracao = z.infer<typeof insertIntegracaoSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type CampaignTemplate = typeof campaignTemplates.$inferSelect;
export type InsertCampaignTemplate = z.infer<typeof insertCampaignTemplateSchema>;

export type Sistema = typeof sistemas.$inferSelect;
export type InsertSistema = z.infer<typeof insertSistemaSchema>;

export type RedirectUrl = typeof redirectUrls.$inferSelect;
export type InsertRedirectUrl = z.infer<typeof insertRedirectUrlSchema>;

export type MensagemRapida = typeof mensagensRapidas.$inferSelect;
export type InsertMensagemRapida = z.infer<typeof insertMensagemRapidaSchema>;

// WhatsApp Settings
export const whatsappSettings = pgTable('whatsapp_settings', {
  id: serial('id').primaryKey(),
  // Profile settings
  profileName: text('profile_name'),
  profileStatus: text('profile_status'),
  profilePicture: text('profile_picture'),
  
  // Connection settings
  markOnlineOnConnect: boolean('mark_online_on_connect').default(false),
  
  // Message settings
  markMessagesRead: boolean('mark_messages_read').default(true),
  sendReadReceipts: boolean('send_read_receipts').default(true),
  
  // Media settings
  autoDownloadMedia: boolean('auto_download_media').default(true),
  autoDownloadDocuments: boolean('auto_download_documents').default(true),
  saveChatHistory: boolean('save_chat_history').default(true),
  
  // Client settings
  fetchClientPhotos: boolean('fetch_client_photos').default(false),
  cacheClientPhotos: boolean('cache_client_photos').default(true),
  showClientStatus: boolean('show_client_status').default(true),
  showProfilePhotosChat: boolean('show_profile_photos_chat').default(true),
  showProfilePhotosClientes: boolean('show_profile_photos_clientes').default(true),
  
  // Advanced settings
  reconnectInterval: integer('reconnect_interval').default(5000),
  maxReconnectRetries: integer('max_reconnect_retries').default(5),
  logLevel: text('log_level').default('info'),
  
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const insertWhatsappSettingsSchema = createInsertSchema(whatsappSettings);
export type WhatsappSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsappSettings = z.infer<typeof insertWhatsappSettingsSchema>;

// Admin users table (renamed from users to avoid conflict with Replit Auth)
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).pick({
  username: true,
  password: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").$type<any>().notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Admin login table
export const login = pgTable("login", {
  id: serial("id").primaryKey(),
  user: varchar("user", { length: 100 }).notNull().unique(),
  password: text("password").notNull(), // Senha com hash bcrypt
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  ultimoAcesso: timestamp("ultimo_acesso"),
});

export const insertLoginSchema = createInsertSchema(login).omit({
  id: true,
  criadoEm: true,
  ultimoAcesso: true,
});

export type Login = typeof login.$inferSelect;
export type InsertLogin = z.infer<typeof insertLoginSchema>;

// Remember Me Tokens
export const rememberTokens = pgTable("remember_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => login.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(), // Hash do token
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsed: timestamp("last_used"),
  userAgent: text("user_agent"), // Para identificar dispositivos
  ipAddress: text("ip_address"), // Para segurança adicional
}, (table) => ({
  userIdIdx: index().on(table.userId),
  tokenIdx: index().on(table.token),
  expiresAtIdx: index().on(table.expiresAt),
}));

export const insertRememberTokenSchema = createInsertSchema(rememberTokens).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export type RememberToken = typeof rememberTokens.$inferSelect;
export type InsertRememberToken = z.infer<typeof insertRememberTokenSchema>;

// Tests table
export const testes = pgTable("testes", {
  id: serial("id").primaryKey(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  aplicativo: varchar("aplicativo", { length: 20 }).notNull(), // ibo_pro, ibo_player, shamel
  dispositivo: varchar("dispositivo", { length: 20 }).notNull(), // smart_tv, tv_box, celular, notebook
  mac: varchar("mac", { length: 255 }).notNull(), // Required for all devices
  deviceKey: varchar("device_key", { length: 255 }).notNull(), // Required for all devices
  duracaoHoras: integer("duracao_horas").notNull(), // 1, 3, 6, 12, 24, 72
  apiUsername: varchar("api_username", { length: 255 }).notNull(), // Username for external API
  apiPassword: varchar("api_password", { length: 255 }).notNull(), // Password for external API
  sistemaId: integer("sistema_id").references(() => sistemas.id), // Local system ID
  apiUserId: integer("api_user_id"), // User ID in external API
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  expiraEm: timestamp("expira_em").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ativo"), // ativo, expirado, deletado, notificado
  createdBy: integer("created_by").references(() => users.id), // User who created the test
});

export const insertTesteSchema = createInsertSchema(testes).omit({
  id: true,
  criadoEm: true,
  status: true,
  apiUsername: true,
  apiPassword: true,
  apiUserId: true,
  sistemaId: true,
  createdBy: true,
}).extend({
  duracaoHoras: z.number().min(1).max(72),
  mac: z.string().min(1, 'MAC é obrigatório'),
  deviceKey: z.string().min(1, 'Device Key é obrigatório'),
});

export type Teste = typeof testes.$inferSelect;
export type InsertTeste = z.infer<typeof insertTesteSchema>;

// Anotações/Tasks
export const anotacoes = pgTable("anotacoes", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  descricao: text("descricao"),
  concluida: boolean("concluida").default(false),
  prioridade: varchar("prioridade", { length: 20 }).notNull().default("media"), // baixa, media, alta
  cor: varchar("cor", { length: 7 }).default("#4F46E5"), // Hex color
  ordem: integer("ordem").notNull().default(0), // Para ordenação manual
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  prazo: timestamp("prazo"), // Data limite opcional
  categoria: varchar("categoria", { length: 50 }), // Categoria opcional
});

export const insertAnotacaoSchema = createInsertSchema(anotacoes).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
}).extend({
  prazo: z.coerce.date().optional().nullable(),
});

export type Anotacao = typeof anotacoes.$inferSelect;
export type InsertAnotacao = z.infer<typeof insertAnotacaoSchema>;

// Office Automation Configuration
export const officeAutomationConfig = pgTable("office_automation_config", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  batchSize: integer("batch_size").notNull().default(10),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  singleGeneration: boolean("single_generation").notNull().default(false),
  renewalAdvanceTime: integer("renewal_advance_time").notNull().default(60), // Tempo em minutos antes do vencimento para renovar
  distributionMode: varchar("distribution_mode", { length: 20 }).default("individual"), // 'individual' | 'fixed-points'
  discordWebhookUrl: text("discord_webhook_url"),
  discordTicketsWebhookUrl: text("discord_tickets_webhook_url"), // Webhook separado para notificações de tickets
  discordNotificationsEnabled: boolean("discord_notifications_enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  totalGenerated: integer("total_generated").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Office Automation Logs
export const officeAutomationLogs = pgTable("office_automation_logs", {
  id: serial("id").primaryKey(),
  taskType: varchar("task_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  username: varchar("username", { length: 255 }),
  password: varchar("password", { length: 255 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Office Extension Configuration (Legacy - mantido para compatibilidade)
export const officeExtensionConfig = pgTable("office_extension_config", {
  id: serial("id").primaryKey(),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  quantityToGenerate: integer("quantity_to_generate").notNull().default(10),
  intervalValue: integer("interval_value").notNull().default(30),
  intervalUnit: varchar("interval_unit", { length: 10 }).notNull().default("minutes"), // minutes or hours
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  totalGenerated: integer("total_generated").notNull().default(0),
  currentSistemaIndex: integer("current_sistema_index").notNull().default(0), // Track which sistema to use next
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Office Generated Credentials History
export const officeCredentials = pgTable("office_credentials", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 100 }).notNull(),
  sistemaId: integer("sistema_id").references(() => sistemas.id),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  source: varchar("source", { length: 20 }).notNull().default("manual"), // manual or automation
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, used, expired
  usedByPontoId: integer("usado_by_ponto_id").references(() => pontos.id),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
});

// Extension Status - armazena o status atual da extensão Chrome
export const extensionStatus = pgTable("extension_status", {
  id: serial("id").primaryKey(),
  isActive: boolean("is_active").notNull().default(false),
  isLoggedIn: boolean("is_logged_in").notNull().default(false),
  currentUrl: text("current_url"),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  lastHeartbeat: timestamp("last_heartbeat"),
  userAgent: text("user_agent"),
  extensionVersion: varchar("extension_version", { length: 20 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Discord Notifications Sent - rastreia notificações enviadas para evitar spam
export const discordNotificationsSent = pgTable("discord_notifications_sent", {
  id: serial("id").primaryKey(),
  notificationType: varchar("notification_type", { length: 50 }).notNull(), // 'system_expiring', 'extension_offline'
  entityId: varchar("entity_id", { length: 100 }).notNull(), // systemId ou 'extension'
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Quando a notificação expira e pode ser enviada novamente
  message: text("message"),
  metadata: json("metadata"),
});

// Schemas para Office Automation
export const insertOfficeAutomationConfigSchema = createInsertSchema(officeAutomationConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfficeAutomationLogsSchema = createInsertSchema(officeAutomationLogs).omit({
  id: true,
  createdAt: true,
});

// Types para Office Automation
export type OfficeAutomationConfig = typeof officeAutomationConfig.$inferSelect;
export type InsertOfficeAutomationConfig = z.infer<typeof insertOfficeAutomationConfigSchema>;

export type OfficeAutomationLogs = typeof officeAutomationLogs.$inferSelect;
export type InsertOfficeAutomationLogs = z.infer<typeof insertOfficeAutomationLogsSchema>;

// Legacy schemas mantidos para compatibilidade
export const insertOfficeExtensionConfigSchema = createInsertSchema(officeExtensionConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfficeCredentialsSchema = createInsertSchema(officeCredentials).omit({
  id: true,
  generatedAt: true,
});

export type OfficeExtensionConfig = typeof officeExtensionConfig.$inferSelect;
export type InsertOfficeExtensionConfig = z.infer<typeof insertOfficeExtensionConfigSchema>;

export type OfficeCredentials = typeof officeCredentials.$inferSelect;
export type InsertOfficeCredentials = z.infer<typeof insertOfficeCredentialsSchema>;

// Extension Status types
export const insertExtensionStatusSchema = createInsertSchema(extensionStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivity: true,
});

export type ExtensionStatus = typeof extensionStatus.$inferSelect;
export type InsertExtensionStatus = z.infer<typeof insertExtensionStatusSchema>;
export type UpdateExtensionStatus = Partial<InsertExtensionStatus>;

// Avisos de Vencimento types
export const insertAvisoVencimentoSchema = createInsertSchema(avisosVencimento).omit({
  id: true,
  dataAviso: true,
  statusEnvio: true,
});

export type AvisoVencimento = typeof avisosVencimento.$inferSelect;
export type InsertAvisoVencimento = z.infer<typeof insertAvisoVencimentoSchema>;

// Config Avisos types
export const insertConfigAvisosSchema = createInsertSchema(configAvisos).omit({
  id: true,
  ultimaExecucao: true,
});

export type ConfigAvisos = typeof configAvisos.$inferSelect;
export type InsertConfigAvisos = z.infer<typeof insertConfigAvisosSchema>;

// Notificações Recorrentes types
export const insertNotificacaoRecorrenteSchema = createInsertSchema(notificacoesRecorrentes).omit({
  id: true,
  dataUltimoEnvio: true,
  totalEnviado: true,
  dataInicioRecorrencia: true,
}).extend({
  proximoEnvio: z.coerce.date(),
});

export type NotificacaoRecorrente = typeof notificacoesRecorrentes.$inferSelect;
export type InsertNotificacaoRecorrente = z.infer<typeof insertNotificacaoRecorrenteSchema>;
