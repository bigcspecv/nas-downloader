// Popup script for NAS Download Manager extension
let downloads = [];
let serverUrl = null;
let isConnected = false;
let downloadIds = new Set();
let lastProgress = {}; // Track last rendered progress percentages

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await checkConfiguration();
    await updateConnectionStatus();
    await loadDownloads();

    // Set up event listeners
    setupEventListeners();

    // Listen for updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'downloads_updated') {
            downloads = message.downloads || [];
            renderDownloads();
        } else if (message.type === 'connection_status_changed') {
            updateConnectionStatus();
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    // Not configured screen
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', openOptions);
    }

    // Main UI
    const addDownloadBtn = document.getElementById('addDownloadBtn');
    if (addDownloadBtn) {
        addDownloadBtn.addEventListener('click', addDownload);
    }

    const downloadUrl = document.getElementById('downloadUrl');
    if (downloadUrl) {
        downloadUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addDownload();
            }
        });
    }

    const openWebUIBtn = document.getElementById('openWebUIBtn');
    if (openWebUIBtn) {
        openWebUIBtn.addEventListener('click', openWebUI);
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openOptions);
    }

    // Event delegation for download control buttons
    const downloadsList = document.getElementById('downloadsList');
    if (downloadsList) {
        downloadsList.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-icon');
            if (button) {
                const action = button.dataset.action;
                const id = button.dataset.id;

                if (action === 'pause') {
                    pauseDownload(id);
                } else if (action === 'resume') {
                    resumeDownload(id);
                } else if (action === 'cancel') {
                    cancelDownload(id);
                }
            }
        });
    }
}

// Check if extension is configured
async function checkConfiguration() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'apiKey']);

        if (!result.serverUrl || !result.apiKey) {
            document.getElementById('notConfigured').style.display = 'block';
            document.getElementById('mainUI').style.display = 'none';
            return false;
        }

        serverUrl = result.serverUrl;
        document.getElementById('notConfigured').style.display = 'none';
        document.getElementById('mainUI').style.display = 'block';
        return true;
    } catch (error) {
        console.error('Failed to check configuration:', error);
        return false;
    }
}

// Update connection status indicator
async function updateConnectionStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_connection_status' });
        isConnected = response && response.connected;

        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (isConnected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    } catch (error) {
        console.error('Failed to get connection status:', error);
    }
}

// Load downloads from background script
async function loadDownloads() {
    try {
        console.log('Loading downloads from background...');
        const response = await chrome.runtime.sendMessage({ type: 'get_downloads' });
        console.log('Background response:', response);
        downloads = response && response.downloads ? response.downloads : [];
        console.log('Downloads array:', downloads);
        renderDownloads();
    } catch (error) {
        console.error('Failed to load downloads:', error);
    }
}

// Render downloads list
function renderDownloads() {
    const container = document.getElementById('downloadsList');

    if (downloads.length === 0) {
        downloadIds.clear();
        lastProgress = {};
        container.innerHTML = '<div class="empty-state">No downloads</div>';
        return;
    }

    // Check if the structure changed (new/removed downloads or status changes)
    const currentIds = new Set(downloads.map(d => d.id));
    const currentStatuses = downloads.map(d => `${d.id}:${d.status}`).join(',');
    const previousStatuses = Array.from(container.querySelectorAll('.download-item')).map(el => {
        return `${el.dataset.id}:${el.dataset.status}`;
    }).join(',');

    const structureChanged = currentIds.size !== downloadIds.size ||
                            !Array.from(currentIds).every(id => downloadIds.has(id)) ||
                            currentStatuses !== previousStatuses;

    if (structureChanged) {
        // Full re-render needed - structure changed
        downloadIds = currentIds;
        lastProgress = {};
        container.innerHTML = downloads.map(download => {
            const progress = download.total_bytes > 0
                ? Math.round((download.downloaded_bytes / download.total_bytes) * 100)
                : 0;

            lastProgress[download.id] = progress;

            const statusClass = getStatusClass(download.status);
            const statusText = getStatusText(download.status);

            return `
                <div class="download-item" data-id="${download.id}" data-status="${download.status}">
                    <div class="download-header">
                        <div class="download-filename" title="${escapeHtml(download.filename)}">
                            ${escapeHtml(download.filename)}
                        </div>
                        <div class="download-controls">
                            ${renderControls(download)}
                        </div>
                    </div>
                    <div class="download-progress">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" data-progress="${download.id}" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="download-info">
                        <span class="download-status ${statusClass}">${statusText}</span>
                        <span data-bytes="${download.id}">${formatBytes(download.downloaded_bytes)} / ${formatBytes(download.total_bytes)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        // Only update progress for downloads where percentage actually changed
        downloads.forEach(download => {
            const progress = download.total_bytes > 0
                ? Math.round((download.downloaded_bytes / download.total_bytes) * 100)
                : 0;

            // Only update if progress percentage changed
            if (lastProgress[download.id] !== progress) {
                lastProgress[download.id] = progress;

                const progressBar = document.querySelector(`[data-progress="${download.id}"]`);
                if (progressBar && progressBar.style.width !== `${progress}%`) {
                    progressBar.style.width = `${progress}%`;
                }
            }

            // Update byte counts (use textContent to avoid parsing)
            const bytesEl = document.querySelector(`[data-bytes="${download.id}"]`);
            if (bytesEl) {
                const newText = `${formatBytes(download.downloaded_bytes)} / ${formatBytes(download.total_bytes)}`;
                if (bytesEl.textContent !== newText) {
                    bytesEl.textContent = newText;
                }
            }
        });
    }
}

// Render control buttons based on download status
function renderControls(download) {
    if (download.status === 'completed' || download.status === 'failed') {
        return `
            <button class="btn-icon" data-action="cancel" data-id="${download.id}" title="Remove">
                ✕
            </button>
        `;
    }

    if (download.status === 'paused' || download.status === 'queued') {
        return `
            <button class="btn-icon" data-action="resume" data-id="${download.id}" title="Resume">
                ▶
            </button>
            <button class="btn-icon" data-action="cancel" data-id="${download.id}" title="Cancel">
                ✕
            </button>
        `;
    }

    if (download.status === 'downloading') {
        return `
            <button class="btn-icon" data-action="pause" data-id="${download.id}" title="Pause">
                ⏸
            </button>
            <button class="btn-icon" data-action="cancel" data-id="${download.id}" title="Cancel">
                ✕
            </button>
        `;
    }

    return '';
}

// Get status CSS class
function getStatusClass(status) {
    const statusMap = {
        'downloading': 'downloading',
        'completed': 'completed',
        'paused': 'paused',
        'queued': 'paused',
        'failed': 'failed'
    };
    return statusMap[status] || '';
}

// Get status display text
function getStatusText(status) {
    const statusMap = {
        'downloading': 'Downloading',
        'completed': 'Completed',
        'paused': 'Paused',
        'queued': 'Queued',
        'failed': 'Failed'
    };
    return statusMap[status] || status;
}

// Add new download
async function addDownload() {
    const urlInput = document.getElementById('downloadUrl');
    const url = urlInput.value.trim();

    if (!url) {
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            type: 'add_download',
            url: url
        });

        // Clear input
        urlInput.value = '';

        // Reload downloads after short delay
        setTimeout(loadDownloads, 500);
    } catch (error) {
        console.error('Failed to add download:', error);
        alert('Failed to add download');
    }
}

// Pause download
async function pauseDownload(id) {
    try {
        await chrome.runtime.sendMessage({
            type: 'pause_download',
            id: id
        });
    } catch (error) {
        console.error('Failed to pause download:', error);
    }
}

// Resume download
async function resumeDownload(id) {
    try {
        await chrome.runtime.sendMessage({
            type: 'resume_download',
            id: id
        });
    } catch (error) {
        console.error('Failed to resume download:', error);
    }
}

// Cancel download
async function cancelDownload(id) {
    try {
        await chrome.runtime.sendMessage({
            type: 'cancel_download',
            id: id
        });
    } catch (error) {
        console.error('Failed to cancel download:', error);
    }
}

// Open options page
function openOptions() {
    console.log('Opening options page...');
    try {
        chrome.runtime.openOptionsPage(() => {
            if (chrome.runtime.lastError) {
                console.error('Error opening options:', chrome.runtime.lastError);
                alert('Failed to open settings: ' + chrome.runtime.lastError.message);
            } else {
                console.log('Options page opened successfully');
            }
        });
    } catch (error) {
        console.error('Exception opening options:', error);
        alert('Failed to open settings: ' + error.message);
    }
}

// Open web UI in new tab
async function openWebUI() {
    if (serverUrl) {
        chrome.tabs.create({ url: serverUrl });
    } else {
        const result = await chrome.storage.sync.get(['serverUrl']);
        if (result.serverUrl) {
            chrome.tabs.create({ url: result.serverUrl });
        }
    }
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    if (bytes < 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
