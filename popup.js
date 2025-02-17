document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const statusMessage = document.getElementById('status-message');
  const tokenDisplay = document.getElementById('token-display');
  const debugToggle = document.getElementById('debug-toggle');
  const debugLogs = document.getElementById('debug-logs');
  const clearLogsBtn = document.getElementById('clear-logs');
  
  // Initialize debug panel
  if (debugToggle) {
    debugToggle.addEventListener('click', function() {
      const debugPanel = document.getElementById('debug-panel');
      if (debugPanel.classList.contains('hidden')) {
        debugPanel.classList.remove('hidden');
        loadDebugLogs();
      } else {
        debugPanel.classList.add('hidden');
      }
    });
  }
  
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: 'clearDebugLogs' }, function() {
        debugLogs.innerHTML = '<p>Logs cleared</p>';
      });
    });
  }
  
  function loadDebugLogs() {
    chrome.runtime.sendMessage({ action: 'getDebugLogs' }, function(response) {
      if (response && response.logs) {
        debugLogs.innerHTML = '';
        response.logs.forEach(log => {
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry';
          logEntry.innerHTML = `
            <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
            <span class="log-message">${log.message}</span>
            ${log.data ? `<pre class="log-data">${log.data}</pre>` : ''}
          `;
          debugLogs.appendChild(logEntry);
        });
        // Scroll to bottom
        debugLogs.scrollTop = debugLogs.scrollHeight;
      }
    });
  }
  
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
  // Load the URL in the current tab
  chrome.tabs.update({ url: 'http://localhost:8080/examcontroller/home?redir=true' });
  // Wait for 1 second before proceeding
  await new Promise(resolve => setTimeout(resolve, 1000));
    const userType = document.getElementById('userType').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Clear previous status and token display
    statusMessage.textContent = '';
    statusMessage.className = '';
    tokenDisplay.textContent = '';
    tokenDisplay.className = 'hidden';
    
    try {
      // Send login request to background script
      chrome.runtime.sendMessage({
        action: 'loginRequest',
        credentials: {
          username,
          password,
          next: '',
          userType
        }
      }, function(response) {
        if (response.success && response.data.success && response.data.data.validLogin) {
          const accessToken = response.data.data.accessToken;
          
          // Display the token
          // tokenDisplay.textContent = `Token: ${accessToken}`;
            let countdown = 1;
            tokenDisplay.innerHTML = `Redirecting in ${countdown} sec...`;
            const timer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
              tokenDisplay.innerHTML = `Redirecting in ${countdown} sec...`;
            } else {
              clearInterval(timer);
              tokenDisplay.innerHTML = `Login successful!.`;
            }
            }, 1000);
          tokenDisplay.className = 'token-box success';
            // Send message to background script to store token
            chrome.runtime.sendMessage({
            action: 'storeToken',
            token: accessToken
            }, function(tokenResponse) {
            if (tokenResponse && tokenResponse.success) {
              // showStatus('Login successful!.', 'success');
              // Reload the URL in the current tab
              chrome.tabs.update({ url: 'http://localhost:8080/examcontroller/home?redir=true' });
              // If debug panel is open, refresh logs
              if (!document.getElementById('debug-panel').classList.contains('hidden')) {
              loadDebugLogs();
              }
            } else {
              showStatus('Error: ' + (tokenResponse?.error || 'Failed to store token'), 'error');
            }
            });
        } else {
          const errorMsg = response.data?.message || response.error || 'Invalid credentials';
          showStatus('Login failed: ' + errorMsg, 'error');
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  });
  
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
  }
});
