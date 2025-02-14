// Debug logging function
function debugLog(message, data) {
  console.log(`[Auth Extension] ${message}`, data || '');

  // Store debug logs for popup access
  chrome.storage.local.get(['debugLogs'], function (result) {
    const logs = result.debugLogs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      message,
      data: data ? JSON.stringify(data) : null
    });

    // Keep only the last 50 logs
    if (logs.length > 50) {
      logs.shift();
    }

    chrome.storage.local.set({ debugLogs: logs });
  });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'getDebugLogs') {
    chrome.storage.local.get(['debugLogs'], function (result) {
      sendResponse({ logs: result.debugLogs || [] });
    });
    return true;
  }

  if (request.action === 'clearDebugLogs') {
    chrome.storage.local.set({ debugLogs: [] });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'storeToken') {
    debugLog('Storing token request received', { token: request.token.substring(0, 10) + '...' });
    storeTokenInLocalhost(request.token)
      .then(result => {
        debugLog('Store token result', result);
        sendResponse(result);
      })
      .catch(error => {
        debugLog('Store token error', error.message);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Indicates we'll respond asynchronously
  }

  if (request.action === 'loginRequest') {
    debugLog('Login request received', {
      userType: request.credentials.userType,
      username: request.credentials.username
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }

      const activeTab = tabs[0];
      if (activeTab.url.startsWith('chrome://')) {
        sendResponse({ success: false, error: 'Cannot access a chrome:// URL' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          debugLog('Error injecting content script', chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: 'makeLoginRequest', credentials: request.credentials }, function (response) {
          if (chrome.runtime.lastError) {
            debugLog('Error sending message to content script', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          debugLog('Login request result', response);
          sendResponse(response);
        });
      });
    });

    return true; // Indicates we'll respond asynchronously
  }
});

async function storeTokenInLocalhost(token) {
  debugLog('Finding localhost:8080 tabs');
  try {
    // Find all localhost:8080 tabs
    const tabs = await chrome.tabs.query({ url: ['http://localhost:8080/*', 'http://[::1]:8080/*'] });

    if (tabs.length === 0) {
      debugLog('No localhost:8080 tabs found');
      throw new Error('No active tab found for localhost:8080');
    }

    debugLog(`Found ${tabs.length} localhost:8080 tabs`);

    // Execute script in the first matched tab
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: injectToken,
      args: [token]
    });

    debugLog('Token injection executed successfully');
    return { success: true, token: token };
  } catch (error) {
    debugLog('Error storing token', error.message);
    return { success: false, error: error.message };
  }
}

function injectToken(token) {
  try {
    localStorage.setItem('token', token);
    // Return the full token for debugging
    return { success: true, token: token };
  } catch (e) {
    console.error('Error setting localStorage:', e);
    return { success: false, error: e.toString() };
  }
}