// OnlineOffice IPTV Automator - Background Script
// Versão refatorada para usar backend como fonte única de verdade

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
const API_BASE = 'https://tv-on.site';
const POLLING_INTERVAL_ACTIVE = 30000; // 30 segundos quando não há tarefas
const POLLING_INTERVAL_IDLE = 60000; // 60 segundos quando automação está desabilitada
const POLLING_INTERVAL_FAST = 10000; // 10 segundos após processar tarefa
const OFFICE_URL = 'https://onlineoffice.zip/iptv/index.php'; // URL específica do painel IPTV

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

// Usa Chrome Alarms API para manter a extensão sempre ativa
function setupAlarms() {
  // Remove alarme anterior se existir
  chrome.alarms.clear('pollBackend', () => {
    // Cria novo alarme que dispara a cada 20 segundos (mais rápido para não perder timing)
    chrome.alarms.create('pollBackend', {
      periodInMinutes: 0.33, // 20 segundos
      delayInMinutes: 0 // Começa imediatamente
    });
    console.log('⏰ Alarme configurado para polling automático a cada 20s');
  });
  
  // Cria alarme adicional para verificação de status
  chrome.alarms.create('checkStatus', {
    periodInMinutes: 1, // A cada minuto
    delayInMinutes: 0
  });
}

// Listener para os alarmes
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollBackend') {
    console.log('⏰ Alarme disparado: checando tarefas...');
    await checkForTasks();
  } else if (alarm.name === 'checkStatus') {
    // Verifica se precisa abrir a aba do OnlineOffice
    await ensureOfficeTabOpen();
  }
});

// Inicia quando o Chrome abre
chrome.runtime.onStartup.addListener(() => {
  console.log('📦 Chrome iniciado, configurando automação...');
  setupAlarms();
  checkForTasks(); // Checa imediatamente
  ensureOfficeTabOpen(); // Garante que a aba está aberta
});

// Inicia quando instalado/atualizado
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extensão instalada/atualizada, configurando automação...');
  setupAlarms();
  checkForTasks(); // Checa imediatamente
});

// Inicia verificação imediata
setupAlarms();
checkForTasks();

// Função para garantir que a aba do OnlineOffice está aberta
async function ensureOfficeTabOpen() {
  // Só abre se a automação está habilitada
  if (!lastStatus.isEnabled) return;
  
  const tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  if (tabs.length === 0) {
    console.log('📂 Abrindo aba do OnlineOffice automaticamente...');
    chrome.tabs.create({ 
      url: OFFICE_URL,
      active: false // Abre em background
    });
  }
}

// ===========================================================================
// POLLING DO BACKEND (Agora usando Alarms API)
// ===========================================================================
function updatePollingInterval(minutes) {
  console.log(`🔄 Atualizando intervalo de polling para ${minutes} minutos`);
  
  chrome.alarms.clear('pollBackend', () => {
    chrome.alarms.create('pollBackend', {
      periodInMinutes: minutes,
      delayInMinutes: 0
    });
  });
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
      currentPollingInterval = POLLING_INTERVAL_IDLE;
      updatePollingInterval(1); // 1 minuto
      return;
    } else if (lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_ACTIVE) {
      console.log('🟢 Automação habilitada, mudando para polling normal (30s)...');
      currentPollingInterval = POLLING_INTERVAL_ACTIVE;
      updatePollingInterval(0.5); // 30 segundos
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
    currentPollingInterval = POLLING_INTERVAL_FAST;
    updatePollingInterval(0.17); // ~10 segundos
    setTimeout(() => {
      if (lastStatus.isEnabled) {
        console.log('⏰ Voltando ao polling normal (30s)...');
        currentPollingInterval = POLLING_INTERVAL_ACTIVE;
        updatePollingInterval(0.5); // 30 segundos
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
  let tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  // Se não encontrar, tenta abrir automaticamente
  if (tabs.length === 0) {
    console.log('📂 Nenhuma aba OnlineOffice encontrada. Abrindo automaticamente...');
    
    // Cria nova aba com o OnlineOffice
    const newTab = await chrome.tabs.create({
      url: OFFICE_URL,
      active: false // Abre em background
    });
    
    // Aguarda a aba carregar
    console.log('⏳ Aguardando aba carregar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Procura novamente
    tabs = await chrome.tabs.query({
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    });
    
    if (tabs.length === 0) {
      console.error('❌ ERRO: Não conseguiu abrir aba OnlineOffice!');
      await reportTaskResult({
        taskId: task.id,
        success: false,
        error: 'Não conseguiu abrir aba OnlineOffice'
      });
      return;
    }
  }
  
  const tabId = tabs[0].id;
  console.log(`✅ Aba encontrada: ${tabs[0].url}`);
  
  // Processa baseado no tipo de tarefa
  if (task.type === 'generate_batch') {
    await generateBatch(tabId, task);
  } else if (task.type === 'generate_single') {
    await generateSingle(tabId, task);
  } else if (task.type === 'renew_system') {
    await renewSystem(tabId, task);
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

async function renewSystem(tabId, task) {
  console.log('🔄 Renovando sistema IPTV...');
  console.log('📋 Dados completos da task:', JSON.stringify(task, null, 2));
  
  // Extrair sistemaId de diferentes locais possíveis
  const sistemaId = task.sistemaId || 
                    task.data?.sistemaId || 
                    task.data?.systemId || 
                    task.metadata?.sistemaId || 
                    task.metadata?.systemId || 
                    null;
                     
  const originalUsername = task.data?.originalUsername || 
                          task.metadata?.originalUsername || 
                          task.metadata?.systemUsername ||
                          task.data?.currentUsername || 
                          'N/A';
  
  console.log(`   Sistema ID: ${sistemaId || 'N/A'}`);
  console.log(`   Usuario atual: ${originalUsername}`);
  console.log(`   Task ID: ${task.id}`);
  
  try {
    // Parse data e metadata se forem strings
    let taskData = task.data;
    let metadata = task.metadata;
    
    if (typeof taskData === 'string') {
      try {
        taskData = JSON.parse(taskData);
      } catch (e) {
        console.error('⚠️ Erro ao fazer parse do data:', e);
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('⚠️ Erro ao fazer parse do metadata:', e);
      }
    }
    
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      console.log('✅ Nova credencial gerada para renovação!');
      console.log(`   Novo Usuario: ${response.credentials.username}`);
      console.log(`   Nova Senha: ${response.credentials.password}`);
      console.log(`   Sistema ID: ${sistemaId || 'desconhecido'}`);
      
      // Reporta sucesso ao backend com sistemaId garantido
      const reportSuccess = await reportTaskResult({
        taskId: task.id,
        type: 'renew_system',
        sistemaId: sistemaId, // Usar sistemaId em vez de systemId
        systemId: sistemaId, // Manter ambos por compatibilidade
        credentials: {
          username: response.credentials.username,
          password: response.credentials.password,
          sistemaId: sistemaId // Incluir também nas credenciais
        },
        oldCredentials: {
          username: originalUsername,
          password: taskData?.currentPassword || metadata?.currentPassword || 'unknown'
        },
        clienteId: taskData?.clienteId || metadata?.clienteId,
        metadata: {
          ...metadata,
          sistemaId: sistemaId,
          originalUsername: originalUsername,
          renewedAt: new Date().toISOString()
        }
      });
      
      if (!reportSuccess) {
        console.error('⚠️ Falha ao reportar renovação ao backend!');
        console.error('   Sistema ID não foi salvo:', sistemaId);
      } else {
        console.log('✅ Renovação reportada ao backend com sucesso');
        console.log(`   Sistema ID ${sistemaId} renovado com sucesso`);
      }
      
    } else {
      throw new Error(response?.error || 'Erro desconhecido ao renovar');
    }
    
  } catch (error) {
    console.error('❌ Erro ao renovar sistema:', error.message);
    
    // Parse data e metadata se forem strings
    let taskData = task.data;
    let metadata = task.metadata;
    
    if (typeof taskData === 'string') {
      try {
        taskData = JSON.parse(taskData);
      } catch (e) {
        // Ignora erro de parse
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        // Ignora erro de parse
      }
    }
    
    // Reporta erro ao backend
    const reportSuccess = await reportTaskResult({
      taskId: task.id,
      type: 'renew_system',
      sistemaId: sistemaId,
      systemId: sistemaId,
      error: error.message,
      metadata: {
        ...metadata,
        sistemaId: sistemaId,
        failedAt: new Date().toISOString()
      }
    });
    
    if (!reportSuccess) {
      console.error('⚠️ Falha ao reportar erro de renovação ao backend!');
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