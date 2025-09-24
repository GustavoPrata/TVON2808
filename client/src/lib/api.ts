import { apiRequest } from './queryClient';
import type { 
  Cliente, 
  Ponto, 
  Pagamento, 
  Conversa, 
  Mensagem, 
  Ticket, 
  BotConfig, 
  NotificacaoConfig, 
  Integracao, 
  Log, 
  DashboardStats,
  WhatsAppStatus 
} from '@/types';

export const api = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiRequest('GET', '/api/dashboard/stats');
    return response.json();
  },

  // Clientes
  getClientes: async (params?: { search?: string; tipo?: string }): Promise<Cliente[]> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tipo) searchParams.set('tipo', params.tipo);
    
    const response = await apiRequest('GET', `/api/clientes?${searchParams}`);
    return response.json();
  },

  getCliente: async (id: number): Promise<Cliente> => {
    const response = await apiRequest('GET', `/api/clientes/${id}`);
    return response.json();
  },

  createCliente: async (data: Omit<Cliente, 'id' | 'dataCadastro'>): Promise<Cliente> => {
    const response = await apiRequest('POST', '/api/clientes', data);
    return response.json();
  },

  updateCliente: async (id: number, data: Partial<Cliente>): Promise<Cliente> => {
    const response = await apiRequest('PUT', `/api/clientes/${id}`, data);
    return response.json();
  },

  deleteCliente: async (id: number): Promise<void> => {
    await apiRequest('DELETE', `/api/clientes/${id}`);
  },

  // Pontos
  getPontos: async (clienteId: number): Promise<Ponto[]> => {
    const response = await apiRequest('GET', `/api/clientes/${clienteId}/pontos`);
    return response.json();
  },

  getAllPontos: async (): Promise<(Ponto & { clienteNome?: string; clienteTelefone?: string })[]> => {
    const response = await apiRequest('GET', '/api/pontos');
    return response.json();
  },

  createPonto: async (clienteId: number, data: Omit<Ponto, 'id' | 'clienteId'> & { syncWithApi?: boolean }): Promise<Ponto> => {
    const response = await apiRequest('POST', `/api/clientes/${clienteId}/pontos`, data);
    return response.json();
  },

  updatePonto: async (id: number, data: Partial<Ponto> & { syncWithApi?: boolean }): Promise<Ponto> => {
    const response = await apiRequest('PUT', `/api/pontos/${id}`, data);
    return response.json();
  },

  deletePonto: async (id: number): Promise<void> => {
    await apiRequest('DELETE', `/api/pontos/${id}`);
  },

  // Pagamentos
  getPagamentos: async (clienteId: number): Promise<Pagamento[]> => {
    const response = await apiRequest('GET', `/api/clientes/${clienteId}/pagamentos`);
    return response.json();
  },

  createPagamento: async (clienteId: number, data: { valor: string; descricao: string }): Promise<any> => {
    const response = await apiRequest('POST', `/api/clientes/${clienteId}/pagamentos`, data);
    return response.json();
  },

  // Conversas
  getConversas: async (): Promise<Conversa[]> => {
    const response = await apiRequest('GET', '/api/conversas');
    return response.json();
  },

  getMensagens: async (conversaId: number): Promise<Mensagem[]> => {
    const response = await apiRequest('GET', `/api/conversas/${conversaId}/mensagens`);
    return response.json();
  },

  // Tickets
  getTickets: async (): Promise<Ticket[]> => {
    const response = await apiRequest('GET', '/api/tickets');
    return response.json();
  },

  createTicket: async (data: { 
    titulo: string; 
    descricao: string; 
    prioridade: 'baixa' | 'media' | 'alta';
    clienteId: number | null;
    telefone: string;
  }): Promise<Ticket> => {
    const response = await apiRequest('POST', '/api/tickets', data);
    return response.json();
  },

  updateTicket: async (id: number, data: { status: string }): Promise<Ticket> => {
    const response = await apiRequest('PUT', `/api/tickets/${id}`, data);
    return response.json();
  },

  // Bot Config
  getBotConfig: async (): Promise<BotConfig[]> => {
    const response = await apiRequest('GET', '/api/bot-config');
    return response.json();
  },

  createBotConfig: async (data: Omit<BotConfig, 'id'>): Promise<BotConfig> => {
    const response = await apiRequest('POST', '/api/bot-config', data);
    return response.json();
  },

  updateBotConfig: async (id: number, data: Partial<BotConfig>): Promise<BotConfig> => {
    const response = await apiRequest('PUT', `/api/bot-config/${id}`, data);
    return response.json();
  },

  // Notificações Config
  getNotificacoesConfig: async (): Promise<NotificacaoConfig[]> => {
    const response = await apiRequest('GET', '/api/notificacoes-config');
    return response.json();
  },

  createNotificacaoConfig: async (data: Omit<NotificacaoConfig, 'id'>): Promise<NotificacaoConfig> => {
    const response = await apiRequest('POST', '/api/notificacoes-config', data);
    return response.json();
  },

  updateNotificacaoConfig: async (id: number, data: Partial<NotificacaoConfig>): Promise<NotificacaoConfig> => {
    const response = await apiRequest('PUT', `/api/notificacoes-config/${id}`, data);
    return response.json();
  },

  // Integrações
  getIntegracoes: async (): Promise<Integracao[]> => {
    const response = await apiRequest('GET', '/api/integracoes');
    return response.json();
  },

  createIntegracao: async (data: Omit<Integracao, 'id' | 'ultimaAtualizacao'>): Promise<Integracao> => {
    const response = await apiRequest('POST', '/api/integracoes', data);
    return response.json();
  },

  updateIntegracao: async (id: number, data: Partial<Integracao>): Promise<Integracao> => {
    const response = await apiRequest('PUT', `/api/integracoes/${id}`, data);
    return response.json();
  },

  // WhatsApp
  getWhatsAppStatus: async (): Promise<WhatsAppStatus> => {
    const response = await apiRequest('GET', '/api/whatsapp/status');
    return response.json();
  },

  disconnectWhatsApp: async (): Promise<void> => {
    await apiRequest('POST', '/api/whatsapp/disconnect');
  },

  // External API
  configureExternalApi: async (config: { baseUrl: string; apiKey: string }): Promise<void> => {
    await apiRequest('POST', '/api/external-api/config', config);
  },

  testExternalApi: async (): Promise<{ connected: boolean }> => {
    const response = await apiRequest('POST', '/api/external-api/test');
    return response.json();
  },

  // Sync
  syncApiConfig: async (): Promise<{ message: string; apiSettings: any[] }> => {
    const response = await apiRequest('POST', '/api/sync/api-config');
    return response.json();
  },

  syncSystems: async (): Promise<{ 
    message: string; 
    created: number; 
    updated: number; 
    deleted: number; 
    errors: string[];
    detalhes?: {
      created: string;
      updated: string;
      deleted: string;
      errors?: string[];
    };
    synced?: number; // legacy field
    local?: number; // legacy field
  }> => {
    const response = await apiRequest('POST', '/api/sync/systems');
    return response.json();
  },

  getSyncStatus: async (): Promise<{ 
    apiConnected: boolean; 
    localSystemsCount: number; 
    apiSystemsCount: number; 
    localUsersCount: number;
    apiUsersCount: number;
    inSync: boolean; 
    lastSync: string | null;
    localUrl: string;
    apiRedirectUrl: string;
  }> => {
    const response = await apiRequest('GET', '/api/sync/status');
    return response.json();
  },

  // PIX Woovi
  configurePix: async (config: { appId: string; correlationID: string; webhook?: string }): Promise<void> => {
    await apiRequest('POST', '/api/pix/config', config);
  },

  // Vencimentos
  getVencimentos: async (params?: { tipo?: string; dias?: number }): Promise<Cliente[]> => {
    const searchParams = new URLSearchParams();
    if (params?.tipo) searchParams.set('tipo', params.tipo);
    if (params?.dias) searchParams.set('dias', params.dias.toString());
    
    const response = await apiRequest('GET', `/api/vencimentos?${searchParams}`);
    return response.json();
  },

  // Logs
  getLogs: async (limit?: number): Promise<Log[]> => {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', limit.toString());
    
    const response = await apiRequest('GET', `/api/logs?${searchParams}`);
    return response.json();
  },

  clearLogs: async (): Promise<void> => {
    await apiRequest('DELETE', '/api/logs');
  },

  // Generic HTTP methods for external API
  get: async (url: string): Promise<any> => {
    const response = await apiRequest('GET', url);
    return response.json();
  },

  post: async (url: string, data?: any): Promise<any> => {
    const response = await apiRequest('POST', url, data);
    return response.json();
  },

  put: async (url: string, data?: any): Promise<any> => {
    const response = await apiRequest('PUT', url, data);
    return response.json();
  },

  delete: async (url: string): Promise<any> => {
    const response = await apiRequest('DELETE', url);
    return response.json();
  },
};
