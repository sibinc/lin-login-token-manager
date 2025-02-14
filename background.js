// Debug logging function
function debugLog(message, data) {
  console.log(`[Auth Extension] ${message}`, data || '');
  
  // Store debug logs for popup access
  chrome.storage.local.get(['debugLogs'], function(result) {
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

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getDebugLogs') {
    chrome.storage.local.get(['debugLogs'], function(result) {
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
    
    makeLoginRequest(request.credentials)
      .then(result => {
        debugLog('Login request result', {
          success: result.success,
          responseData: result.data ? {
            success: result.data.success,
            message: result.data.message,
            hasToken: result.data.data && result.data.data.accessToken ? 'yes' : 'no'
          } : null
        });
        sendResponse(result);
      })
      .catch(error => {
        debugLog('Login request error', error.message);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Indicates we'll respond asynchronously
  }
});

async function makeLoginRequest(credentials) {
  try {
    debugLog('Sending XHR request');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://localhost/academics/api/v1/auth/staff-login-credentials', true);
      
      // Set headers
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', '*/*');
      xhr.setRequestHeader('Origin', 'http://localhost');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      
      // Include credentials (cookies, if any)
      xhr.withCredentials = true;
      
      xhr.onload = function() {
        debugLog('XHR response received', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseHeaders: xhr.getAllResponseHeaders()
        });
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ success: true, data });
          } catch (e) {
            reject(new Error('Failed to parse response: ' + e.message));
          }
        } else {
          reject(new Error('Server returned status ' + xhr.status + ': ' + xhr.responseText));
        }
      };
      
      xhr.onerror = function() {
        debugLog('XHR error occurred', {
          readyState: xhr.readyState,
          status: xhr.status,
          statusText: xhr.statusText
        });
        reject(new Error('Network error occurred'));
      };
      
      debugLog('XHR request details', {
        url: 'http://localhost/academics/api/v1/auth/staff-login-credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Origin': 'http://localhost',
          'Cache-Control': 'no-cache'
        },
        withCredentials: true
      });
      
      xhr.send(JSON.stringify(credentials));
    });
  } catch (error) {
    debugLog('Login request exception', error.message);
    throw error;
  }
}

async function storeTokenInLocalhost(token) {
  debugLog('Finding localhost:8080 tabs');
  try {
    // Find all localhost:8080 tabs
    const tabs = await chrome.tabs.query({ url: 'http://localhost:8080/*' });
    
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
