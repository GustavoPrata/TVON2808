// Background script for OnlineOffice IPTV Automator
// Centraliza todo o controle de automação

// Estado da automação mantido no background
let automationState = {
  enabled: false,
  config: null,
  tabId: null,
  currentCount: 0,
  targetCount: 0,
  currentTimer: null // Para intervalos < 60s
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
      currentCount: 0,
      targetCount: 0
    }
  });
});

// Listener de alarmes (para intervalos >= 60s)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Background] Alarme disparado:', alarm.name);
  
  if (alarm.name === 'automation' && automationState.enabled) {
    await executeNextGeneration();
  }
});

// Função principal para executar a próxima geração
async function executeNextGeneration() {
  console.log(`[Background] Executando geração ${automationState.currentCount + 1} de ${automationState.targetCount}`);
  
  // Verificar se ainda deve continuar
  if (!automationState.enabled || automationState.currentCount >= automationState.targetCount) {
    console.log('[Background] Automação completa ou parada');
    stopAutomation();
    return;
  }
  
  // Enviar comando para content script
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
      // Incrementar contador
      automationState.currentCount++;
      console.log(`[Background] Sucesso! ${automationState.currentCount}/${automationState.targetCount} gerados`);
      
      // Salvar estado
      await chrome.storage.sync.set({
        automationState: {
          enabled: automationState.enabled,
          currentCount: automationState.currentCount,
          targetCount: automationState.targetCount
        }
      });
      
      // Notificar popup
      chrome.runtime.sendMessage({
        type: 'credentialGenerated',
        credentials: response.credentials,
        progress: {
          current: automationState.currentCount,
          total: automationState.targetCount
        }
      }).catch(() => {
        // Popup pode não estar aberto
      });
      
      // Verificar se deve continuar
      if (automationState.currentCount < automationState.targetCount) {
        scheduleNextGeneration();
      } else {
        console.log('[Background] Todas as credenciais foram geradas!');
        stopAutomation();
      }
    } else {
      console.error('[Background] Erro na geração:', response?.error);
      // Tentar novamente após delay
      setTimeout(() => scheduleNextGeneration(), 5000);
    }
  } catch (error) {
    console.error('[Background] Erro ao enviar mensagem:', error);
    // Parar se a aba foi fechada
    stopAutomation();
  }
}

// Agendar próxima geração baseado no intervalo
function scheduleNextGeneration() {
  if (!automationState.enabled || !automationState.config) return;
  
  const { intervalValue, intervalUnit } = automationState.config;
  
  // Calcular intervalo em minutos
  let intervalMinutes = intervalValue;
  if (intervalUnit === 'hours') {
    intervalMinutes = intervalValue * 60;
  } else if (intervalUnit === 'seconds') {
    intervalMinutes = intervalValue / 60;
  }
  
  console.log(`[Background] Próxima geração em ${intervalValue} ${intervalUnit}`);
  
  // Para intervalos >= 1 minuto, usar chrome.alarms
  if (intervalMinutes >= 1) {
    chrome.alarms.create('automation', {
      delayInMinutes: intervalMinutes
    });
  } else {
    // Para intervalos < 1 minuto, usar setTimeout
    // AVISO: Pode não funcionar com aba em background
    let intervalMs = intervalValue * 1000;
    if (intervalUnit === 'minutes') {
      intervalMs = intervalValue * 60 * 1000;
    }
    
    automationState.currentTimer = setTimeout(() => {
      executeNextGeneration();
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
        currentCount: automationState.currentCount,
        targetCount: automationState.targetCount,
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
    currentCount: 0,
    targetCount: config.quantity
  };
  
  // Salvar estado
  await chrome.storage.sync.set({
    automationConfig: {
      ...config,
      enabled: true
    },
    automationState: {
      enabled: true,
      currentCount: 0,
      targetCount: config.quantity
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
  
  console.log(`[Background] Gerando ${config.quantity} credenciais com intervalo de ${intervalValue} ${intervalUnit}`);
  
  // Iniciar primeira geração imediatamente
  setTimeout(() => executeNextGeneration(), 1000);
}

// Parar automação
function stopAutomation() {
  console.log('[Background] Parando automação');
  
  const wasEnabled = automationState.enabled;
  const finalCount = automationState.currentCount;
  const targetCount = automationState.targetCount;
  
  // Limpar estado
  automationState = {
    enabled: false,
    config: null,
    tabId: null,
    currentCount: 0,
    targetCount: 0,
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
      currentCount: 0,
      targetCount: 0
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
      finalCount: finalCount,
      targetCount: targetCount,
      reason: finalCount >= targetCount ? 'completed' : 'stopped'
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