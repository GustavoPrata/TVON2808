// OnlineOffice IPTV Automator - Background Script
// Versão refatorada para usar backend como fonte única de verdade

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
const API_BASE = 'https://tv-on.site';
const POLLING_INTERVAL_ACTIVE = 30000; // 30 segundos quando não há tarefas
const POLLING_INTERVAL_IDLE = 60000; // 60 segundos quando automação está desabilitada
const POLLING_INTERVAL_FAST = 10000; // 10 segundos após processar tarefa

// ===========================================================================
// ESTADO GLOBAL (mínimo, apenas para cache)
// ===========================================================================
let pollingTimer = null;
let isProcessingTask = false;
let lastStatus = {
  isEnabled: false,
  badge: '',
  lastCheck: 0
};
let currentPollingInterval = POLLING_INTERVAL_IDLE;

// ===========================================================================
// INICIALIZAÇÃO
// ===========================================================================
console.log('🚀 Background script iniciado (versão backend-driven)');

// Inicia polling ao carregar
chrome.runtime.onStartup.addListener(() => {
  console.log('📦 Chrome iniciado, iniciando polling do backend...');
  startPolling();
});

// Inicia polling quando instalado
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extensão instalada/atualizada, iniciando polling...');
  startPolling();
});

// Inicia polling imediatamente
startPolling();

// ===========================================================================
// POLLING DO BACKEND
// ===========================================================================
function startPolling(intervalOverride = null) {
  console.log(`🔄 Iniciando polling do backend com intervalo: ${intervalOverride || currentPollingInterval}ms`);
  
  // Cancela polling anterior se existir
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  
  // Define o intervalo se foi especificado
  if (intervalOverride !== null) {
    currentPollingInterval = intervalOverride;
  }
  
  // Faz primeira checagem imediata
  checkForTasks();
  
  // Configura polling recorrente com intervalo adaptativo
  pollingTimer = setInterval(checkForTasks, currentPollingInterval);
}

async function checkForTasks() {
  // Se já está processando, pula esta checagem
  if (isProcessingTask) {
    console.log('⏳ Já processando tarefa, pulando checagem...');
    return;
  }
  
  // Evita requisições muito frequentes
  const now = Date.now();
  if (now - lastStatus.lastCheck < 5000) {
    console.log('🚫 Checagem muito recente, aguardando...');
    return;
  }
  lastStatus.lastCheck = now;
  
  try {
    // Consulta próxima tarefa no backend
    const response = await fetch(`${API_BASE}/api/office/automation/next-task`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      }
    }).catch(err => {
      console.error('❌ Erro na requisição:', err);
      return null;
    });
    
    if (!response) {
      updateBadge(false);
      return;
    }
    
    if (!response.ok) {
      console.error('❌ Erro ao consultar backend. Status:', response.status);
      updateBadge(false);
      return;
    }
    
    const data = await response.json();
    
    // Atualiza badge baseado no status
    updateBadge(data.isEnabled || false);
    lastStatus.isEnabled = data.isEnabled || false;
    
    // Ajusta intervalo de polling baseado no status
    if (!lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_IDLE) {
      console.log('🟠 Automação desabilitada, mudando para polling lento (60s)...');
      startPolling(POLLING_INTERVAL_IDLE);
      return;
    } else if (lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_ACTIVE) {
      console.log('🟢 Automação habilitada, mudando para polling normal (30s)...');
      startPolling(POLLING_INTERVAL_ACTIVE);
    }
    
    // Se não há tarefa, continua polling
    if (!data.hasTask) {
      console.log(`⏰ Sem tarefas. Próxima checagem em ${currentPollingInterval / 1000}s`);
      return;
    }
    
    console.log('📋 Nova tarefa recebida do backend:', data.task);
    
    // Marca como processando
    isProcessingTask = true;
    
    // Processa a tarefa
    await processTask(data.task);
    
    // Após processar, fazer polling mais rápido temporariamente
    console.log('⚡ Tarefa processada, fazendo polling rápido temporário (10s)...');
    startPolling(POLLING_INTERVAL_FAST);
    setTimeout(() => {
      if (lastStatus.isEnabled) {
        console.log('⏰ Voltando ao polling normal (30s)...');
        startPolling(POLLING_INTERVAL_ACTIVE);
      }
    }, 60000); // Volta ao normal após 1 minuto
    
  } catch (error) {
    console.error('❌ Erro no polling:', error);
    updateBadge(false);
  } finally {
    isProcessingTask = false;
  }
}

// ===========================================================================
// PROCESSAMENTO DE TAREFAS
// ===========================================================================
async function processTask(task) {
  console.log('========================================');
  console.log('🎯 PROCESSANDO TAREFA DO BACKEND');
  console.log(`📦 Tipo: ${task.type}`);
  console.log(`🔢 Quantidade: ${task.quantity || 1}`);
  console.log('========================================');
  
  // Procura aba do OnlineOffice
  const tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  if (tabs.length === 0) {
    console.error('❌ ERRO: Nenhuma aba OnlineOffice encontrada!');
    
    // Reporta erro ao backend
    await reportTaskResult({
      taskId: task.id,
      success: false,
      error: 'Nenhuma aba OnlineOffice encontrada'
    });
    
    return;
  }
  
  const tabId = tabs[0].id;
  console.log(`✅ Aba encontrada: ${tabs[0].url}`);
  
  // Processa baseado no tipo de tarefa
  if (task.type === 'generate_batch') {
    await generateBatch(tabId, task);
  } else if (task.type === 'generate_single') {
    await generateSingle(tabId, task);
  }
}

async function generateBatch(tabId, task) {
  const quantity = task.quantity || 10;
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  console.log(`📦 Gerando lote de ${quantity} credenciais...`);
  
  for (let i = 0; i < quantity; i++) {
    console.log(`\n🎯 Gerando credencial ${i + 1}/${quantity}...`);
    
    try {
      // Envia comando para content script
      const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
      
      if (response && response.success && response.credentials) {
        successCount++;
        
        console.log(`✅ Sucesso! Credencial ${i + 1} gerada`);
        console.log(`   Usuario: ${response.credentials.username}`);
        console.log(`   Senha: ${response.credentials.password}`);
        
        results.push({
          success: true,
          username: response.credentials.username,
          password: response.credentials.password
        });
        
        // Notifica popup se estiver aberto
        chrome.runtime.sendMessage({
          type: 'credentialGenerated',
          credentials: response.credentials,
          progress: {
            current: i + 1,
            total: quantity
          }
        }).catch(() => {});
        
      } else {
        errorCount++;
        console.error(`❌ Erro na credencial ${i + 1}:`, response?.error || 'Sem resposta');
        
        results.push({
          success: false,
          error: response?.error || 'Erro desconhecido'
        });
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Erro ao gerar credencial ${i + 1}:`, error.message);
      
      results.push({
        success: false,
        error: error.message
      });
      
      // Se perdeu conexão com a aba, parar
      if (error.message.includes('Could not establish connection')) {
        console.error('🔌 Perdeu conexão com a aba. Parando lote...');
        break;
      }
    }
    
    // Aguarda entre gerações
    if (i < quantity - 1) {
      console.log('⏳ Aguardando 5 segundos antes da próxima...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n========================================');
  console.log('📊 LOTE COMPLETO');
  console.log(`✅ Sucesso: ${successCount} credenciais`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log('========================================\n');
  
  // Reporta resultados ao backend - IMPORTANTE: Usar formato correto
  const reportSuccess = await reportTaskResult({
    taskId: task.id,
    type: 'generate_batch',
    results: results,
    summary: {
      successCount,
      errorCount,
      total: quantity
    }
  });
  
  if (!reportSuccess) {
    console.error('⚠️ Falha ao reportar resultado ao backend!');
  } else {
    console.log('✅ Resultado reportado ao backend com sucesso');
  }
}

async function generateSingle(tabId, task) {
  console.log('🎯 Gerando credencial única...');
  
  try {
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      console.log('✅ Credencial gerada com sucesso!');
      console.log(`   Usuario: ${response.credentials.username}`);
      console.log(`   Senha: ${response.credentials.password}`);
      
      // Reporta sucesso ao backend - IMPORTANTE: Usar formato correto
      const reportSuccess = await reportTaskResult({
        taskId: task.id,
        type: 'generate_single',
        credentials: {
          username: response.credentials.username,
          password: response.credentials.password
        }
      });
      
      if (!reportSuccess) {
        console.error('⚠️ Falha ao reportar credencial ao backend!');
      } else {
        console.log('✅ Credencial reportada ao backend com sucesso');
      }
      
      // Notifica popup
      chrome.runtime.sendMessage({
        type: 'credentialGenerated',
        credentials: response.credentials
      }).catch(() => {});
      
    } else {
      throw new Error(response?.error || 'Erro desconhecido');
    }
    
  } catch (error) {
    console.error('❌ Erro ao gerar credencial:', error.message);
    
    // Reporta erro ao backend
    const reportSuccess = await reportTaskResult({
      taskId: task.id,
      type: 'generate_single',
      error: error.message
    });
    
    if (!reportSuccess) {
      console.error('⚠️ Falha ao reportar erro ao backend!');
    }
  }
}

// ===========================================================================
// COMUNICAÇÃO COM BACKEND
// ===========================================================================
async function reportTaskResult(result) {
  console.log('📤 Reportando resultado ao backend:', JSON.stringify(result, null, 2));
  
  try {
    // Usa o endpoint correto task-complete
    const response = await fetch(`${API_BASE}/api/office/automation/task-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      },
      body: JSON.stringify(result)
    });
    
    if (!response.ok) {
      console.error('❌ Erro ao reportar resultado:', response.status);
      const errorText = await response.text();
      console.error('Resposta do servidor:', errorText);
      return false;
    } else {
      const data = await response.json();
      console.log('✅ Resultado reportado com sucesso:', data);
      return true;
    }
    
  } catch (error) {
    console.error('❌ Erro ao reportar resultado:', error);
  }
}

// ===========================================================================
// ATUALIZAÇÃO DE BADGE
// ===========================================================================
function updateBadge(isEnabled) {
  const newBadge = isEnabled ? 'ON' : '';
  
  // Só atualiza se mudou
  if (lastStatus.badge !== newBadge) {
    if (isEnabled) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
      console.log('🟢 Badge: ON');
    } else {
      chrome.action.setBadgeText({ text: '' });
      console.log('⚫ Badge: OFF');
    }
    
    lastStatus.badge = newBadge;
    lastStatus.isEnabled = isEnabled;
  }
}

// ===========================================================================
// LISTENER DE MENSAGENS DO POPUP
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensagem recebida do popup:', request.type);
  
  if (request.type === 'getStatus') {
    // Retorna status do cache
    sendResponse({
      isRunning: lastStatus.isEnabled,
      message: lastStatus.isEnabled 
        ? 'Automação controlada pelo backend' 
        : 'Automação parada'
    });
    return true;
  }
  
  if (request.type === 'openDashboard') {
    // Abre o painel de controle
    chrome.tabs.create({ 
      url: `${API_BASE}/painel-office` 
    });
    sendResponse({success: true});
    return true;
  }
  
  // Outras mensagens são ignoradas pois tudo é controlado pelo backend
  console.log('⚠️ Mensagem ignorada - controle via backend');
  sendResponse({
    success: false,
    message: 'Use o painel de controle web para gerenciar a automação'
  });
  return true;
});

console.log('✅ Background script carregado e polling iniciado');