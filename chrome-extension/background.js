// OnlineOffice IPTV Automator - Background Script
// Versão simplificada com foco em funcionalidade

// ===========================================================================
// ESTADO GLOBAL
// ===========================================================================
let automationState = {
  isRunning: false,
  batchSize: 10,  // quantas credenciais por lote
  intervalMinutes: 5,  // intervalo entre lotes
  totalGenerated: 0,
  currentBatch: 0,
  lastGenerated: null // última credencial gerada
};

// ===========================================================================
// INICIALIZAÇÃO
// ===========================================================================
console.log('🚀 Background script iniciado!');

// Carrega estado salvo ao iniciar
chrome.runtime.onStartup.addListener(async () => {
  console.log('📦 Chrome iniciado, carregando estado salvo...');
  const stored = await chrome.storage.local.get(['automationState']);
  if (stored.automationState) {
    automationState = stored.automationState;
    console.log('✅ Estado recuperado:', automationState);
    
    // Se estava rodando, recriar alarme
    if (automationState.isRunning) {
      console.log('♻️ Recriando alarme para continuar automação...');
      chrome.alarms.create('generateBatch', {
        periodInMinutes: automationState.intervalMinutes
      });
    }
  }
});

// ===========================================================================
// LISTENER DE ALARMES
// ===========================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'generateBatch' && automationState.isRunning) {
    console.log('⏰ Alarme disparado! Hora de gerar novo lote!');
    await generateBatch();
  }
});

// ===========================================================================
// FUNÇÃO PRINCIPAL - GERAR LOTE
// ===========================================================================
async function generateBatch() {
  console.log('========================================');
  console.log(`📦 INICIANDO LOTE #${automationState.currentBatch + 1}`);
  console.log(`🎯 Quantidade: ${automationState.batchSize} credenciais`);
  console.log('========================================');
  
  // Procura aba do OnlineOffice
  const tabs = await chrome.tabs.query({
    url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
  });
  
  if (tabs.length === 0) {
    console.error('❌ ERRO: Nenhuma aba OnlineOffice encontrada!');
    console.log('⚠️ Abra o site onlineoffice.zip e faça login');
    
    // Notifica popup se estiver aberto
    chrome.runtime.sendMessage({
      type: 'error',
      message: 'Abra o OnlineOffice.zip primeiro!'
    }).catch(() => {});
    
    return;
  }
  
  const tabId = tabs[0].id;
  console.log(`✅ Aba encontrada: ${tabs[0].url}`);
  
  // Incrementa contador de lote
  automationState.currentBatch++;
  
  // Gera credenciais uma por uma
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < automationState.batchSize; i++) {
    if (!automationState.isRunning) {
      console.log('⏹️ Automação parada pelo usuário');
      break;
    }
    
    console.log(`\n🎯 Gerando credencial ${i + 1}/${automationState.batchSize}...`);
    
    try {
      // Envia comando para content script e AGUARDA RESPOSTA COMPLETA
      const response = await chrome.tabs.sendMessage(tabId, {action: 'generateOne'});
      
      if (response && response.success && response.credentials) {
        successCount++;
        automationState.totalGenerated++;
        automationState.lastGenerated = response.credentials;
        
        console.log(`✅ Sucesso! Credencial ${i + 1} gerada`);
        console.log(`   Usuario: ${response.credentials.username}`);
        console.log(`   Senha: ${response.credentials.password}`);
        
        // SALVA NA API
        try {
          const apiResponse = await fetch('https://aef8336d-fdf6-4f45-8827-b87d99023c0e-00-3bbspqbjbb2rl.worf.replit.dev/api/office/save-credentials', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              usuario: response.credentials.username,
              senha: response.credentials.password,
              vencimento: new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR')
            })
          });
          
          const apiData = await apiResponse.json();
          if (apiData.success) {
            console.log('💾 Salvo na API com sucesso!');
          } else {
            console.error('⚠️ Erro ao salvar na API:', apiData.error);
          }
        } catch (apiError) {
          console.error('⚠️ Erro ao chamar API:', apiError);
        }
        
        // Notifica popup
        chrome.runtime.sendMessage({
          type: 'credentialGenerated',
          credentials: response.credentials,
          progress: {
            current: i + 1,
            total: automationState.batchSize,
            batchNumber: automationState.currentBatch
          }
        }).catch(() => {});
        
      } else {
        errorCount++;
        console.error(`❌ Erro na credencial ${i + 1}:`, response?.error || 'Sem resposta');
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Erro ao gerar credencial ${i + 1}:`, error.message);
      
      // Se perdeu conexão com a aba, parar
      if (error.message.includes('Could not establish connection')) {
        console.error('🔌 Perdeu conexão com a aba. Parando lote...');
        break;
      }
    }
    
    // Aguarda entre gerações (TEMPO MAIOR PARA NÃO SOBREPOR)
    if (i < automationState.batchSize - 1) {
      console.log('⏳ Aguardando 10 segundos antes da próxima...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos entre cada geração
    }
  }
  
  // Resumo do lote
  console.log('\n========================================');
  console.log(`📊 LOTE #${automationState.currentBatch} COMPLETO`);
  console.log(`✅ Sucesso: ${successCount} credenciais`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📈 Total geral: ${automationState.totalGenerated} credenciais`);
  console.log(`⏰ Próximo lote em: ${automationState.intervalMinutes} minutos`);
  console.log('========================================\n');
  
  // Salva estado
  await chrome.storage.local.set({automationState});
}

// ===========================================================================
// LISTENER DE MENSAGENS DO POPUP
// ===========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensagem recebida:', request.type);
  
  if (request.type === 'startAutomation') {
    console.log('🚀 INICIANDO AUTOMAÇÃO');
    console.log('Configuração:', request.config);
    
    // Atualiza estado
    automationState.isRunning = true;
    automationState.batchSize = request.config.batchSize;
    automationState.intervalMinutes = request.config.intervalMinutes;
    automationState.currentBatch = 0;
    automationState.totalGenerated = 0;
    automationState.lastGenerated = null;
    
    // Salva estado
    chrome.storage.local.set({automationState});
    
    // Remove alarme antigo se existir
    chrome.alarms.clear('generateBatch');
    
    // Cria novo alarme recorrente
    chrome.alarms.create('generateBatch', {
      delayInMinutes: 0.1, // Começa em 6 segundos
      periodInMinutes: automationState.intervalMinutes
    });
    
    console.log(`⏰ Alarme configurado: a cada ${automationState.intervalMinutes} minutos`);
    console.log('🔄 Primeiro lote será gerado em 6 segundos...');
    
    // Atualiza badge
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    
    sendResponse({success: true});
    return true;
  }
  
  if (request.type === 'stopAutomation') {
    console.log('🛑 PARANDO AUTOMAÇÃO');
    
    automationState.isRunning = false;
    chrome.alarms.clear('generateBatch');
    chrome.storage.local.set({automationState});
    
    // Remove badge
    chrome.action.setBadgeText({ text: '' });
    
    console.log('✅ Automação parada');
    console.log(`📊 Total gerado: ${automationState.totalGenerated} credenciais`);
    
    sendResponse({success: true});
    return true;
  }
  
  if (request.type === 'getStatus') {
    sendResponse(automationState);
    return true;
  }
  
  if (request.type === 'generateOneManual') {
    console.log('🎯 Geração manual solicitada');
    
    // Procura aba e gera uma credencial
    chrome.tabs.query({
      url: ['*://onlineoffice.zip/*', '*://*.onlineoffice.zip/*']
    }).then(async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({success: false, error: 'Abra o OnlineOffice.zip primeiro!'});
        return;
      }
      
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {action: 'generateOne'});
        
        if (response && response.success && response.credentials) {
          automationState.totalGenerated++;
          automationState.lastGenerated = response.credentials;
          
          // SALVA NA API
          try {
            const apiResponse = await fetch('https://aef8336d-fdf6-4f45-8827-b87d99023c0e-00-3bbspqbjbb2rl.worf.replit.dev/api/office/save-credentials', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                usuario: response.credentials.username,
                senha: response.credentials.password,
                vencimento: new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString('pt-BR')
              })
            });
            
            const apiData = await apiResponse.json();
            if (!apiData.success) {
              console.error('⚠️ Erro ao salvar na API:', apiData.error);
            }
          } catch (apiError) {
            console.error('⚠️ Erro ao chamar API:', apiError);
          }
          
          await chrome.storage.local.set({automationState});
          sendResponse({success: true, credentials: response.credentials});
        } else {
          sendResponse({success: false, error: response?.error || 'Erro desconhecido'});
        }
      } catch (error) {
        sendResponse({success: false, error: error.message});
      }
    });
    
    return true; // resposta assíncrona
  }
});