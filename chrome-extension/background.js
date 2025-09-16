// Background script for OnlineOffice IPTV Automator

// Keep track of connected tabs
const connectedTabs = new Set();

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('OnlineOffice IPTV Automator installed');
  
  // Set default configuration
  chrome.storage.sync.set({
    serverUrl: 'http://localhost:5000',
    autoGenerate: false,
    lastCredentials: null
  });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's OnlineOffice
    if (tab.url.includes('onlineoffice.zip')) {
      // Inject content script if needed
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => {
        // Script might already be injected
        console.log('Content script already injected or error:', err);
      });
      
      connectedTabs.add(tabId);
      
      // Update extension badge
      chrome.action.setBadgeText({ text: 'ON', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
    } else {
      connectedTabs.delete(tabId);
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.type === 'credentialsGenerated') {
    // Store the credentials
    chrome.storage.sync.set({ lastCredentials: request.credentials });
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Credenciais IPTV Geradas!',
      message: `Usuário: ${request.credentials.username}\nSenha: ${request.credentials.password}`,
      priority: 2
    });
    
    // Forward to popup if open
    chrome.runtime.sendMessage({
      type: 'credentialsGenerated',
      credentials: request.credentials
    }).catch(() => {
      // Popup might not be open
    });
  }
  
  if (request.type === 'pageChanged') {
    console.log('Page changed to:', request.url);
  }
});

// Handle connections from popup
chrome.runtime.onConnect.addListener((port) => {
  console.log('Popup connected');
  
  port.onMessage.addListener((msg) => {
    if (msg.action === 'getConnectedTabs') {
      port.postMessage({
        type: 'connectedTabs',
        tabs: Array.from(connectedTabs)
      });
    }
  });
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  connectedTabs.delete(tabId);
});

// Function to check if extension has access to OnlineOffice
async function checkOnlineOfficeAccess() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://onlineoffice.zip/*' });
    return tabs.length > 0;
  } catch (error) {
    console.error('Error checking OnlineOffice access:', error);
    return false;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkOnlineOfficeAccess };
}