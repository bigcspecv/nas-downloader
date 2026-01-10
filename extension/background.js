// Background service worker for nas-downloader Chrome extension
let ws = null;
let reconnectTimer = null;
let isConnected = false;
let serverUrl = null;
let apiKey = null;
let downloads = [];
let globalPaused = false;
let interceptEnabled = true; // Default to enabled

// Parse filename from URL (strip query params, decode URL encoding)
function parseFilenameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;
        let filename = pathname.split('/').pop();
        if (!filename) {
            return '';
        }
        // Decode URL-encoded characters (e.g., %20 -> space)
        filename = decodeURIComponent(filename);
        return filename;
    } catch (error) {
        console.error('Error parsing filename from URL:', error);
        return '';
    }
}

// Icon animation state
let animationInterval = null;
let animationFrame = 0;
const ANIMATION_FRAMES = 8;  // Number of frames in animation cycle
const ANIMATION_SPEED = 150; // ms between frames
let baseIconBitmap = null;   // Cached base icon for animation overlay

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(() => {
    console.log('nas-downloader extension installed');
    createContextMenu();
    loadSettingsAndConnect();
    loadInterceptSetting();
    loadBaseIcon();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Browser started, reconnecting...');
    loadSettingsAndConnect();
    loadInterceptSetting();
    loadBaseIcon();
});

// Intercept browser downloads
chrome.downloads.onCreated.addListener((downloadItem) => {
    console.log('Download intercepted:', downloadItem.url, 'interceptEnabled:', interceptEnabled);

    // Skip blob: URLs - these are internal browser downloads (canvas exports, etc.)
    if (downloadItem.url.startsWith('blob:')) {
        console.log('Blob URL detected, allowing browser to handle download locally');
        return;
    }

    // Check if interception is enabled
    if (!interceptEnabled) {
        console.log('Interception disabled, allowing browser download to proceed normally');
        return; // Let browser handle download
    }

    console.log('Interception enabled, cancelling browser download and sending to server');

    // Cancel the browser download immediately
    chrome.downloads.cancel(downloadItem.id, () => {
        // After cancelling, remove from browser's download list
        chrome.downloads.erase({ id: downloadItem.id }, () => {
            console.log('Browser download cancelled and removed:', downloadItem.id);
        });
    });

    // Send to our server instead with parsed filename
    // Use browser's suggested filename if available, otherwise parse from URL
    const filename = downloadItem.filename
        ? downloadItem.filename.split(/[/\\]/).pop()  // Extract just filename from path
        : parseFilenameFromUrl(downloadItem.url);
    addDownload(downloadItem.url, '', filename);
});

// Create context menu for right-click download
function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        // Always show "NAS Download to" for folder selection
        chrome.contextMenus.create({
            id: 'nas-download-to',
            title: 'NAS Download to...',
            contexts: ['link', 'video', 'audio', 'image']
        });

        // Only show "NAS Download" when intercept is disabled
        // (when intercept is enabled, all downloads go to NAS automatically)
        if (!interceptEnabled) {
            chrome.contextMenus.create({
                id: 'nas-download',
                title: 'NAS Download',
                contexts: ['link', 'video', 'audio', 'image']
            });
        }
    });
}

// Update context menu when intercept setting changes
function updateContextMenu() {
    createContextMenu();
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const url = info.linkUrl || info.srcUrl;
    if (!url) return;

    if (info.menuItemId === 'nas-download') {
        // Direct download to default folder with parsed filename
        const filename = parseFilenameFromUrl(url);
        addDownload(url, '', filename);
    } else if (info.menuItemId === 'nas-download-to') {
        // Store URL and open popup for folder selection
        try {
            await chrome.storage.local.set({ pendingDownloadUrl: url });
            // Open the popup automatically
            chrome.action.openPopup();
        } catch (error) {
            console.error('Failed to open popup:', error);
            // Fallback: show notification if popup fails to open
            showNotification('Select Folder', 'Click the extension icon to choose a download folder');
        }
    }
});

// Load settings and connect to server
async function loadSettingsAndConnect() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'apiKey']);

        if (result.serverUrl && result.apiKey) {
            // Check if we have permission for this server URL
            const origin = new URL(result.serverUrl).origin + '/*';
            const hasPermission = await chrome.permissions.contains({ origins: [origin] });

            if (!hasPermission) {
                console.log('No permission for server URL. User needs to re-save settings.');
                updateConnectionStatus(false);
                return;
            }

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

// Load intercept setting
async function loadInterceptSetting() {
    try {
        const result = await chrome.storage.sync.get(['interceptDownloads']);
        // Default to true if not set
        interceptEnabled = result.interceptDownloads !== false;
        console.log('Intercept enabled:', interceptEnabled);
        // Update context menu based on setting
        updateContextMenu();
    } catch (error) {
        console.error('Failed to load intercept setting:', error);
        interceptEnabled = true; // Default to enabled on error
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
        globalPaused = message.global_paused || false;
        console.log('Updated downloads array:', downloads.length, 'downloads, globalPaused:', globalPaused);

        // Check if any downloads are actively downloading
        const hasActiveDownloads = downloads.some(d => d.status === 'downloading');

        if (hasActiveDownloads && !globalPaused) {
            startIconAnimation();
        } else {
            stopIconAnimation();
        }

        // Notify popup if it's open
        chrome.runtime.sendMessage({
            type: 'downloads_updated',
            downloads: downloads,
            globalPaused: globalPaused
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

    // Stop animation when disconnected
    if (!connected) {
        stopIconAnimation();
    }

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

// Get cookies for a URL's domain
async function getCookiesForUrl(url) {
    try {
        const urlObj = new URL(url);
        const cookies = await chrome.cookies.getAll({ domain: urlObj.hostname });
        // Also try without leading dot for subdomains
        const parentDomain = urlObj.hostname.split('.').slice(-2).join('.');
        if (parentDomain !== urlObj.hostname) {
            const parentCookies = await chrome.cookies.getAll({ domain: parentDomain });
            // Merge, avoiding duplicates
            const seen = new Set(cookies.map(c => c.name));
            for (const cookie of parentCookies) {
                if (!seen.has(cookie.name)) {
                    cookies.push(cookie);
                }
            }
        }
        // Format as cookie header string
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch (error) {
        console.error('Failed to get cookies:', error);
        return '';
    }
}

// Add download via API
async function addDownload(url, folder = '', filename = '') {
    if (!serverUrl || !apiKey) {
        console.error('Cannot add download: not configured');
        showNotification('Not configured', 'Please configure server settings first');
        return;
    }

    try {
        // Get cookies from browser for this URL's domain
        const cookies = await getCookiesForUrl(url);

        const requestBody = {
            url: url,
            folder: folder || '',  // Use provided folder or default
            user_agent: navigator.userAgent,  // Pass browser's User-Agent
            cookies: cookies  // Pass browser cookies for this domain
        };

        // Include filename if provided
        if (filename) {
            requestBody.filename = filename;
        }

        const response = await fetch(`${serverUrl}/api/downloads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
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

    } else if (message.type === 'intercept_setting_changed') {
        // Intercept setting changed
        interceptEnabled = message.enabled;
        console.log('Intercept setting updated:', interceptEnabled);
        // Update context menu to show/hide "NAS Download" option
        updateContextMenu();
        sendResponse({ success: true });

    } else if (message.type === 'get_connection_status') {
        sendResponse({ connected: isConnected });

    } else if (message.type === 'get_downloads') {
        console.log('Popup requested downloads, sending:', downloads.length, 'downloads');
        sendResponse({ downloads: downloads, globalPaused: globalPaused });

    } else if (message.type === 'add_download') {
        addDownload(message.url, message.folder, message.filename);
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

    } else if (message.type === 'pause_all_downloads') {
        pauseAllDownloads();
        sendResponse({ success: true });

    } else if (message.type === 'resume_all_downloads') {
        resumeAllDownloads();
        sendResponse({ success: true });

    } else if (message.type === 'get_global_paused') {
        sendResponse({ globalPaused: globalPaused });
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

// Pause all downloads
async function pauseAllDownloads() {
    if (!serverUrl || !apiKey) return;

    try {
        await fetch(`${serverUrl}/api/downloads/pause-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (error) {
        console.error('Failed to pause all downloads:', error);
    }
}

// Resume all downloads
async function resumeAllDownloads() {
    if (!serverUrl || !apiKey) return;

    try {
        await fetch(`${serverUrl}/api/downloads/resume-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (error) {
        console.error('Failed to resume all downloads:', error);
    }
}

// Load and cache the base icon for animation overlay
async function loadBaseIcon() {
    try {
        const response = await fetch(chrome.runtime.getURL('icons/icon128.png'));
        const blob = await response.blob();
        baseIconBitmap = await createImageBitmap(blob);
        console.log('Base icon loaded for animation overlay');
    } catch (error) {
        console.error('Failed to load base icon:', error);
    }
}

// Generate animated icon frame with downward-moving arrow overlay
function generateAnimatedIcon(frameIndex) {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // Draw the original icon as base (if loaded)
    if (baseIconBitmap) {
        ctx.drawImage(baseIconBitmap, 0, 0, 128, 128);
    } else {
        // Fallback: draw gradient background if icon not loaded
        const gradient = ctx.createLinearGradient(0, 0, 128, 128);
        gradient.addColorStop(0, '#14b8a6');
        gradient.addColorStop(1, '#0d9488');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(0, 0, 128, 128, 24);
        ctx.fill();
    }

    // Calculate arrow position based on frame (moves from top to bottom)
    // Arrow travels ~55 pixels so it starts at top and ends near bottom
    const arrowOffset = (frameIndex / ANIMATION_FRAMES) * 55;

    // Draw animated down arrow overlay (slightly larger)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Add subtle shadow for visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Arrow shaft (centered, starts near top of icon)
    const centerX = 64;
    const baseY = 12 + arrowOffset;  // Start near top (12px from edge)

    ctx.beginPath();
    ctx.moveTo(centerX, baseY);
    ctx.lineTo(centerX, baseY + 55);  // Slightly longer shaft
    ctx.stroke();

    // Arrow head (slightly larger)
    ctx.beginPath();
    ctx.moveTo(centerX - 24, baseY + 38);
    ctx.lineTo(centerX, baseY + 60);
    ctx.lineTo(centerX + 24, baseY + 38);
    ctx.stroke();

    return ctx.getImageData(0, 0, 128, 128);
}

// Start icon animation
function startIconAnimation() {
    if (animationInterval) return; // Already animating

    console.log('Starting icon animation');
    animationInterval = setInterval(() => {
        animationFrame = (animationFrame + 1) % ANIMATION_FRAMES;
        const imageData = generateAnimatedIcon(animationFrame);
        chrome.action.setIcon({ imageData: { 128: imageData } });
    }, ANIMATION_SPEED);
}

// Stop icon animation and restore static icon
function stopIconAnimation() {
    if (animationInterval) {
        console.log('Stopping icon animation');
        clearInterval(animationInterval);
        animationInterval = null;
        animationFrame = 0;
        // Restore static icon
        chrome.action.setIcon({
            path: {
                16: 'icons/icon16.png',
                48: 'icons/icon48.png',
                128: 'icons/icon128.png'
            }
        });
    }
}
