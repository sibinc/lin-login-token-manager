chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'makeLoginRequest') {
    makeLoginRequest(request.credentials)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Indicates we'll respond asynchronously
  }
});

async function makeLoginRequest(credentials) {
  try {
    const response = await fetch('http://localhost/academics/api/v1/auth/staff-login-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Origin': 'http://localhost',
        'Cache-Control': 'no-cache'
      },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const errorText = await response.text();
      throw new Error('Server returned status ' + response.status + ': ' + errorText);
    }
  } catch (error) {
    throw error;
  }
}