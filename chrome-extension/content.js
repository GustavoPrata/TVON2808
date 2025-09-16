// OnlineOffice IPTV Automator - Content Script
console.log('OnlineOffice IPTV Automator: Content script loaded');

// Configuration
const CONFIG = {
  checkInterval: 1000, // Check every 1 second for elements
  maxRetries: 30, // Max attempts to find elements
  serverUrl: '', // Will be set from storage
  autoGenerate: false // Will be set from storage
};

// Load configuration from storage
chrome.storage.sync.get(['serverUrl', 'autoGenerate'], (result) => {
  CONFIG.serverUrl = result.serverUrl || 'http://localhost:5000';
  CONFIG.autoGenerate = result.autoGenerate || false;
  console.log('Configuration loaded:', CONFIG);
  
  // Start monitoring if auto-generate is enabled
  if (CONFIG.autoGenerate) {
    startMonitoring();
  }
});

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'generateCredentials') {
    generateCredentials().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'startMonitoring') {
    startMonitoring();
    sendResponse({ success: true, message: 'Monitoring started' });
  }
  
  if (request.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({ success: true, message: 'Monitoring stopped' });
  }
  
  if (request.action === 'getStatus') {
    sendResponse({ 
      success: true, 
      isMonitoring: isMonitoring,
      lastCredentials: lastGeneratedCredentials 
    });
  }
});

// Variables to track state
let isMonitoring = false;
let monitoringInterval = null;
let lastGeneratedCredentials = null;

// Function to find and click the generate button
async function clickGenerateButton() {
  console.log('Looking for generate button...');
  
  // Try different selectors that might match the button
  const selectors = [
    'button:contains("Gerar IPTV")',
    'button:contains("Gerar")',
    'button:contains("Generate")',
    'button.generate-iptv',
    'button#generate-iptv',
    '[data-action="generate-iptv"]',
    'button.btn-primary:contains("Gerar")',
    'button.btn:contains("IPTV")',
    // More generic selectors
    'button.btn-success',
    'button.btn-primary'
  ];
  
  // First try with text content
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('gerar') && text.includes('iptv')) {
      console.log('Found button by text content:', button);
      button.click();
      return true;
    }
    if (text.includes('generate') && text.includes('iptv')) {
      console.log('Found button by text content:', button);
      button.click();
      return true;
    }
    if (text === 'gerar' || text === 'generate') {
      console.log('Found generic generate button:', button);
      button.click();
      return true;
    }
  }
  
  // Try CSS selectors
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found button with selector:', selector);
        element.click();
        return true;
      }
    } catch (e) {
      // Some selectors might be invalid, ignore
    }
  }
  
  console.log('Generate button not found');
  return false;
}

// Function to extract credentials from the page
async function extractCredentials() {
  console.log('Extracting credentials...');
  
  // Wait a bit for the credentials to appear
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Try to find credential elements
  const credentialSelectors = {
    username: [
      'input[name="username"]',
      'input[name="usuario"]',
      'input[name="user"]',
      'input#username',
      'input#usuario',
      'input.username',
      '[data-field="username"]',
      'input[type="text"]:not([type="password"])'
    ],
    password: [
      'input[name="password"]',
      'input[name="senha"]',
      'input[name="pass"]',
      'input#password',
      'input#senha',
      'input.password',
      '[data-field="password"]',
      'input[type="password"]'
    ]
  };
  
  let username = null;
  let password = null;
  
  // Try to find username
  for (const selector of credentialSelectors.username) {
    const element = document.querySelector(selector);
    if (element && element.value) {
      username = element.value;
      console.log('Found username:', username);
      break;
    }
  }
  
  // Try to find password
  for (const selector of credentialSelectors.password) {
    const element = document.querySelector(selector);
    if (element && element.value) {
      password = element.value;
      console.log('Found password:', password);
      break;
    }
  }
  
  // Alternative: Look for text in divs/spans that might contain credentials
  if (!username || !password) {
    const allTexts = document.querySelectorAll('div, span, p, td');
    for (const element of allTexts) {
      const text = element.textContent;
      
      // Look for patterns like "Usuário: xxxxx" or "Username: xxxxx"
      const userMatch = text.match(/(?:usuário|usuario|username|user):\s*(\S+)/i);
      if (userMatch && !username) {
        username = userMatch[1];
      }
      
      // Look for patterns like "Senha: xxxxx" or "Password: xxxxx"
      const passMatch = text.match(/(?:senha|password|pass):\s*(\S+)/i);
      if (passMatch && !password) {
        password = passMatch[1];
      }
    }
  }
  
  // Check for modal or popup with credentials
  const modals = document.querySelectorAll('.modal, .popup, .dialog, [role="dialog"]');
  for (const modal of modals) {
    if (modal.style.display !== 'none') {
      const modalText = modal.textContent;
      
      const userMatch = modalText.match(/(?:usuário|usuario|username|user):\s*(\S+)/i);
      if (userMatch && !username) {
        username = userMatch[1];
      }
      
      const passMatch = modalText.match(/(?:senha|password|pass):\s*(\S+)/i);
      if (passMatch && !password) {
        password = passMatch[1];
      }
    }
  }
  
  if (username && password) {
    return { username, password };
  }
  
  return null;
}

// Main function to generate credentials
async function generateCredentials() {
  try {
    console.log('Starting credential generation...');
    
    // Click the generate button
    const buttonClicked = await clickGenerateButton();
    if (!buttonClicked) {
      throw new Error('Could not find generate button');
    }
    
    // Wait and extract credentials
    const credentials = await extractCredentials();
    if (!credentials) {
      throw new Error('Could not extract credentials');
    }
    
    console.log('Credentials extracted:', credentials);
    lastGeneratedCredentials = credentials;
    
    // Send to server if configured
    if (CONFIG.serverUrl) {
      await sendCredentialsToServer(credentials);
    }
    
    // Send to extension popup
    chrome.runtime.sendMessage({
      type: 'credentialsGenerated',
      credentials: credentials
    });
    
    return { success: true, credentials };
    
  } catch (error) {
    console.error('Error generating credentials:', error);
    throw error;
  }
}

// Send credentials to server
async function sendCredentialsToServer(credentials) {
  try {
    const response = await fetch(`${CONFIG.serverUrl}/api/office/save-credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usuario: credentials.username,
        senha: credentials.password,
        vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        source: 'chrome-extension'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    console.log('Credentials sent to server successfully');
    return true;
    
  } catch (error) {
    console.error('Error sending to server:', error);
    // Don't throw, just log - credentials were still generated
    return false;
  }
}

// Monitoring functions
function startMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  console.log('Starting automatic monitoring...');
  
  monitoringInterval = setInterval(() => {
    // Check if we're on the right page
    if (document.readyState === 'complete') {
      // Look for indicators that we can generate
      const canGenerate = checkIfCanGenerate();
      if (canGenerate) {
        generateCredentials().catch(console.error);
      }
    }
  }, CONFIG.checkInterval);
}

function stopMonitoring() {
  if (!isMonitoring) return;
  
  isMonitoring = false;
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  console.log('Monitoring stopped');
}

function checkIfCanGenerate() {
  // Check if generate button exists and is enabled
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if ((text.includes('gerar') || text.includes('generate')) && 
        !button.disabled && 
        button.offsetParent !== null) {
      return true;
    }
  }
  return false;
}

// Inject helper to detect page changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('Page changed:', url);
    
    // Notify extension of page change
    chrome.runtime.sendMessage({
      type: 'pageChanged',
      url: url
    });
  }
}).observe(document, { subtree: true, childList: true });

// Log that we're ready
console.log('OnlineOffice IPTV Automator ready!');