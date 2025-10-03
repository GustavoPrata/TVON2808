// OnlineOffice IPTV Automator - Background Script
// Versão refatorada para usar backend como fonte única de verdade

// ===========================================================================
// SISTEMA DE LOGS 
// ===========================================================================
class ExtensionLogger {
  constructor() {
    this.MAX_LOGS = 1000;
    this.STORAGE_KEY = 'extension_logs';
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

  // Adiciona log ao chrome.storage.local
  async addLog(level, message, context = {}) {
    const logs = await this.getLogs();
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
      await chrome.storage.local.set({ [this.STORAGE_KEY]: logs });
    } catch (e) {
      // Se falhar ao salvar, limpar logs antigos
      await this.clearOldLogs();
      await chrome.storage.local.set({ [this.STORAGE_KEY]: logs.slice(-500) });
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
  async getLogs() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (e) {
      return [];
    }
  }

  // Filtra logs por nível
  async getLogsByLevel(level) {
    const logs = await this.getLogs();
    return logs.filter(log => log.level === level);
  }

  // Busca logs por texto
  async searchLogs(searchText) {
    const lowerSearch = searchText.toLowerCase();
    const logs = await this.getLogs();
    return logs.filter(log => 
      log.message.toLowerCase().includes(lowerSearch) ||
      JSON.stringify(log.context).toLowerCase().includes(lowerSearch)
    );
  }

  // Limpa todos os logs
  async clearLogs() {
    await chrome.storage.local.remove(this.STORAGE_KEY);
    await this.info('Logs limpos pelo usuário');
  }

  // Limpa logs antigos (mantém apenas os últimos 500)
  async clearOldLogs() {
    const logs = await this.getLogs();
    if (logs.length > 500) {
      const recentLogs = logs.slice(-500);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: recentLogs });
    }
  }

  // Métodos de conveniência para cada nível
  async debug(message, context = {}) {
    await this.addLog(this.LOG_LEVELS.DEBUG, message, context);
  }

  async info(message, context = {}) {
    await this.addLog(this.LOG_LEVELS.INFO, message, context);
  }

  async warn(message, context = {}) {
    await this.addLog(this.LOG_LEVELS.WARN, message, context);
  }

  async error(message, context = {}) {
    await this.addLog(this.LOG_LEVELS.ERROR, message, context);
  }

  // Formata logs para exibição
  async formatLogs(logs = null) {
    const logsToFormat = logs || await this.getLogs();
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
  async exportAsText() {
    const logs = await this.getLogs();
    const header = `=== OnlineOffice Extension Logs ===\n`;
    const exportDate = `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
    const totalLogs = `Total de logs: ${logs.length}\n`;
    const separator = '=' .repeat(50) + '\n\n';
    
    const formatted = await this.formatLogs(logs);
    return header + exportDate + totalLogs + separator + formatted;
  }
}

// Instância global do logger
const logger = new ExtensionLogger();

// ===========================================================================
// CONFIGURAÇÃO
// ===========================================================================
// Função para determinar a URL do servidor dinamicamente
async function getApiBase() {
  // Primeiro, verifica se há uma configuração salva no storage
  const stored = await chrome.storage.local.get('apiBase');
  if (stored.apiBase) {
    await logger.info(`📍 Usando API configurada: ${stored.apiBase}`);
    return stored.apiBase;
  }
  
  // Lista de servidores possíveis em ordem de prioridade
  const servers = [
    'http://localhost:5000',           // Desenvolvimento local
    'http://127.0.0.1:5000',          // Desenvolvimento local alternativo
    'https://tv-on.site'               // Produção
  ];
  
  // Tenta cada servidor para ver qual está disponível
  for (const server of servers) {
    try {
      await logger.debug(`🔍 Testando servidor: ${server}`);
      const response = await fetch(`${server}/api`, {
        method: 'HEAD',
        mode: 'cors'
      }).catch(() => null);
      
      if (response && response.ok) {
        await logger.info(`✅ Servidor disponível: ${server}`);
        // Salva o servidor funcional no storage
        await chrome.storage.local.set({ apiBase: server });
        return server;
      }
    } catch (e) {
      await logger.debug(`❌ Servidor não disponível: ${server}`);
    }
  }
  
  // Se nenhum servidor responder, usa o padrão de produção
  await logger.warn('⚠️ Nenhum servidor respondeu, usando produção como fallback');
  return 'https://tv-on.site';
}

// Variável global para armazenar a URL do API
let API_BASE = null;
const POLLING_INTERVAL_ACTIVE = 30000; // 30 segundos quando não há tarefas
const POLLING_INTERVAL_IDLE = 60000; // 60 segundos quando automação está desabilitada
const POLLING_INTERVAL_FAST = 10000; // 10 segundos após processar tarefa
const OFFICE_URL = 'https://onlineoffice.zip/'; // URL base do OnlineOffice

// ===========================================================================
// ESTADO GLOBAL (mínimo, apenas para cache)
// ===========================================================================
let pollingTimer = null;
let isProcessingTask = false;
let processingStartTime = null; // Para rastrear quando começou o processamento
let lastStatus = {
  isEnabled: false,
  badge: '',
  lastCheck: 0
};
let currentPollingInterval = POLLING_INTERVAL_IDLE;
let heartbeatTimer = null;
let pendingTask = null; // Armazena tarefa pendente mas não processada

// Timeout de segurança para resetar isProcessingTask (5 minutos)
const PROCESSING_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// ===========================================================================
// SISTEMA DE HEARTBEAT
// ===========================================================================
async function sendHeartbeat() {
  try {
    // Busca todas as abas do OnlineOffice
    const tabs = await chrome.tabs.query({
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    });
    
    if (tabs.length === 0) {
      await logger.debug('💔 Nenhuma aba OnlineOffice aberta para heartbeat');
      return;
    }
    
    // Pega a primeira aba ativa
    const activeTab = tabs[0];
    const currentUrl = activeTab.url || '';
    
    // Verifica se está logado baseado na URL
    // Se está na página de login, está deslogado
    // Se está em qualquer outra página do OnlineOffice, está logado
    const isLoggedIn = currentUrl.includes('onlineoffice.zip') && !currentUrl.includes('#/login');
    
    await logger.debug(`💓 Enviando heartbeat - URL: ${currentUrl}, Logado: ${isLoggedIn}`);
    
    // Envia heartbeat para o backend
    if (API_BASE) {
      const response = await fetch(`${API_BASE}/api/extension/heartbeat?ts=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Key': 'tvon-extension-2024',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache'
        },
        cache: 'no-store',
        body: JSON.stringify({
          currentUrl: currentUrl,
          isLoggedIn: isLoggedIn,
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version,
          metadata: {
            tabId: activeTab.id,
            windowId: activeTab.windowId
          }
        })
      });
      
      if (!response.ok) {
        await logger.warn(`⚠️ Heartbeat falhou: ${response.status}`);
      } else {
        await logger.debug('✅ Heartbeat enviado com sucesso');
      }
    }
  } catch (error) {
    await logger.error('❌ Erro ao enviar heartbeat:', { error: error.message });
  }
}

// Inicia o sistema de heartbeat
async function startHeartbeat() {
  // Para qualquer heartbeat anterior
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  
  // Envia heartbeat imediatamente
  await sendHeartbeat();
  
  // Configura heartbeat a cada 30 segundos
  heartbeatTimer = setInterval(async () => {
    await sendHeartbeat();
  }, 30000);
  
  await logger.info('💗 Sistema de heartbeat iniciado (30s)');
}

// ===========================================================================
// INICIALIZAÇÃO
// ===========================================================================
// Inicialização assíncrona do logger e API
(async () => {
  await logger.info('🚀 Background script iniciado (versão backend-driven)');
  // Inicializa API_BASE dinamicamente
  API_BASE = await getApiBase();
  await logger.info(`🔗 Servidor API configurado: ${API_BASE}`);
  
  // Inicia o sistema de heartbeat
  await startHeartbeat();
})();

// ===========================================================================
// MONITORAMENTO DE ABAS
// ===========================================================================
// Monitora mudanças de URL nas abas do OnlineOffice
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url && tab.url.includes('onlineoffice.zip')) {
    await logger.debug(`🔄 URL mudou em aba ${tabId}: ${changeInfo.url}`);
    // Envia heartbeat quando URL muda
    await sendHeartbeat();
  }
});

// Monitora quando uma aba do OnlineOffice é ativada
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && tab.url.includes('onlineoffice.zip')) {
    await logger.debug(`🔄 Aba OnlineOffice ativada: ${tab.url}`);
    // Envia heartbeat quando aba é ativada
    await sendHeartbeat();
  }
});

// Monitora quando uma nova janela é focada
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    const tabs = await chrome.tabs.query({ 
      active: true, 
      windowId: windowId,
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    });
    if (tabs.length > 0) {
      await logger.debug(`🥇 Janela com OnlineOffice focada`);
      await sendHeartbeat();
    }
  }
});

// Usa Chrome Alarms API para manter a extensão sempre ativa
async function setupAlarms() {
  // Remove alarme anterior se existir
  chrome.alarms.clear('pollBackend', async () => {
    // Cria novo alarme que dispara a cada 20 segundos (mais rápido para não perder timing)
    chrome.alarms.create('pollBackend', {
      periodInMinutes: 0.33, // 20 segundos
      delayInMinutes: 0 // Começa imediatamente
    });
    await logger.info('⏰ Alarme configurado para polling automático a cada 20s');
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
    await logger.debug('⏰ Alarme disparado: checando tarefas...', { alarm: alarm.name });
    await checkForTasks();
  } else if (alarm.name === 'checkStatus') {
    // Verifica se precisa abrir a aba do OnlineOffice
    await ensureOfficeTabOpen();
  }
});

// Inicia quando o Chrome abre
chrome.runtime.onStartup.addListener(async () => {
  await logger.info('📦 Chrome iniciado, configurando automação...');
  // Reset de segurança no startup
  isProcessingTask = false;
  processingStartTime = null;
  await logger.info('🔄 Estado resetado no startup', { isProcessingTask: false });
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
  await ensureOfficeTabOpen(); // Garante que a aba está aberta
});

// Inicia quando instalado/atualizado
chrome.runtime.onInstalled.addListener(async () => {
  await logger.info('🔧 Extensão instalada/atualizada, configurando automação...');
  // Reset de segurança na instalação/atualização
  isProcessingTask = false;
  processingStartTime = null;
  await logger.info('🔄 Estado resetado na instalação/atualização', { isProcessingTask: false });
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
});

// Inicia verificação imediata
(async () => {
  // Reset de segurança no início
  isProcessingTask = false;
  processingStartTime = null;
  await logger.info('🔄 Estado inicial resetado', { isProcessingTask: false });
  await setupAlarms();
  await checkForTasks();
})();

// Função para garantir que a aba do OnlineOffice está aberta
async function ensureOfficeTabOpen(forceOpen = false) {
  // Só abre se a automação está habilitada OU se forceOpen é true (quando há task)
  if (!lastStatus.isEnabled && !forceOpen) return;
  
  const tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  if (tabs.length === 0) {
    await logger.info('📂 Abrindo aba do OnlineOffice automaticamente...');
    chrome.tabs.create({ 
      url: OFFICE_URL,
      active: false // Abre em background
    });
  }
}

// ===========================================================================
// POLLING DO BACKEND (Agora usando Alarms API)
// ===========================================================================
async function updatePollingInterval(minutes) {
  await logger.debug(`🔄 Atualizando intervalo de polling para ${minutes} minutos`);
  
  chrome.alarms.clear('pollBackend', () => {
    chrome.alarms.create('pollBackend', {
      periodInMinutes: minutes,
      delayInMinutes: 0
    });
  });
}

async function checkForTasks() {
  // Verificação de timeout de segurança
  if (isProcessingTask && processingStartTime) {
    const processingTime = Date.now() - processingStartTime;
    if (processingTime > PROCESSING_TIMEOUT) {
      await logger.error('⚠️ TIMEOUT: Processamento travado há mais de 5 minutos! Resetando...', {
        processingTime: processingTime / 1000 + ' segundos'
      });
      isProcessingTask = false;
      processingStartTime = null;
    }
  }
  
  // Se já está processando, pula esta checagem
  if (isProcessingTask) {
    const timeElapsed = processingStartTime ? (Date.now() - processingStartTime) / 1000 : 0;
    await logger.debug('⏳ Já processando tarefa, pulando checagem...', {
      tempoDecorrido: timeElapsed + ' segundos'
    });
    return;
  }
  
  // Evita requisições muito frequentes
  const now = Date.now();
  if (now - lastStatus.lastCheck < 5000) {
    await logger.debug('🚫 Checagem muito recente, aguardando...');
    return;
  }
  lastStatus.lastCheck = now;
  
  // Garante que API_BASE está definido
  if (!API_BASE) {
    API_BASE = await getApiBase();
    await logger.info(`🔗 Servidor API re-configurado: ${API_BASE}`);
  }
  
  try {
    // Log detalhado da URL sendo usada com timestamp único para evitar cache 304
    const fullUrl = `${API_BASE}/api/office/automation/next-task?ts=${Date.now()}`;
    await logger.info(`🔍 Buscando tarefas em: ${fullUrl}`);
    
    // Consulta próxima tarefa no backend com headers anti-cache
    let response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'tvon-extension-2024',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    }).catch(async err => {
      await logger.error('❌ Erro na requisição:', { error: err.message });
      return null;
    });
    
    if (!response) {
      await updateBadge(false);
      return;
    }
    
    if (!response.ok) {
      // Se receber 304 Not Modified, tenta novamente com novo timestamp
      if (response.status === 304) {
        await logger.warn('⚠️ Recebido 304 Not Modified, refazendo requisição com novo timestamp...');
        const retryUrl = `${API_BASE}/api/office/automation/next-task?ts=${Date.now()}&force=true`;
        const retryResponse = await fetch(retryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Extension-Key': 'tvon-extension-2024',
            'Cache-Control': 'no-cache, no-store, max-age=0',
            'Pragma': 'no-cache',
            'If-None-Match': ''
          },
          cache: 'no-store'
        });
        if (!retryResponse.ok) {
          await logger.error('❌ Erro ao consultar backend após retry', { status: retryResponse.status });
          await updateBadge(false);
          return;
        }
        // Substitui a resposta pela retry
        response = retryResponse;
      } else {
        await logger.error('❌ Erro ao consultar backend', { status: response.status });
        await updateBadge(false);
        return;
      }
    }
    
    const data = await response.json();
    
    // Log detalhado da resposta
    await logger.info(`📦 Resposta do servidor:`, { 
      hasTask: data.hasTask,
      isEnabled: data.isEnabled,
      taskType: data.task?.type,
      server: API_BASE
    });
    
    // Atualiza badge baseado no status
    await updateBadge(data.isEnabled || false);
    lastStatus.isEnabled = data.isEnabled || false;
    
    // Ajusta intervalo de polling baseado no status
    if (!lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_IDLE) {
      await logger.info('🟠 Automação desabilitada, mudando para polling lento (60s)...');
      currentPollingInterval = POLLING_INTERVAL_IDLE;
      await updatePollingInterval(1); // 1 minuto
      return;
    } else if (lastStatus.isEnabled && currentPollingInterval !== POLLING_INTERVAL_ACTIVE) {
      await logger.info('🟢 Automação habilitada, mudando para polling normal (30s)...');
      currentPollingInterval = POLLING_INTERVAL_ACTIVE;
      await updatePollingInterval(0.5); // 30 segundos
    }
    
    // Se não há tarefa, limpa pendingTask e continua polling
    if (!data.hasTask) {
      pendingTask = null;
      await updateBadge(data.isEnabled || false);
      await logger.debug(`⏰ Sem tarefas. Próxima checagem em ${currentPollingInterval / 1000}s`);
      return;
    }
    
    // IMPORTANTE: Apenas armazena a tarefa, NÃO processa automaticamente!
    if (data.hasTask && data.task) {
      pendingTask = data.task;
      await logger.info('⚠️ TAREFA PENDENTE DETECTADA - Aguardando comando do usuário', { 
        taskId: data.task?.id,
        taskType: data.task?.type 
      });
      
      // Atualiza badge para mostrar que há tarefa pendente
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff9800' });
      
      // Notifica o popup se estiver aberto
      chrome.runtime.sendMessage({
        type: 'taskPending',
        task: data.task
      }).catch(() => {
        // Ignora erro se popup não estiver aberto
      });
      
      // NÃO processa automaticamente!
      // O processamento só acontecerá quando o usuário clicar no botão no popup
      await logger.info('📋 Tarefa armazenada. Aguardando ação do usuário.');
    }
    
  } catch (error) {
    await logger.error('❌ Erro no polling', { error: error.message });
    await updateBadge(false);
  } finally {
    // Sempre reseta o estado de processamento
    if (isProcessingTask) {
      const processingTime = processingStartTime ? (Date.now() - processingStartTime) / 1000 : 0;
      await logger.info('✅ Finalizando processamento', {
        tempoTotal: processingTime + ' segundos',
        isProcessingTask: false
      });
    }
    isProcessingTask = false;
    processingStartTime = null;
  }
}

// ===========================================================================
// PROCESSAMENTO DE TAREFAS
// ===========================================================================
async function processTask(task) {
  await logger.info('========================================');
  await logger.info('🎯 PROCESSANDO TAREFA DO BACKEND');
  await logger.info(`📦 Tipo: ${task.type}`);
  await logger.info(`🔢 Quantidade: ${task.quantity || 1}`);
  await logger.info('========================================');
  
  // Timeout de segurança para a tarefa (10 minutos)
  const taskTimeout = setTimeout(async () => {
    await logger.error('⚠️ TIMEOUT: Tarefa demorou mais de 10 minutos para processar!', {
      taskId: task?.id,
      taskType: task?.type
    });
    // Força reset do estado
    isProcessingTask = false;
    processingStartTime = null;
  }, 10 * 60 * 1000);
  
  try {
  
  // Procura aba do OnlineOffice
  let tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  // Se não encontrar, tenta abrir automaticamente
  if (tabs.length === 0) {
    await logger.warn('📂 Nenhuma aba OnlineOffice encontrada. Abrindo automaticamente...');
    
    // Cria nova aba com o OnlineOffice
    const newTab = await chrome.tabs.create({
      url: OFFICE_URL,
      active: false // Abre em background
    });
    
    // Aguarda a aba carregar
    await logger.info('⏳ Aguardando aba carregar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Procura novamente
    tabs = await chrome.tabs.query({
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    });
    
    if (tabs.length === 0) {
      await logger.error('❌ ERRO: Não conseguiu abrir aba OnlineOffice!');
      await reportTaskResult({
        taskId: task.id,
        success: false,
        error: 'Não conseguiu abrir aba OnlineOffice'
      });
      return;
    }
  }
  
    const tabId = tabs[0].id;
    await logger.info(`✅ Aba encontrada`, { url: tabs[0].url });
    
    // Processa baseado no tipo de tarefa
    if (task.type === 'generate_batch') {
      await generateBatch(tabId, task);
    } else if (task.type === 'generate_single' || task.type === 'single_generation') {
      // Suporta ambos os tipos: 'generate_single' e 'single_generation'
      await logger.info('🎯 Task de geração única detectada', { 
        type: task.type,
        taskId: task.id
      });
      await generateSingle(tabId, task);
    } else if (task.type === 'renewal' || task.type === 'renew_system') {
      // Suporta ambos os tipos: 'renewal' (do backend) e 'renew_system' (legado)
      await logger.info('🔄 Task de renovação detectada', { 
        type: task.type,
        taskId: task.id,
        sistemaId: task.sistemaId || task.data?.sistemaId || task.metadata?.sistemaId || 'N/A',
        metadata: task.metadata,
        data: task.data
      });
      await renewSystem(tabId, task);
    } else {
      await logger.warn('⚠️ Tipo de task desconhecido', { type: task.type, task });
      // Reporta erro para task desconhecida
      await reportTaskResult({
        taskId: task?.id,
        success: false,
        error: `Tipo de task desconhecido: ${task.type}`
      });
    }
  } catch (error) {
    await logger.error('❌ Erro em processTask', { error: error.message, stack: error.stack });
    // Reporta erro ao backend
    await reportTaskResult({
      taskId: task?.id,
      success: false,
      error: error.message
    });
  } finally {
    // Limpa o timeout
    clearTimeout(taskTimeout);
    await logger.info('🎁 ProcessTask finalizado para task', { taskId: task?.id });
  }
}

async function generateBatch(tabId, task) {
  const quantity = task.quantity || 10;
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  await logger.info(`📦 Gerando lote de ${quantity} credenciais...`);
  
  for (let i = 0; i < quantity; i++) {
    await logger.info(`🎯 Gerando credencial ${i + 1}/${quantity}...`);
    
    try {
      // Envia comando para content script
      const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
      
      if (response && response.success && response.credentials) {
        successCount++;
        
        await logger.info(`✅ Sucesso! Credencial ${i + 1} gerada`, {
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
        await logger.error(`❌ Erro na credencial ${i + 1}`, { error: response?.error || 'Sem resposta' });
        
        results.push({
          success: false,
          error: response?.error || 'Erro desconhecido'
        });
      }
      
    } catch (error) {
      errorCount++;
      await logger.error(`❌ Erro ao gerar credencial ${i + 1}`, { error: error.message });
      
      results.push({
        success: false,
        error: error.message
      });
      
      // Se perdeu conexão com a aba, parar
      if (error.message.includes('Could not establish connection')) {
        await logger.error('🔌 Perdeu conexão com a aba. Parando lote...');
        break;
      }
    }
    
    // Aguarda entre gerações
    if (i < quantity - 1) {
      await logger.debug('⏳ Aguardando 5 segundos antes da próxima...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  await logger.info('========================================');
  await logger.info('📊 LOTE COMPLETO');
  await logger.info(`✅ Sucesso: ${successCount} credenciais`);
  await logger.info(`❌ Erros: ${errorCount}`);
  await logger.info('========================================');
  
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
    await logger.error('⚠️ Falha ao reportar resultado ao backend!');
  } else {
    await logger.info('✅ Resultado reportado ao backend com sucesso');
  }
}

async function generateSingle(tabId, task) {
  await logger.info('🎯 Gerando credencial única...', {
    taskId: task?.id,
    taskType: task?.type
  });
  
  try {
    // Timeout para a geração de credencial (30 segundos)
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, {action: 'generateOne'}),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Timeout ao gerar credencial')), 
        30000
      ))
    ]);
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Credencial gerada com sucesso!', {
        username: response.credentials.username,
        password: response.credentials.password
      });
      
      // Reporta sucesso ao backend - IMPORTANTE: Usar formato correto
      const reportSuccess = await reportTaskResult({
        taskId: task.id,
        type: task.type || 'generate_single', // Usa o tipo original da task
        credentials: {
          username: response.credentials.username,
          password: response.credentials.password
        }
      });
      
      if (!reportSuccess) {
        await logger.error('⚠️ Falha ao reportar credencial ao backend!');
      } else {
        await logger.info('✅ Credencial reportada ao backend com sucesso');
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
    await logger.error('❌ Erro ao gerar credencial', { error: error.message });
    
    // Reporta erro ao backend
    const reportSuccess = await reportTaskResult({
      taskId: task.id,
      type: task.type || 'generate_single', // Usa o tipo original da task
      error: error.message
    });
    
    if (!reportSuccess) {
      await logger.error('⚠️ Falha ao reportar erro ao backend!');
    }
  }
}

async function renewSystem(tabId, task) {
  await logger.info('🔄 Renovando sistema IPTV...', { taskData: task });
  
  // DEBUG: Log completo da task para análise
  await logger.info('📊 DEBUG - Task completa recebida:', {
    taskId: task.id,
    taskType: task.type,
    taskData: JSON.stringify(task.data),
    taskMetadata: JSON.stringify(task.metadata),
    directSistemaId: task.sistemaId
  });
  
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
  
  await logger.info('📋 Dados da renovação', {
    sistemaId: sistemaId || 'N/A',
    usuarioAtual: originalUsername,
    taskId: task.id,
    taskType: task.type
  });
  
  // Validação do sistemaId
  if (!sistemaId) {
    await logger.error('❌ ERRO CRÍTICO: sistemaId não encontrado na task', {
      task: JSON.stringify(task)
    });
  }
  
  try {
    // Parse data e metadata se forem strings
    let taskData = task.data;
    let metadata = task.metadata;
    
    if (typeof taskData === 'string') {
      try {
        taskData = JSON.parse(taskData);
      } catch (error) {
        await logger.warn('⚠️ Erro ao fazer parse do data', { error: error.message });
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        await logger.warn('⚠️ Erro ao fazer parse do metadata', { error: error.message });
      }
    }
    
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Nova credencial gerada para renovação!', {
        novoUsuario: response.credentials.username,
        novaSenha: response.credentials.password,
        sistemaId: sistemaId || 'desconhecido'
      });
      
      // Edição de sistema removida - não é função da extensão
      // A extensão apenas gera credenciais. A edição é feita no aplicativo.
      await logger.info('ℹ️ Edição automática desabilitada - credenciais geradas com sucesso', { 
        sistemaId,
        novoUsuario: response.credentials.username 
      });
      
      // NÃO tenta mais editar o sistema no OnlineOffice
      // As credenciais geradas são reportadas ao backend
      // e a edição será feita no aplicativo
      
      /*
      // Código de edição removido para evitar navegação para URLs inexistentes
      // como https://onlineoffice.zip/#/sistemas/21/edit
      */
      
      // Continua apenas com o reporte das credenciais
      const reportMetadata = {
        ...metadata,
        sistemaId: sistemaId,
        originalUsername: originalUsername,
        renewedAt: new Date().toISOString()
      };
      
      // Reporta sucesso apenas com as credenciais geradas
      await logger.info('✅ Credenciais de renovação geradas com sucesso!', { 
        sistemaId,
        novoUsuario: response.credentials.username,
        novaSenha: response.credentials.password
      });
      
      // Reporta sucesso ao backend com sistemaId garantido
      const reportSuccess = await reportTaskResult({
        taskId: task.id,
        type: task.type || 'renewal', // Usar o tipo original da task
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
          renewedAt: new Date().toISOString(),
          systemEdited: false // Sistema não é editado pela extensão
        }
      });
      
      if (!reportSuccess) {
        await logger.error('⚠️ Falha ao reportar renovação ao backend!', { sistemaId });
      } else {
        await logger.info('✅ Renovação completa reportada ao backend com sucesso', { 
          sistemaId,
          username: response.credentials.username,
          edited: true
        });
      }
      
    } else {
      throw new Error(response?.error || 'Erro desconhecido ao renovar');
    }
    
  } catch (error) {
    await logger.error('❌ Erro ao renovar sistema', { error: error.message, sistemaId });
    
    // Parse data e metadata se forem strings
    let taskData = task.data;
    let metadata = task.metadata;
    
    if (typeof taskData === 'string') {
      try {
        taskData = JSON.parse(taskData);
      } catch (error) {
        // Ignora erro de parse
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
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
      await logger.error('⚠️ Falha ao reportar erro de renovação ao backend!');
    }
  }
}

// ===========================================================================
// COMUNICAÇÃO COM BACKEND
// ===========================================================================
async function reportTaskResult(result) {
  // Garante que API_BASE está definido
  if (!API_BASE) {
    API_BASE = await getApiBase();
    await logger.info(`🔗 Servidor API re-configurado: ${API_BASE}`);
  }
  
  await logger.info('📤 Reportando resultado ao backend', { 
    result,
    server: API_BASE
  });
  
  try {
    // Usa o endpoint correto task-complete com timestamp único para evitar cache
    const response = await fetch(`${API_BASE}/api/office/automation/task-complete?ts=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'tvon-extension-2024',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify(result)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      await logger.error('❌ Erro ao reportar resultado', { 
        status: response.status,
        response: errorText 
      });
      return false;
    } else {
      const data = await response.json();
      await logger.info('✅ Resultado reportado com sucesso', { response: data });
      return true;
    }
    
  } catch (error) {
    await logger.error('❌ Erro ao reportar resultado', { error: error.message });
    return false;
  }
}

// ===========================================================================
// ATUALIZAÇÃO DE BADGE
// ===========================================================================
async function updateBadge(isEnabled) {
  const newBadge = isEnabled ? 'ON' : '';
  
  // Só atualiza se mudou
  if (lastStatus.badge !== newBadge) {
    if (isEnabled) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
      await logger.debug('🟢 Badge: ON');
    } else {
      chrome.action.setBadgeText({ text: '' });
      await logger.debug('⚫ Badge: OFF');
    }
    
    lastStatus.badge = newBadge;
    lastStatus.isEnabled = isEnabled;
  }
}

// ===========================================================================
// LISTENER DE MENSAGENS DO POPUP E COMUNICAÇÃO COM BACKEND
// ===========================================================================
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await logger.debug('📨 Mensagem recebida', { type: request.type, from: sender.tab ? 'tab' : 'popup' });
  
  // Mensagens de gerenciamento de logs
  if (request.type === 'getLogs') {
    const filters = request.filters || {};
    let logs = await logger.getLogs();
    
    // Aplicar filtros
    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }
    if (filters.searchText) {
      logs = await logger.searchLogs(filters.searchText);
    }
    if (filters.limit) {
      logs = logs.slice(-filters.limit);
    }
    
    sendResponse({
      success: true,
      logs: logs,
      formatted: await logger.formatLogs(logs)
    });
    return true;
  }
  
  if (request.type === 'clearLogs') {
    await logger.clearLogs();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'exportLogs') {
    const exportText = await logger.exportAsText();
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
        : 'Automação parada',
      hasPendingTask: pendingTask !== null,
      pendingTask: pendingTask
    });
    return true;
  }
  
  if (request.type === 'processPendingTask') {
    // Processa tarefa pendente manualmente quando solicitado pelo usuário
    if (pendingTask) {
      (async () => {
        await logger.info('👤 Usuário solicitou processamento manual da tarefa pendente', {
          taskId: pendingTask?.id,
          taskType: pendingTask?.type
        });
        
        // Marca como processando
        isProcessingTask = true;
        processingStartTime = Date.now();
        
        try {
          // Garante que temos a aba do OnlineOffice aberta
          await ensureOfficeTabOpen(true);
          
          // Processa a tarefa
          await processTask(pendingTask);
          
          // Limpa tarefa pendente após processar
          pendingTask = null;
          
          // Restaura badge normal
          await updateBadge(lastStatus.isEnabled);
          
          sendResponse({ success: true, message: 'Tarefa processada com sucesso' });
        } catch (error) {
          await logger.error('❌ Erro ao processar tarefa manual', { error: error.message });
          sendResponse({ success: false, error: error.message });
        } finally {
          isProcessingTask = false;
          processingStartTime = null;
        }
      })();
      return true; // Indica resposta assíncrona
    } else {
      sendResponse({ success: false, error: 'Nenhuma tarefa pendente' });
    }
    return true;
  }
  
  if (request.type === 'openDashboard') {
    // Abre o painel de controle
    const dashboardUrl = API_BASE || 'http://localhost:5000';
    chrome.tabs.create({ 
      url: `${dashboardUrl}/painel-office` 
    });
    sendResponse({success: true});
    return true;
  }
  
  if (request.type === 'getCurrentServer') {
    // Retorna o servidor atual
    sendResponse({ server: API_BASE });
    return true;
  }
  
  if (request.type === 'serverUpdated') {
    // Atualiza o servidor quando alterado no popup
    (async () => {
      API_BASE = request.server;
      await logger.info(`🔄 Servidor atualizado via popup: ${API_BASE}`);
      // Força nova checagem com o novo servidor
      await checkForTasks();
    })();
    sendResponse({success: true});
    return true;
  }
  
  if (request.type === 'autoDetectServer') {
    // Re-detecta o servidor
    (async () => {
      await logger.info('🔍 Re-detectando servidor...');
      API_BASE = await getApiBase();
      await logger.info(`✅ Servidor detectado: ${API_BASE}`);
      sendResponse({ server: API_BASE });
    })();
    return true; // Indica resposta assíncrona
  }
  
  // Outras mensagens são ignoradas pois tudo é controlado pelo backend
  await logger.debug('⚠️ Mensagem ignorada - controle via backend');
  sendResponse({
    success: false,
    message: 'Use o painel de controle web para gerenciar a automação'
  });
  return true;
});

// Log de carregamento inicial
(async () => {
  await logger.info('✅ Background script carregado e polling iniciado');
})();