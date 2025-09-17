// TV ON Office Chrome Extension - Content Script
// This script runs in the context of OnlineOffice pages

// Configuration
const CONFIG = {
  serverUrl: '', // Will be set dynamically based on current domain
  extractionDelay: 1000, // Wait 1 second after modal appears
  maxRetries: 5,
  retryDelay: 2000
};

// Não há mais estado de automação aqui - controlado pelo background.js

// Get current domain dynamically
function getCurrentDomain() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  } else if (hostname.includes('replit.dev')) {
    // Replace Replit dev URL with localhost for API calls from extension
    return 'http://localhost:5000';
  } else {
    // Production
    return 'https://tv-on.site';
  }
}

// Initialize
console.log('[TV ON Extension] Content script loaded');
console.log('[TV ON Extension] Current domain:', window.location.hostname);
console.log('[TV ON Extension] API endpoint:', getCurrentDomain());

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request.action);
  
  // Handler principal para geração de credencial
  if (request.action === 'generateOne') {
    console.log('[Content] Executando geração única...');
    performSingleGeneration()
      .then(result => {
        console.log('[Content] Geração concluída:', result);
        sendResponse({ success: true, credentials: result });
      })
      .catch(error => {
        console.error('[Content] Erro na geração:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Resposta assíncrona
  }
  
  // Handler para extrair credenciais (se necessário)
  if (request.action === 'extractCredentials') {
    console.log('[Content] Extraindo credenciais...');
    extractCredentialsFromModal()
      .then(credentials => {
        if (credentials) {
          sendResponse({ success: true, data: credentials });
        } else {
          sendResponse({ success: false, error: 'Credenciais não encontradas' });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Status simples - não há mais estado de automação aqui
  if (request.action === 'getStatus') {
    sendResponse({ 
      success: true,
      ready: true,
      url: window.location.href
    });
    return false;
  }
});

// Função de automação removida - agora controlada pelo background.js

// Perform a single credential generation
async function performSingleGeneration() {
  try {
    console.log('[Content] Iniciando geração de credencial...');
    
    // Verificar se está na página correta
    if (!window.location.href.includes('onlineoffice')) {
      throw new Error('Não está na página OnlineOffice');
    }
    
    // Step 1: Click "Gerar IPTV" button
    console.log('[Content] Passo 1: Procurando botão "Gerar IPTV"...');
    const generateButton = await waitForElementWithText('Gerar IPTV', 'button');
    generateButton.click();
    console.log('[Content] Clicou em "Gerar IPTV"');
    
    // Passo 2: Aguardar modal e clicar no primeiro "Confirmar"
    console.log('[Content] Passo 2: Aguardando primeiro "Confirmar"...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const firstConfirm = await waitForElementWithText('Confirmar', 'button');
    firstConfirm.click();
    console.log('[Content] Clicou no primeiro "Confirmar"');
    
    // Passo 3: Clicar no segundo "Confirmar"
    console.log('[Content] Passo 3: Aguardando segundo "Confirmar"...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const secondConfirm = await waitForElementWithText('Confirmar', 'button');
    secondConfirm.click();
    console.log('[Content] Clicou no segundo "Confirmar"');
    
    // Passo 4: Aguardar modal de credenciais
    console.log('[Content] Passo 4: Aguardando modal de credenciais...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Passo 5: Extrair credenciais
    console.log('[Content] Passo 5: Extraindo credenciais...');
    const credentials = await extractCredentialsFromModal();
    
    if (!credentials) {
      throw new Error('Não foi possível extrair credenciais');
    }
    
    console.log('[Content] Credenciais extraídas:', credentials);
    
    // Passo 6: Enviar para o servidor
    await sendCredentialsToServer(credentials);
    
    // Passo 7: Fechar o modal
    console.log('[Content] Passo 7: Fechando modal...');
    await closeModal();
    
    return credentials;
    
  } catch (error) {
    console.error('[Content] Erro na geração:', error);
    // Tentar fechar modal em caso de erro
    try {
      await closeModal();
    } catch (e) {
      console.log('[Content] Não foi possível fechar modal:', e);
    }
    throw error;
  }
}

// Close modal
async function closeModal() {
  try {
    console.log('[Extension] Closing modal by clicking backdrop...');
    
    // Click on backdrop/overlay to close modal (most modals close this way)
    const backdrops = [
      '.swal2-container',
      '.swal2-backdrop',
      '.modal-backdrop',
      '.overlay',
      '[class*="backdrop"]',
      '[class*="overlay"]'
    ];
    
    for (const selector of backdrops) {
      const backdrop = document.querySelector(selector);
      if (backdrop) {
        console.log('[Extension] Found backdrop:', selector);
        backdrop.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
    }
    
    // Alternative: click anywhere outside the modal content
    console.log('[Extension] Clicking at coordinates to close modal...');
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: 10,  // Click near the edge of the screen
      clientY: 10
    });
    document.body.dispatchEvent(clickEvent);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error('[Extension] Error closing modal:', error);
  }
}

// Helper function to wait for element with specific text
function waitForElementWithText(text, tagName = '*', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const elements = document.querySelectorAll(tagName);
      
      for (const element of elements) {
        const elementText = element.textContent || element.innerText || '';
        if (elementText.trim() === text || elementText.includes(text)) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            resolve(element);
            return;
          }
        }
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for element with text: ${text}`));
        return;
      }
      
      setTimeout(checkElement, 100);
    };
    
    checkElement();
  });
}

// Extract credentials from modal
async function extractCredentialsFromModal() {
  try {
    console.log('[Extension] Starting credential extraction...');
    
    // Wait a bit for modal to fully render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Look for any modal or popup element
    const modalSelectors = [
      '.swal2-container', '.swal2-modal', '.swal2-popup',
      '.modal', '.modal-body', '.modal-content',
      '[role="dialog"]', '.dialog', '.popup',
      'div[class*="modal"]', 'div[class*="dialog"]'
    ];
    
    let modalText = '';
    for (const selector of modalSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if visible
        if (element.offsetParent !== null) {
          const text = element.innerText || element.textContent || '';
          if (text.includes('USUÁRIO') || text.includes('SENHA')) {
            modalText = text;
            console.log('[Extension] Found modal with credentials');
            break;
          }
        }
      }
      if (modalText) break;
    }
    
    // If no modal found, try to get all page text
    if (!modalText) {
      console.log('[Extension] No modal found, scanning entire page...');
      modalText = document.body.innerText || document.body.textContent || '';
    }
    
    console.log('[Extension] Text to parse:', modalText);
    
    // Extract username and password using simple patterns
    let username = null;
    let password = null;
    
    // Split text into lines and process
    const lines = modalText.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for USUÁRIO
      if (line.includes('USUÁRIO')) {
        // Check if value is on the same line after colon
        if (line.includes(':')) {
          const parts = line.split(':');
          if (parts.length > 1 && parts[1].trim()) {
            username = parts[1].trim();
            console.log('[Extension] Found username on same line:', username);
          }
        }
        // If not, check next line
        if (!username && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // Make sure next line is not another label
          if (!nextLine.includes(':') && !nextLine.includes('SENHA') && !nextLine.includes('VENCIMENTO')) {
            username = nextLine;
            console.log('[Extension] Found username on next line:', username);
          }
        }
      }
      
      // Look for SENHA
      if (line.includes('SENHA')) {
        // Check if value is on the same line after colon
        if (line.includes(':')) {
          const parts = line.split(':');
          if (parts.length > 1 && parts[1].trim()) {
            password = parts[1].trim();
            console.log('[Extension] Found password on same line:', password);
          }
        }
        // If not, check next line
        if (!password && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // Make sure next line is not another label
          if (!nextLine.includes(':') && !nextLine.includes('VENCIMENTO')) {
            password = nextLine;
            console.log('[Extension] Found password on next line:', password);
          }
        }
      }
    }
    
    // Try fallback regex if still no credentials
    if (!username || !password) {
      console.log('[Extension] Trying regex fallback...');
      
      // Try to match patterns in the full text
      const userRegex = /USUÁRIO:?\s*([^\s\n]+)/i;
      const passRegex = /SENHA:?\s*([^\s\n]+)/i;
      
      const userMatch = modalText.match(userRegex);
      const passMatch = modalText.match(passRegex);
      
      if (userMatch && userMatch[1]) {
        username = userMatch[1].trim();
        console.log('[Extension] Found username with regex:', username);
      }
      
      if (passMatch && passMatch[1]) {
        password = passMatch[1].trim();
        console.log('[Extension] Found password with regex:', password);
      }
    }
    
    // Final validation
    if (username && password) {
      console.log('[Extension] Successfully extracted credentials');
      return { username, password };
    } else {
      console.log('[Extension] Failed to extract credentials');
      console.log('[Extension] Username found:', !!username);
      console.log('[Extension] Password found:', !!password);
      return null;
    }
    
  } catch (error) {
    console.error('[Extension] Error extracting credentials:', error);
    return null;
  }
}

// Send credentials to server
async function sendCredentialsToServer(credentials) {
  try {
    const serverUrl = CONFIG.serverUrl || getCurrentDomain();
    console.log('[Extension] Sending credentials to server:', serverUrl);
    
    const response = await fetch(`${serverUrl}/api/office/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        source: 'extension'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[Extension] Server response:', result);
    return result;
    
  } catch (error) {
    console.error('[Extension] Failed to send credentials:', error);
    throw error;
  }
}

// Auto-detect and notify background when on OnlineOffice page
if (window.location.href.includes('onlineoffice')) {
  console.log('[Content] OnlineOffice detectado');
  
  // Notificar background que content script está pronto
  chrome.runtime.sendMessage({ 
    type: 'contentScriptReady',
    url: window.location.href
  });
  
  // Monitorar mudanças de página
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      chrome.runtime.sendMessage({ 
        type: 'pageChanged',
        url: lastUrl
      });
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}