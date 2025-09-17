// TV ON Office Chrome Extension - Content Script
// This script runs in the context of OnlineOffice pages

// Configuration
const CONFIG = {
  serverUrl: '', // Will be set dynamically based on current domain
  extractionDelay: 1000, // Wait 1 second after modal appears
  maxRetries: 5,
  retryDelay: 2000
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
    console.log('[Extension] Starting automation...');
    startAutomation()
      .then(result => {
        console.log('[Extension] Automation completed:', result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('[Extension] Automation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'extractCredentials') {
    console.log('[Extension] Extracting credentials only...');
    const credentials = extractCredentialsFromModal();
    if (credentials) {
      sendResponse({ success: true, data: credentials });
    } else {
      sendResponse({ success: false, error: 'No credentials found' });
    }
  }
});

// Main automation function
async function startAutomation() {
  try {
    // Check if we're on the right page
    if (!window.location.href.includes('onlineoffice')) {
      throw new Error('Not on OnlineOffice page. Please navigate to the correct page.');
    }
    
    console.log('[Extension] Starting credential generation sequence...');
    
    // Perform the generation sequence
    const credentials = await performGenerationSequence();
    
    if (!credentials) {
      throw new Error('Failed to extract credentials');
    }
    
    // Send to server
    await sendCredentialsToServer(credentials);
    
    return credentials;
    
  } catch (error) {
    console.error('[Extension] Automation error:', error);
    throw error;
  }
}

// Helper function to wait for element with specific text
function waitForElementWithText(text, tagName = '*', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      // Find all elements of the specified tag
      const elements = document.querySelectorAll(tagName);
      
      for (const element of elements) {
        const elementText = element.textContent || element.innerText || '';
        if (elementText.trim() === text || elementText.includes(text)) {
          // Check if element is visible
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            resolve(element);
            return;
          }
        }
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for element with text: ${text}`));
        return;
      }
      
      // Try again
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

// SIMPLIFIED Extract credentials from modal
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
  
  // Monitor for credential modals
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.innerText || node.textContent || '';
            if (text.includes('USUÁRIO') && text.includes('SENHA')) {
              console.log('[Extension] Credential modal detected!');
            }
          }
        }
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}