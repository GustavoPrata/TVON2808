import fetch from 'node-fetch';

interface IPTVCredentials {
  usuario: string;
  senha: string;
  vencimento?: string;
  m3u8?: string;
  error?: string;
}

export class OfficeAutomation {
  private apiBaseUrl = 'https://gesapioffice.com/api';
  
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async generateIPTVTest(): Promise<IPTVCredentials> {
    try {
      console.log('🚀 Iniciando geração de teste IPTV via API...');
      
      // Usar token fixo para teste
      // Este token precisa ser obtido manualmente fazendo login no site e pegando do DevTools
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOlwvXC9nZXNhcGlvZmZpY2UuY29tXC9hcGlcL2xvZ2luIiwiaWF0IjoxNzU3MDU5NjI4LCJleHAiOjE3NTcwODEyMjgsIm5iZiI6MTc1NzA1OTYyOCwianRpIjoiMGdlSWFUSmR2NmpWRGs0cyIsInN1YiI6OTA1MTMsInBydiI6IjJjMzY5OGEwMGZmZTc2MDdjZWZjYmNkODFmZmIyMzJiMzgzMWUwMGIifQ.9PhrpXtTee8OTHueRVZq8VfWkqBruy6Pzm28JX8gkgY';
      
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
        
        // Se o token expirou
        if (generateResponse.status === 401) {
          throw new Error('Token expirado. Por favor, atualize o token no código.');
        }
        
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
}

// Criar e exportar uma instância única
export const officeAutomation = new OfficeAutomation();