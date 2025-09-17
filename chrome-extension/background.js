// Background script for OnlineOffice IPTV Automator
// Sistema de automação com persistência completa e recorrência infinita

// ===========================================================================
// ESTADO PERSISTENTE - Sincronizado com chrome.storage.local
// ===========================================================================
let automationState = {
  isRunning: false,              // Se a automação está ativa
  config: null,                  // Configuração (quantidade, intervalo, etc)
  tabId: null,                   // ID da aba do OnlineOffice
  batchNumber: 0,                // Número do lote atual
  currentBatchProgress: 0,       // Progresso dentro do lote atual  
  totalGenerated: 0,             // Total de credenciais geradas
  lastRunTime: null,             // Última vez que executou (timestamp)
  nextRunTime: null,             // Próxima execução (timestamp)
  credentialsHistory: []         // Histórico de credenciais (últimas 100)
};

// ===========================================================================
// INICIALIZAÇÃO E RECUPERAÇÃO DE ESTADO
// ===========================================================================

// Ao iniciar o Chrome (quando navegador abre)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] ======= CHROME INICIADO =======');
  await recoverAutomationState();
});

// Ao instalar ou atualizar a extensão
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] ======= EXTENSÃO INSTALADA/ATUALIZADA =======');
  
  // Verificar se já existe estado salvo
  const stored = await chrome.storage.local.get(['automationState']);
  
  if (stored.automationState) {
    console.log('[Background] Estado existente encontrado, recuperando...');
    await recoverAutomationState();
  } else {
    console.log('[Background] Primeira instalação, configurando estado inicial...');
    await saveAutomationState();
  }
});

// Recuperar estado salvo e continuar automação se estava ativa
async function recoverAutomationState() {
  try {
    const stored = await chrome.storage.local.get(['automationState']);
    
    if (!stored.automationState) {
      console.log('[Background] Nenhum estado salvo encontrado');
      return;
    }
    
    automationState = stored.automationState;
    console.log('[Background] Estado recuperado:', {
      isRunning: automationState.isRunning,
      batchNumber: automationState.batchNumber,
      totalGenerated: automationState.totalGenerated,
      nextRunTime: automationState.nextRunTime ? new Date(automationState.nextRunTime) : null
    });
    
    // Se automação estava ativa, continuar
    if (automationState.isRunning && automationState.config) {
      console.log('[Background] 🚀 AUTOMAÇÃO ESTAVA ATIVA! Retomando...');
      
      // Verificar se tem alarme configurado
      const alarm = await chrome.alarms.get('automationBatch');
      
      if (!alarm) {
        console.log('[Background] Alarme não encontrado, recriando...');
        
        // Calcular próxima execução
        const now = Date.now();
        const nextRun = automationState.nextRunTime;
        
        if (nextRun && nextRun > now) {
          // Agendar para o tempo que estava programado
          const delayMinutes = Math.max(1, (nextRun - now) / 60000);
          console.log(`[Background] Próxima execução em ${delayMinutes.toFixed(1)} minutos`);
          await scheduleNextBatch(delayMinutes);
        } else {
          // Executar imediatamente se já passou do tempo
          console.log('[Background] Tempo já passou, executando imediatamente...');
          await scheduleNextBatch(0.1); // 6 segundos
        }
      } else {
        console.log('[Background] Alarme encontrado, será executado em:', 
                   new Date(alarm.scheduledTime));
      }
      
      // Atualizar badge
      chrome.action.setBadgeText({ text: 'AUTO' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      console.log('[Background] Automação estava desativada');
    }
  } catch (error) {
    console.error('[Background] Erro ao recuperar estado:', error);
  }
}

// Salvar estado no storage
async function saveAutomationState() {
  try {
    await chrome.storage.local.set({ automationState });
    console.log('[Background] Estado salvo:', {
      isRunning: automationState.isRunning,
      batchNumber: automationState.batchNumber,
      totalGenerated: automationState.totalGenerated
    });
  } catch (error) {
    console.error('[Background] Erro ao salvar estado:', error);
  }
}

// ===========================================================================
// LISTENERS DE ALARMES E MENSAGENS
// ===========================================================================

// Listener de alarmes para recorrência
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Background] ⏰ ALARME DISPARADO:', alarm.name, new Date());
  
  if (alarm.name === 'automationBatch' && automationState.isRunning) {
    // Atualizar última execução
    automationState.lastRunTime = Date.now();
    await saveAutomationState();
    
    // Executar próximo lote
    await executeNextBatch();
  }
});

// ===========================================================================
// EXECUÇÃO DE LOTES
// ===========================================================================

// Executar próximo lote de gerações
async function executeNextBatch() {
  if (!automationState.isRunning) {
    console.log('[Background] Automação não está ativa');
    return;
  }
  
  // Verificar se tem uma aba válida
  if (!automationState.tabId) {
    console.log('[Background] Sem aba configurada, procurando aba do OnlineOffice...');
    
    // Procurar aba do OnlineOffice
    const tabs = await chrome.tabs.query({ url: "*://*.onlineoffice.zip/*" });
    
    if (tabs.length === 0) {
      console.log('[Background] ❌ Nenhuma aba do OnlineOffice encontrada!');
      console.log('[Background] Aguardando próximo ciclo...');
      await scheduleNextBatch();
      return;
    }
    
    automationState.tabId = tabs[0].id;
    console.log('[Background] Aba encontrada:', automationState.tabId);
  }
  
  // Verificar se aba ainda existe
  try {
    await chrome.tabs.get(automationState.tabId);
  } catch (error) {
    console.log('[Background] Aba foi fechada, procurando nova aba...');
    automationState.tabId = null;
    await saveAutomationState();
    await executeNextBatch(); // Tentar novamente
    return;
  }
  
  // Incrementar contador de lotes
  automationState.batchNumber++;
  automationState.currentBatchProgress = 0;
  const batchSize = automationState.config.quantity;
  
  console.log(`[Background] ========================================`);
  console.log(`[Background] 📦 LOTE #${automationState.batchNumber}`);
  console.log(`[Background] 🎯 Gerando ${batchSize} credenciais`);
  console.log(`[Background] 📊 Total até agora: ${automationState.totalGenerated}`);
  console.log(`[Background] ========================================`);
  
  // Notificar popup sobre início do lote
  chrome.runtime.sendMessage({
    type: 'batchStarted',
    batchNumber: automationState.batchNumber,
    batchSize: batchSize,
    totalGenerated: automationState.totalGenerated
  }).catch(() => {});
  
  // Gerar cada credencial do lote em sequência
  for (let i = 0; i < batchSize; i++) {
    if (!automationState.enabled) {
      console.log('[Background] Automação parada durante lote');
      break;
    }
    
    automationState.currentBatchProgress = i + 1;
    console.log(`[Background] Gerando credencial ${i + 1}/${batchSize}...`);
    
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
        automationState.totalGenerated++;
        
        // Adicionar ao histórico (manter últimas 100)
        automationState.credentialsHistory.unshift({
          ...response.credentials,
          timestamp: Date.now(),
          batchNumber: automationState.batchNumber
        });
        
        if (automationState.credentialsHistory.length > 100) {
          automationState.credentialsHistory = automationState.credentialsHistory.slice(0, 100);
        }
        
        console.log(`[Background] ✅ Credencial ${i + 1}/${batchSize} gerada`);
        
        // Salvar estado após cada credencial
        await saveAutomationState();
        
        // Notificar popup
        chrome.runtime.sendMessage({
          type: 'credentialGenerated',
          credentials: response.credentials,
          progress: {
            currentInBatch: i + 1,
            batchSize: batchSize,
            batchNumber: automationState.batchNumber,
            totalGenerated: automationState.totalGenerated
          }
        }).catch(() => {});
        
        // Aguardar 2 segundos entre gerações (exceto na última)
        if (i < batchSize - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.error(`[Background] ❌ Erro na geração ${i + 1}:`, response?.error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`[Background] ❌ Erro ao gerar credencial ${i + 1}:`, error);
      
      // Se aba foi fechada, limpar tabId
      if (error.message?.includes('Could not establish connection')) {
        console.log('[Background] Aba foi fechada');
        automationState.tabId = null;
        await saveAutomationState();
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (automationState.isRunning) {
    console.log(`[Background] ✅ LOTE #${automationState.batchNumber} CONCLUÍDO!`);
    console.log(`[Background] 📊 Total gerado: ${automationState.totalGenerated} credenciais`);
    
    // Notificar popup
    chrome.runtime.sendMessage({
      type: 'batchCompleted',
      batchNumber: automationState.batchNumber,
      totalGenerated: automationState.totalGenerated
    }).catch(() => {});
    
    // Agendar próximo lote
    await scheduleNextBatch();
  }
}

// Agendar próximo lote
async function scheduleNextBatch(customDelayMinutes = null) {
  if (!automationState.isRunning || !automationState.config) return;
  
  const { intervalValue, intervalUnit } = automationState.config;
  
  // Calcular intervalo em minutos
  let intervalMinutes = customDelayMinutes;
  
  if (intervalMinutes === null) {
    intervalMinutes = intervalValue;
    
    if (intervalUnit === 'hours') {
      intervalMinutes = intervalValue * 60;
    } else if (intervalUnit === 'seconds') {
      intervalMinutes = intervalValue / 60;
    }
  }
  
  // Calcular próxima execução
  automationState.nextRunTime = Date.now() + (intervalMinutes * 60000);
  await saveAutomationState();
  
  console.log(`[Background] ⏰ Próximo lote em ${intervalMinutes.toFixed(1)} minutos`);
  console.log(`[Background] 📅 Execução agendada para:`, new Date(automationState.nextRunTime));
  
  // Usar chrome.alarms para intervalos >= 1 minuto
  if (intervalMinutes >= 1) {
    await chrome.alarms.create('automationBatch', {
      delayInMinutes: intervalMinutes
    });
    
    console.log('[Background] Alarme criado com sucesso');
  } else {
    // Para intervalos < 1 minuto, executar após o delay
    console.warn('[Background] ⚠️ Intervalo < 1 minuto! Usando setTimeout');
    console.warn('[Background] NOTA: Funciona apenas com aba ativa!');
    
    setTimeout(async () => {
      if (automationState.isRunning) {
        automationState.lastRunTime = Date.now();
        await saveAutomationState();
        await executeNextBatch();
      }
    }, intervalMinutes * 60000);
  }
}

// Listener de mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Mensagem recebida:', request.type || request.action);
  
  // Iniciar automação
  if (request.type === 'startAutomation') {
    startAutomation(request.config, request.tabId)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Resposta assíncrona
  }
  
  // Parar automação
  if (request.type === 'stopAutomation') {
    stopAutomation()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  // Obter estado atual
  if (request.type === 'getAutomationState') {
    // Retornar estado completo incluindo próxima execução
    chrome.alarms.get('automationBatch', (alarm) => {
      sendResponse({
        success: true,
        state: {
          ...automationState,
          nextRunTime: alarm ? alarm.scheduledTime : null
        }
      });
    });
    return true; // Resposta assíncrona
  }
  
  // Content script pronto
  if (request.type === 'contentScriptReady') {
    console.log('[Background] Content script pronto em:', request.url);
    
    // Se automação está ativa e não tem tabId, usar esta aba
    if (automationState.isRunning && !automationState.tabId) {
      automationState.tabId = sender.tab?.id;
      saveAutomationState();
      console.log('[Background] TabId atualizado:', automationState.tabId);
    }
    
    sendResponse({ success: true });
    return false;
  }
  
  // Repassar progresso para popup
  if (request.type === 'credentialGenerated' || 
      request.type === 'batchStarted' || 
      request.type === 'batchCompleted') {
    chrome.runtime.sendMessage(request).catch(() => {});
    if (sendResponse) sendResponse({ success: true });
    return false;
  }
});

// ===========================================================================
// CONTROLE DE AUTOMAÇÃO
// ===========================================================================

// Iniciar automação
async function startAutomation(config, tabId) {
  console.log('[Background] ========================================');
  console.log('[Background] INICIANDO AUTOMAÇÃO');
  console.log('[Background] Config:', config);
  console.log('[Background] ========================================');
  
  if (!config || !config.quantity || !config.intervalValue) {
    throw new Error('Configuração inválida');
  }
  
  // Parar qualquer automação anterior
  await stopAutomation();
  
  // Configurar novo estado
  automationState = {
    isRunning: true,
    config: config,
    tabId: tabId,
    batchNumber: 0,
    currentBatchProgress: 0,
    totalGenerated: 0,
    lastRunTime: null,
    nextRunTime: null,
    credentialsHistory: []
  };
  
  // Salvar estado inicial
  await saveAutomationState();
  
  // Configurar badge
  chrome.action.setBadgeText({ text: 'AUTO' });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  
  // Executar primeiro lote imediatamente
  console.log('[Background] Executando primeiro lote...');
  await executeNextBatch();
  
  return true;
}

// Parar automação
async function stopAutomation() {
  console.log('[Background] PARANDO AUTOMAÇÃO');
  
  // Limpar alarmes
  await chrome.alarms.clear('automationBatch');
  
  // Atualizar estado
  automationState.isRunning = false;
  automationState.tabId = null;
  
  // Salvar estado
  await saveAutomationState();
  
  // Limpar badge
  chrome.action.setBadgeText({ text: '' });
  
  console.log('[Background] Automação parada');
  return true;
}

// Log de inicialização
console.log('[Background] ======================================');
console.log('[Background] OnlineOffice IPTV Automator');
console.log('[Background] Versão: 2.0 - Persistência Completa');
console.log('[Background] ======================================');