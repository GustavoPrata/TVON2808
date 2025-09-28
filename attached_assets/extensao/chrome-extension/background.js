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
// Sistema de comunicação direta com API
const API_ENDPOINTS = {
  HEALTH: '/api/health',
  NEXT_TASK: '/api/office/automation/next-task',
  TASK_COMPLETE: '/api/office/automation/task-complete',
  GENERATE_BATCH: '/api/office/automation/generate-batch',
  GENERATE_SINGLE: '/api/office/automation/generate-single',
  RENEW_SYSTEM: '/api/office/automation/renew-system'
};

// Função para comunicação direta com API
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Extension-Key': 'chrome-extension-secret-2024',
    'Accept': 'application/json'
  };

  try {
    await logger.debug(`🔄 Fazendo requisição para ${BACKEND_URL}${endpoint}`);
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
          signal: AbortSignal.timeout(15000), // 15 segundos timeout
          mode: 'cors',
          credentials: 'include'
        });

        // Log detalhado da resposta
        await logger.debug(`📥 Resposta recebida:`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            data,
            server: baseUrl
          };
        } else {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        await logger.error(`❌ Erro na requisição para ${baseUrl}:`, { 
          error: error.message,
          attempt: attempts + 1
        });

        // Verifica se é um erro que merece retry
        const shouldRetry = retryableErrors.some(e => error.message.includes(e));
        
        if (shouldRetry && attempts < maxAttempts - 1) {
          attempts++;
          // Espera exponencial entre tentativas
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
          continue;
        }

        // Se chegou aqui, ou não é retryable ou acabaram as tentativas
        if (attempts === maxAttempts - 1) {
          await logger.error('❌ Todas as tentativas falharam para este servidor');
          break; // Tenta próximo servidor
        }
      }
    }
  }
  
  throw new Error('Nenhum servidor disponível');
}

// Função para determinar a URL do servidor dinamicamente
async function getApiBase() {
  try {
    await logger.info(`🔗 Usando servidor configurado: ${BACKEND_URL}`);
    return BACKEND_URL;
  } catch (e) {
    await logger.error('❌ Erro ao retornar URL do servidor:', { error: e.message });
    throw e;
  }
}

// Variável global para armazenar a URL do API
let API_BASE = null;
const POLLING_INTERVAL_ACTIVE = 3000; // 3 segundos quando não há tarefas
const POLLING_INTERVAL_IDLE = 5000; // 5 segundos quando automação está desabilitada
const POLLING_INTERVAL_FAST = 1000; // 1 segundo após processar tarefa

// URLs importantes
const OFFICE_URL = 'https://onlineoffice.zip/iptv/index.php';
const BACKEND_URL = 'https://aef8336d-fdf6-4f45-8827-b87d99023c0e-00-3bbspqbjbb2rl.worf.replit.dev';

// Configurações de rede
const NETWORK_CONFIG = {
  timeouts: {
    request: 15000,    // 15 segundos para requisições
    retry: 5000,       // 5 segundos entre retries
    connection: 30000  // 30 segundos para verificar conexão
  },
  retry: {
    maxAttempts: 3,
    backoffMultiplier: 2
  },
  headers: {
    'Content-Type': 'application/json',
    'X-Extension-Key': 'chrome-extension-secret-2024',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  }
};

// Configuração de reconexão
const RECONNECT_CONFIG = {
  maxRetries: 5,
  retryDelay: 2000,
  backoffMultiplier: 1.5
};

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
// Inicialização assíncrona do logger e API com verificação de compatibilidade
(async () => {
  try {
    await logger.info('🚀 Background script iniciando...');
    
    // Verifica compatibilidade primeiro
    const isCompatible = await checkCompatibility();
    await logger.info('🔍 Verificação de compatibilidade:', {
      chromeVersion: API_STATUS.chromeVersion,
      platform: await getPlatformInfo(),
      isCompatible,
      fallbackMode: COMPATIBILITY_CONFIG.fallbackMode
    });
    
    // Se não for compatível, tenta modo de compatibilidade
    if (!isCompatible) {
      await logger.warn('⚠️ Modo de compatibilidade ativado');
      COMPATIBILITY_CONFIG.fallbackMode = true;
      
      // Notifica o usuário
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Modo de Compatibilidade',
        message: 'A extensão está rodando em modo de compatibilidade. Algumas funcionalidades podem ser limitadas.',
        priority: 1
      });
    }
    
    // Inicializa API_BASE dinamicamente
    API_BASE = await getApiBase();
    await logger.info(`🔗 Servidor API configurado: ${API_BASE}`);
    
    // Inicializa verificação contínua de conexão
    startConnectionCheck();
    
    // Inicia o processo de auto-recuperação
    startAutoRecovery();
    
    // Configura listeners específicos para o modo de compatibilidade
    if (COMPATIBILITY_CONFIG.fallbackMode) {
      setupCompatibilityListeners();
    }
    
    await logger.info('✅ Inicialização completa', {
      mode: COMPATIBILITY_CONFIG.fallbackMode ? 'compatibility' : 'normal',
      features: COMPATIBILITY_CONFIG.features
    });
    
  } catch (error) {
    await logger.error('❌ Erro na inicialização:', { error: error.message });
    
    // Tenta reiniciar em modo de compatibilidade
    COMPATIBILITY_CONFIG.fallbackMode = true;
    COMPATIBILITY_CONFIG.usePolyfills = true;
    
    // Reinicia a extensão em 5 segundos
    setTimeout(() => chrome.runtime.reload(), 5000);
  }
})();

// Configura listeners específicos para modo de compatibilidade
function setupCompatibilityListeners() {
  // Intercepta erros não tratados
  window.onerror = async function(msg, url, line, col, error) {
    await logger.error('Erro não tratado:', {
      message: msg,
      location: `${url}:${line}:${col}`,
      error: error?.stack || 'No stack'
    });
    return false;
  };
  
  // Intercepta rejeições de Promise não tratadas
  window.onunhandledrejection = async function(event) {
    await logger.error('Promise rejeitada não tratada:', {
      reason: event.reason?.message || event.reason
    });
  };
  
  // Monitor de memória
  if (chrome.system && chrome.system.memory) {
    setInterval(async () => {
      try {
        const info = await chrome.system.memory.getInfo();
        if (info.availableCapacity < 100 * 1024 * 1024) { // menos de 100MB
          await logger.warn('⚠️ Pouca memória disponível:', {
            available: Math.round(info.availableCapacity / (1024 * 1024)) + 'MB'
          });
        }
      } catch (e) {
        // Ignora erro se API não estiver disponível
      }
    }, 60000);
  }
}

// Função para verificar e manter conexão
async function startConnectionCheck() {
  setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ping`, {
        method: 'HEAD',
        mode: 'cors'
      });
      
      if (!response.ok) {
        await logger.warn('⚠️ Conexão instável com servidor');
        await reconnectServer();
      }
    } catch (e) {
      await logger.error('❌ Erro de conexão', { error: e.message });
      await reconnectServer();
    }
  }, 5000); // Verifica a cada 5 segundos
}

// Função para reconexão automática
async function reconnectServer() {
  await logger.info('🔄 Verificando conexão...');
  
  try {
    const isConnected = await ensureBackendConnection();
    
    if (isConnected) {
      await logger.info('✅ Conexão estabelecida!');
      await ensureOfficeTabOpen(true);
      return true;
    } else {
      await logger.error('❌ Não foi possível estabelecer conexão');
      return false;
    }
  } catch (e) {
    await logger.error(`❌ Erro ao tentar reconectar: ${e.message}`);
    return false;
  }
}

// Sistema de auto-recuperação
async function startAutoRecovery() {
  setInterval(async () => {
    const tabs = await chrome.tabs.query({});
    let hasOfficeTab = false;
    
    for (const tab of tabs) {
      if (tab.url && (
        tab.url.includes('onlineoffice.zip') ||
        tab.url.includes('tv-on.site')
      )) {
        hasOfficeTab = true;
        // Recarrega a aba periodicamente para evitar sessão expirada
        chrome.tabs.reload(tab.id);
        await logger.info('🔄 Aba do OnlineOffice recarregada');
      }
    }
    
    if (!hasOfficeTab) {
      await logger.warn('⚠️ Aba do OnlineOffice não encontrada');
      await ensureOfficeTabOpen(true);
    }
  }, 300000); // Verifica a cada 5 minutos
}

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
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
  await ensureOfficeTabOpen(); // Garante que a aba está aberta
});

// Inicia quando instalado/atualizado
chrome.runtime.onInstalled.addListener(async () => {
  await logger.info('🔧 Extensão instalada/atualizada, configurando automação...');
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
});

// Sistema de auto-inicialização e recuperação
async function startAutomation() {
  try {
    // Força automação estar sempre ativa
    LOCAL_CONFIG.automation.enabled = true;
    lastStatus.isEnabled = true;
    
    // Configura alarmes
    await setupAlarms();
    
    // Inicia verificação de tarefas
    await checkForTasks();
    
    // Configura auto-restart periódico para garantir funcionamento
    TASK_CACHE.autoRestartTimer = setInterval(async () => {
      await logger.info('🔄 Auto-restart periódico...');
      
      // Força status ativo
      lastStatus.isEnabled = true;
      
      // Reinicia verificações
      await checkForTasks();
      
      // Força reconexão com backend
      await ensureBackendConnection();
      
    }, 300000); // A cada 5 minutos
    
    await logger.info('✅ Automação iniciada em modo independente');
    
  } catch (error) {
    await logger.error('❌ Erro ao iniciar automação:', { error: error.message });
    
    // Tenta reiniciar em 30 segundos
    setTimeout(startAutomation, 30000);
  }
}

// Inicia automação
startAutomation();

// Função para garantir que a aba do OnlineOffice está aberta
async function ensureOfficeTabOpen(forceOpen = false) {
  try {
    // Sempre mantém uma aba aberta, independente do status
    const tabs = await chrome.tabs.query({
      url: [
        '*://onlineoffice.zip/*', 
        '*://*.onlineoffice.zip/*',
        '*://tv-on.site/*',
        '*://*.tv-on.site/*'
      ]
    }).catch(e => {
      logger.error('❌ Erro ao consultar abas:', { error: e.message });
      return [];
    });
    
    if (tabs.length === 0) {
      await logger.info('📂 Abrindo aba do OnlineOffice automaticamente...');
      
      try {
        // Verifica se já tem muitas abas abertas
        const allTabs = await chrome.tabs.query({});
        if (allTabs.length > 50) {
          await logger.warn('⚠️ Muitas abas abertas, fechando algumas...');
          // Fecha abas antigas do OnlineOffice
          for (const tab of allTabs) {
            if (tab.url && (
              tab.url.includes('onlineoffice.zip') ||
              tab.url.includes('tv-on.site')
            )) {
              await chrome.tabs.remove(tab.id).catch(() => {});
            }
          }
        }
        
        // Tenta abrir nova aba com retry
        let newTab = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            newTab = await chrome.tabs.create({ 
              url: OFFICE_URL,
              active: false
            });
            break;
          } catch (e) {
            await logger.warn(`❌ Tentativa ${attempt + 1} falhou:`, { error: e.message });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (!newTab) {
          throw new Error('Não foi possível criar nova aba após 3 tentativas');
        }
        
        // Sistema de monitoramento da aba
        const tabMonitor = {
          id: newTab.id,
          lastCheck: Date.now(),
          errors: 0,
          status: 'loading'
        };
        
        // Configura listener para reabrir se a aba for fechada
        const tabRemovedListener = async (tabId) => {
          if (tabId === tabMonitor.id) {
            await logger.warn('⚠️ Aba do OnlineOffice foi fechada, reabrindo...');
            chrome.tabs.onRemoved.removeListener(tabRemovedListener);
            chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
            setTimeout(() => ensureOfficeTabOpen(true), 1000);
          }
        };
        
        // Configura listener para erros de carregamento
        const tabUpdatedListener = async (tabId, changeInfo) => {
          if (tabId === tabMonitor.id) {
            if (changeInfo.status === 'complete') {
              try {
                const tab = await chrome.tabs.get(tabId);
                
                // Verifica erros de carregamento
                if (tab.url.includes('chrome-error')) {
                  tabMonitor.errors++;
                  await logger.error(`❌ Erro ao carregar página (${tabMonitor.errors})`);
                  
                  if (tabMonitor.errors >= 3) {
                    // Remove listeners e tenta abrir nova aba
                    chrome.tabs.onRemoved.removeListener(tabRemovedListener);
                    chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
                    await chrome.tabs.remove(tabId).catch(() => {});
                    setTimeout(() => ensureOfficeTabOpen(true), 5000);
                  } else {
                    // Tenta recarregar
                    chrome.tabs.reload(tabId);
                  }
                } else {
                  tabMonitor.status = 'loaded';
                  tabMonitor.errors = 0;
                  await logger.info('✅ Aba carregada com sucesso');
                }
              } catch (e) {
                await logger.error('❌ Erro ao verificar aba:', { error: e.message });
              }
            }
          }
        };
        
        chrome.tabs.onRemoved.addListener(tabRemovedListener);
        chrome.tabs.onUpdated.addListener(tabUpdatedListener);
        
        // Inicia monitoramento periódico
        const checkInterval = setInterval(async () => {
          try {
            // Verifica se a aba ainda existe
            const tab = await chrome.tabs.get(tabMonitor.id).catch(() => null);
            if (!tab) {
              clearInterval(checkInterval);
              return;
            }
            
            // Verifica responsividade
            const now = Date.now();
            if (now - tabMonitor.lastCheck > 30000) { // 30 segundos
              await logger.warn('⚠️ Aba sem resposta por muito tempo');
              chrome.tabs.reload(tabMonitor.id);
            }
            
            // Tenta enviar ping
            await chrome.tabs.sendMessage(tabMonitor.id, { action: 'ping' })
              .catch(() => {
                tabMonitor.errors++;
                if (tabMonitor.errors >= 3) {
                  chrome.tabs.reload(tabMonitor.id);
                }
              });
            
            tabMonitor.lastCheck = now;
            tabMonitor.errors = 0;
            
          } catch (e) {
            await logger.error('❌ Erro no monitoramento:', { error: e.message });
          }
        }, 10000); // Checa a cada 10 segundos
        
      } catch (e) {
        await logger.error('❌ Erro ao abrir aba:', { error: e.message });
        // Tenta novamente em 30 segundos
        setTimeout(() => ensureOfficeTabOpen(true), 30000);
      }
    } else {
      // Verifica se a aba existente está respondendo
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'ping',
          timeout: 5000
        });
      } catch (e) {
        await logger.warn('⚠️ Aba não está respondendo, recarregando...');
        // Tenta recarregar com retry
        for (let i = 0; i < 3; i++) {
          try {
            await chrome.tabs.reload(tabs[0].id);
            break;
          } catch (reloadError) {
            await logger.error(`❌ Erro ao recarregar (tentativa ${i + 1}):`, { error: reloadError.message });
            if (i === 2) { // Na última tentativa
              // Remove aba problemática e abre nova
              await chrome.tabs.remove(tabs[0].id).catch(() => {});
              setTimeout(() => ensureOfficeTabOpen(true), 5000);
            }
          }
        }
      }
    }
  } catch (error) {
    await logger.error('❌ Erro crítico em ensureOfficeTabOpen:', { error: error.message });
    // Força reinício da extensão em caso de erro crítico
    if (COMPATIBILITY_CONFIG.fallbackMode) {
      chrome.runtime.reload();
    } else {
      COMPATIBILITY_CONFIG.fallbackMode = true;
      setTimeout(() => ensureOfficeTabOpen(true), 10000);
    }
  }
}

// ===========================================================================
// PROCESSAMENTO DIRETO VIA API E CACHE LOCAL
// ===========================================================================
// Cache para armazenar estado e evitar dependência do painel
const TASK_CACHE = {
  pendingTasks: [],
  lastCheck: 0,
  processingResults: new Map(),
  autoRestartTimer: null
};

// Função para simular verificação de tarefas sem painel
async function checkTasksLocally() {
  const now = Date.now();
  
  // Atualiza cache se necessário
  if (now - TASK_CACHE.lastCheck > 5000) {
    try {
      const response = await fetch(`${API_BASE}/api/office/automation/pending-tasks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Key': LOCAL_CONFIG.credentials.apiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        TASK_CACHE.pendingTasks = data.tasks || [];
        TASK_CACHE.lastCheck = now;
      }
    } catch (e) {
      await logger.warn('⚠️ Erro ao atualizar cache local:', { error: e.message });
    }
  }
  
  // Retorna próxima tarefa do cache
  return TASK_CACHE.pendingTasks.shift();
}

async function processTaskViaApi(task) {
  await logger.info('🔄 Tentando processar tarefa diretamente via API');
  
  // Força automação continuar
  lastStatus.isEnabled = true;
  
  try {
    // Sistema de retry para processar via API
    let lastError = null;
    for (let attempt = 0; attempt < RECONNECT_CONFIG.maxRetries; attempt++) {
      try {
        // Verifica conexão primeiro
        if (!await ensureBackendConnection()) {
          throw new Error('Sem conexão com backend');
        }
        
        // Endpoint específico para cada tipo de tarefa
        let endpoint = '';
        let payload = {};
    
    switch (task.type) {
      case 'generate_batch':
        endpoint = '/api/office/automation/generate-batch';
        payload = {
          quantity: task.quantity || 10,
          taskId: task.id,
          metadata: task.metadata
        };
        break;
        
      case 'generate_single':
        endpoint = '/api/office/automation/generate-single';
        payload = {
          taskId: task.id,
          metadata: task.metadata
        };
        break;
        
      case 'renewal':
      case 'renew_system':
        endpoint = '/api/office/automation/renew-system';
        payload = {
          taskId: task.id,
          sistemaId: task.sistemaId || task.data?.sistemaId || task.metadata?.sistemaId,
          originalUsername: task.data?.originalUsername || task.metadata?.originalUsername,
          metadata: task.metadata
        };
        break;
        
      default:
        throw new Error(`Tipo de tarefa não suportado via API: ${task.type}`);
    }
    
    // Faz a requisição
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API respondeu com status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      await logger.info('✅ Tarefa processada com sucesso via API', { 
        type: task.type,
        taskId: task.id
      });
      
      // Reporta o resultado
      await reportTaskResult({
        taskId: task.id,
        success: true,
        result: result.data,
        processedVia: 'api',
        type: task.type,
        metadata: {
          ...task.metadata,
          processedAt: new Date().toISOString(),
          processMethod: 'direct-api'
        }
      });
      
      return { success: true, data: result.data };
    } else {
      throw new Error(result.error || 'API retornou erro');
    }
  } catch (error) {
    await logger.warn('⚠️ Falha no processamento via API', { 
      error: error.message,
      type: task.type,
      taskId: task.id
    });
    throw error; // Re-throw para tentar via interface
  }
}

async function continueTaskProcessing(task, tabId) {
  try {
    // Tenta autenticar primeiro
    await ensureAuthenticated(tabId);
    
    // Processa baseado no tipo
    if (task.type === 'generate_batch') {
      return await generateBatch(tabId, task);
    } else if (task.type === 'generate_single') {
      return await generateSingle(tabId, task);
    } else if (task.type === 'renewal' || task.type === 'renew_system') {
      return await renewSystem(tabId, task);
    } else {
      throw new Error(`Tipo de tarefa desconhecido: ${task.type}`);
    }
  } catch (error) {
    await logger.error('❌ Erro no processamento da tarefa', { error: error.message });
    throw error;
  }
}

async function ensureAuthenticated(tabId) {
  try {
    // Verifica se está logado
    const authStatus = await chrome.tabs.sendMessage(tabId, { action: 'checkAuth' });
    
    if (!authStatus || !authStatus.authenticated) {
      await logger.warn('⚠️ Não autenticado, tentando login...');
      
      // Tenta login automático
      const loginResult = await chrome.tabs.sendMessage(tabId, { 
        action: 'autoLogin',
        credentials: {
          username: 'seu_usuario', // Substitua pelos valores corretos
          password: 'sua_senha'    // Substitua pelos valores corretos
        }
      });
      
      if (!loginResult || !loginResult.success) {
        throw new Error('Falha na autenticação automática');
      }
      
      await logger.info('✅ Login realizado com sucesso');
    }
  } catch (error) {
    await logger.error('❌ Erro na verificação/autenticação', { error: error.message });
    throw error;
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
  try {
    // Sistema sempre ativo
    lastStatus.isEnabled = true;
    
    // Se já está processando, aguarda
    if (isProcessingTask) {
      await logger.debug('⏳ Processamento em andamento...');
      return;
    }
    
    // Busca tarefas diretamente da API
    try {
      const result = await makeApiRequest(API_ENDPOINTS.NEXT_TASK);
      
      if (result.success && result.data.task) {
        isProcessingTask = true;
        
        try {
          // Processa direto via API
          const processResult = await processTaskViaApi(result.data.task);
          
          if (processResult.success) {
            await logger.info('✅ Tarefa processada com sucesso via API');
          }
        } finally {
          isProcessingTask = false;
        }
      }
    } catch (error) {
      await logger.error('❌ Erro ao buscar/processar tarefa:', { error: error.message });
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
    // Log detalhado da URL sendo usada
    const fullUrl = `${API_BASE}/api/office/automation/next-task`;
    await logger.info(`🔍 Buscando tarefas em: ${fullUrl}`);
    
    // Consulta próxima tarefa no backend
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      }
    }).catch(async err => {
      await logger.error('❌ Erro na requisição:', { error: err.message });
      return null;
    });
    
    if (!response) {
      await updateBadge(false);
      return;
    }
    
    if (!response.ok) {
      await logger.error('❌ Erro ao consultar backend', { status: response.status });
      await updateBadge(false);
      return;
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
    
    // Se há task, SEMPRE abre a aba OnlineOffice
    if (data.hasTask) {
      await logger.info('✅ TASK ENCONTRADA! Abrindo aba OnlineOffice...');
      await ensureOfficeTabOpen(true); // força abertura quando há task
    }
    
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
    
    // Se não há tarefa, continua polling
    if (!data.hasTask) {
      await logger.debug(`⏰ Sem tarefas. Próxima checagem em ${currentPollingInterval / 1000}s`);
      return;
    }
    
    await logger.info('📋 Nova tarefa recebida do backend', { 
      task: data.task,
      taskId: data.task?.id,
      taskType: data.task?.type 
    });
    
    // Marca como processando
    isProcessingTask = true;
    
    // Processa a tarefa
    await processTask(data.task);
    
    // Após processar, fazer polling mais rápido temporariamente
    await logger.info('⚡ Tarefa processada, fazendo polling rápido temporário (10s)...');
    currentPollingInterval = POLLING_INTERVAL_FAST;
    await updatePollingInterval(0.17); // ~10 segundos
    setTimeout(async () => {
      if (lastStatus.isEnabled) {
        await logger.info('⏰ Voltando ao polling normal (30s)...');
        currentPollingInterval = POLLING_INTERVAL_ACTIVE;
        await updatePollingInterval(0.5); // 30 segundos
      }
    }, 60000); // Volta ao normal após 1 minuto
    
  } catch (error) {
    await logger.error('❌ Erro no polling', { error: error.message });
    await updateBadge(false);
  } finally {
    isProcessingTask = false;
  }
}

// ===========================================================================
// CONFIGURAÇÃO DO BACKEND E COMPATIBILIDADE
// ===========================================================================
// Credenciais e configurações armazenadas localmente
const LOCAL_CONFIG = {
  credentials: {
    apiKey: 'chrome-extension-secret-2024',
    defaultUsername: 'admin', // será substituído pela configuração real
    defaultPassword: 'admin'  // será substituído pela configuração real
  },
  automation: {
    enabled: true,
    shouldRunWithoutPanel: true, // IMPORTANTE: permite rodar sem painel
    autoReconnect: true,
    maxRetries: 5
  }
};

// Configuração de compatibilidade
const COMPATIBILITY_CONFIG = {
  usePolyfills: true,
  fallbackMode: false,
  debug: true,
  retryOnError: true,
  timeoutMS: 30000,
  features: {
    serviceWorker: true,
    fetchAPI: true,
    promiseAPI: true
  }
};

let currentBackendIndex = 0;
let API_STATUS = {
  lastCheck: 0,
  isHealthy: false,
  reconnectAttempts: 0,
  chromeVersion: getChromeVersion(),
  platform: getPlatformInfo(),
  lastError: null
};

// Detecta versão do Chrome
function getChromeVersion() {
  const raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  return raw ? parseInt(raw[2]) : null;
}

// Detecta informações da plataforma
async function getPlatformInfo() {
  try {
    return await chrome.runtime.getPlatformInfo();
  } catch (e) {
    return { os: 'unknown', arch: 'unknown' };
  }
}

// Função para verificar compatibilidade
async function checkCompatibility() {
  try {
    // Verifica recursos essenciais
    if (!window.fetch) {
      COMPATIBILITY_CONFIG.fallbackMode = true;
      COMPATIBILITY_CONFIG.features.fetchAPI = false;
    }
    
    if (!window.Promise) {
      COMPATIBILITY_CONFIG.fallbackMode = true;
      COMPATIBILITY_CONFIG.features.promiseAPI = false;
    }
    
    // Verifica suporte a Service Worker
    if (!('serviceWorker' in navigator)) {
      COMPATIBILITY_CONFIG.features.serviceWorker = false;
    }
    
    // Atualiza status
    await chrome.storage.local.set({
      compatibilityStatus: {
        version: API_STATUS.chromeVersion,
        platform: await getPlatformInfo(),
        features: COMPATIBILITY_CONFIG.features,
        fallbackMode: COMPATIBILITY_CONFIG.fallbackMode
      }
    });
    
    return !COMPATIBILITY_CONFIG.fallbackMode;
  } catch (e) {
    console.error('Erro ao verificar compatibilidade:', e);
    return false;
  }
}

// Função para verificar conexão com backend
async function ensureBackendConnection() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'X-Extension-Key': 'chrome-extension-secret-2024'
      },
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      API_STATUS.isHealthy = true;
      API_STATUS.reconnectAttempts = 0;
      return true;
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (e) {
    await logger.warn(`❌ Backend não disponível: ${e.message}`);
    API_STATUS.isHealthy = false;
    return false;
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
  
  try {
    // Tenta processar diretamente via API primeiro
    const directProcessResult = await processTaskViaApi(task);
    if (directProcessResult.success) {
      await logger.info('✅ Tarefa processada diretamente via API');
      return;
    }
  } catch (error) {
    await logger.warn('⚠️ Não foi possível processar via API, tentando via interface...', { error: error.message });
  }
  
  // Se não conseguir via API, tenta via interface
  let maxRetries = 3;
  let currentTry = 0;
  
  while (currentTry < maxRetries) {
    currentTry++;
    await logger.info(`� Tentativa ${currentTry}/${maxRetries} de processar via interface`);
    
    try {
      // Procura ou cria aba do OnlineOffice
      let tabs = await chrome.tabs.query({
        url: [
          '*://onlineoffice.zip/*', 
          '*://*.onlineoffice.zip/*',
          '*://tv-on.site/*',
          '*://*.tv-on.site/*'
        ]
      });
      
      if (tabs.length === 0) {
        await logger.info('📂 Criando nova aba OnlineOffice...');
        const newTab = await chrome.tabs.create({
          url: OFFICE_URL,
          active: false
        });
        
        // Aguarda e verifica se carregou
        await logger.info('⏳ Aguardando carregamento...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Verifica se carregou corretamente
        const tab = await chrome.tabs.get(newTab.id);
        if (tab.status !== 'complete' || tab.url.includes('chrome-error')) {
          throw new Error('Falha no carregamento da página');
        }
        
        tabs = [tab];
      }
      
      // Tenta interagir com a página
      const response = await chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'ping',
        timeout: 5000 
      });
      
      if (response && response.success) {
        await logger.info('✅ Página respondeu, processando tarefa...');
        return await continueTaskProcessing(task, tabs[0].id);
      }
      
      throw new Error('Página não respondeu ao ping');
      
    } catch (error) {
      await logger.error(`❌ Erro na tentativa ${currentTry}`, { error: error.message });
      
      if (currentTry === maxRetries) {
        // Se falhou todas as tentativas, reporta erro
        await reportTaskResult({
          taskId: task.id,
          success: false,
          error: `Falha após ${maxRetries} tentativas: ${error.message}`,
          metadata: {
            attempts: currentTry,
            lastError: error.message,
            failedAt: new Date().toISOString()
          }
        });
        return;
      }
      
      // Aguarda antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 5000 * currentTry));
    }
  }
}
  
  const tabId = tabs[0].id;
  await logger.info(`✅ Aba encontrada`, { url: tabs[0].url });
  
  // Processa baseado no tipo de tarefa
  if (task.type === 'generate_batch') {
    await generateBatch(tabId, task);
  } else if (task.type === 'generate_single') {
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
  await logger.info('🎯 Gerando credencial única...');
  
  try {
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Credencial gerada com sucesso!', {
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
      type: 'generate_single',
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
      } catch (e) {
        await logger.warn('⚠️ Erro ao fazer parse do data', { error: e.message });
      }
    }
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        await logger.warn('⚠️ Erro ao fazer parse do metadata', { error: e.message });
      }
    }
    
    const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Nova credencial gerada para renovação!', {
        novoUsuario: response.credentials.username,
        novaSenha: response.credentials.password,
        sistemaId: sistemaId || 'desconhecido'
      });
      
      // NOVO: Editar o sistema no OnlineOffice com as novas credenciais
      await logger.info('📝 Iniciando edição do sistema no OnlineOffice...', { sistemaId });
      
      try {
        // Envia comando para editar o sistema
        const editResponse = await chrome.tabs.sendMessage(tabId, {
          action: 'editSystem',
          sistemaId: sistemaId,
          username: response.credentials.username,
          password: response.credentials.password
        });
        
        if (!editResponse || !editResponse.success) {
          // Se falhou ao editar, lança erro
          const errorMsg = editResponse?.error || 'Falha desconhecida ao editar sistema';
          await logger.error('❌ Falha ao editar sistema no OnlineOffice', { 
            sistemaId, 
            error: errorMsg,
            response: editResponse 
          });
          throw new Error(`Falha ao editar sistema: ${errorMsg}`);
        }
        
        await logger.info('✅ Sistema editado com sucesso no OnlineOffice!', {
          sistemaId,
          username: response.credentials.username
        });
        
      } catch (editError) {
        // Se falhou ao editar, reporta erro e não continua
        await logger.error('❌ Erro crítico ao editar sistema', { 
          sistemaId,
          error: editError.message
        });
        
        // Reporta falha ao backend
        await reportTaskResult({
          taskId: task.id,
          type: task.type || 'renewal', // Usar o tipo original da task
          sistemaId: sistemaId,
          systemId: sistemaId,
          error: `Credenciais geradas mas falha ao editar sistema: ${editError.message}`,
          partialSuccess: {
            credentialsGenerated: true,
            systemEdited: false,
            newUsername: response.credentials.username
          },
          metadata: {
            ...metadata,
            sistemaId: sistemaId,
            originalUsername: originalUsername,
            failedAt: new Date().toISOString(),
            failureReason: 'edit_system_failed'
          }
        });
        
        // Sai da função sem reportar sucesso completo
        return;
      }
      
      // Só reporta sucesso se AMBOS geraram credenciais E editaram o sistema
      await logger.info('✅ Renovação completa: credenciais geradas E sistema editado!', { 
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
          systemEdited: true // Marca que o sistema foi editado
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
        : 'Automação parada'
    });
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