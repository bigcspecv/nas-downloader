let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let downloads = [];
let globalPaused = false;

// Configuration - modify these if needed
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
               window.location.host + '/ws';
const API_URL = window.location.origin + '/api';

// Get API key from URL hash or prompt user
let API_KEY = window.location.hash.substring(1);
if (!API_KEY) {
    API_KEY = prompt('Enter API Key:');
    if (!API_KEY) {
        showNotification('error', 'Authentication Required', 'API key is required to use the download manager.');
    } else {
        // Store in URL hash for convenience (not secure, but this is for local use)
        window.location.hash = API_KEY;
    }
}

// ============================================================================
// Notification System
// ============================================================================

function showNotification(type, title, message, duration = 5000) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    notification.innerHTML = `
        <div class="notification-icon">${icons[type] || icons.info}</div>
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(title)}</div>
            ${message ? `<div class="notification-message">${escapeHtml(message)}</div>` : ''}
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(notification);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// ============================================================================
// Form Validation
// ============================================================================

function validateURL(url) {
    if (!url || url.trim() === '') {
        return 'URL is required';
    }

    try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return 'URL must use HTTP or HTTPS protocol';
        }
        return null; // Valid
    } catch (e) {
        return 'Please enter a valid URL';
    }
}

function validateRateLimit(value) {
    const num = parseInt(value);
    if (isNaN(num)) {
        return 'Rate limit must be a number';
    }
    if (num < 0) {
        return 'Rate limit must be 0 or greater';
    }
    return null; // Valid
}

function showFieldError(fieldId, errorMessage) {
    const field = document.getElementById(fieldId);
    const controlGroup = field.closest('.control-group');

    // Remove existing error
    const existingError = controlGroup.querySelector('.validation-error');
    if (existingError) {
        existingError.remove();
    }

    if (errorMessage) {
        controlGroup.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errorMessage;
        controlGroup.appendChild(errorDiv);
    } else {
        controlGroup.classList.remove('error');
    }
}

function clearFieldError(fieldId) {
    showFieldError(fieldId, null);
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function connect() {
    if (!API_KEY) return;

    const wsUrl = `${WS_URL}?api_key=${encodeURIComponent(API_KEY)}`;

    try {
        ws = new WebSocket(wsUrl);
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        showNotification('error', 'Connection Failed', 'Unable to connect to server. Please check your network connection.');
        updateConnectionStatus(false);
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        reconnectAttempts = 0;
        showNotification('success', 'Connected', 'Real-time updates enabled', 3000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't show notification on every error - wait for onclose
    };

    ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        updateConnectionStatus(false);

        // Only show notification if not a clean close
        if (event.code !== 1000 && reconnectAttempts === 0) {
            showNotification('warning', 'Disconnected', 'Connection to server lost. Attempting to reconnect...', 3000);
        }

        scheduleReconnect();
    };
}

function scheduleReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connect, delay);
    } else {
        showNotification('error', 'Connection Failed', 'Could not reconnect to server after multiple attempts. Please refresh the page.', 0);
    }
}

function handleWebSocketMessage(data) {
    if (data.type === 'status') {
        downloads = data.downloads || [];
        globalPaused = data.global_paused || false;
        renderDownloads();
        updatePauseButton();
    } else if (data.type === 'settings_update') {
        // Settings were changed by another user or session
        updateSettingsUI(data.settings);
    } else if (data.error) {
        console.error('WebSocket error:', data.error);
    }
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (connected) {
        dot.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        dot.classList.remove('connected');
        if (reconnectAttempts > 0 && reconnectAttempts < maxReconnectAttempts) {
            text.textContent = 'Reconnecting...';
        } else if (reconnectAttempts >= maxReconnectAttempts) {
            text.textContent = 'Connection Failed';
        } else {
            text.textContent = 'Disconnected';
        }
    }
}

// ============================================================================
// UI Rendering
// ============================================================================

function renderDownloads() {
    const container = document.getElementById('downloadsList');

    if (downloads.length === 0) {
        container.innerHTML = '<div class="empty-state">No downloads yet. Add one above to get started.</div>';
        return;
    }

    container.innerHTML = downloads.map(download => {
        // Access progress data from nested object
        const progress = download.progress || {};
        const downloadedBytes = progress.downloaded_bytes || 0;
        const totalBytes = progress.total_bytes || 0;
        const percentage = progress.percentage || 0;
        const speedBps = progress.speed_bps || 0;
        const etaSeconds = progress.eta_seconds || 0;

        const speedMBps = (speedBps / 1048576).toFixed(2);
        const downloadedMB = (downloadedBytes / 1048576).toFixed(2);
        const totalMB = totalBytes > 0 ? (totalBytes / 1048576).toFixed(2) : '?';
        const eta = formatETA(etaSeconds);

        let progressClass = '';
        if (download.status === 'completed') progressClass = 'completed';
        if (download.status === 'failed') progressClass = 'failed';
        if (download.status === 'paused') progressClass = 'paused';

        const errorMsg = download.error_message ?
            `<div class="error-message">${escapeHtml(download.error_message)}</div>` : '';

        return `
            <div class="download-item">
                <div class="download-header">
                    <div class="download-info">
                        <div class="download-filename">${escapeHtml(download.filename)}</div>
                        <div class="download-url">${escapeHtml(download.url)}</div>
                        ${download.folder ? `<div class="download-folder">📁 ${escapeHtml(download.folder)}</div>` : ''}
                    </div>
                    <div class="download-actions">
                        ${download.status === 'downloading' || download.status === 'queued' ?
                            `<button onclick="pauseDownload('${download.id}')">Pause</button>` : ''}
                        ${download.status === 'paused' ?
                            `<button onclick="resumeDownload('${download.id}')">Resume</button>` : ''}
                        ${download.status !== 'completed' ?
                            `<button class="danger" onclick="cancelDownload('${download.id}')">Cancel</button>` :
                            `<button class="danger" onclick="removeDownload('${download.id}')">Remove</button>`}
                    </div>
                </div>
                <div class="download-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                    </div>
                    <div class="download-stats">
                        <span>
                            <span class="status-badge ${download.status}">${download.status}</span>
                            ${totalBytes > 0 ?
                                `${downloadedMB} / ${totalMB} MB (${percentage}%)` :
                                `${downloadedMB} MB (size unknown)`}
                        </span>
                        <span>
                            ${download.status === 'downloading' ?
                                `⚡ ${speedMBps} MB/s • ETA: ${eta}` :
                                (download.status === 'paused' && speedBps > 0) ?
                                `⚡ Last speed: ${speedMBps} MB/s` :
                                ''}
                        </span>
                    </div>
                </div>
                ${errorMsg}
            </div>
        `;
    }).join('');
}

function formatETA(seconds) {
    if (!seconds || seconds <= 0) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// API Calls with Loading States
// ============================================================================

async function apiCall(endpoint, method = 'GET', body = null, buttonElement = null) {
    // Show loading state on button if provided
    if (buttonElement) {
        buttonElement.classList.add('loading');
        buttonElement.disabled = true;
    }

    try {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);

        if (!response.ok) {
            let errorMessage = 'Request failed';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (e) {
                // Response wasn't JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        // Handle network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your connection.');
        }
        throw error;
    } finally {
        // Remove loading state
        if (buttonElement) {
            buttonElement.classList.remove('loading');
            buttonElement.disabled = false;
        }
    }
}

// ============================================================================
// Download Management
// ============================================================================

async function addDownload(event) {
    event.preventDefault();

    const urlField = document.getElementById('downloadUrl');
    const folderField = document.getElementById('downloadFolder');
    const filenameField = document.getElementById('downloadFilename');
    const submitButton = event.target.querySelector('button[type="submit"]');

    const url = urlField.value.trim();
    const folder = folderField.value.trim();
    const filename = filenameField.value.trim();

    // Clear previous validation errors
    clearFieldError('downloadUrl');
    clearFieldError('downloadFolder');

    // Validate URL
    const urlError = validateURL(url);
    if (urlError) {
        showFieldError('downloadUrl', urlError);
        showNotification('error', 'Validation Error', urlError);
        return;
    }

    try {
        const body = { url, folder };
        if (filename) body.filename = filename;

        await apiCall('/downloads', 'POST', body, submitButton);

        // Clear form on success
        urlField.value = '';
        folderField.value = '';
        filenameField.value = '';

        showNotification('success', 'Download Added', 'Your download has been added to the queue');
    } catch (error) {
        showNotification('error', 'Failed to Add Download', error.message);
    }
}

async function pauseDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'pause' });
        showNotification('info', 'Download Paused', '', 2000);
    } catch (error) {
        showNotification('error', 'Failed to Pause', error.message);
    }
}

async function resumeDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'resume' });
        showNotification('info', 'Download Resumed', '', 2000);
    } catch (error) {
        showNotification('error', 'Failed to Resume', error.message);
    }
}

async function cancelDownload(id) {
    if (!confirm('Cancel this download and delete the partial file?')) return;

    try {
        await apiCall(`/downloads/${id}`, 'DELETE');
        showNotification('success', 'Download Cancelled', 'Partial file has been deleted', 3000);
    } catch (error) {
        showNotification('error', 'Failed to Cancel', error.message);
    }
}

async function removeDownload(id) {
    if (!confirm('Remove this download from the list? (file will be kept)')) return;

    try {
        await apiCall(`/downloads/${id}`, 'DELETE');
        showNotification('success', 'Download Removed', 'File has been kept on disk', 3000);
    } catch (error) {
        showNotification('error', 'Failed to Remove', error.message);
    }
}

function updatePauseButton() {
    const button = document.getElementById('togglePauseBtn');
    if (button) {
        if (globalPaused) {
            button.textContent = 'Resume All';
            button.classList.remove('secondary');
            button.classList.add('primary');
        } else {
            button.textContent = 'Pause All';
            button.classList.add('secondary');
            button.classList.remove('primary');
        }
    }
}

async function togglePauseAll() {
    const button = document.getElementById('togglePauseBtn');

    try {
        if (globalPaused) {
            await apiCall('/downloads/resume-all', 'POST', null, button);
            showNotification('success', 'All Downloads Resumed', '', 2000);
        } else {
            await apiCall('/downloads/pause-all', 'POST', null, button);
            showNotification('success', 'All Downloads Paused', '', 2000);
        }
    } catch (error) {
        showNotification('error', `Failed to ${globalPaused ? 'Resume' : 'Pause'} All`, error.message);
    }
}

// ============================================================================
// Settings Management
// ============================================================================

async function updateRateLimit(event) {
    const valueField = document.getElementById('rateLimit');
    const unitField = document.getElementById('rateLimitUnit');
    const button = event ? event.target : null; // Get the button that triggered this

    const value = valueField.value.trim();
    const unit = parseInt(unitField.value);

    // Clear previous validation errors
    clearFieldError('rateLimit');

    // Validate rate limit
    const validationError = validateRateLimit(value);
    if (validationError) {
        showFieldError('rateLimit', validationError);
        showNotification('error', 'Validation Error', validationError);
        return;
    }

    const bytes = parseInt(value) * unit;

    try {
        await apiCall('/settings', 'PATCH', { global_rate_limit_bps: bytes.toString() }, button);

        const displayValue = parseInt(value);
        const unitName = unitField.options[unitField.selectedIndex].text;
        const message = displayValue === 0 ?
            'Rate limiting disabled' :
            `Set to ${displayValue} ${unitName}`;

        showNotification('success', 'Rate Limit Updated', message, 3000);
    } catch (error) {
        showNotification('error', 'Failed to Update Rate Limit', error.message);
    }
}

// Load initial settings
async function loadSettings() {
    try {
        const settings = await apiCall('/settings');
        updateSettingsUI(settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
        showNotification('error', 'Failed to Load Settings', error.message);
    }
}

// Update settings UI when settings change
function updateSettingsUI(settings) {
    const rateLimitBps = parseInt(settings.global_rate_limit_bps) || 0;

    // Convert to MB/s for display
    const rateLimitMBps = Math.floor(rateLimitBps / 1048576);
    document.getElementById('rateLimit').value = rateLimitMBps;

    // Note: max_concurrent_downloads is not currently displayed in the UI,
    // but when it is added, it should be updated here as well
}

// ============================================================================
// Input Validation on Blur
// ============================================================================

// Add real-time validation feedback
document.addEventListener('DOMContentLoaded', () => {
    const urlField = document.getElementById('downloadUrl');
    const rateLimitField = document.getElementById('rateLimit');

    if (urlField) {
        urlField.addEventListener('blur', () => {
            const value = urlField.value.trim();
            if (value) {
                const error = validateURL(value);
                showFieldError('downloadUrl', error);
            }
        });

        urlField.addEventListener('input', () => {
            // Clear error when user starts typing
            if (urlField.value.trim()) {
                clearFieldError('downloadUrl');
            }
        });
    }

    if (rateLimitField) {
        rateLimitField.addEventListener('blur', () => {
            const value = rateLimitField.value.trim();
            if (value) {
                const error = validateRateLimit(value);
                showFieldError('rateLimit', error);
            }
        });

        rateLimitField.addEventListener('input', () => {
            clearFieldError('rateLimit');
        });
    }
});

// ============================================================================
// Initialize
// ============================================================================

if (API_KEY) {
    connect();
    loadSettings();
}
