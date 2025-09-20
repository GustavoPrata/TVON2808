// OnlineOffice IPTV Automator - Background Script
// Versão refatorada para usar backend como fonte única de verdade

// Log de inicialização
console.log('✅ Extensão iniciada em modo autônomo');

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
    
    // Adiciona log à fila para envio ao backend
    queueLogForBackend(level, message, context);
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
// SISTEMA DE ENVIO DE LOGS PARA O BACKEND
// ===========================================================================
let pendingLogs = [];
let lastLogSentTime = Date.now();

// Função para enviar logs acumulados para o backend
async function sendLogsToBackend() {
  // Não envia se não houver logs pendentes
  if (pendingLogs.length === 0) {
    return;
  }
  
  // Copia e limpa logs pendentes
  const logsToSend = [...pendingLogs];
  pendingLogs = [];
  
  try {
    const apiBase = API_BASE || await getApiBase();
    const response = await fetch(`${apiBase}/api/extension/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': 'chrome-extension-secret-2024'
      },
      body: JSON.stringify({ logs: logsToSend })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`📤 ${result.count} logs enviados para o servidor`);
      lastLogSentTime = Date.now();
    } else {
      // Se falhar, adiciona os logs de volta
      pendingLogs = [...logsToSend, ...pendingLogs];
      console.error('Erro ao enviar logs para o servidor:', response.status);
    }
  } catch (error) {
    // Se falhar, adiciona os logs de volta  
    pendingLogs = [...logsToSend, ...pendingLogs];
    console.error('Erro ao enviar logs para o servidor:', error);
  }
}

// Função para adicionar log à fila de envio
function queueLogForBackend(level, message, context = {}) {
  pendingLogs.push({
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    context: context,
    traceId: context.traceId || null
  });
  
  // Limita o tamanho da fila
  if (pendingLogs.length > 500) {
    pendingLogs = pendingLogs.slice(-500);
  }
  
  // Se tiver muitos logs acumulados, envia imediatamente
  if (pendingLogs.length >= 50) {
    sendLogsToBackend();
  }
}

// Envio periódico de logs (a cada 30 segundos)
setInterval(async () => {
  await sendLogsToBackend();
}, 30000);

// Envio de logs quando a extensão é descarregada
chrome.runtime.onSuspend.addListener(async () => {
  await sendLogsToBackend();
});

// Listener removido - não usa mais content script

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
// FUNÇÃO DE GERAÇÃO LOCAL DE CREDENCIAIS
// ===========================================================================
async function generateCredentialsLocally() {
  // Gera username com 9 dígitos
  const username = Math.floor(Math.random() * 900000000 + 100000000).toString();
  
  // Gera password no formato NNNNxNNNNa (N=dígito)
  const part1 = Math.floor(Math.random() * 9000 + 1000).toString();
  const part2 = Math.floor(Math.random() * 9000 + 1000).toString();
  const password = `${part1}x${part2}a`;
  
  await logger.info('🔑 Credenciais geradas localmente', {
    username: '***',
    password: '***'
  });
  
  return {
    success: true,
    credentials: {
      username: username,
      password: password
    }
  };
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
  
})();


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
  
  // Cria alarme específico para checagem de renovação a cada 30 segundos
  chrome.alarms.create('checkRenewalTasks', {
    periodInMinutes: 0.5, // 30 segundos
    delayInMinutes: 0
  });
}

// Listener para os alarmes
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollBackend') {
    await logger.debug('⏰ Alarme disparado: checando tarefas...', { alarm: alarm.name });
    await checkForTasks();
  } else if (alarm.name === 'checkStatus') {
  } else if (alarm.name === 'checkRenewalTasks') {
    // Checagem específica para tarefas de renovação a cada 30 segundos
    await logger.debug('🔄 Checando tarefas de renovação...', { alarm: alarm.name });
    await checkForTasks();
  }
});

// Inicia quando o Chrome abre
chrome.runtime.onStartup.addListener(async () => {
  await logger.info('📦 Chrome iniciado, configurando automação...');
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
});

// Inicia quando instalado/atualizado
chrome.runtime.onInstalled.addListener(async () => {
  await logger.info('🔧 Extensão instalada/atualizada, configurando automação...');
  await setupAlarms();
  await checkForTasks(); // Checa imediatamente
});

// Inicia verificação imediata
(async () => {
  await setupAlarms();
  await checkForTasks();
})();


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
  // Se já está processando, pula esta checagem
  if (isProcessingTask) {
    await logger.debug('⏳ Já processando tarefa, pulando checagem...');
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
    
    // Se há task, processa diretamente sem abrir aba
    if (data.hasTask) {
      await logger.info('✅ TASK ENCONTRADA! Processando em background...');
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
// PROCESSAMENTO DE TAREFAS
// ===========================================================================
async function processTask(task) {
  await logger.info('========================================');
  await logger.info('🎯 PROCESSANDO TAREFA DO BACKEND (MODO AUTÔNOMO)');
  await logger.info(`📦 Tipo: ${task.type}`);
  await logger.info(`🔢 Quantidade: ${task.quantity || 1}`);
  await logger.info('========================================');
  
  // Processa diretamente sem precisar de tabs
  if (task.type === 'generate_batch') {
    await generateBatch(null, task);
  } else if (task.type === 'generate_single') {
    await generateSingle(null, task);
  } else if (task.type === 'renewal' || task.type === 'renew_system') {
    // Suporta ambos os tipos: 'renewal' (do backend) e 'renew_system' (legado)
    await logger.info('🔄 Task de renovação detectada (modo autônomo)', { 
      type: task.type,
      taskId: task.id,
      sistemaId: task.sistemaId || task.data?.sistemaId || task.metadata?.sistemaId || 'N/A',
      metadata: task.metadata,
      data: task.data
    });
    await renewSystem(null, task);
  } else {
    await logger.warn('⚠️ Tipo de task desconhecido', { type: task.type, task });
  }
}

async function generateBatch(tabId, task) {
  const quantity = task.quantity || 10;
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  await logger.info(`📦 Gerando lote de ${quantity} credenciais (modo autônomo)...`);
  
  for (let i = 0; i < quantity; i++) {
    await logger.info(`🎯 Gerando credencial ${i + 1}/${quantity}...`);
    
    try {
      // Gera credenciais localmente sem precisar de tab
      const response = await generateCredentialsLocally();
      
      if (response && response.success && response.credentials) {
        successCount++;
        
        await logger.info(`✅ Sucesso! Credencial ${i + 1} gerada`, {
          username: '***',
          password: '***'
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
  await logger.info('🎯 Gerando credencial única (modo autônomo)...');
  
  try {
    // Gera credenciais localmente sem precisar de tab
    const response = await generateCredentialsLocally();
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Credencial gerada com sucesso!', {
        username: '***',
        password: '***'
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
  await logger.info('🔄 Renovando sistema IPTV (modo autônomo)...', { taskData: task });
  
  // Extrair sistemaId de diferentes locais possíveis
  const sistemaId = task.sistemaId || 
                    task.data?.sistemaId || 
                    task.data?.systemId || 
                    task.metadata?.sistemaId || 
                    task.metadata?.systemId || 
                    task.metadata?.system_id ||
                    null;
                     
  const originalUsername = task.data?.originalUsername || 
                          task.metadata?.originalUsername || 
                          task.metadata?.systemUsername ||
                          task.data?.currentUsername || 
                          'N/A';
  
  const traceId = task.metadata?.traceId || `renewal_ext_${Date.now()}`;
  
  await logger.info('📋 Dados da renovação', {
    sistemaId: sistemaId || 'N/A',
    usuarioAtual: originalUsername,
    taskId: task.id,
    taskType: task.type,
    traceId: traceId
  });
  
  // Validação do sistemaId
  if (!sistemaId) {
    await logger.error('❌ ERRO CRÍTICO: sistemaId não encontrado na task', {
      task: JSON.stringify(task),
      traceId: traceId
    });
    // Reporta erro ao backend
    await reportTaskResult({
      taskId: task.id,
      type: task.type || 'renewal',
      error: 'sistemaId não encontrado na task',
      metadata: {
        ...task.metadata,
        error: 'sistemaId não encontrado',
        traceId: traceId
      }
    });
    return;
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
    
    // PASSO 1: Gera as credenciais localmente
    const response = await generateCredentialsLocally();
    
    if (response && response.success && response.credentials) {
      await logger.info('✅ Nova credencial gerada para renovação!', {
        novoUsuario: '***',
        novaSenha: '***',
        sistemaId: sistemaId || 'desconhecido'
      });
      
      // PASSO 2: Enviar credenciais para o backend (que fará a atualização)
      await logger.info('📤 Enviando credenciais para atualizar o sistema no backend...', { 
        sistemaId,
        username: '***',
        traceId: traceId
      });
      
      // Chamar o endpoint para atualizar o sistema com as novas credenciais (com retry)
      try {
        const updateResult = await retryWithBackoff(async () => {
          const updateResponse = await fetch(`${API_BASE}/api/sistemas/process-renewal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Extension-Key': 'chrome-extension-secret-2024'
            },
            body: JSON.stringify({
              sistemaId: sistemaId,
              username: response.credentials.username,
              password: response.credentials.password,
              taskId: task.id,
              traceId: traceId
            })
          });
          
          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            // Incluir o status no erro para o retryWithBackoff detectar
            if (updateResponse.status >= 400 && updateResponse.status < 500) {
              throw new Error(`Erro ${updateResponse.status}: ${errorText}`);
            }
            // Se for erro do servidor (5xx), lança exceção para tentar novamente
            throw new Error(`Erro ${updateResponse.status}: ${errorText}`);
          }
          
          return await updateResponse.json();
        }, 3, 2000, 10000); // 3 tentativas, delay inicial de 2s, máximo de 10s
        await logger.info('✅ Sistema atualizado com sucesso!', {
          sistemaId: sistemaId,
          username: '***',
          expiracao: updateResult.expiracao,
          traceId: traceId
        });
        
        // Reporta sucesso ao backend com as credenciais geradas
        const reportSuccess = await reportTaskResult({
          taskId: task.id,
          type: task.type || 'renewal',
          sistemaId: sistemaId,
          systemId: sistemaId, // Manter ambos por compatibilidade
          credentials: {
            username: response.credentials.username,
            password: response.credentials.password,
            sistemaId: sistemaId
          },
          metadata: {
            ...metadata,
            sistemaId: sistemaId,
            originalUsername: originalUsername,
            renewedAt: new Date().toISOString(),
            systemUpdated: true,
            traceId: traceId,
            expiracao: updateResult.expiracao
          }
        });
        
        if (!reportSuccess) {
          await logger.error('⚠️ Falha ao reportar conclusão ao backend!', { sistemaId, traceId });
        } else {
          await logger.info('✅ Renovação completa reportada ao backend!', { 
            sistemaId,
            username: '***',
            traceId: traceId
          });
        }
        
      } catch (updateError) {
        await logger.error('❌ Erro ao atualizar sistema no backend', {
          error: updateError.message,
          sistemaId,
          traceId: traceId
        });
        
        // Mesmo com erro no update, reporta as credenciais geradas
        await reportTaskResult({
          taskId: task.id,
          type: task.type || 'renewal',
          sistemaId: sistemaId,
          credentials: {
            username: response.credentials.username,
            password: response.credentials.password
          },
          error: `Credenciais geradas mas erro ao atualizar sistema: ${updateError.message}`,
          metadata: {
            ...metadata,
            sistemaId: sistemaId,
            systemUpdated: false,
            updateError: updateError.message,
            traceId: traceId
          }
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
// FUNÇÕES DE RETRY COM BACKOFF EXPONENCIAL
// ===========================================================================
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 2000, maxDelay = 10000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Tenta executar a função
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Verifica se o erro é do tipo que não deve ser retentado
      // Erros 4xx (cliente) não devem ser retentados
      if (error.message && error.message.includes('4')) {
        const match = error.message.match(/\b4\d{2}\b/);
        if (match) {
          await logger.error(`❌ Erro de cliente (${match[0]}) - não será retentado`, {
            error: error.message,
            attempt: attempt + 1
          });
          throw error; // Lança erro imediatamente para erros 4xx
        }
      }
      
      // Se é a última tentativa, lança o erro
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calcula o delay com backoff exponencial
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      await logger.warn(`⏳ Tentativa ${attempt + 1}/${maxRetries} falhou, tentando novamente em ${delay}ms`, {
        error: error.message,
        attempt: attempt + 1,
        nextDelay: delay
      });
      
      // Aguarda antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
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
    result: {
      ...result,
      // Mascara credenciais no log se existirem
      credentials: result.credentials ? { username: '***', password: '***' } : undefined,
      results: result.results ? result.results.map(r => ({
        ...r,
        username: r.username ? '***' : undefined,
        password: r.password ? '***' : undefined
      })) : undefined
    },
    server: API_BASE
  });
  
  try {
    // Usa retry com backoff exponencial
    const success = await retryWithBackoff(async () => {
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
        // Incluir o status no erro para o retryWithBackoff detectar
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }
        // Se for erro do servidor (5xx), lança exceção para tentar novamente
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      await logger.info('✅ Resultado reportado com sucesso', { response: data });
      return true;
    }, 3, 2000, 10000); // 3 tentativas, delay inicial de 2s, máximo de 10s
    
    return success;
    
  } catch (error) {
    await logger.error('❌ Falha ao reportar resultado após múltiplas tentativas', { error: error.message });
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