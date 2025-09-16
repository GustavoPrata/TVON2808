// OnlineOffice IPTV Automator - Content Script
console.log('OnlineOffice IPTV Automator: Content script loaded');

// Configuration
const CONFIG = {
  serverUrl: '',
  currentQuantity: 0,
  targetQuantity: 10,
  isAutomationActive: false
};

// Load configuration from storage
chrome.storage.sync.get(['serverUrl', 'automationConfig'], (result) => {
  CONFIG.serverUrl = result.serverUrl || getCurrentDomain();
  if (result.automationConfig) {
    CONFIG.isAutomationActive = result.automationConfig.enabled;
    CONFIG.targetQuantity = result.automationConfig.quantity || 10;
  }
  console.log('Configuration loaded:', CONFIG);
});

// Get current domain for API calls
function getCurrentDomain() {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost')) {
    return 'http://localhost:5000';
  } else if (hostname.includes('replit.app') || hostname.includes('replit.dev')) {
    return window.location.origin;
  } else if (hostname.includes('tv-on.site')) {
    return 'https://tv-on.site';
  }
  return window.location.origin;
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'generateOne') {
    generateSingleCredential().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open
  }
  
  if (request.action === 'startAutomation') {
    startAutomation(request.config);
    sendResponse({ success: true });
  }
  
  if (request.action === 'stopAutomation') {
    stopAutomation();
    sendResponse({ success: true });
  }
  
  if (request.action === 'getStatus') {
    sendResponse({ 
      success: true, 
      isAutomationActive: CONFIG.isAutomationActive,
      currentQuantity: CONFIG.currentQuantity,
      targetQuantity: CONFIG.targetQuantity
    });
  }
});

// Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found after ${timeout}ms`));
        return;
      }
      
      setTimeout(checkElement, 100);
    };
    
    checkElement();
  });
}

// Wait for element with text content
function waitForElementWithText(text, tagName = '*', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const elements = document.querySelectorAll(tagName);
      for (const element of elements) {
        if (element.textContent.includes(text)) {
          resolve(element);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element with text "${text}" not found after ${timeout}ms`));
        return;
      }
      
      setTimeout(checkElement, 100);
    };
    
    checkElement();
  });
}

// Click sequence for generating credentials
async function performGenerationSequence() {
  try {
    console.log('Starting generation sequence...');
    
    // Step 1: Click "Gerar IPTV" button
    console.log('Step 1: Looking for "Gerar IPTV" button...');
    const generateButton = await waitForElementWithText('Gerar IPTV', 'button');
    generateButton.click();
    console.log('Clicked "Gerar IPTV" button');
    
    // Step 2: Wait for modal and click first "Confirmar"
    console.log('Step 2: Waiting for first "Confirmar" button...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for modal to appear
    const firstConfirm = await waitForElementWithText('Confirmar', 'button');
    firstConfirm.click();
    console.log('Clicked first "Confirmar" button');
    
    // Step 3: Click second "Confirmar"
    console.log('Step 3: Waiting for second "Confirmar" button...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for next modal
    const secondConfirm = await waitForElementWithText('Confirmar', 'button');
    secondConfirm.click();
    console.log('Clicked second "Confirmar" button');
    
    // Step 4: Wait 5 seconds for credentials to be generated
    console.log('Step 4: Waiting 5 seconds for credentials...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 5: Extract credentials from modal
    console.log('Step 5: Extracting credentials from modal...');
    const credentials = await extractCredentialsFromModal();
    
    if (!credentials) {
      throw new Error('Could not extract credentials from modal');
    }
    
    console.log('Credentials extracted successfully:', credentials);
    return credentials;
    
  } catch (error) {
    console.error('Error in generation sequence:', error);
    throw error;
  }
}

// Extract credentials from modal
async function extractCredentialsFromModal() {
  try {
    // Look for modal elements
    const modals = document.querySelectorAll('.modal, .modal-body, .modal-content, [role="dialog"], .popup, .dialog');
    
    for (const modal of modals) {
      // Skip if modal is hidden
      if (modal.style.display === 'none' || modal.style.visibility === 'hidden') {
        continue;
      }
      
      const modalText = modal.innerText || modal.textContent;
      console.log('Checking modal text:', modalText.substring(0, 200));
      
      // Look for USUÁRIO and SENHA patterns
      const userMatch = modalText.match(/(?:USUÁRIO|USUARIO|USERNAME):\s*([^\s\n]+)/i);
      const passMatch = modalText.match(/(?:SENHA|PASSWORD):\s*([^\s\n]+)/i);
      
      if (userMatch && passMatch) {
        return {
          username: userMatch[1].trim(),
          password: passMatch[1].trim()
        };
      }
      
      // Alternative pattern with line breaks
      const lines = modalText.split('\n');
      let username = null;
      let password = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('USUÁRIO') || line.includes('USUARIO') || line.includes('USERNAME')) {
          // Check same line first
          const sameLineMatch = line.match(/(?:USUÁRIO|USUARIO|USERNAME):\s*(.+)/i);
          if (sameLineMatch) {
            username = sameLineMatch[1].trim();
          } else if (i + 1 < lines.length) {
            // Check next line
            username = lines[i + 1].trim();
          }
        }
        
        if (line.includes('SENHA') || line.includes('PASSWORD')) {
          // Check same line first
          const sameLineMatch = line.match(/(?:SENHA|PASSWORD):\s*(.+)/i);
          if (sameLineMatch) {
            password = sameLineMatch[1].trim();
          } else if (i + 1 < lines.length) {
            // Check next line
            password = lines[i + 1].trim();
          }
        }
      }
      
      if (username && password) {
        return { username, password };
      }
    }
    
    // Try to find in any visible element
    const allElements = document.querySelectorAll('div, span, p, td, li');
    let username = null;
    let password = null;
    
    for (const element of allElements) {
      const text = element.textContent;
      
      if (!username) {
        const userMatch = text.match(/(?:USUÁRIO|USUARIO|USERNAME):\s*([^\s\n]+)/i);
        if (userMatch) {
          username = userMatch[1].trim();
        }
      }
      
      if (!password) {
        const passMatch = text.match(/(?:SENHA|PASSWORD):\s*([^\s\n]+)/i);
        if (passMatch) {
          password = passMatch[1].trim();
        }
      }
      
      if (username && password) {
        return { username, password };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Error extracting credentials:', error);
    return null;
  }
}

// Send credentials to server
async function sendCredentialsToServer(credentials) {
  try {
    const serverUrl = CONFIG.serverUrl || getCurrentDomain();
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
    console.log('Credentials sent to server:', result);
    return result;
    
  } catch (error) {
    console.error('Error sending to server:', error);
    throw error;
  }
}

// Generate single credential
async function generateSingleCredential() {
  try {
    console.log('Generating single credential...');
    
    // Perform the click sequence
    const credentials = await performGenerationSequence();
    
    // Send to server
    const serverResult = await sendCredentialsToServer(credentials);
    
    // Notify popup
    chrome.runtime.sendMessage({
      type: 'credentialGenerated',
      credentials: credentials,
      serverResult: serverResult
    });
    
    return { 
      success: true, 
      credentials: credentials,
      serverResult: serverResult
    };
    
  } catch (error) {
    console.error('Error generating credential:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Automation functions
let automationInterval = null;

async function startAutomation(config) {
  console.log('Starting automation with config:', config);
  
  CONFIG.isAutomationActive = true;
  CONFIG.currentQuantity = 0;
  CONFIG.targetQuantity = config.quantity || 10;
  
  // Save config
  chrome.storage.sync.set({ 
    automationConfig: {
      enabled: true,
      quantity: CONFIG.targetQuantity,
      intervalValue: config.intervalValue,
      intervalUnit: config.intervalUnit
    }
  });
  
  // Generate immediately
  await generateBatch();
  
  // Set up interval for future generations
  const intervalMs = config.intervalUnit === 'hours' 
    ? config.intervalValue * 60 * 60 * 1000 
    : config.intervalValue * 60 * 1000;
  
  automationInterval = setInterval(async () => {
    if (CONFIG.isAutomationActive) {
      CONFIG.currentQuantity = 0; // Reset counter
      await generateBatch();
    }
  }, intervalMs);
}

async function generateBatch() {
  console.log(`Generating batch of ${CONFIG.targetQuantity} credentials...`);
  
  for (let i = 0; i < CONFIG.targetQuantity; i++) {
    if (!CONFIG.isAutomationActive) {
      console.log('Automation stopped, aborting batch');
      break;
    }
    
    console.log(`Generating credential ${i + 1} of ${CONFIG.targetQuantity}`);
    
    try {
      const result = await generateSingleCredential();
      if (result.success) {
        CONFIG.currentQuantity++;
        
        // Notify popup of progress
        chrome.runtime.sendMessage({
          type: 'automationProgress',
          current: CONFIG.currentQuantity,
          total: CONFIG.targetQuantity
        });
      }
    } catch (error) {
      console.error(`Error generating credential ${i + 1}:`, error);
    }
    
    // Wait between generations to avoid overwhelming the system
    if (i < CONFIG.targetQuantity - 1) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds between each
    }
  }
  
  console.log(`Batch complete: Generated ${CONFIG.currentQuantity} of ${CONFIG.targetQuantity} credentials`);
}

function stopAutomation() {
  console.log('Stopping automation');
  
  CONFIG.isAutomationActive = false;
  
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
  
  // Save config
  chrome.storage.sync.set({ 
    automationConfig: {
      enabled: false,
      quantity: CONFIG.targetQuantity,
      intervalValue: 30,
      intervalUnit: 'minutes'
    }
  });
  
  // Notify popup
  chrome.runtime.sendMessage({
    type: 'automationStopped'
  });
}

// Check if we're on the correct page
function isOnCorrectPage() {
  const url = window.location.href;
  return url.includes('onlineoffice.zip') || url.includes('tv-on.site');
}

// Initialize
if (isOnCorrectPage()) {
  console.log('OnlineOffice IPTV Automator ready on:', window.location.href);
  
  // Notify popup that content script is ready
  chrome.runtime.sendMessage({
    type: 'contentScriptReady',
    url: window.location.href
  });
} else {
  console.log('Not on OnlineOffice page, extension inactive');
}