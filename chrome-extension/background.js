// Background script for OnlineOffice IPTV Automator
// Centraliza todo o controle de automação

// Estado da automação mantido no background
let automationState = {
  enabled: false,
  config: null,
  tabId: null,
  currentBatchNumber: 0,       // Número do lote atual
  currentBatchProgress: 0,     // Progresso dentro do lote atual
  totalGeneratedCount: 0,      // Total de credenciais geradas
  currentTimer: null           // Para intervalos < 60s
};

// Listener de instalação
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] OnlineOffice IPTV Automator instalado');
  
  // Configuração padrão
  chrome.storage.sync.set({
    serverUrl: '',
    automationConfig: {
      enabled: false,
      quantity: 10,
      intervalValue: 30,
      intervalUnit: 'minutes'
    },
    lastCredentials: null,
    automationState: {
      enabled: false,
      currentBatchNumber: 0,
      currentBatchProgress: 0,
      totalGeneratedCount: 0
    }
  });
});

// Listener de alarmes (para intervalos >= 60s)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Background] Alarme disparado:', alarm.name);
  
  if (alarm.name === 'automation' && automationState.enabled) {
    await executeNextBatch();
  }
});

// Função principal para executar um lote de gerações
async function executeNextBatch() {
  if (!automationState.enabled) {
    console.log('[Background] Automação parada');
    return;
  }
  
  automationState.currentBatchNumber++;
  automationState.currentBatchProgress = 0;
  const batchSize = automationState.config.quantity;
  
  console.log(`[Background] ========================================`);
  console.log(`[Background] Iniciando LOTE #${automationState.currentBatchNumber} de ${batchSize} credenciais`);
  console.log(`[Background] Total gerado até agora: ${automationState.totalGeneratedCount}`);
  console.log(`[Background] ========================================`);
  
  // Notificar popup sobre início do lote
  chrome.runtime.sendMessage({
    type: 'batchStarted',
    batchNumber: automationState.currentBatchNumber,
    batchSize: batchSize,
    totalGenerated: automationState.totalGeneratedCount
  }).catch(() => {});
  
  // Gerar cada credencial do lote em sequência
  for (let i = 0; i < batchSize; i++) {
    if (!automationState.enabled) {
      console.log('[Background] Automação parada durante lote');
      break;
    }
    
    automationState.currentBatchProgress = i + 1;
    console.log(`[Background] Gerando credencial ${i + 1}/${batchSize} do lote #${automationState.currentBatchNumber}`);
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          automationState.tabId, 
          { action: 'generateOne' },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });
      
      if (response && response.success) {
        automationState.totalGeneratedCount++;
        console.log(`[Background] ✅ Credencial ${i + 1}/${batchSize} gerada com sucesso`);
        
        // Salvar estado
        await chrome.storage.sync.set({
          automationState: {
            enabled: automationState.enabled,
            currentBatchNumber: automationState.currentBatchNumber,
            currentBatchProgress: automationState.currentBatchProgress,
            totalGeneratedCount: automationState.totalGeneratedCount
          }
        });
        
        // Notificar popup
        chrome.runtime.sendMessage({
          type: 'credentialGenerated',
          credentials: response.credentials,
          progress: {
            currentInBatch: i + 1,
            batchSize: batchSize,
            batchNumber: automationState.currentBatchNumber,
            totalGenerated: automationState.totalGeneratedCount
          }
        }).catch(() => {});
        
        // Aguardar 2 segundos entre gerações (exceto na última)
        if (i < batchSize - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.error(`[Background] ❌ Erro na geração ${i + 1}/${batchSize}:`, response?.error);
        // Continuar com a próxima tentativa após um delay
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`[Background] ❌ Erro ao gerar credencial ${i + 1}/${batchSize}:`, error);
      // Se a aba foi fechada, parar
      if (error.message?.includes('Could not establish connection')) {
        console.log('[Background] Aba foi fechada, parando automação');
        stopAutomation();
        return;
      }
      // Caso contrário, aguardar e tentar próxima
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (automationState.enabled) {
    console.log(`[Background] ✅ LOTE #${automationState.currentBatchNumber} CONCLUÍDO!`);
    console.log(`[Background] Total de credenciais geradas: ${automationState.totalGeneratedCount}`);
    console.log(`[Background] Aguardando próximo intervalo...`);
    
    // Notificar popup sobre conclusão do lote
    chrome.runtime.sendMessage({
      type: 'batchCompleted',
      batchNumber: automationState.currentBatchNumber,
      totalGenerated: automationState.totalGeneratedCount
    }).catch(() => {});
    
    // Agendar próximo lote
    scheduleNextBatch();
  }
}

// Agendar próximo lote baseado no intervalo
function scheduleNextBatch() {
  if (!automationState.enabled || !automationState.config) return;
  
  const { intervalValue, intervalUnit } = automationState.config;
  
  // Calcular intervalo em minutos
  let intervalMinutes = intervalValue;
  if (intervalUnit === 'hours') {
    intervalMinutes = intervalValue * 60;
  } else if (intervalUnit === 'seconds') {
    intervalMinutes = intervalValue / 60;
  }
  
  console.log(`[Background] Próximo lote em ${intervalValue} ${intervalUnit}`);
  
  // Para intervalos >= 1 minuto, usar chrome.alarms
  if (intervalMinutes >= 1) {
    chrome.alarms.create('automation', {
      delayInMinutes: intervalMinutes
    });
  } else {
    // Para intervalos < 1 minuto, usar setTimeout
    let intervalMs = intervalValue * 1000;
    if (intervalUnit === 'minutes') {
      intervalMs = intervalValue * 60 * 1000;
    }
    
    automationState.currentTimer = setTimeout(() => {
      executeNextBatch();
    }, intervalMs);
  }
}

// Listener de mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Mensagem recebida:', request.type || request.action);
  
  // Mensagens do popup
  if (request.type === 'startAutomation') {
    startAutomation(request.config, request.tabId)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Indica resposta assíncrona
  }
  
  if (request.type === 'stopAutomation') {
    stopAutomation();
    sendResponse({ success: true });
    return false;
  }
  
  if (request.type === 'getAutomationState') {
    sendResponse({
      success: true,
      state: {
        enabled: automationState.enabled,
        currentBatchNumber: automationState.currentBatchNumber,
        currentBatchProgress: automationState.currentBatchProgress,
        totalGeneratedCount: automationState.totalGeneratedCount,
        config: automationState.config
      }
    });
    return false;
  }
  
  // Mensagens do content script
  if (request.type === 'contentScriptReady') {
    console.log('[Background] Content script pronto em:', request.url);
    
    // Verificar se deve retomar automação
    chrome.storage.sync.get(['automationState'], (result) => {
      if (result.automationState?.enabled && sender.tab?.id) {
        // Retomar automação se estava ativa
        console.log('[Background] Retomando automação...');
        automationState = {
          ...automationState,
          ...result.automationState,
          tabId: sender.tab.id
        };
      }
    });
    
    sendResponse({ success: true });
    return false;
  }
  
  // Repassar mensagens de progresso para o popup
  if (request.type === 'credentialGenerated' || request.type === 'automationProgress') {
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup pode não estar aberto
    });
    
    if (sendResponse) {
      sendResponse({ success: true });
    }
    return false;
  }
});

// Iniciar automação
async function startAutomation(config, tabId) {
  console.log('[Background] Iniciando automação:', config);
  
  // Validar configuração
  if (!config || !config.quantity || !config.intervalValue) {
    throw new Error('Configuração inválida');
  }
  
  // Parar qualquer automação anterior
  stopAutomation();
  
  // Configurar novo estado
  automationState = {
    enabled: true,
    config: config,
    tabId: tabId,
    currentBatchNumber: 0,
    currentBatchProgress: 0,
    totalGeneratedCount: 0,
    currentTimer: null
  };
  
  // Salvar estado
  await chrome.storage.sync.set({
    automationConfig: {
      ...config,
      enabled: true
    },
    automationState: {
      enabled: true,
      currentBatchNumber: 0,
      currentBatchProgress: 0,
      totalGeneratedCount: 0
    }
  });
  
  // Atualizar badge
  if (tabId) {
    chrome.action.setBadgeText({ text: 'AUTO', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
  }
  
  // Avisar usuário sobre limitações para intervalos curtos
  const { intervalValue, intervalUnit } = config;
  let intervalMinutes = intervalValue;
  if (intervalUnit === 'hours') {
    intervalMinutes = intervalValue * 60;
  } else if (intervalUnit === 'seconds') {
    intervalMinutes = intervalValue / 60;
  }
  
  if (intervalMinutes < 1) {
    console.warn('[Background] AVISO: Intervalos menores que 1 minuto podem não funcionar com aba em background!');
    // Notificar popup
    chrome.runtime.sendMessage({
      type: 'warning',
      message: 'Intervalos menores que 1 minuto requerem que a aba permaneça ativa'
    }).catch(() => {});
  }
  
  console.log(`[Background] Gerando lotes de ${config.quantity} credenciais a cada ${intervalValue} ${intervalUnit}`);
  console.log(`[Background] Processo continuará indefinidamente até ser parado manualmente`);
  
  // Iniciar primeiro lote imediatamente
  setTimeout(() => executeNextBatch(), 1000);
}

// Parar automação
function stopAutomation() {
  console.log('[Background] Parando automação');
  
  const wasEnabled = automationState.enabled;
  const totalGenerated = automationState.totalGeneratedCount;
  const batchNumber = automationState.currentBatchNumber;
  
  // Limpar estado
  automationState = {
    enabled: false,
    config: null,
    tabId: null,
    currentBatchNumber: 0,
    currentBatchProgress: 0,
    totalGeneratedCount: 0,
    currentTimer: null
  };
  
  // Limpar timers
  if (automationState.currentTimer) {
    clearTimeout(automationState.currentTimer);
  }
  chrome.alarms.clear('automation');
  
  // Atualizar storage
  chrome.storage.sync.set({
    automationConfig: {
      enabled: false,
      quantity: 10,
      intervalValue: 30,
      intervalUnit: 'minutes'
    },
    automationState: {
      enabled: false,
      currentBatchNumber: 0,
      currentBatchProgress: 0,
      totalGeneratedCount: 0
    }
  });
  
  // Limpar badge
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }
    });
  });
  
  // Notificar popup se a automação estava rodando
  if (wasEnabled) {
    chrome.runtime.sendMessage({
      type: 'automationStopped',
      totalGenerated: totalGenerated,
      batchNumber: batchNumber,
      reason: 'stopped'
    }).catch(() => {});
  }
}

// Listener de atualização de aba
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isOnlineOffice = tab.url.includes('onlineoffice.zip') || tab.url.includes('tv-on.site');
    
    if (isOnlineOffice) {
      // Atualizar badge
      if (automationState.enabled && automationState.tabId === tabId) {
        chrome.action.setBadgeText({ text: 'AUTO', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
      } else {
        chrome.action.setBadgeText({ text: 'ON', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId: tabId });
      }
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

// Listener de remoção de aba
chrome.tabs.onRemoved.addListener((tabId) => {
  // Parar automação se a aba foi fechada
  if (automationState.tabId === tabId) {
    console.log('[Background] Aba de automação fechada, parando...');
    stopAutomation();
  }
});

// Listener de inicialização - restaurar estado se extensão foi recarregada
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extensão iniciada');
  
  // Verificar se havia automação ativa
  chrome.storage.sync.get(['automationState', 'automationConfig'], (result) => {
    if (result.automationState?.enabled) {
      console.log('[Background] Automação estava ativa, aguardando content script...');
      // O content script irá notificar quando estiver pronto
    }
  });
});

console.log('[Background] Script carregado e pronto');