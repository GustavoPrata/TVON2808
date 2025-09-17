// OnlineOffice IPTV Automator - Popup Script
// Versão simplificada

const batchSizeInput = document.getElementById('batchSize');
const intervalSelect = document.getElementById('interval');
const manualBtn = document.getElementById('manualBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const credentialsDiv = document.getElementById('credentials');
const lastUserSpan = document.getElementById('lastUser');
const lastPassSpan = document.getElementById('lastPass');
const logDiv = document.getElementById('log');

let automationRunning = false;

// Função para adicionar log
function addLog(message) {
  const time = new Date().toLocaleTimeString();
  logDiv.innerHTML = `[${time}] ${message}<br>` + logDiv.innerHTML;
  // Limita a 10 linhas
  const lines = logDiv.innerHTML.split('<br>');
  if (lines.length > 10) {
    logDiv.innerHTML = lines.slice(0, 10).join('<br>');
  }
}

// Função para atualizar status
async function updateStatus() {
  try {
    // Verifica se está na aba do OnlineOffice
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const currentTab = tabs[0];
    const isOnlineOffice = currentTab.url && currentTab.url.includes('onlineoffice.zip');
    
    if (!isOnlineOffice) {
      addLog('⚠️ Acesse onlineoffice.zip primeiro!');
      manualBtn.disabled = true;
      startBtn.disabled = true;
    } else {
      manualBtn.disabled = false;
      startBtn.disabled = automationRunning;
    }
    
    // Pega estado do background
    const response = await chrome.runtime.sendMessage({type: 'getStatus'});
    automationRunning = response.isRunning;
    
    if (automationRunning) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      statusDiv.className = 'status status-running';
      statusDiv.innerHTML = `
        <strong>Status:</strong> 🟢 Rodando<br>
        <strong>Total Gerado:</strong> ${response.totalGenerated} credenciais<br>
        <strong>Lote Atual:</strong> ${response.currentBatch}<br>
        <strong>Config:</strong> ${response.batchSize} a cada ${response.intervalMinutes} min
      `;
    } else {
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      statusDiv.className = 'status status-stopped';
      statusDiv.innerHTML = `
        <strong>Status:</strong> 🔴 Parado<br>
        <strong>Total Gerado:</strong> ${response.totalGenerated || 0} credenciais<br>
        <strong>Lote Atual:</strong> ${response.currentBatch || 0}
      `;
    }
    
    // Mostra última credencial se existir
    if (response.lastGenerated) {
      credentialsDiv.style.display = 'block';
      lastUserSpan.textContent = response.lastGenerated.username || '-';
      lastPassSpan.textContent = response.lastGenerated.password || '-';
    }
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    addLog('❌ Erro ao conectar com background');
  }
}

// Botão Gerar Manual
manualBtn.addEventListener('click', async () => {
  addLog('🎯 Gerando uma credencial manual...');
  manualBtn.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({type: 'generateOneManual'});
    
    if (response.success) {
      addLog('✅ Credencial gerada com sucesso!');
      if (response.credentials) {
        credentialsDiv.style.display = 'block';
        lastUserSpan.textContent = response.credentials.username;
        lastPassSpan.textContent = response.credentials.password;
      }
    } else {
      addLog(`❌ Erro: ${response.error}`);
    }
  } catch (error) {
    addLog('❌ Erro ao gerar credencial');
    console.error(error);
  } finally {
    manualBtn.disabled = false;
  }
});

// Botão Iniciar
startBtn.addEventListener('click', async () => {
  const config = {
    batchSize: parseInt(batchSizeInput.value) || 10,
    intervalMinutes: parseInt(intervalSelect.value) || 5
  };
  
  addLog(`🚀 Iniciando automação: ${config.batchSize} a cada ${config.intervalMinutes} min`);
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'startAutomation',
      config: config
    });
    
    if (response.success) {
      addLog('✅ Automação iniciada!');
      automationRunning = true;
      await updateStatus();
    } else {
      addLog('❌ Erro ao iniciar automação');
    }
  } catch (error) {
    addLog('❌ Erro ao comunicar com background');
    console.error(error);
  }
});

// Botão Parar
stopBtn.addEventListener('click', async () => {
  addLog('⏹️ Parando automação...');
  
  try {
    const response = await chrome.runtime.sendMessage({type: 'stopAutomation'});
    
    if (response.success) {
      addLog('✅ Automação parada!');
      automationRunning = false;
      await updateStatus();
    }
  } catch (error) {
    addLog('❌ Erro ao parar automação');
    console.error(error);
  }
});

// Listener para mensagens do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'credentialGenerated') {
    addLog('📋 Nova credencial gerada');
    if (request.credentials) {
      credentialsDiv.style.display = 'block';
      lastUserSpan.textContent = request.credentials.username;
      lastPassSpan.textContent = request.credentials.password;
    }
    if (request.progress) {
      addLog(`Progresso: ${request.progress.current}/${request.progress.total}`);
    }
  }
  
  if (request.type === 'error') {
    addLog(`❌ ${request.message}`);
  }
});

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  addLog('🎯 Extensão carregada');
  await updateStatus();
  
  // Atualiza status a cada 3 segundos
  setInterval(updateStatus, 3000);
});

// Carrega estado salvo
chrome.storage.local.get(['automationState'], (result) => {
  if (result.automationState) {
    batchSizeInput.value = result.automationState.batchSize || 10;
    intervalSelect.value = result.automationState.intervalMinutes || 5;
    
    if (result.automationState.lastGenerated) {
      credentialsDiv.style.display = 'block';
      lastUserSpan.textContent = result.automationState.lastGenerated.username || '-';
      lastPassSpan.textContent = result.automationState.lastGenerated.password || '-';
    }
  }
});