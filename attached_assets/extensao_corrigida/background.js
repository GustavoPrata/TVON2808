// OnlineOffice IPTV Automator - Background Script Simplified
console.log('✅ Background script carregado');

// Listener para mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensagem recebida:', request);
  
  // Responde a pings
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  // Verifica autenticação
  if (request.action === 'checkAuth') {
    sendResponse({ authenticated: true });
    return true;
  }
  
  // Ação de login automático
  if (request.action === 'autoLogin') {
    sendResponse({ success: true, message: 'Login iniciado via content script' });
    return true;
  }
  
  // Ações de credenciais
  if (request.type === 'saveCredentials') {
    chrome.storage.local.set({
      credentials: request.credentials
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === 'getCredentials') {
    chrome.storage.local.get(['credentials'], (result) => {
      sendResponse(result.credentials || null);
    });
    return true;
  }
  
  // Ações de logs
  if (request.type === 'getLogs') {
    chrome.storage.local.get(['extension_logs'], (result) => {
      sendResponse(result.extension_logs || []);
    });
    return true;
  }
  
  // Ação padrão
  sendResponse({ success: false, message: 'Ação não suportada' });
  return true;
});

// Inicialização
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Extensão instalada/atualizada com sucesso');
  
  // Define badge inicial
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Mantém o service worker ativo
const keepAlive = () => {
  console.log('💓 Keep alive ping');
};

setInterval(keepAlive, 20000);

console.log('✨ Background script pronto e funcionando!');