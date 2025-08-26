export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  tipo: 'regular' | 'familia';
  dataCadastro: string;
  status: 'ativo' | 'inativo' | 'suspenso' | 'cancelado';
  observacoes?: string;
  valorTotal: string;
  vencimento?: string;
}

export interface Ponto {
  id: number;
  clienteId: number;
  aplicativo: 'ibo_pro' | 'ibo_player' | 'shamel';
  dispositivo: 'smart_tv' | 'tv_box' | 'celular' | 'notebook';
  usuario: string;
  senha: string;
  valor?: string; // TODO: Adicionar campo no banco
  expiracao: string;
  ultimoAcesso?: string;
  macAddress?: string;
  deviceKey?: string;
  descricao?: string;
  status: 'ativo' | 'inativo';
  apiUserId?: number;
  sistemaId?: number;
}

export interface Pagamento {
  id: number;
  clienteId: number;
  valor: string;
  status: 'pendente' | 'pago' | 'cancelado';
  pixId?: string;
  qrCode?: string;
  dataCriacao: string;
  dataPagamento?: string;
  dataVencimento?: string;
}

export interface Conversa {
  id: number;
  clienteId?: number;
  telefone: string;
  nome?: string;
  ultimaMensagem?: string;
  dataUltimaMensagem?: string;
  status: 'ativo' | 'arquivado';
  modoAtendimento: 'bot' | 'humano';
  mensagensNaoLidas: number;
}

export interface Mensagem {
  id: number;
  conversaId: number;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'video' | 'audio' | 'arquivo';
  remetente: 'cliente' | 'sistema' | 'bot';
  timestamp: string;
  lida: boolean;
  metadados?: any;
}

export interface Ticket {
  id: number;
  clienteId?: number;
  conversaId?: number;
  titulo: string;
  descricao: string;
  status: 'aberto' | 'em_atendimento' | 'fechado';
  prioridade: 'baixa' | 'media' | 'alta';
  dataCriacao: string;
  dataFechamento?: string;
  telefone: string;
  clienteNome?: string; // Added for enriched data from backend
}

export interface BotConfig {
  id: number;
  tipo: 'novos' | 'clientes' | 'testes';
  mensagemBoasVindas: string;
  opcoes: BotOption[];
  ativo: boolean;
  rodape?: string;
  usarBotoes?: boolean;
  detectarNovosClientes?: boolean;
  tempoResposta?: number;
}

export interface BotOption {
  numero: string;
  texto: string;
  acao: string;
  resposta?: string;
  descricao?: string;
}

export interface NotificacaoConfig {
  id: number;
  tipo: 'vencimento' | 'pagamento' | 'boas_vindas';
  ativo: boolean;
  diasAntes?: number;
  horarioEnvio?: string;
  mensagem: string;
  configuracoes?: any;
}

export interface Integracao {
  id: number;
  tipo: 'whatsapp' | 'pix' | 'api_externa';
  configuracoes: any;
  ativo: boolean;
  ultimaAtualizacao?: string;
}

export interface Log {
  id: number;
  nivel: 'info' | 'warn' | 'error';
  origem: string;
  mensagem: string;
  detalhes?: any;
  timestamp: string;
}

export interface DashboardStats {
  totalClientes: number;
  clientesAtivos: number;
  vencendo5Dias: number;
  receitaMensal: number;
  clientesPorApp: Array<{ aplicativo: string; count: number }>;
  vencimentosProximos: Array<Cliente & { diasRestantes: number }>;
}

export interface WhatsAppStatus {
  status: {
    connection: string;
    lastDisconnect?: any;
  };
  qr?: string;
}

export interface WSMessage {
  type: string;
  data: any;
}
