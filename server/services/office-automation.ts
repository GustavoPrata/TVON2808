import fetch from 'node-fetch';

interface IPTVCredentials {
  usuario: string;
  senha: string;
  vencimento?: string;
  m3u8?: string;
  error?: string;
}

export class OfficeAutomation {
  private username = 'gustavoprata17';
  private password = 'iptv102030';
  private apiBaseUrl = 'https://gesapioffice.com/api';
  
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async generateIPTVTest(): Promise<IPTVCredentials> {
    try {
      console.log('🚀 Iniciando geração de teste IPTV via API...');
      
      // Fazer login primeiro para obter o token
      console.log('🔐 Fazendo login na API...');
      
      const loginResponse = await fetch(`${this.apiBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://onlineoffice.zip/'
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.error('❌ Erro no login:', loginResponse.status, errorText);
        throw new Error(`Erro no login: ${loginResponse.status}`);
      }

      const loginData = await loginResponse.json() as any;
      const token = loginData.access_token || loginData.token;
      
      if (!token) {
        throw new Error('Token não encontrado na resposta de login');
      }

      console.log('✅ Login realizado com sucesso');

      // Gerar o teste IPTV
      console.log('🎬 Gerando teste IPTV via API...');
      
      const generateResponse = await fetch(`${this.apiBaseUrl}/users-iptv`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Referer': 'https://onlineoffice.zip/'
        },
        body: JSON.stringify({
          isOficial: false,
          package: '1',
          credits: 1,
          isCustomPackage: false,
          nota: 'Usuário gerado em teste rápido - TV ON System',
          test_hours: ''
        })
      });

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        console.error('❌ Erro ao gerar teste:', generateResponse.status, errorText);
        throw new Error(`Erro ao gerar teste IPTV: ${generateResponse.status}`);
      }

      const testData = await generateResponse.json() as any;
      
      console.log('✅ Teste IPTV gerado com sucesso!');
      console.log('📋 Dados do teste:', {
        username: testData.username,
        password: testData.password,
        exp_date: testData.exp_date
      });

      // Formatar a data de expiração
      const expirationDate = testData.exp_date ? 
        new Date(testData.exp_date).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Não especificado';

      return {
        usuario: String(testData.username),
        senha: testData.password,
        vencimento: expirationDate,
        m3u8: testData.M3U8 || testData.m3u8
      };

    } catch (error) {
      console.error('❌ Erro na automação:', error);
      throw error;
    }
  }

  async getIPTVList() {
    try {
      console.log('📋 Obtendo lista de testes IPTV...');
      
      // Fazer login primeiro para obter o token
      const loginResponse = await fetch(`${this.apiBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://onlineoffice.zip/'
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      });

      if (!loginResponse.ok) {
        throw new Error(`Erro no login: ${loginResponse.status}`);
      }

      const loginData = await loginResponse.json() as any;
      const token = loginData.access_token || loginData.token;
      
      if (!token) {
        throw new Error('Token não encontrado na resposta de login');
      }

      // Obter lista de testes
      const listResponse = await fetch(`${this.apiBaseUrl}/users-iptv`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Referer': 'https://onlineoffice.zip/'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Erro ao obter lista: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      return listData;

    } catch (error) {
      console.error('❌ Erro ao obter lista:', error);
      throw error;
    }
  }
}

// Criar e exportar uma instância única
export const officeAutomation = new OfficeAutomation();