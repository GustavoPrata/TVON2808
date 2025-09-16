// Background script for OnlineOffice IPTV Automator

// Keep track of automation state
let automationState = {
  enabled: false,
  config: null,
  tabId: null
};

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('OnlineOffice IPTV Automator installed');
  
  // Set default configuration
  chrome.storage.sync.set({
    serverUrl: '',
    automationConfig: {
      enabled: false,
      quantity: 10,
      intervalValue: 30,
      intervalUnit: 'minutes'
    },
    lastCredentials: null
  });
});

// Listen for alarms (for automation)
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  if (alarm.name === 'automation' && automationState.enabled) {
    // Send message to content script to generate batch
    if (automationState.tabId) {
      chrome.tabs.sendMessage(automationState.tabId, {
        action: 'generateBatch',
        config: automationState.config
      }).catch(err => {
        console.error('Error sending to content script:', err);
        // Stop automation if tab is closed
        stopAutomation();
      });
    }
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.type === 'startAutomation') {
    startAutomation(request.config, sender.tab?.id);
    sendResponse({ success: true });
  }
  
  if (request.type === 'stopAutomation') {
    stopAutomation();
    sendResponse({ success: true });
  }
  
  if (request.type === 'credentialGenerated') {
    // Store the credentials
    chrome.storage.sync.set({ lastCredentials: request.credentials });
    
    // Forward to popup if open
    chrome.runtime.sendMessage({
      type: 'credentialGenerated',
      credentials: request.credentials,
      serverResult: request.serverResult
    }).catch(() => {
      // Popup might not be open
    });
  }
  
  if (request.type === 'automationProgress') {
    // Forward to popup
    chrome.runtime.sendMessage({
      type: 'automationProgress',
      current: request.current,
      total: request.total
    }).catch(() => {
      // Popup might not be open
    });
  }
  
  if (request.type === 'contentScriptReady') {
    console.log('Content script ready on:', request.url);
    
    // Check if automation should be resumed
    chrome.storage.sync.get(['automationConfig'], (result) => {
      if (result.automationConfig?.enabled && sender.tab?.id) {
        automationState.tabId = sender.tab.id;
        // Content script will handle resuming automation
      }
    });
  }
});

// Start automation
function startAutomation(config, tabId) {
  console.log('Starting automation with config:', config);
  
  automationState = {
    enabled: true,
    config: config,
    tabId: tabId
  };
  
  // Clear any existing alarm
  chrome.alarms.clear('automation');
  
  // Set up recurring alarm
  const intervalMinutes = config.intervalUnit === 'hours' 
    ? config.intervalValue * 60 
    : config.intervalValue;
  
  chrome.alarms.create('automation', {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });
  
  console.log(`Automation alarm set for every ${intervalMinutes} minutes`);
  
  // Update badge
  if (tabId) {
    chrome.action.setBadgeText({ text: 'AUTO', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
  }
}

// Stop automation
function stopAutomation() {
  console.log('Stopping automation');
  
  automationState = {
    enabled: false,
    config: null,
    tabId: null
  };
  
  // Clear alarm
  chrome.alarms.clear('automation');
  
  // Update storage
  chrome.storage.sync.get(['automationConfig'], (result) => {
    if (result.automationConfig) {
      chrome.storage.sync.set({
        automationConfig: {
          ...result.automationConfig,
          enabled: false
        }
      });
    }
  });
  
  // Clear badge
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
    }
  });
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's OnlineOffice
    const isOnlineOffice = tab.url.includes('onlineoffice.zip') || tab.url.includes('tv-on.site');
    
    if (isOnlineOffice) {
      // Update badge
      chrome.action.setBadgeText({ text: 'ON', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId: tabId });
      
      // Check if this is the automation tab
      if (automationState.enabled && automationState.tabId === tabId) {
        chrome.action.setBadgeText({ text: 'AUTO', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tabId });
      }
    } else {
      // Clear badge
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      
      // Stop automation if this was the automation tab
      if (automationState.tabId === tabId) {
        stopAutomation();
      }
    }
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Stop automation if the automation tab is closed
  if (automationState.tabId === tabId) {
    stopAutomation();
  }
});

// Handle extension icon click (open popup)
chrome.action.onClicked.addListener((tab) => {
  // The popup will open automatically if defined in manifest
  console.log('Extension icon clicked');
});

// Export for service worker
export { startAutomation, stopAutomation };