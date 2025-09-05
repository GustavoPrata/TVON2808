import fetch from 'node-fetch';

interface IPTVCredentials {
  usuario: string;
  senha: string;
  vencimento?: string;
  m3u8?: string;
  error?: string;
}

export class OfficeAutomation {
  private apiBaseUrl = 'https://onlineoffice.zip/api';
  
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async generateIPTVTest(): Promise<IPTVCredentials> {
    try {
      console.log('🚀 Iniciando geração de teste IPTV...');
      
      // IMPORTANTE: Este token precisa ser atualizado quando expirar
      // Para obter um novo token:
      // 1. Acesse https://onlineoffice.zip
      // 2. Faça login com gustavoprata17/iptv102030
      // 3. Abra o DevTools (F12) > Network
      // 4. Gere um teste e procure por requisições para api/users-iptv
      // 5. Copie o token do header Authorization
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOlwvXC9nZXNhcGlvZmZpY2UuY29tXC9hcGlcL2xvZ2luIiwiaWF0IjoxNzU3MDU5NjI4LCJleHAiOjE3NTcwODEyMjgsIm5iZiI6MTc1NzA1OTYyOCwianRpIjoiMGdlSWFUSmR2NmpWRGs0cyIsInN1YiI6OTA1MTMsInBydiI6IjJjMzY5OGEwMGZmZTc2MDdjZWZjYmNkODFmZmIyMzJiMzgzMWUwMGIifQ.9PhrpXtTee8OTHueRVZq8VfWkqBruy6Pzm28JX8gkgY';
      
      // O reg_password também pode precisar ser atualizado
      const regPassword = 'eyJpdiI6IkdtSkNCZ2dtUGY4WTI4S3dMSG1haUE9PSIsInZhbHVlIjoiVHoxTUNkaWhzMVJ4MmkrVUlyaVdCL3FlSDJzLzB3d09kOUhXWmlUeldPYz0iLCJtYWMiOiJlZTExNmRiMmU2Mjg2YzJiOGRjZWRlZTA0ODRmMzRhNDM0Y2M2NTgxNDAyYWRjZTc3YjE3MGJjNzkxYTdhMGEyIiwidGFnIjoiIn0=';
      
      console.log('🎬 Tentando gerar teste IPTV...');
      
      // Gerar um nome de usuário aleatório para o teste
      const randomNum = Math.floor(Math.random() * 100000);
      const testUsername = `teste${randomNum}`;
      
      // Simular credenciais enquanto a API está fora
      // Quando a API voltar, remover esta simulação
      const now = new Date();
      const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas
      
      console.log('⚠️ API temporariamente indisponível. Usando modo de demonstração.');
      
      return {
        usuario: testUsername,
        senha: `senha${randomNum}`,
        vencimento: expiration.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        m3u8: `http://onlineoffice.zip/get.php?username=${testUsername}&password=senha${randomNum}&type=m3u8_plus&output=ts`,
        error: 'API temporariamente indisponível - Modo demonstração ativo'
      };

    } catch (error) {
      console.error('❌ Erro na automação:', error);
      throw error;
    }
  }

  // Método para testar quando a API voltar
  async generateIPTVTestReal(): Promise<IPTVCredentials> {
    try {
      console.log('🚀 Iniciando geração de teste IPTV via API...');
      
      const token = 'SEU_TOKEN_AQUI';
      const regPassword = 'SEU_REG_PASSWORD_AQUI';
      
      console.log('🎬 Gerando teste IPTV via API...');
      
      // Tentar múltiplos endpoints possíveis
      const possibleEndpoints = [
        'https://onlineoffice.zip/api/users-iptv',
        'https://gesapioffice.com/api/users-iptv',
        'https://onlineoffice.zip/api/test-iptv',
        'https://onlineoffice.zip/api/generate-test'
      ];
      
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Tentando endpoint: ${endpoint}`);
          
          const generateResponse = await fetch(`${endpoint}?reg_password=${regPassword}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'pt-BR,pt;q=0.9',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Origin': 'https://onlineoffice.zip',
              'Referer': 'https://onlineoffice.zip/'
            },
            body: JSON.stringify({
              isOficial: false,
              package: '1',
              credits: 1,
              isCustomPackage: false,
              nota: 'Usuário gerado via TV ON System',
              test_hours: '24'
            })
          });

          if (generateResponse.ok) {
            const testData = await generateResponse.json() as any;
            
            console.log('✅ Teste IPTV gerado com sucesso!');
            console.log('📋 Dados do teste:', {
              username: testData.username,
              password: testData.password,
              exp_date: testData.exp_date
            });

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
              m3u8: testData.M3U8 || testData.m3u8 || `http://onlineoffice.zip/get.php?username=${testData.username}&password=${testData.password}&type=m3u8_plus&output=ts`
            };
          }
        } catch (err) {
          console.log(`Endpoint ${endpoint} falhou:`, err);
        }
      }
      
      throw new Error('Nenhum endpoint funcionou. Token pode ter expirado.');

    } catch (error) {
      console.error('❌ Erro na automação:', error);
      throw error;
    }
  }
}

// Criar e exportar uma instância única
export const officeAutomation = new OfficeAutomation();