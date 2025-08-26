import axios, { AxiosInstance } from 'axios';
import { storage } from '../storage';

export interface ExternalApiUser {
  id: number;
  username: string;
  password: string;
  status: 'Active' | 'Inactive';
  exp_date: string;
  system: number;
  last_access: string;
}

export interface ExternalApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  id?: number;
}

export class ExternalApiService {
  private client: AxiosInstance;
  private baseUrl: string = '';
  private apiKey: string = '';

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.initializeConfig();
  }

  private async initializeConfig() {
    try {
      const integracao = await storage.getIntegracaoByTipo('api_externa');
      if (integracao && integracao.ativo) {
        const config = integracao.configuracoes as any;
        this.baseUrl = config.baseUrl || '';
        this.apiKey = config.apiKey || '';
        
        this.client.defaults.baseURL = this.baseUrl;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
      }
    } catch (error) {
      console.error('Erro ao inicializar configuração da API externa:', error);
    }
  }

  async updateConfig(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    
    this.client.defaults.baseURL = baseUrl;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;

    // Salvar configuração
    const integracao = await storage.getIntegracaoByTipo('api_externa');
    if (integracao) {
      await storage.updateIntegracao(integracao.id, {
        configuracoes: { baseUrl, apiKey },
        ativo: true
      });
    } else {
      await storage.createIntegracao({
        tipo: 'api_externa',
        configuracoes: { baseUrl, apiKey },
        ativo: true
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/users/get');
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return false;
    }
  }

  // Métodos para Users
  async getUsers(): Promise<ExternalApiUser[]> {
    try {
      const response = await this.client.get<ExternalApiResponse<ExternalApiUser[]>>('/users/get');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw error;
    }
  }

  async getUser(id: number): Promise<ExternalApiUser | null> {
    try {
      const response = await this.client.get<ExternalApiResponse<ExternalApiUser>>(`/users/get/${id}`);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  async createUser(userData: {
    username: string;
    password: string;
    status?: string;
    exp_date?: string;
    system?: number;
  }): Promise<ExternalApiUser | null> {
    try {
      const response = await this.client.post<ExternalApiResponse<ExternalApiUser>>('/users/adicionar', userData);
      console.log('Resposta completa da API ao criar usuário:', response.data);
      
      // Se a resposta tem um ID direto na resposta
      if (response.data.id) {
        return {
          id: response.data.id,
          username: userData.username,
          password: userData.password,
          status: userData.status as 'Active' | 'Inactive' || 'Active',
          exp_date: userData.exp_date || '',
          system: userData.system || 1,
          last_access: ''
        };
      }
      
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<ExternalApiUser>): Promise<ExternalApiUser | null> {
    try {
      const response = await this.client.put<ExternalApiResponse<ExternalApiUser>>(`/users/editar/${id}`, userData);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const response = await this.client.delete<ExternalApiResponse<any>>(`/users/apagar/${id}`);
      return response.data.success;
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return false;
    }
  }

  // Métodos para System Credentials
  async getSystemCredentials(): Promise<any[]> {
    if (!this.baseUrl || !this.apiKey) {
      console.log('API não configurada');
      return [];
    }
    try {
      const response = await this.client.get<ExternalApiResponse<any[]>>('/system_credentials/get');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar credenciais do sistema:', error);
      return [];
    }
  }

  async getSystemCredential(id: number): Promise<any | null> {
    try {
      const response = await this.client.get<ExternalApiResponse<any>>(`/system_credentials/get/${id}`);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao buscar credencial do sistema:', error);
      return null;
    }
  }

  async createSystemCredential(credentialData: {
    system_id?: string;
    username: string;
    password: string;
  }): Promise<any | null> {
    try {
      const response = await this.client.post<ExternalApiResponse<any>>('/system_credentials/adicionar', credentialData);
      console.log('Resposta da API ao criar sistema:', response.data);
      
      // If success, fetch the created system
      if (response.data.success) {
        // Fetch all systems to find the newly created one
        const allSystems = await this.getSystemCredentials();
        const createdSystem = allSystems.find(s => 
          s.username === credentialData.username && 
          s.password === credentialData.password
        );
        
        if (createdSystem) {
          return createdSystem;
        }
      }
      
      // If the API returns an ID directly, use it
      if (response.data.id) {
        return {
          system_id: response.data.id.toString(),
          username: credentialData.username,
          password: credentialData.password
        };
      }
      
      // Otherwise return the data or constructed object
      return response.data.data || {
        system_id: credentialData.system_id,
        username: credentialData.username,
        password: credentialData.password
      };
    } catch (error) {
      console.error('Erro ao criar credencial do sistema:', error);
      throw error;
    }
  }

  async updateSystemCredential(id: number, credentialData: any): Promise<any | null> {
    try {
      const response = await this.client.put<ExternalApiResponse<any>>(`/system_credentials/editar/${id}`, credentialData);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao atualizar credencial do sistema:', error);
      throw error;
    }
  }

  async deleteSystemCredential(id: number): Promise<boolean> {
    try {
      const response = await this.client.delete<ExternalApiResponse<any>>(`/system_credentials/apagar/${id}`);
      return response.data.success;
    } catch (error) {
      console.error('Erro ao deletar credencial do sistema:', error);
      return false;
    }
  }

  // Métodos para Settings
  async getSettings(): Promise<any[]> {
    try {
      const response = await this.client.get<ExternalApiResponse<any[]>>('/settings/get');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      return [];
    }
  }

  async getSetting(key: string): Promise<any | null> {
    if (!this.baseUrl || !this.apiKey) {
      console.log('API não configurada');
      return null;
    }
    try {
      const response = await this.client.get<ExternalApiResponse<any>>(`/settings/get/${key}`);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      return null;
    }
  }

  async createSetting(settingData: {
    setting_key: string;
    setting_value: string;
  }): Promise<any | null> {
    try {
      const response = await this.client.post<ExternalApiResponse<any>>('/settings/adicionar', settingData);
      console.log('Create setting response:', response.data);
      // API might return success without data field
      if (response.data.success) {
        return settingData; // Return the input data if API doesn't return the created object
      }
      return response.data.data || settingData;
    } catch (error) {
      console.error('Erro ao criar configuração:', error);
      throw error;
    }
  }

  async updateSetting(key: string, settingData: any): Promise<any | null> {
    if (!this.baseUrl || !this.apiKey) {
      console.log('API não configurada');
      return null;
    }
    try {
      // API expects { setting_value: "..." } format
      const payload = settingData.value ? { setting_value: settingData.value } : settingData;
      const response = await this.client.put<ExternalApiResponse<any>>(`/settings/editar/${key}`, payload);
      return response.data.data || null;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  async deleteSetting(key: string): Promise<boolean> {
    try {
      const response = await this.client.delete<ExternalApiResponse<any>>(`/settings/apagar/${key}`);
      return response.data.success;
    } catch (error) {
      console.error('Erro ao deletar configuração:', error);
      return false;
    }
  }

  private async logActivity(nivel: string, mensagem: string, detalhes?: any) {
    try {
      await storage.createLog({
        nivel,
        origem: 'API Externa',
        mensagem,
        detalhes: detalhes ? JSON.stringify(detalhes) : null
      });
    } catch (error) {
      console.error('Erro ao criar log:', error);
    }
  }
}

export const externalApiService = new ExternalApiService();
