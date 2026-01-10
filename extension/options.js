// Load saved settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    updateConnectionStatus();
});

// Save settings
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const serverUrl = document.getElementById('serverUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();

    // Validate URL format
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        showStatus('Server URL must start with http:// or https://', 'error');
        return;
    }

    // Remove trailing slash from URL
    const cleanUrl = serverUrl.replace(/\/$/, '');

    try {
        // Request permission for the server URL
        const origin = new URL(cleanUrl).origin + '/*';
        const granted = await chrome.permissions.request({
            origins: [origin]
        });

        if (!granted) {
            showStatus('Permission denied. The extension needs access to your server URL to function.', 'error');
            return;
        }

        // Save to Chrome storage
        await chrome.storage.sync.set({
            serverUrl: cleanUrl,
            apiKey: apiKey
        });

        showStatus('Settings saved successfully!', 'success');

        // Notify background script to reconnect
        chrome.runtime.sendMessage({ type: 'settings_updated' });

        // Update connection status after a short delay
        setTimeout(updateConnectionStatus, 1000);
    } catch (error) {
        showStatus('Failed to save settings: ' + error.message, 'error');
    }
});

// Test connection
document.getElementById('testConnection').addEventListener('click', async () => {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!serverUrl || !apiKey) {
        showStatus('Please enter both server URL and API key', 'error');
        return;
    }

    // Remove trailing slash
    const cleanUrl = serverUrl.replace(/\/$/, '');

    try {
        showStatus('Testing connection...', 'success');

        console.log('Testing connection to:', cleanUrl);
        console.log('Using API key:', apiKey.substring(0, 4) + '...');

        // Check if we have permission for this URL
        const origin = new URL(cleanUrl).origin + '/*';
        const hasPermission = await chrome.permissions.contains({ origins: [origin] });

        if (!hasPermission) {
            // Request permission
            const granted = await chrome.permissions.request({ origins: [origin] });
            if (!granted) {
                showStatus('Permission denied. Cannot test connection without access to the server URL.', 'error');
                return;
            }
        }

        // Test by fetching server status
        const response = await fetch(`${cleanUrl}/api/downloads`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        console.log('Response status:', response.status);

        if (response.status === 401) {
            showStatus('Authentication failed: Invalid API key', 'error');
            console.error('401 Unauthorized - API key is incorrect');
            return;
        }

        if (!response.ok) {
            showStatus(`Connection failed: HTTP ${response.status}`, 'error');
            console.error('HTTP error:', response.status, response.statusText);
            return;
        }

        // Try to parse response
        const data = await response.json();
        console.log('Connection test successful:', data);
        showStatus('Connection successful! Server is reachable.', 'success');

    } catch (error) {
        console.error('Connection test error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showStatus('Connection failed: Cannot reach server. Check URL and network.', 'error');
        } else {
            showStatus('Connection failed: ' + error.message, 'error');
        }
    }
});

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'apiKey']);

        if (result.serverUrl) {
            document.getElementById('serverUrl').value = result.serverUrl;
        }

        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Update connection status indicator
async function updateConnectionStatus() {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');

    try {
        // Check if background script reports connected
        const response = await chrome.runtime.sendMessage({ type: 'get_connection_status' });

        if (response && response.connected) {
            indicator.classList.add('connected');
            indicator.classList.remove('disconnected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.add('disconnected');
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    } catch (error) {
        indicator.classList.add('disconnected');
        indicator.classList.remove('connected');
        text.textContent = 'Not connected';
    }
}

// Listen for connection status updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'connection_status_changed') {
        updateConnectionStatus();
    }
});
