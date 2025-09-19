// OnlineOffice IPTV Automator - Background Script
// Versão refatorada para usar backend como fonte única de verdade

// ===========================================================================
// SISTEMA DE LOGS 
// ===========================================================================
class ExtensionLogger {
  constructor() {
    this.MAX_LOGS = 1000;
    this.LOG_LEVELS = {
      DEBUG: 'DEBUG',
      INFO: 'INFO', 
      WARN: 'WARN',
      ERROR: 'ERROR'
    };
    this.LOG_COLORS = {
      DEBUG: '#6c757d',
      INFO: '#0d6efd',
      WARN: '#ffc107',
      ERROR: '#dc3545'
    };
  }

  // Adiciona log ao localStorage
  addLog(level, message, context = {}) {
    const logs = this.getLogs();
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      context: context
    };
    
    logs.push(logEntry);
    
    // Manter apenas os últimos MAX_LOGS
    if (logs.length > this.MAX_LOGS) {
      logs.splice(0, logs.length - this.MAX_LOGS);
    }
    
    try {
      localStorage.setItem('extension_logs', JSON.stringify(logs));
    } catch (e) {
      // Se falhar ao salvar (estouro de cota), limpar logs antigos
      this.clearOldLogs();
      localStorage.setItem('extension_logs', JSON.stringify(logs.slice(-500)));
    }
    
    // Também enviar para o console com estilo
    const color = this.LOG_COLORS[level] || '#000';
    console.log(
      `%c[${level}] ${new Date().toLocaleTimeString()} - ${message}`,
      `color: ${color}; font-weight: ${level === 'ERROR' ? 'bold' : 'normal'}`
    );
    if (Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
  }

  // Recupera todos os logs
  getLogs() {
    try {
      const logs = localStorage.getItem('extension_logs');
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      return [];
    }
  }

  // Filtra logs por nível
  getLogsByLevel(level) {
    return this.getLogs().filter(log => log.level === level);
  }

  // Busca logs por texto
  searchLogs(searchText) {
    const lowerSearch = searchText.toLowerCase();
    return this.getLogs().filter(log => 
      log.message.toLowerCase().includes(lowerSearch) ||
      JSON.stringify(log.context).toLowerCase().includes(lowerSearch)
    );
  }

  // Limpa todos os logs
  clearLogs() {
    localStorage.removeItem('extension_logs');
    this.info('Logs limpos pelo usuário');
  }

  // Limpa logs antigos (mantém apenas os últimos 500)
  clearOldLogs() {
    const logs = this.getLogs();
    if (logs.length > 500) {
      const recentLogs = logs.slice(-500);
      localStorage.setItem('extension_logs', JSON.stringify(recentLogs));
    }
  }

  // Métodos de conveniência para cada nível
  debug(message, context = {}) {
    this.addLog(this.LOG_LEVELS.DEBUG, message, context);
  }

  info(message, context = {}) {
    this.addLog(this.LOG_LEVELS.INFO, message, context);
  }

  warn(message, context = {}) {
    this.addLog(this.LOG_LEVELS.WARN, message, context);
  }

  error(message, context = {}) {
    this.addLog(this.LOG_LEVELS.ERROR, message, context);
  }

  // Formata logs para exibição
  formatLogs(logs = null) {
    const logsToFormat = logs || this.getLogs();
    return logsToFormat.map(log => {
      const date = new Date(log.timestamp);
      const timeStr = date.toLocaleTimeString('pt-BR');
      const dateStr = date.toLocaleDateString('pt-BR');
      const contextStr = Object.keys(log.context).length > 0 
        ? ` | ${JSON.stringify(log.context)}` 
        : '';
      return `[${log.level}] ${dateStr} ${timeStr} - ${log.message}${contextStr}`;
    }).join('\n');
  }

  // Exporta logs como texto
  exportAsText() {
    const logs = this.getLogs();
    const header = `=== OnlineOffice Extension Logs ===\n`;
    const exportDate = `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
    const totalLogs = `Total de logs: ${logs.length}\n`;
    const separator = '=' .repeat(50) + '\n\n';
    
    return header + exportDate + totalLogs + separator + this.formatLogs(logs);
  }
}

// Instância global do logger
const logger = new ExtensionLogger();

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
logger.info('🚀 Background script iniciado (versão backend-driven)');

// Usa Chrome Alarms API para manter a extensão sempre ativa
function setupAlarms() {
  // Remove alarme anterior se existir
  chrome.alarms.clear('pollBackend', () => {
    // Cria novo alarme que dispara a cada 20 segundos (mais rápido para não perder timing)
    chrome.alarms.create('pollBackend', {
      periodInMinutes: 0.33, // 20 segundos
      delayInMinutes: 0 // Começa imediatamente
    });
    logger.info('⏰ Alarme configurado para polling automático a cada 20s');
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
    logger.debug('⏰ Alarme disparado: checando tarefas...', { alarm: alarm.name });
    await checkForTasks();
  } else if (alarm.name === 'checkStatus') {
    // Verifica se precisa abrir a aba do OnlineOffice
    await ensureOfficeTabOpen();
  }
});

// Inicia quando o Chrome abre
chrome.runtime.onStartup.addListener(() => {
  logger.info('📦 Chrome iniciado, configurando automação...');
  setupAlarms();
  checkForTasks(); // Checa imediatamente
  ensureOfficeTabOpen(); // Garante que a aba está aberta
});

// Inicia quando instalado/atualizado
chrome.runtime.onInstalled.addListener(() => {
  logger.info('🔧 Extensão instalada/atualizada, configurando automação...');
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
    logger.info('📂 Abrindo aba do OnlineOffice automaticamente...');
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
  logger.debug(`🔄 Atualizando intervalo de polling para ${minutes} minutos`);
  
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
    logger.debug('⏳ Já processando tarefa, pulando checagem...');
    return;
  }
  
  // Evita requisições muito frequentes
  const now = Date.now();
  if (now - lastStatus.lastCheck < 5000) {
    logger.debug('🚫 Checagem muito recente, aguardando...');
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
      logger.error('❌ Erro na requisição:', { error: err.message });
      return null;
    });
    
    if (!response) {
      updateBadge(false);
      return;
    }
    
    if (!response.ok) {
      logger.error('❌ Erro ao consultar backend', { status: response.status });
      updateBadge(false);
      return;
    }
    
    const data = await response.json();
    
    // Atualiza badge baseado no status
    updateBadge(data.isEnabled || false);
    lastStatus.isEnabled = data.isEnabled || false;
    
    // Ajusta intervalo de polling baseado no status
    if (!lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_IDLE) {
      logger.info('🟠 Automação desabilitada, mudando para polling lento (60s)...');
      currentPollingInterval = POLLING_INTERVAL_IDLE;
      updatePollingInterval(1); // 1 minuto
      return;
    } else if (lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_ACTIVE) {
      logger.info('🟢 Automação habilitada, mudando para polling normal (30s)...');
      currentPollingInterval = POLLING_INTERVAL_ACTIVE;
      updatePollingInterval(0.5); // 30 segundos
    }
    
    // Se não há tarefa, continua polling
    if (!data.hasTask) {
      logger.debug(`⏰ Sem tarefas. Próxima checagem em ${currentPollingInterval / 1000}s`);
      return;
    }
    
    logger.info('📋 Nova tarefa recebida do backend', { task: data.task });
    
    // Marca como processando
    isProcessingTask = true;
    
    // Processa a tarefa
    await processTask(data.task);
    
    // Após processar, fazer polling mais rápido temporariamente
    logger.info('⚡ Tarefa processada, fazendo polling rápido temporário (10s)...');
    currentPollingInterval = POLLING_INTERVAL_FAST;
    updatePollingInterval(0.17); // ~10 segundos
    setTimeout(() => {
      if (lastStatus.isEnabled) {
        logger.info('⏰ Voltando ao polling normal (30s)...');
        currentPollingInterval = POLLING_INTERVAL_ACTIVE;
        updatePollingInterval(0.5); // 30 segundos
      }
    }, 60000); // Volta ao normal após 1 minuto
    
  } catch (error) {
    logger.error('❌ Erro no polling', { error: error.message });
    updateBadge(false);
  } finally {
    isProcessingTask = false;
  }
}

// ===========================================================================
// PROCESSAMENTO DE TAREFAS
// ===========================================================================
async function processTask(task) {
  logger.info('========================================');
  logger.info('🎯 PROCESSANDO TAREFA DO BACKEND');
  logger.info(`📦 Tipo: ${task.type}`);
  logger.info(`🔢 Quantidade: ${task.quantity || 1}`);
  logger.info('========================================');
  
  // Procura aba do OnlineOffice
  let tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  // Se não encontrar, tenta abrir automaticamente
  if (tabs.length === 0) {
    logger.warn('📂 Nenhuma aba OnlineOffice encontrada. Abrindo automaticamente...');
    
    // Cria nova aba com o OnlineOffice
    const newTab = await chrome.tabs.create({
      url: OFFICE_URL,
      active: false // Abre em background
    });
    
    // Aguarda a aba carregar
    logger.info('⏳ Aguardando aba carregar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Procura novamente
    tabs = await chrome.tabs.query({
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    });
    
    if (tabs.length === 0) {
      logger.error('❌ ERRO: Não conseguiu abrir aba OnlineOffice!');
      await reportTaskResult({
        taskId: task.id,
        success: false,
        error: 'Não conseguiu abrir aba OnlineOffice'
      });
      return;
    }
  }
  
  const tabId = tabs[0].id;
  logger.info(`✅ Aba encontrada`, { url: tabs[0].url });
  
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
  
  logger.info(`📦 Gerando lote de ${quantity} credenciais...`);
  
  for (let i = 0; i < quantity; i++) {
    logger.info(`🎯 Gerando credencial ${i + 1}/${quantity}...`);
    
    try {
      // Envia comando para content script
      const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
      
      if (response && response.success && response.credentials) {
        successCount++;
        
        logger.info(`✅ Sucesso! Credencial ${i + 1} gerada`, {
          username: response.credentials.username,
          password: response.credentials.password
        });
        
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
        logger.error(`❌ Erro na credencial ${i + 1}`, { error: response?.error || 'Sem resposta' });
        
        results.push({
          success: false,
          error: response?.error || 'Erro desconhecido'
        });
      }
      
    } catch (error) {
      errorCount++;
      logger.error(`❌ Erro ao gerar credencial ${i + 1}`, { error: error.message });
      
      results.push({
        success: false,
        error: error.message
      });
      
      // Se perdeu conexão com a aba, parar
      if (error.message.includes('Could not establish connection')) {
        logger.error('🔌 Perdeu conexão com a aba. Parando lote...');
        break;
      }
    }
    
    // Aguarda entre gerações
    if (i < quantity - 1) {
      logger.debug('⏳ Aguardando 5 segundos antes da próxima...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  logger.info('========================================');
  logger.info('📊 LOTE COMPLETO');
  logger.info(`✅ Sucesso: ${successCount} credenciais`);
  logger.info(`❌ Erros: ${errorCount}`);
  logger.info('========================================');
  
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
    logger.error('⚠️ Falha ao reportar resultado ao backend!');
  } else {
    logger.info('✅ Resultado reportado ao backend com sucesso');
  }
}

async function generateSingle(tabId, task) {
  logger.info('🎯 Gerando credencial única...');
  
  try {
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      logger.info('✅ Credencial gerada com sucesso!', {
        username: response.credentials.username,
        password: response.credentials.password
      });
      
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
        logger.error('⚠️ Falha ao reportar credencial ao backend!');
      } else {
        logger.info('✅ Credencial reportada ao backend com sucesso');
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
    logger.error('❌ Erro ao gerar credencial', { error: error.message });
    
    // Reporta erro ao backend
    const reportSuccess = await reportTaskResult({
      taskId: task.id,
      type: 'generate_single',
      error: error.message
    });
    
    if (!reportSuccess) {
      logger.error('⚠️ Falha ao reportar erro ao backend!');
    }
  }
}

async function renewSystem(tabId, task) {
  logger.info('🔄 Renovando sistema IPTV...', { taskData: task });
  
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
  
  logger.info('📋 Dados da renovação', {
    sistemaId: sistemaId || 'N/A',
    usuarioAtual: originalUsername,
    taskId: task.id
  });
  
  try {
    // Parse data e metadata se forem strings
    let taskData = task.data;
    let metadata = task.metadata;
    
    if (typeof taskData === 'string') {
      try {
        taskData = JSON.parse(taskData);
      } catch (e) {
        logger.warn('⚠️ Erro ao fazer parse do data', { error: e.message });
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        logger.warn('⚠️ Erro ao fazer parse do metadata', { error: e.message });
      }
    }
    
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      logger.info('✅ Nova credencial gerada para renovação!', {
        novoUsuario: response.credentials.username,
        novaSenha: response.credentials.password,
        sistemaId: sistemaId || 'desconhecido'
      });
      
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
        logger.error('⚠️ Falha ao reportar renovação ao backend!', { sistemaId });
      } else {
        logger.info('✅ Renovação reportada ao backend com sucesso', { sistemaId });
      }
      
    } else {
      throw new Error(response?.error || 'Erro desconhecido ao renovar');
    }
    
  } catch (error) {
    logger.error('❌ Erro ao renovar sistema', { error: error.message, sistemaId });
    
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
      logger.error('⚠️ Falha ao reportar erro de renovação ao backend!');
    }
  }
}

// ===========================================================================
// COMUNICAÇÃO COM BACKEND
// ===========================================================================
async function reportTaskResult(result) {
  logger.info('📤 Reportando resultado ao backend', { result });
  
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
      const errorText = await response.text();
      logger.error('❌ Erro ao reportar resultado', { 
        status: response.status,
        response: errorText 
      });
      return false;
    } else {
      const data = await response.json();
      logger.info('✅ Resultado reportado com sucesso', { response: data });
      return true;
    }
    
  } catch (error) {
    logger.error('❌ Erro ao reportar resultado', { error: error.message });
    return false;
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
      logger.debug('🟢 Badge: ON');
    } else {
      chrome.action.setBadgeText({ text: '' });
      logger.debug('⚫ Badge: OFF');
    }
    
    lastStatus.badge = newBadge;
    lastStatus.isEnabled = isEnabled;
  }
}

// ===========================================================================
// LISTENER DE MENSAGENS DO POPUP E COMUNICAÇÃO COM BACKEND
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.debug('📨 Mensagem recebida', { type: request.type, from: sender.tab ? 'tab' : 'popup' });
  
  // Mensagens de gerenciamento de logs
  if (request.type === 'getLogs') {
    const filters = request.filters || {};
    let logs = logger.getLogs();
    
    // Aplicar filtros
    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }
    if (filters.searchText) {
      logs = logger.searchLogs(filters.searchText);
    }
    if (filters.limit) {
      logs = logs.slice(-filters.limit);
    }
    
    sendResponse({
      success: true,
      logs: logs,
      formatted: logger.formatLogs(logs)
    });
    return true;
  }
  
  if (request.type === 'clearLogs') {
    logger.clearLogs();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'exportLogs') {
    const exportText = logger.exportAsText();
    sendResponse({
      success: true,
      text: exportText
    });
    return true;
  }
  
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
  logger.debug('⚠️ Mensagem ignorada - controle via backend');
  sendResponse({
    success: false,
    message: 'Use o painel de controle web para gerenciar a automação'
  });
  return true;
});

logger.info('✅ Background script carregado e polling iniciado');