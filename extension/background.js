// Background service worker for NAS Download Manager extension
let ws = null;
let reconnectTimer = null;
let isConnected = false;
let serverUrl = null;
let apiKey = null;
let downloads = [];

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(() => {
    console.log('NAS Download Manager extension installed');
    createContextMenu();
    loadSettingsAndConnect();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Browser started, reconnecting...');
    loadSettingsAndConnect();
});

// Create context menu for right-click download
function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'download-with-nas',
            title: 'Download with NAS',
            contexts: ['link', 'video', 'audio', 'image']
        });
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'download-with-nas') {
        const url = info.linkUrl || info.srcUrl;
        if (url) {
            addDownload(url);
        }
    }
});

// Load settings and connect to server
async function loadSettingsAndConnect() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'apiKey']);

        if (result.serverUrl && result.apiKey) {
            serverUrl = result.serverUrl;
            apiKey = result.apiKey;
            connectWebSocket();
        } else {
            console.log('No server settings configured');
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        updateConnectionStatus(false);
    }
}

// Connect to WebSocket server
function connectWebSocket() {
    if (!serverUrl || !apiKey) {
        console.log('Cannot connect: missing server URL or API key');
        return;
    }

    // Close existing connection
    if (ws) {
        ws.close();
        ws = null;
    }

    try {
        // Convert http(s) URL to ws(s)
        const wsUrl = serverUrl.replace(/^http/, 'ws') + `/ws?api_key=${encodeURIComponent(apiKey)}`;
        console.log('Connecting to WebSocket:', wsUrl.replace(apiKey, '***'));

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            isConnected = true;
            updateConnectionStatus(true);

            // Clear reconnect timer
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            isConnected = false;
            updateConnectionStatus(false);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            isConnected = false;
            updateConnectionStatus(false);
            ws = null;

            // Attempt to reconnect after 5 seconds
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    reconnectTimer = null;
                    connectWebSocket();
                }, 5000);
            }
        };

    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        isConnected = false;
        updateConnectionStatus(false);
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
    console.log('WebSocket message received:', message.type);

    if (message.type === 'status') {
        // Server sends 'status' messages with downloads list
        downloads = message.downloads || [];
        console.log('Updated downloads array:', downloads.length, 'downloads');

        // Notify popup if it's open
        chrome.runtime.sendMessage({
            type: 'downloads_updated',
            downloads: downloads
        }).catch(() => {
            // Popup might not be open, ignore error
        });

    } else if (message.type === 'settings_update') {
        // Settings changed on server
        chrome.runtime.sendMessage({
            type: 'settings_updated',
            settings: message.settings
        }).catch(() => {
            // Popup might not be open, ignore error
        });

    } else if (message.type === 'auth_error') {
        console.error('Authentication failed:', message.message);
        isConnected = false;
        updateConnectionStatus(false);

        // Don't attempt reconnect on auth error
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    isConnected = connected;

    // Update badge
    chrome.action.setBadgeText({
        text: connected ? '' : '!'
    });

    chrome.action.setBadgeBackgroundColor({
        color: connected ? '#10b981' : '#ef4444'
    });

    // Notify options page if open
    chrome.runtime.sendMessage({
        type: 'connection_status_changed',
        connected: connected
    }).catch(() => {
        // Options page might not be open, ignore error
    });
}

// Add download via API
async function addDownload(url) {
    if (!serverUrl || !apiKey) {
        console.error('Cannot add download: not configured');
        showNotification('Not configured', 'Please configure server settings first');
        return;
    }

    try {
        const response = await fetch(`${serverUrl}/api/downloads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url: url,
                folder: ''  // Use default folder
            })
        });

        if (response.status === 401) {
            showNotification('Authentication failed', 'Invalid API key');
            return;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            showNotification('Download failed', error.error || `HTTP ${response.status}`);
            return;
        }

        const result = await response.json();
        showNotification('Download added', `Added: ${result.filename || url}`);

    } catch (error) {
        console.error('Failed to add download:', error);
        showNotification('Connection failed', 'Cannot reach server');
    }
}

// Show notification
function showNotification(title, message) {
    try {
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: title,
                message: message
            });
        } else {
            console.log('Notification:', title, '-', message);
        }
    } catch (error) {
        console.error('Failed to show notification:', error);
        console.log('Notification:', title, '-', message);
    }
}

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settings_updated') {
        // Settings changed, reconnect
        loadSettingsAndConnect();
        sendResponse({ success: true });

    } else if (message.type === 'get_connection_status') {
        sendResponse({ connected: isConnected });

    } else if (message.type === 'get_downloads') {
        console.log('Popup requested downloads, sending:', downloads.length, 'downloads');
        sendResponse({ downloads: downloads });

    } else if (message.type === 'add_download') {
        addDownload(message.url);
        sendResponse({ success: true });

    } else if (message.type === 'pause_download') {
        pauseDownload(message.id);
        sendResponse({ success: true });

    } else if (message.type === 'resume_download') {
        resumeDownload(message.id);
        sendResponse({ success: true });

    } else if (message.type === 'cancel_download') {
        cancelDownload(message.id);
        sendResponse({ success: true });
    }

    return true; // Keep message channel open for async response
});

// Pause download
async function pauseDownload(id) {
    if (!serverUrl || !apiKey) return;

    try {
        await fetch(`${serverUrl}/api/downloads/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'pause' })
        });
    } catch (error) {
        console.error('Failed to pause download:', error);
    }
}

// Resume download
async function resumeDownload(id) {
    if (!serverUrl || !apiKey) return;

    try {
        await fetch(`${serverUrl}/api/downloads/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'resume' })
        });
    } catch (error) {
        console.error('Failed to resume download:', error);
    }
}

// Cancel download
async function cancelDownload(id) {
    if (!serverUrl || !apiKey) return;

    try {
        await fetch(`${serverUrl}/api/downloads/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (error) {
        console.error('Failed to cancel download:', error);
    }
}
