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
  
  // When on OnlineOffice site, use the stored server URL or default
  if (hostname.includes('onlineoffice')) {
    // Try to get from storage first
    if (CONFIG.serverUrl) {
      return CONFIG.serverUrl;
    }
    // Default to tv-on.site if not configured
    return 'https://tv-on.site';
  }
  
  // When testing locally
  if (hostname.includes('localhost')) {
    return 'http://localhost:5000';
  }
  
  // When on Replit domains
  if (hostname.includes('replit.app') || hostname.includes('replit.dev')) {
    // Get the actual Replit server origin, not the current page origin
    const origin = window.location.origin;
    // If we're on a Replit domain, it's likely the server URL
    return origin;
  }
  
  // When on tv-on.site
  if (hostname.includes('tv-on.site')) {
    return 'https://tv-on.site';
  }
  
  // Default: Use stored server URL or current origin
  return CONFIG.serverUrl || window.location.origin;
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
    const modals = document.querySelectorAll('.modal, .modal-body, .modal-content, [role="dialog"], .popup, .dialog, .swal2-container, .swal2-modal');
    
    for (const modal of modals) {
      // Skip if modal is hidden
      if (modal.style.display === 'none' || modal.style.visibility === 'hidden') {
        continue;
      }
      
      const modalText = modal.innerText || modal.textContent;
      console.log('Checking modal text:', modalText);
      
      // Method 1: Look for specific elements containing labels and values
      const allElements = modal.querySelectorAll('div, span, p, td, li, strong, b, label');
      let username = null;
      let password = null;
      let foundUserLabel = false;
      let foundPassLabel = false;
      
      for (const element of allElements) {
        const text = (element.textContent || '').trim();
        const nextSibling = element.nextSibling;
        const nextElement = element.nextElementSibling;
        
        // Check if this element contains the label
        if (text.includes('USUÁRIO:') || text === 'USUÁRIO') {
          foundUserLabel = true;
          // Try to extract from same element after colon
          const colonMatch = text.match(/USUÁRIO:\s*(.+)/);
          if (colonMatch && colonMatch[1].trim()) {
            username = colonMatch[1].trim();
          } else if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
            // Check text node after element
            username = nextSibling.textContent.trim();
          } else if (nextElement) {
            // Check next element
            username = nextElement.textContent.trim();
          }
        }
        
        if (text.includes('SENHA:') || text === 'SENHA') {
          foundPassLabel = true;
          // Try to extract from same element after colon
          const colonMatch = text.match(/SENHA:\s*(.+)/);
          if (colonMatch && colonMatch[1].trim()) {
            password = colonMatch[1].trim();
          } else if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
            // Check text node after element
            password = nextSibling.textContent.trim();
          } else if (nextElement) {
            // Check next element
            password = nextElement.textContent.trim();
          }
        }
        
        // If we found labels but no values, check if current element might be a value
        if (foundUserLabel && !username && !text.includes('USUÁRIO') && !text.includes('SENHA') && text.length > 0) {
          username = text;
          foundUserLabel = false;
        }
        if (foundPassLabel && !password && !text.includes('SENHA') && !text.includes('VENCIMENTO') && text.length > 0) {
          password = text;
          foundPassLabel = false;
        }
      }
      
      if (username && password) {
        console.log('Found credentials using element parsing:', { username, password });
        return { username, password };
      }
      
      // Method 2: Try regex on full text
      const userMatch = modalText.match(/USUÁRIO:\s*([^\s\n]+)/);
      const passMatch = modalText.match(/SENHA:\s*([^\s\n]+)/);
      
      if (userMatch && passMatch) {
        console.log('Found credentials using regex:', { username: userMatch[1], password: passMatch[1] });
        return {
          username: userMatch[1].trim(),
          password: passMatch[1].trim()
        };
      }
      
      // Method 3: Try line-by-line parsing
      const lines = modalText.split(/[\n\r]+/);
      username = null;
      password = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for username
        if (line.includes('USUÁRIO')) {
          // Try to extract from same line
          const colonMatch = line.match(/USUÁRIO:\s*(.+)/);
          if (colonMatch && colonMatch[1].trim()) {
            username = colonMatch[1].trim();
          } else {
            // Look for next non-empty, non-label line
            for (let j = i + 1; j < lines.length && j < i + 5; j++) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.includes(':') && !nextLine.includes('SENHA') && !nextLine.includes('VENCIMENTO')) {
                username = nextLine;
                break;
              }
            }
          }
        }
        
        // Check for password
        if (line.includes('SENHA')) {
          // Try to extract from same line
          const colonMatch = line.match(/SENHA:\s*(.+)/);
          if (colonMatch && colonMatch[1].trim()) {
            password = colonMatch[1].trim();
          } else {
            // Look for next non-empty, non-label line
            for (let j = i + 1; j < lines.length && j < i + 5; j++) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.includes(':') && !nextLine.includes('VENCIMENTO')) {
                password = nextLine;
                break;
              }
            }
          }
        }
      }
      
      if (username && password) {
        console.log('Found credentials using line parsing:', { username, password });
        return { username, password };
      }
    }
    
    // Method 4: Last resort - try to find in any visible element on page
    const allElements = document.querySelectorAll('div, span, p, td, li, strong, b');
    let username = null;
    let password = null;
    let userLabelFound = false;
    let passLabelFound = false;
    
    for (const element of allElements) {
      const text = (element.textContent || '').trim();
      
      // Check if element is visible
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      
      if (text === 'USUÁRIO:' || text === 'USUÁRIO') {
        userLabelFound = true;
      } else if (userLabelFound && !username && text && !text.includes(':')) {
        username = text;
        userLabelFound = false;
      } else if (text.includes('USUÁRIO:')) {
        const match = text.match(/USUÁRIO:\s*(.+)/);
        if (match && match[1].trim()) {
          username = match[1].trim();
        }
      }
      
      if (text === 'SENHA:' || text === 'SENHA') {
        passLabelFound = true;
      } else if (passLabelFound && !password && text && !text.includes(':') && !text.includes('VENCIMENTO')) {
        password = text;
        passLabelFound = false;
      } else if (text.includes('SENHA:')) {
        const match = text.match(/SENHA:\s*(.+)/);
        if (match && match[1].trim()) {
          password = match[1].trim();
        }
      }
      
      if (username && password) {
        console.log('Found credentials in page elements:', { username, password });
        return { username, password };
      }
    }
    
    console.log('Could not extract credentials - no matching patterns found');
    return null;
    
  } catch (error) {
    console.error('Error extracting credentials:', error);
    return null;
  }
}

// Send credentials to server
async function sendCredentialsToServer(credentials) {
  try {
    // Always prefer CONFIG.serverUrl if it's set
    const serverUrl = CONFIG.serverUrl ? CONFIG.serverUrl : getCurrentDomain();
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