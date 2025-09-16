// Popup script for OnlineOffice IPTV Automator

// Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const generateBtn = document.getElementById('generateBtn');
const serverUrlInput = document.getElementById('serverUrl');
const saveConfigBtn = document.getElementById('saveConfig');
const autoGenerateCheckbox = document.getElementById('autoGenerate');
const credentialsSection = document.getElementById('credentialsSection');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const logContent = document.getElementById('logContent');

// Load saved configuration
chrome.storage.sync.get(['serverUrl', 'autoGenerate', 'lastCredentials'], (result) => {
  serverUrlInput.value = result.serverUrl || 'http://localhost:5000';
  autoGenerateCheckbox.checked = result.autoGenerate || false;
  
  if (result.lastCredentials) {
    showCredentials(result.lastCredentials);
  }
});

// Check if we're on the OnlineOffice website
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  const isOnlineOffice = currentTab.url && currentTab.url.includes('onlineoffice.zip');
  
  if (isOnlineOffice) {
    setStatus('connected', 'Conectado ao OnlineOffice');
    generateBtn.disabled = false;
    
    // Get status from content script
    chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, (response) => {
      if (response && response.success) {
        if (response.isMonitoring) {
          addLog('Monitoramento automático ativo');
        }
        if (response.lastCredentials) {
          showCredentials(response.lastCredentials);
        }
      }
    });
  } else {
    setStatus('disconnected', 'Acesse onlineoffice.zip primeiro');
    generateBtn.disabled = true;
  }
});

// Generate button click
generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = 'Gerando...';
  addLog('Iniciando geração de credenciais...');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'generateCredentials' }, (response) => {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<span class="icon">⚡</span> Gerar Credenciais';
      
      if (response && response.success) {
        addLog('✅ Credenciais geradas com sucesso!');
        showCredentials(response.credentials);
        
        // Save to storage
        chrome.storage.sync.set({ lastCredentials: response.credentials });
      } else {
        addLog(`❌ Erro: ${response ? response.error : 'Sem resposta'}`);
      }
    });
  });
});

// Save configuration
saveConfigBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim();
  
  if (!serverUrl) {
    alert('Por favor, insira a URL do servidor');
    return;
  }
  
  chrome.storage.sync.set({ 
    serverUrl: serverUrl,
    autoGenerate: autoGenerateCheckbox.checked 
  }, () => {
    addLog('✅ Configuração salva');
    
    // Notify content script of changes
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab.url && currentTab.url.includes('onlineoffice.zip')) {
        chrome.tabs.sendMessage(currentTab.id, {
          action: autoGenerateCheckbox.checked ? 'startMonitoring' : 'stopMonitoring'
        });
      }
    });
  });
});

// Auto-generate checkbox change
autoGenerateCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ autoGenerate: autoGenerateCheckbox.checked });
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('onlineoffice.zip')) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: autoGenerateCheckbox.checked ? 'startMonitoring' : 'stopMonitoring'
      }, (response) => {
        if (response && response.success) {
          addLog(response.message);
        }
      });
    }
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
    
    addLog(`${field === 'username' ? 'Usuário' : 'Senha'} copiado`);
  });
});

// Helper functions
function setStatus(type, text) {
  statusIndicator.className = 'status-indicator ' + type;
  statusText.textContent = text;
}

function showCredentials(credentials) {
  credentialsSection.style.display = 'block';
  usernameInput.value = credentials.username || '';
  passwordInput.value = credentials.password || '';
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

// Listen for messages from background/content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'credentialsGenerated') {
    showCredentials(request.credentials);
    addLog('📥 Credenciais recebidas do site');
    chrome.storage.sync.set({ lastCredentials: request.credentials });
  }
  
  if (request.type === 'pageChanged') {
    addLog(`📍 Navegou para: ${new URL(request.url).pathname}`);
  }
});