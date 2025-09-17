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

// State
let isOnOnlineOffice = false;
let automationActive = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfiguration();
  await checkCurrentTab();
});

// Load saved configuration
async function loadConfiguration() {
  chrome.storage.sync.get(['automationConfig', 'lastCredentials'], (result) => {
    if (result.automationConfig) {
      quantityInput.value = result.automationConfig.quantity || 10;
      intervalValueInput.value = result.automationConfig.intervalValue || 30;
      intervalUnitSelect.value = result.automationConfig.intervalUnit || 'minutes';
      automationActive = result.automationConfig.enabled || false;
      updateAutomationUI(automationActive);
    }
    
    if (result.lastCredentials) {
      showCredentials(result.lastCredentials);
    }
  });
}

// Check current tab
async function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url || '';
    
    isOnOnlineOffice = url.includes('onlineoffice.zip') || url.includes('tv-on.site');
    
    if (isOnOnlineOffice) {
      setStatus('connected', 'Conectado ao OnlineOffice');
      generateOneBtn.disabled = false;
      pageUrl.textContent = new URL(url).hostname;
      
      // Get automation state from background
      chrome.runtime.sendMessage({ type: 'getAutomationState' }, (response) => {
        if (response && response.success && response.state) {
          if (response.state.enabled) {
            updateAutomationUI(true);
            updateProgress(response.state.currentCount, response.state.targetCount);
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
    
    // Save disabled state
    chrome.storage.sync.set({ 
      automationConfig: {
        enabled: false,
        quantity: quantityInput.value,
        intervalValue: intervalValueInput.value,
        intervalUnit: intervalUnitSelect.value
      }
    });
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
  
  // Save to storage
  chrome.storage.sync.set({ automationConfig: config }, () => {
    addLog('✅ Configuração salva');
    
    // Obter tabId atual e enviar para background
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Enviar mensagem para background.js
      chrome.runtime.sendMessage({ 
        type: 'startAutomation',
        config: config,
        tabId: tabs[0].id
      }, (response) => {
        if (response && response.success) {
          addLog('🚀 Automação iniciada');
          updateProgress(0, config.quantity);
        }
      });
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

function updateProgress(current, total) {
  progressSection.style.display = 'block';
  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressFill.style.width = percentage + '%';
  progressText.textContent = `${current} de ${total} gerados`;
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

// Listen for messages from content/background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request.type);
  
  if (request.type === 'credentialGenerated') {
    showCredentials(request.credentials);
    addLog('✅ Credencial gerada');
    chrome.storage.sync.set({ lastCredentials: request.credentials });
    
    // Atualizar progresso se enviado
    if (request.progress) {
      updateProgress(request.progress.current, request.progress.total);
    }
  }
  
  if (request.type === 'automationProgress') {
    updateProgress(request.current, request.total);
  }
  
  if (request.type === 'automationStopped') {
    updateAutomationUI(false);
    const reason = request.reason === 'completed' ? 'completa' : 'parada';
    const msg = request.finalCount && request.targetCount 
      ? `🛑 Automação ${reason} (${request.finalCount}/${request.targetCount} gerados)`
      : '🛑 Automação parada';
    addLog(msg);
  }
  
  if (request.type === 'warning') {
    addLog(`⚠️ ${request.message}`);
  }
  
  if (request.type === 'contentScriptReady') {
    addLog('✅ Extensão pronta no site');
    generateOneBtn.disabled = false;
  }
  
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

// Initialize log
addLog('🚀 Extensão iniciada');