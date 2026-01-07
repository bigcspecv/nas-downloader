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
        alert('API key is required to use the download manager.');
    } else {
        // Store in URL hash for convenience (not secure, but this is for local use)
        window.location.hash = API_KEY;
    }
}

// WebSocket connection
function connect() {
    if (!API_KEY) return;

    const wsUrl = `${WS_URL}?api_key=${encodeURIComponent(API_KEY)}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);

        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(connect, delay);
        }
    };
}

function handleWebSocketMessage(data) {
    if (data.type === 'status') {
        downloads = data.downloads || [];
        globalPaused = data.global_paused || false;
        renderDownloads();
        updatePauseButton();
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
        text.textContent = reconnectAttempts > 0 ? 'Reconnecting...' : 'Disconnected';
    }
}

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
        const totalMB = (totalBytes / 1048576).toFixed(2);
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
                            ${downloadedMB} / ${totalMB} MB (${percentage}%)
                        </span>
                        <span>
                            ${download.status === 'downloading' ?
                                `${speedMBps} MB/s • ETA: ${eta}` :
                                (download.status === 'paused' && speedBps > 0) ?
                                `Last speed: ${speedMBps} MB/s` :
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

// API calls
async function apiCall(endpoint, method = 'GET', body = null) {
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
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

async function addDownload(event) {
    event.preventDefault();

    const url = document.getElementById('downloadUrl').value;
    const folder = document.getElementById('downloadFolder').value;
    const filename = document.getElementById('downloadFilename').value;

    try {
        const body = { url, folder };
        if (filename) body.filename = filename;

        await apiCall('/downloads', 'POST', body);

        // Clear form
        document.getElementById('downloadUrl').value = '';
        document.getElementById('downloadFolder').value = '';
        document.getElementById('downloadFilename').value = '';

        alert('Download added successfully!');
    } catch (error) {
        alert(`Failed to add download: ${error.message}`);
    }
}

async function pauseDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'pause' });
    } catch (error) {
        alert(`Failed to pause download: ${error.message}`);
    }
}

async function resumeDownload(id) {
    try {
        await apiCall(`/downloads/${id}`, 'PATCH', { action: 'resume' });
    } catch (error) {
        alert(`Failed to resume download: ${error.message}`);
    }
}

async function cancelDownload(id) {
    if (!confirm('Cancel this download and delete the partial file?')) return;

    try {
        await apiCall(`/downloads/${id}`, 'DELETE');
    } catch (error) {
        alert(`Failed to cancel download: ${error.message}`);
    }
}

async function removeDownload(id) {
    if (!confirm('Remove this download from the list? (file will be kept)')) return;

    try {
        await apiCall(`/downloads/${id}`, 'DELETE');
    } catch (error) {
        alert(`Failed to remove download: ${error.message}`);
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
    try {
        if (globalPaused) {
            await apiCall('/downloads/resume-all', 'POST');
        } else {
            await apiCall('/downloads/pause-all', 'POST');
        }
    } catch (error) {
        alert(`Failed to ${globalPaused ? 'resume' : 'pause'} all downloads: ${error.message}`);
    }
}

async function updateRateLimit() {
    const value = parseInt(document.getElementById('rateLimit').value) || 0;
    const unit = parseInt(document.getElementById('rateLimitUnit').value);
    const bytes = value * unit;

    try {
        await apiCall('/settings', 'PATCH', { global_rate_limit_bps: bytes.toString() });
        alert('Rate limit updated successfully!');
    } catch (error) {
        alert(`Failed to update rate limit: ${error.message}`);
    }
}

// Load initial settings
async function loadSettings() {
    try {
        const settings = await apiCall('/settings');
        const rateLimitBps = parseInt(settings.global_rate_limit_bps) || 0;

        // Convert to MB/s for display
        const rateLimitMBps = Math.floor(rateLimitBps / 1048576);
        document.getElementById('rateLimit').value = rateLimitMBps;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Initialize
if (API_KEY) {
    connect();
    loadSettings();
}
