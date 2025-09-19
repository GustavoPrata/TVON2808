const API_BASE = 'http://localhost:5000';

// Função auxiliar para fazer requisições autenticadas
// Cookie storage
let cookies = '';

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(cookies && { 'Cookie': cookies }),
    ...options.headers
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  // Extract cookies from response
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    cookies = setCookie.split(';')[0];
    console.log('   Sessão salva:', cookies.split('=')[0]);
  }
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
}

async function testRenewal() {
  console.log('🚀 Iniciando teste de renovação automática...\n');

  try {
    // 1. Login
    console.log('1️⃣ Fazendo login...');
    await apiRequest('/api/login', {
      method: 'POST',
      body: { usuario: 'admin', senha: 'admin123' }
    });
    console.log('✅ Login bem-sucedido\n');

    // 2. Configurar renovação automática
    console.log('2️⃣ Configurando renovação automática...');
    console.log('   - renewalAdvanceTime: 1 minuto');
    console.log('   - isEnabled: true');
    
    const configUpdate = await apiRequest('/api/office/automation/config', {
      method: 'PUT',
      body: {
        renewalAdvanceTime: 1, // 1 minuto antes do vencimento
        isEnabled: true
      }
    });
    
    console.log('✅ Configuração salva:', configUpdate);
    console.log(`   - renewalAdvanceTime: ${configUpdate.renewalAdvanceTime} minutos`);
    console.log(`   - isEnabled: ${configUpdate.isEnabled}\n`);

    // 3. Criar/Atualizar um sistema de teste
    console.log('3️⃣ Criando sistema de teste...');
    const expiracaoEm2Min = new Date(Date.now() + 2 * 60 * 1000); // 2 minutos no futuro
    
    const sistema = await apiRequest('/api/sistemas', {
      method: 'POST',
      body: {
        username: `teste_renovacao_${Date.now()}`,
        password: 'teste123',
        maxPontosAtivos: 10,
        expiracao: expiracaoEm2Min.toISOString(),
        autoRenewalEnabled: true,
        renewalAdvanceTime: 1,
        nota: 'Sistema criado para teste de renovação automática'
      }
    });
    
    console.log('✅ Sistema criado:');
    console.log(`   - ID: ${sistema.id}`);
    console.log(`   - Username: ${sistema.username}`);
    console.log(`   - Expira em: ${expiracaoEm2Min.toISOString()}`);
    console.log(`   - Auto-renovação: ${sistema.autoRenewalEnabled}\n`);

    // 4. Aguardar e monitorar
    console.log('4️⃣ Aguardando renovação automática...');
    console.log('   O sistema expira em 2 minutos');
    console.log('   A renovação deve ocorrer em 1 minuto (1 min antes da expiração)');
    console.log('   Monitorando logs do serviço...\n');

    // Verificar status a cada 20 segundos
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
      checkCount++;
      console.log(`⏱️ Verificação #${checkCount} (${checkCount * 20}s):`);
      
      try {
        // Buscar sistema atualizado
        const sistemas = await apiRequest('/api/sistemas');
        const sistemaAtual = sistemas.find(s => s.id === sistema.id);
        
        if (sistemaAtual) {
          console.log(`   - Expira em: ${sistemaAtual.expiracao}`);
          console.log(`   - Renovações: ${sistemaAtual.renewalCount || 0}`);
          console.log(`   - Última renovação: ${sistemaAtual.lastRenewalAt || 'Nunca'}`);
          
          if (sistemaAtual.renewalCount > 0) {
            console.log('\n🎉 RENOVAÇÃO DETECTADA!');
            console.log('   Sistema foi renovado com sucesso!');
            clearInterval(checkInterval);
            
            // Buscar logs de renovação
            const logs = await apiRequest('/api/office/automation/logs?limit=10');
            console.log('\n📜 Logs recentes:');
            logs.slice(0, 5).forEach(log => {
              console.log(`   [${log.createdAt}] ${log.taskType}: ${log.status} - ${log.message || log.error || ''}`);
            });
          }
        }
        console.log('');
      } catch (error) {
        console.error('   Erro ao verificar:', error.message);
      }
      
      // Parar após 3 minutos
      if (checkCount >= 9) {
        console.log('⏰ Tempo limite atingido (3 minutos)');
        clearInterval(checkInterval);
      }
    }, 20000); // Verificar a cada 20 segundos

    // Verificação inicial imediata
    console.log('📊 Status inicial:');
    const configAtual = await apiRequest('/api/office/automation/config');
    console.log(`   - Automação habilitada: ${configAtual.isEnabled}`);
    console.log(`   - Tempo de antecedência: ${configAtual.renewalAdvanceTime} min`);
    console.log(`   - Última execução: ${configAtual.lastRunAt || 'Nunca'}\n`);

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

// Executar teste
testRenewal().catch(console.error);