// Popup script for OnlineOffice IPTV Automator

// Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const generateOneBtn = document.getElementById('generateOneBtn');
const automationToggle = document.getElementById('automationToggle');
const automationStatus = document.getElementById('automationStatus');
const automationConfig = document.getElementById('automationConfig');
const saveAutomationBtn = document.getElementById('saveAutomation');
const quantityInput = document.getElementById('quantity');
const intervalValueInput = document.getElementById('intervalValue');
const intervalUnitSelect = document.getElementById('intervalUnit');
const credentialsSection = document.getElementById('credentialsSection');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const logContent = document.getElementById('logContent');
const pageUrl = document.getElementById('pageUrl');

// Additional elements for batch info
const batchStatus = document.getElementById('batchStatus');
const batchNumber = document.getElementById('batchNumber');
const totalGenerated = document.getElementById('totalGenerated');

// State
let isOnOnlineOffice = false;
let automationActive = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfiguration();
  await checkCurrentTab();
});

// Load saved configuration from local storage
async function loadConfiguration() {
  // Usar chrome.storage.local para persistência completa
  chrome.storage.local.get(['automationState'], async (result) => {
    if (result.automationState) {
      const state = result.automationState;
      
      // Carregar configuração se existir
      if (state.config) {
        quantityInput.value = state.config.quantity || 10;
        intervalValueInput.value = state.config.intervalValue || 30;
        intervalUnitSelect.value = state.config.intervalUnit || 'minutes';
      }
      
      // Verificar se está rodando
      automationActive = state.isRunning || false;
      updateAutomationUI(automationActive);
      
      // Se está rodando, mostrar progresso
      if (state.isRunning) {
        updateBatchInfo(
          state.batchNumber || 0,
          state.currentBatchProgress || 0,
          state.config?.quantity || 0,
          state.totalGenerated || 0
        );
        
        // Buscar próxima execução
        const alarm = await chrome.alarms.get('automationBatch');
        if (alarm) {
          updateNextRunTime(alarm.scheduledTime);
        }
        
        // Mostrar histórico de credenciais se existir
        if (state.credentialsHistory && state.credentialsHistory.length > 0) {
          showCredentials(state.credentialsHistory[0]);
        }
        
        addLog(`📦 Automação ATIVA - Lote #${state.batchNumber}, Total: ${state.totalGenerated}`);
      }
    }
  });
}

// Check current tab
async function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url || '';
    
    isOnOnlineOffice = url.includes('onlineoffice.zip') || url.includes('tv-on.site');
    
    if (isOnOnlineOffice) {
      setStatus('connected', 'Conectado ao OnlineOffice');
      generateOneBtn.disabled = false;
      pageUrl.textContent = new URL(url).hostname;
      
      // Get automation state from background
      chrome.runtime.sendMessage({ type: 'getAutomationState' }, async (response) => {
        if (response && response.success && response.state) {
          const state = response.state;
          
          // Atualizar interface se automação está ativa
          if (state.isRunning) {
            updateAutomationUI(true);
            updateBatchInfo(
              state.batchNumber || 0,
              state.currentBatchProgress || 0,
              state.config?.quantity || 0,
              state.totalGenerated || 0
            );
            
            // Mostrar próxima execução
            if (state.nextRunTime) {
              updateNextRunTime(state.nextRunTime);
            }
            
            // Mostrar última credencial se existir
            if (state.credentialsHistory && state.credentialsHistory.length > 0) {
              showCredentials(state.credentialsHistory[0]);
            }
          }
        }
      });
      
      // Check if content script is ready
      chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not ready yet');
        } else if (response && response.success) {
          console.log('Content script ready');
        }
      });
    } else {
      setStatus('disconnected', 'Acesse onlineoffice.zip primeiro');
      generateOneBtn.disabled = true;
      pageUrl.textContent = 'Não conectado';
    }
  });
}

// Generate One button
generateOneBtn.addEventListener('click', async () => {
  if (!isOnOnlineOffice) {
    addLog('❌ Você precisa estar no OnlineOffice');
    return;
  }
  
  generateOneBtn.disabled = true;
  generateOneBtn.textContent = 'Gerando...';
  addLog('🔄 Iniciando geração de credencial...');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'generateOne' }, (response) => {
      generateOneBtn.disabled = false;
      generateOneBtn.innerHTML = '<span class="icon">➕</span> Gerar Um';
      
      if (response && response.success) {
        addLog('✅ Credencial gerada com sucesso!');
        showCredentials(response.credentials);
        
        // Save to storage
        chrome.storage.sync.set({ lastCredentials: response.credentials });
      } else {
        addLog(`❌ Erro: ${response ? response.error : 'Sem resposta'}`);
      }
    });
  });
});

// Automation toggle
automationToggle.addEventListener('change', async () => {
  const enabled = automationToggle.checked;
  
  if (enabled && !isOnOnlineOffice) {
    addLog('❌ Você precisa estar no OnlineOffice para ativar');
    automationToggle.checked = false;
    return;
  }
  
  updateAutomationUI(enabled);
  
  if (enabled) {
    // Show config section
    automationConfig.style.display = 'block';
    progressSection.style.display = 'block';
    addLog('⚙️ Configure a automação abaixo');
  } else {
    // Stop automation via background
    automationConfig.style.display = 'none';
    progressSection.style.display = 'none';
    
    // Comunicar com background.js
    chrome.runtime.sendMessage({ type: 'stopAutomation' }, (response) => {
      if (response && response.success) {
        addLog('🛑 Automação desativada');
      }
    });
    
    // Nada a salvar - o background já cuida disso
  }
});

// Save automation config
saveAutomationBtn.addEventListener('click', () => {
  const config = {
    enabled: automationToggle.checked,
    quantity: parseInt(quantityInput.value) || 10,
    intervalValue: parseInt(intervalValueInput.value) || 30,
    intervalUnit: intervalUnitSelect.value
  };
  
  // Validate
  if (config.quantity < 1 || config.quantity > 100) {
    alert('Quantidade deve ser entre 1 e 100');
    return;
  }
  
  if (config.intervalValue < 1 || config.intervalValue > 60) {
    alert('Intervalo deve ser entre 1 e 60');
    return;
  }
  
  // Avisar sobre limitações se intervalo menor que 1 minuto
  if (config.intervalUnit === 'seconds' || 
      (config.intervalUnit === 'minutes' && config.intervalValue < 1)) {
    addLog('⚠️ Intervalos < 1 min requerem aba ativa');
  }
  
  // Não salvar localmente - enviar direto para background
  addLog('✅ Configuração definida');
  addLog(`📊 Gerando lotes de ${config.quantity} credenciais a cada ${config.intervalValue} ${config.intervalUnit}`);
  addLog('♾️ Processo continuará INDEFINIDAMENTE mesmo após fechar o Chrome!');
  
  // Obter tabId atual e enviar para background
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Enviar mensagem para background.js
    chrome.runtime.sendMessage({ 
      type: 'startAutomation',
      config: config,
      tabId: tabs[0].id
    }, (response) => {
      if (response && response.success) {
        addLog('🚀 Automação iniciada com persistência total!');
        addLog('🔄 Continuará rodando mesmo se fechar o Chrome');
        updateBatchInfo(0, 0, config.quantity, 0);
      } else {
        addLog(`❌ Erro: ${response?.error || 'Não foi possível iniciar'}`);
        automationToggle.checked = false;
        updateAutomationUI(false);
      }
    });
  });
});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const field = e.target.dataset.copy;
    const input = field === 'username' ? usernameInput : passwordInput;
    
    // Select and copy
    input.select();
    document.execCommand('copy');
    
    // Visual feedback
    const originalText = e.target.textContent;
    e.target.textContent = '✅';
    setTimeout(() => {
      e.target.textContent = originalText;
    }, 1000);
    
    addLog(`📋 ${field === 'username' ? 'Usuário' : 'Senha'} copiado`);
  });
});

// Helper functions
function setStatus(type, text) {
  statusIndicator.className = 'status-indicator ' + type;
  statusText.textContent = text;
}

function updateAutomationUI(enabled) {
  automationToggle.checked = enabled;
  automationStatus.textContent = enabled ? 'Automação ON' : 'Automação OFF';
  automationStatus.className = enabled ? 'automation-on' : 'automation-off';
}

function showCredentials(credentials) {
  credentialsSection.style.display = 'block';
  usernameInput.value = credentials.username || '';
  passwordInput.value = credentials.password || '';
}

function updateBatchInfo(batchNum, currentInBatch, batchSize, totalCount) {
  progressSection.style.display = 'block';
  
  // Update batch status
  if (batchStatus) {
    if (batchNum === 0) {
      batchStatus.textContent = 'Aguardando início...';
    } else {
      batchStatus.textContent = currentInBatch > 0 
        ? `Gerando credencial ${currentInBatch}/${batchSize}...`
        : 'Aguardando próximo lote...';
    }
  }
  
  // Update batch number
  if (batchNumber) {
    batchNumber.textContent = `Lote: ${batchNum}`;
  }
  
  // Update progress bar
  const percentage = batchSize > 0 ? (currentInBatch / batchSize) * 100 : 0;
  progressFill.style.width = percentage + '%';
  progressText.textContent = `${currentInBatch} de ${batchSize} no lote atual`;
  
  // Update total generated
  if (totalGenerated) {
    totalGenerated.textContent = `Total gerado: ${totalCount} credenciais`;
  }
}

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
  
  logContent.insertBefore(logEntry, logContent.firstChild);
  
  // Keep only last 10 entries
  while (logContent.children.length > 10) {
    logContent.removeChild(logContent.lastChild);
  }
}

// Função para atualizar próxima execução
function updateNextRunTime(scheduledTime) {
  const nextRunElement = document.getElementById('nextRunTime');
  if (!nextRunElement) return;
  
  if (!scheduledTime) {
    nextRunElement.textContent = 'Não agendado';
    return;
  }
  
  const now = Date.now();
  const timeUntil = scheduledTime - now;
  
  if (timeUntil <= 0) {
    nextRunElement.textContent = 'Executando...';
  } else {
    const minutes = Math.floor(timeUntil / 60000);
    const seconds = Math.floor((timeUntil % 60000) / 1000);
    
    if (minutes > 0) {
      nextRunElement.textContent = `${minutes} min ${seconds}s`;
    } else {
      nextRunElement.textContent = `${seconds} segundos`;
    }
  }
}

// Atualizar próxima execução a cada segundo se automação está ativa
let nextRunInterval = null;

function startNextRunTimer() {
  if (nextRunInterval) clearInterval(nextRunInterval);
  
  nextRunInterval = setInterval(async () => {
    if (!automationActive) {
      clearInterval(nextRunInterval);
      return;
    }
    
    // Buscar alarme atual
    const alarm = await chrome.alarms.get('automationBatch');
    if (alarm) {
      updateNextRunTime(alarm.scheduledTime);
    } else {
      // Se não tem alarme mas deveria ter, buscar do estado
      chrome.runtime.sendMessage({ type: 'getAutomationState' }, (response) => {
        if (response && response.success && response.state && response.state.nextRunTime) {
          updateNextRunTime(response.state.nextRunTime);
        }
      });
    }
  }, 1000);
}

// Listen for messages from content/background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request.type);
  
  // Batch started
  if (request.type === 'batchStarted') {
    addLog(`📦 LOTE #${request.batchNumber} iniciado (${request.batchSize} credenciais)`);
    updateBatchInfo(request.batchNumber, 0, request.batchSize, request.totalGenerated);
    
    // Iniciar timer de próxima execução
    if (automationActive) {
      startNextRunTimer();
    }
  }
  
  // Batch completed
  if (request.type === 'batchCompleted') {
    addLog(`✅ LOTE #${request.batchNumber} concluído! Total gerado: ${request.totalGenerated}`);
    addLog('⏳ Aguardando próximo intervalo...');
    addLog('🔄 Automação continuará mesmo se fechar o Chrome');
  }
  
  // Individual credential generated
  if (request.type === 'credentialGenerated') {
    showCredentials(request.credentials);
    chrome.storage.sync.set({ lastCredentials: request.credentials });
    
    // Update progress if batch info is provided
    if (request.progress) {
      updateBatchInfo(
        request.progress.batchNumber,
        request.progress.currentInBatch,
        request.progress.batchSize,
        request.progress.totalGenerated
      );
      
      // Only log every 5th credential to avoid spam
      if (request.progress.currentInBatch % 5 === 0 || 
          request.progress.currentInBatch === request.progress.batchSize) {
        addLog(`✅ ${request.progress.currentInBatch}/${request.progress.batchSize} geradas`);
      }
    }
  }
  
  // Automation stopped
  if (request.type === 'automationStopped') {
    updateAutomationUI(false);
    addLog(`🛑 Automação parada após gerar ${request.totalGenerated} credenciais em ${request.batchNumber} lotes`);
  }
  
  // Warning messages
  if (request.type === 'warning') {
    addLog(`⚠️ ${request.message}`);
  }
  
  // Content script ready
  if (request.type === 'contentScriptReady') {
    addLog('✅ Extensão pronta no site');
    generateOneBtn.disabled = false;
  }
  
  // Page navigation
  if (request.type === 'pageChanged') {
    addLog(`📍 Navegou para: ${new URL(request.url).pathname}`);
  }
});

// Check tab changes
chrome.tabs.onActivated.addListener(() => {
  checkCurrentTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id === tabId) {
        checkCurrentTab();
      }
    });
  }
});

// Initialize
addLog('🚀 Extensão iniciada');
addLog('💾 Verificando estado salvo...');

// Verificar se há automação recuperada
chrome.storage.local.get(['automationState'], (result) => {
  if (result.automationState && result.automationState.isRunning) {
    addLog('📡 AUTOMAÇÃO RECUPERADA DO STORAGE!');
    addLog(`📦 Continuando do Lote #${result.automationState.batchNumber}`);
    addLog(`📊 Total já gerado: ${result.automationState.totalGenerated} credenciais`);
    startNextRunTimer();
  }
});