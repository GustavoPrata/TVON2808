// TV ON Office Chrome Extension - Content Script
// This script runs in the context of OnlineOffice pages

// Configuration
const CONFIG = {
  serverUrl: '', // Will be set dynamically based on current domain
  extractionDelay: 1000, // Wait 1 second after modal appears
  maxRetries: 5,
  retryDelay: 2000
};

// Automation state
let automationState = {
  isRunning: false,
  config: null,
  currentCount: 0,
  targetCount: 0,
  intervalId: null
};

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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Extension] Message received:', request);
  
  if (request.action === 'startAutomation') {
    console.log('[Extension] Starting automation with config:', request.config);
    startAutomationMode(request.config)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'generateOne') {
    console.log('[Extension] Generating one credential...');
    performSingleGeneration()
      .then(result => {
        console.log('[Extension] Single generation completed:', result);
        sendResponse({ success: true, credentials: result });
      })
      .catch(error => {
        console.error('[Extension] Single generation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'extractCredentials') {
    console.log('[Extension] Extracting credentials only...');
    extractCredentialsFromModal()
      .then(credentials => {
        if (credentials) {
          sendResponse({ success: true, data: credentials });
        } else {
          sendResponse({ success: false, error: 'No credentials found' });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'getStatus') {
    sendResponse({ 
      success: true,
      isAutomationActive: automationState.isRunning,
      currentQuantity: automationState.currentCount,
      targetQuantity: automationState.targetCount
    });
    return false;
  }
  
  if (request.action === 'stopAutomation') {
    stopAutomation();
    sendResponse({ success: true });
    return false;
  }
});

// Start automation mode
async function startAutomationMode(config) {
  try {
    console.log('[Extension] Starting automation mode:', config);
    
    // Stop any existing automation
    stopAutomation();
    
    // Set up new automation
    automationState.isRunning = true;
    automationState.config = config;
    automationState.currentCount = 0;
    automationState.targetCount = config.quantity || 10;
    
    // Calculate interval in milliseconds
    let intervalMs = config.intervalValue * 1000; // Default seconds
    if (config.intervalUnit === 'minutes') {
      intervalMs = config.intervalValue * 60 * 1000;
    } else if (config.intervalUnit === 'hours') {
      intervalMs = config.intervalValue * 60 * 60 * 1000;
    }
    
    console.log(`[Extension] Will generate ${automationState.targetCount} credentials with ${intervalMs}ms interval`);
    
    // Notify popup of progress
    chrome.runtime.sendMessage({
      type: 'automationProgress',
      current: automationState.currentCount,
      total: automationState.targetCount
    });
    
    // Start generating credentials
    const generateNext = async () => {
      if (!automationState.isRunning || automationState.currentCount >= automationState.targetCount) {
        console.log('[Extension] Automation complete or stopped');
        stopAutomation();
        chrome.runtime.sendMessage({ type: 'automationStopped' });
        return;
      }
      
      try {
        console.log(`[Extension] Generating credential ${automationState.currentCount + 1} of ${automationState.targetCount}`);
        const credentials = await performSingleGeneration();
        
        if (credentials) {
          automationState.currentCount++;
          
          // Notify popup
          chrome.runtime.sendMessage({
            type: 'credentialGenerated',
            credentials: credentials
          });
          
          chrome.runtime.sendMessage({
            type: 'automationProgress',
            current: automationState.currentCount,
            total: automationState.targetCount
          });
          
          // Schedule next generation
          if (automationState.currentCount < automationState.targetCount) {
            console.log(`[Extension] Waiting ${intervalMs}ms before next generation...`);
            automationState.intervalId = setTimeout(generateNext, intervalMs);
          } else {
            console.log('[Extension] All credentials generated');
            stopAutomation();
            chrome.runtime.sendMessage({ type: 'automationStopped' });
          }
        }
      } catch (error) {
        console.error('[Extension] Error in automation:', error);
        // Retry after delay
        automationState.intervalId = setTimeout(generateNext, 5000);
      }
    };
    
    // Start first generation immediately
    generateNext();
    
    return { started: true, config: config };
    
  } catch (error) {
    console.error('[Extension] Failed to start automation:', error);
    stopAutomation();
    throw error;
  }
}

// Stop automation
function stopAutomation() {
  console.log('[Extension] Stopping automation');
  automationState.isRunning = false;
  if (automationState.intervalId) {
    clearTimeout(automationState.intervalId);
    automationState.intervalId = null;
  }
}

// Perform a single credential generation
async function performSingleGeneration() {
  try {
    console.log('[Extension] Starting single generation...');
    
    // Check if we're on the right page
    if (!window.location.href.includes('onlineoffice')) {
      throw new Error('Not on OnlineOffice page');
    }
    
    // Step 1: Click "Gerar IPTV" button
    console.log('[Extension] Step 1: Looking for "Gerar IPTV" button...');
    const generateButton = await waitForElementWithText('Gerar IPTV', 'button');
    generateButton.click();
    console.log('[Extension] Clicked "Gerar IPTV" button');
    
    // Step 2: Wait for modal and click first "Confirmar"
    console.log('[Extension] Step 2: Waiting for first "Confirmar" button...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const firstConfirm = await waitForElementWithText('Confirmar', 'button');
    firstConfirm.click();
    console.log('[Extension] Clicked first "Confirmar" button');
    
    // Step 3: Click second "Confirmar"
    console.log('[Extension] Step 3: Waiting for second "Confirmar" button...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const secondConfirm = await waitForElementWithText('Confirmar', 'button');
    secondConfirm.click();
    console.log('[Extension] Clicked second "Confirmar" button');
    
    // Step 4: Wait for credentials modal
    console.log('[Extension] Step 4: Waiting for credentials modal...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 5: Extract credentials
    console.log('[Extension] Step 5: Extracting credentials...');
    const credentials = await extractCredentialsFromModal();
    
    if (!credentials) {
      throw new Error('Could not extract credentials');
    }
    
    console.log('[Extension] Credentials extracted:', credentials);
    
    // Step 6: Send to server
    await sendCredentialsToServer(credentials);
    
    // Step 7: Close the modal
    console.log('[Extension] Step 7: Closing modal...');
    await closeModal();
    
    return credentials;
    
  } catch (error) {
    console.error('[Extension] Generation error:', error);
    // Try to close modal in case of error
    try {
      await closeModal();
    } catch (e) {
      console.log('[Extension] Could not close modal:', e);
    }
    throw error;
  }
}

// Close modal
async function closeModal() {
  try {
    console.log('[Extension] Looking for close button...');
    
    // Look for close button in various forms
    const closeSelectors = [
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      'button.swal2-close',
      'button.close',
      '.swal2-close',
      'button:has(> span[aria-hidden="false"])',
      'button:has(> .swal2-x-mark)',
      'button[class*="close"]',
      'button[title="Close"]',
      'button[title="Fechar"]'
    ];
    
    for (const selector of closeSelectors) {
      const closeBtn = document.querySelector(selector);
      if (closeBtn) {
        console.log('[Extension] Found close button with selector:', selector);
        closeBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
    }
    
    // Alternative: look for button containing × symbol
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      const text = button.innerText || button.textContent || '';
      if (text.includes('×') || text.includes('X') || text.includes('x')) {
        console.log('[Extension] Found close button with × symbol');
        button.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
    }
    
    // Last resort: press ESC key
    console.log('[Extension] No close button found, trying ESC key...');
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 });
    document.dispatchEvent(escEvent);
    
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

// Auto-detect and notify popup when on OnlineOffice page
if (window.location.href.includes('onlineoffice')) {
  console.log('[Extension] OnlineOffice page detected');
  
  // Notify popup that content script is ready
  chrome.runtime.sendMessage({ type: 'contentScriptReady' });
  
  // Monitor for page changes
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