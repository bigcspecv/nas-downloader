let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let downloads = [];
let globalPaused = false;
let currentFilter = 'all';
let searchQuery = '';
let selectedDownloads = new Set();

// Configuration
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
               window.location.host + '/ws';
const API_URL = window.location.origin + '/api';

// Get API key from URL hash or prompt user
let API_KEY = window.location.hash.substring(1);

// ============================================================================
// Generic Dialog Modal System
// ============================================================================

let dialogResolve = null;
let dialogReject = null;

function showDialog(options) {
    return new Promise((resolve, reject) => {
        dialogResolve = resolve;
        dialogReject = reject;

        const modal = document.getElementById('dialogModal');
        const title = document.getElementById('dialogTitle');
        const message = document.getElementById('dialogMessage');
        const inputContainer = document.getElementById('dialogInputContainer');
        const input = document.getElementById('dialogInput');
        const checkboxContainer = document.getElementById('dialogCheckboxContainer');
        const checkbox = document.getElementById('dialogCheckbox');
        const checkboxLabel = document.getElementById('dialogCheckboxLabel');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        const confirmBtn = document.getElementById('dialogConfirmBtn');

        title.textContent = options.title || 'Confirm';
        message.textContent = options.message || '';

        // Configure for different dialog types
        if (options.type === 'prompt') {
            inputContainer.style.display = 'block';
            input.value = options.defaultValue || '';
            input.type = options.inputType || 'text';
            input.placeholder = options.placeholder || '';
            cancelBtn.style.display = 'inline-block';
            confirmBtn.textContent = options.confirmText || 'OK';
        } else if (options.type === 'confirm') {
            inputContainer.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
            confirmBtn.textContent = options.confirmText || 'Confirm';
        } else { // alert
            inputContainer.style.display = 'none';
            cancelBtn.style.display = 'none';
            confirmBtn.textContent = 'OK';
        }

        // Handle optional checkbox
        if (options.checkbox) {
            checkboxContainer.style.display = 'block';
            checkboxLabel.textContent = options.checkbox.label || '';
            checkbox.checked = options.checkbox.defaultChecked || false;
        } else {
            checkboxContainer.style.display = 'none';
        }

        // Add danger class if needed
        if (options.danger) {
            confirmBtn.classList.remove('btn-primary');
            confirmBtn.classList.add('btn-danger');
        } else {
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');
        }

        modal.classList.add('active');

        // Focus input if prompt and add Enter key handler
        if (options.type === 'prompt') {
            setTimeout(() => {
                input.focus();
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmDialog();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeDialog();
                    }
                };
            }, 100);
        }

        // Add Escape key handler for all dialog types
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    });
}

function confirmDialog() {
    const inputContainer = document.getElementById('dialogInputContainer');
    const input = document.getElementById('dialogInput');
    const checkboxContainer = document.getElementById('dialogCheckboxContainer');
    const checkbox = document.getElementById('dialogCheckbox');

    if (inputContainer.style.display === 'block') {
        // Prompt mode - return input value
        if (dialogResolve) {
            dialogResolve(input.value);
        }
    } else {
        // Confirm/Alert mode - return true or object with checkbox state
        if (dialogResolve) {
            if (checkboxContainer.style.display === 'block') {
                dialogResolve({ confirmed: true, checkboxValue: checkbox.checked });
            } else {
                dialogResolve(true);
            }
        }
    }

    closeDialog();
}

function closeDialog() {
    const modal = document.getElementById('dialogModal');
    const input = document.getElementById('dialogInput');
    const checkboxContainer = document.getElementById('dialogCheckboxContainer');

    modal.classList.remove('active');

    // Clean up event handlers
    input.onkeydown = null;

    if (dialogResolve) {
        const inputContainer = document.getElementById('dialogInputContainer');
        if (inputContainer.style.display === 'block') {
            // Prompt mode - return null on cancel
            dialogResolve(null);
        } else if (checkboxContainer.style.display === 'block') {
            // Confirm with checkbox mode - return object with confirmed: false
            dialogResolve({ confirmed: false, checkboxValue: false });
        } else {
            // Confirm mode - return false on cancel
            dialogResolve(false);
        }
    }

    dialogResolve = null;
    dialogReject = null;
}

// Helper functions
function showConfirm(message, title = 'Confirm', danger = false) {
    return showDialog({
        type: 'confirm',
        title: title,
        message: message,
        danger: danger
    });
}

function showPrompt(message, title = 'Input', defaultValue = '', placeholder = '') {
    return showDialog({
        type: 'prompt',
        title: title,
        message: message,
        defaultValue: defaultValue,
        placeholder: placeholder
    });
}

function showAlert(message, title = 'Alert') {
    return showDialog({
        type: 'alert',
        title: title,
        message: message
    });
}

// Initialize - get API key
async function initializeApiKey() {
    if (!API_KEY) {
        API_KEY = await showPrompt(
            'Please enter your API key to continue',
            'Authentication Required',
            '',
            'API Key'
        );

        if (!API_KEY) {
            showNotification('error', 'Authentication Required', 'API key is required.');
        } else {
            window.location.hash = API_KEY;
            connect();
            loadSettings();
        }
    } else {
        connect();
        loadSettings();
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApiKey);
} else {
    initializeApiKey();
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

    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
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
        showNotification('error', 'Connection Failed', 'Unable to connect to server.');
        updateConnectionStatus(false);
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        reconnectAttempts = 0;
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
    };

    ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        updateConnectionStatus(false);

        // Don't show reconnecting notification if we've hit max attempts (e.g., auth failure)
        if (event.code !== 1000 && reconnectAttempts === 0) {
            showNotification('warning', 'Disconnected', 'Reconnecting...', 3000);
        }

        scheduleReconnect();
    };
}

function scheduleReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(connect, delay);
    } else {
        showNotification('error', 'Connection Failed', 'Could not reconnect. Please refresh.', 0);
    }
}

function handleWebSocketMessage(data) {
    if (data.type === 'status') {
        downloads = data.downloads || [];
        globalPaused = data.global_paused || false;
        renderDownloads();
        updateStatusBar();
        updateCategoryCounts();
        updatePauseButton();
    } else if (data.type === 'settings_update') {
        updateSettingsUI(data.settings);
    } else if (data.type === 'auth_error') {
        // Authentication failed - stop reconnecting
        console.error('Authentication error:', data.error);
        reconnectAttempts = maxReconnectAttempts; // Prevent reconnection

        // Clear the invalid API key
        window.location.hash = '';
        API_KEY = null;

        // Close the current connection
        if (ws) {
            ws.close();
        }

        // Prompt for new API key
        setTimeout(async () => {
            const newKey = await showPrompt(
                'Your API key was invalid. Please enter the correct API key.',
                'Authentication Failed',
                '',
                'API Key'
            );

            if (newKey) {
                API_KEY = newKey;
                window.location.hash = newKey;
                reconnectAttempts = 0;
                connect();
                loadSettings();
            }
        }, 500);
    } else if (data.error) {
        console.error('WebSocket error:', data.error);
        showNotification('error', 'Server Error', data.error);
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
            text.textContent = 'Failed';
        } else {
            text.textContent = 'Disconnected';
        }
    }
}

// ============================================================================
// Category Navigation
// ============================================================================

function switchCategory(filter) {
    currentFilter = filter;

    // Update active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.filter === filter) {
            item.classList.add('active');
        }
    });

    renderDownloads();
}

function updateCategoryCounts() {
    const counts = {
        all: downloads.length,
        active: downloads.filter(d => d.status === 'downloading' || d.status === 'queued').length,
        completed: downloads.filter(d => d.status === 'completed').length,
        paused: downloads.filter(d => d.status === 'paused').length,
        failed: downloads.filter(d => d.status === 'failed').length
    };

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countActive').textContent = counts.active;
    document.getElementById('countCompleted').textContent = counts.completed;
    document.getElementById('countPaused').textContent = counts.paused;
    document.getElementById('countFailed').textContent = counts.failed;
}

function filterDownloads() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase();
    renderDownloads();
}

function getFilteredDownloads() {
    let filtered = downloads;

    // Apply category filter
    if (currentFilter === 'active') {
        filtered = filtered.filter(d => d.status === 'downloading' || d.status === 'queued');
    } else if (currentFilter !== 'all') {
        filtered = filtered.filter(d => d.status === currentFilter);
    }

    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(d =>
            d.filename.toLowerCase().includes(searchQuery) ||
            d.url.toLowerCase().includes(searchQuery) ||
            (d.folder && d.folder.toLowerCase().includes(searchQuery))
        );
    }

    return filtered;
}

// ============================================================================
// UI Rendering
// ============================================================================

function renderDownloads() {
    const container = document.getElementById('downloadsTable');
    const filtered = getFilteredDownloads();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="icon icon-lg"><use href="/static/images/icons.svg#icon-download"></use></svg>
                <p>No downloads ${currentFilter !== 'all' ? 'in this category' : 'yet'}</p>
                <p class="hint">Click "New Download" to get started</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(download => {
        const progress = download.progress || {};
        const totalBytes = progress.total_bytes || 0;
        const percentage = progress.percentage || 0;
        const speedBps = progress.speed_bps || 0;

        const totalMB = totalBytes > 0 ? (totalBytes / 1048576).toFixed(2) : '?';
        const speedMBps = (speedBps / 1048576).toFixed(2);

        const progressClass = getProgressClass(download.status);
        const isSelected = selectedDownloads.has(download.id);

        return `
            <div class="download-row ${isSelected ? 'selected' : ''}" data-id="${download.id}">
                <div class="td td-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}
                           onchange="toggleDownloadSelection('${download.id}', this.checked)">
                </div>
                <div class="td">
                    <div class="download-info">
                        <div class="download-name" title="${escapeHtml(download.filename)}">
                            ${escapeHtml(download.filename)}
                        </div>
                        <div class="download-url" title="${escapeHtml(download.url)}">
                            ${escapeHtml(download.url)}
                        </div>
                        ${download.folder ? `<div class="download-folder">📁 ${escapeHtml(download.folder)}</div>` : ''}
                    </div>
                </div>
                <div class="td">
                    <div class="download-size">${totalBytes > 0 ? totalMB + ' MB' : 'Unknown'}</div>
                </div>
                <div class="td">
                    <div class="download-progress">
                        <div class="progress-text">${percentage.toFixed(1)}%</div>
                        <div class="progress-bar">
                            <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
                <div class="td">
                    <div class="download-speed ${speedBps > 0 ? '' : 'inactive'}">
                        ${speedBps > 0 ? speedMBps + ' MB/s' : '-'}
                    </div>
                </div>
                <div class="td">
                    <div class="download-actions">
                        ${download.status === 'downloading' || download.status === 'queued' ?
                            `<button class="btn-icon" onclick="pauseDownload('${download.id}')">Pause</button>` : ''}
                        ${download.status === 'paused' ?
                            `<button class="btn-icon" onclick="resumeDownload('${download.id}')">Resume</button>` : ''}
                        <button class="btn-icon btn-danger" onclick="deleteDownload('${download.id}')">
                            <svg class="icon"><use href="/static/images/icons.svg#icon-trash"></use></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateSelectAllCheckbox();
    updateDeleteButton();
}

function getProgressClass(status) {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (status === 'paused') return 'paused';
    return '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Selection Management
// ============================================================================

function toggleDownloadSelection(id, checked) {
    if (checked) {
        selectedDownloads.add(id);
    } else {
        selectedDownloads.delete(id);
    }
    renderDownloads();
}

function toggleSelectAll(checked) {
    const filtered = getFilteredDownloads();
    selectedDownloads.clear();

    if (checked) {
        filtered.forEach(d => selectedDownloads.add(d.id));
    }

    renderDownloads();
}

function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    const filtered = getFilteredDownloads();

    if (filtered.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else {
        const selectedCount = filtered.filter(d => selectedDownloads.has(d.id)).length;
        selectAll.checked = selectedCount === filtered.length;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < filtered.length;
    }
}

function updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (deleteBtn) {
        deleteBtn.disabled = selectedDownloads.size === 0;
    }
}

// ============================================================================
// Status Bar
// ============================================================================

function updateStatusBar() {
    let totalSpeed = 0;
    let activeCount = 0;

    downloads.forEach(d => {
        if (d.status === 'downloading') {
            activeCount++;
            const progress = d.progress || {};
            totalSpeed += progress.speed_bps || 0;
        }
    });

    const speedElement = document.getElementById('globalDownloadSpeed');
    if (totalSpeed > 0) {
        const speedMBps = (totalSpeed / 1048576).toFixed(2);
        speedElement.textContent = `${speedMBps} MB/s`;
    } else {
        speedElement.textContent = '0 B/s';
    }

    const activeElement = document.getElementById('activeDownloadsCount');
    activeElement.textContent = `${activeCount} active download${activeCount !== 1 ? 's' : ''}`;
}

// ============================================================================
// Toolbar Actions
// ============================================================================

async function deleteSelected() {
    if (selectedDownloads.size === 0) {
        showNotification('warning', 'No Selection', 'Please select downloads to delete');
        return;
    }

    const confirmed = await showConfirm(
        `Are you sure you want to delete ${selectedDownloads.size} selected download(s)?`,
        'Delete Downloads',
        false
    );

    if (!confirmed) {
        return;
    }

    const promises = Array.from(selectedDownloads).map(id =>
        apiCall(`/downloads/${id}`, 'DELETE').catch(err => {
            console.error(`Failed to delete ${id}:`, err);
        })
    );

    Promise.all(promises).then(() => {
        showNotification('success', 'Deleted', `${selectedDownloads.size} download(s) deleted`);
        selectedDownloads.clear();
    });
}

function updatePauseButton() {
    const button = document.getElementById('playPauseBtn');

    if (globalPaused) {
        button.innerHTML = `
            <svg class="icon"><use href="/static/images/icons.svg#icon-play"></use></svg>
            Resume All
        `;
    } else {
        button.innerHTML = `
            <svg class="icon"><use href="/static/images/icons.svg#icon-pause"></use></svg>
            Pause All
        `;
    }
}

async function togglePauseAll() {
    try {
        if (globalPaused) {
            await apiCall('/downloads/resume-all', 'POST');
            showNotification('success', 'All Downloads Resumed', '', 2000);
        } else {
            await apiCall('/downloads/pause-all', 'POST');
            showNotification('success', 'All Downloads Paused', '', 2000);
        }
    } catch (error) {
        showNotification('error', `Failed to ${globalPaused ? 'Resume' : 'Pause'} All`, error.message);
    }
}

// ============================================================================
// Modal Management
// ============================================================================

function openAddDownloadModal() {
    const modal = document.getElementById('addDownloadModal');
    modal.classList.add('active');
    document.getElementById('downloadUrl').focus();
}

function closeAddDownloadModal() {
    const modal = document.getElementById('addDownloadModal');
    modal.classList.remove('active');

    document.getElementById('downloadUrl').value = '';
    document.getElementById('downloadFolder').value = '';
    document.getElementById('downloadFilename').value = '';
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');
    loadSettings();
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
}

// ============================================================================
// API Calls
// ============================================================================

async function apiCall(endpoint, method = 'GET', body = null, buttonElement = null) {
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
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your connection.');
        }
        throw error;
    } finally {
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

    const url = urlField.value.trim();
    const folder = folderField.value.trim();
    const filename = filenameField.value.trim();

    try {
        const body = { url, folder };
        if (filename) body.filename = filename;

        await apiCall('/downloads', 'POST', body);

        closeAddDownloadModal();
        showNotification('success', 'Download Added', 'Your download has been queued');
    } catch (error) {
        showNotification('error', 'Failed to Add Download', error.message);
    }
}

async function pauseDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'pause' });
    } catch (error) {
        showNotification('error', 'Failed to Pause', error.message);
    }
}

async function resumeDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'resume' });
    } catch (error) {
        showNotification('error', 'Failed to Resume', error.message);
    }
}

async function deleteDownload(id) {
    const download = downloads.find(d => d.id === id);
    let deleteFile = false;

    // For completed downloads, offer option to delete the file
    if (download && download.status === 'completed') {
        const result = await showDialog({
            type: 'confirm',
            title: 'Delete Download',
            message: 'Are you sure you want to delete this download?',
            checkbox: {
                label: 'Also delete the downloaded file',
                defaultChecked: false
            }
        });

        if (!result.confirmed) return;
        deleteFile = result.checkboxValue;
    } else {
        const confirmed = await showConfirm(
            'Are you sure you want to delete this download?',
            'Delete Download',
            false
        );

        if (!confirmed) return;
    }

    try {
        const endpoint = deleteFile ? `/downloads/${id}?delete_file=true` : `/downloads/${id}`;
        await apiCall(endpoint, 'DELETE');
        showNotification('success', 'Download Deleted', '');
    } catch (error) {
        showNotification('error', 'Failed to Delete', error.message);
    }
}

// ============================================================================
// Settings Management
// ============================================================================

async function loadSettings() {
    try {
        const settings = await apiCall('/settings');
        updateSettingsUI(settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
        showNotification('error', 'Failed to Load Settings', error.message);
    }
}

function updateSettingsUI(settings) {
    const rateLimitBps = parseInt(settings.global_rate_limit_bps) || 0;
    const maxConcurrent = parseInt(settings.max_concurrent_downloads) || 3;

    const rateLimitMBps = Math.floor(rateLimitBps / 1048576);
    document.getElementById('rateLimit').value = rateLimitMBps;
    document.getElementById('maxConcurrent').value = maxConcurrent;
}

async function saveSettings() {
    const rateLimitValue = document.getElementById('rateLimit').value.trim();
    const rateLimitUnit = parseInt(document.getElementById('rateLimitUnit').value);
    const maxConcurrent = document.getElementById('maxConcurrent').value.trim();

    try {
        const rateLimitBps = parseInt(rateLimitValue) * rateLimitUnit;

        await apiCall('/settings', 'PATCH', {
            global_rate_limit_bps: rateLimitBps.toString(),
            max_concurrent_downloads: maxConcurrent
        });

        showNotification('success', 'Settings Saved', 'Your settings have been updated');
        closeSettingsModal();
    } catch (error) {
        showNotification('error', 'Failed to Save Settings', error.message);
    }
}
