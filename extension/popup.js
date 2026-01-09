// Popup script for NAS Download Manager extension
let downloads = [];
let serverUrl = null;
let apiKey = null;
let isConnected = false;
let globalPaused = false;
let downloadIds = new Set();
let lastProgress = {}; // Track last rendered progress percentages

// Folder picker state
let currentFolderPath = '';
let pendingDownloadUrl = null;

// Multi-select state
let selectMode = false;
let selectedDownloads = new Set();

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await checkConfiguration();
    await updateConnectionStatus();
    await loadDownloads();
    await loadInterceptSetting();
    await checkPendingDownload();

    // Set up event listeners
    setupEventListeners();

    // Listen for updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'downloads_updated') {
            downloads = message.downloads || [];
            if (message.globalPaused !== undefined) {
                globalPaused = message.globalPaused;
                updatePauseAllButton();
            }
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

    // Main UI - Add Download button opens folder picker modal
    const addDownloadBtn = document.getElementById('addDownloadBtn');
    if (addDownloadBtn) {
        addDownloadBtn.addEventListener('click', () => openFolderPicker());
    }

    const openWebUIBtn = document.getElementById('openWebUIBtn');
    if (openWebUIBtn) {
        openWebUIBtn.addEventListener('click', openWebUI);
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openOptions);
    }

    // Pause all button
    const pauseAllBtn = document.getElementById('pauseAllBtn');
    if (pauseAllBtn) {
        pauseAllBtn.addEventListener('click', togglePauseAll);
    }

    // Intercept toggle
    const interceptToggle = document.getElementById('interceptToggle');
    if (interceptToggle) {
        interceptToggle.addEventListener('change', saveInterceptSetting);
    }

    // Select mode button (in toolbar)
    const selectModeBtn2 = document.getElementById('selectModeBtn2');
    if (selectModeBtn2) {
        selectModeBtn2.addEventListener('click', toggleSelectMode);
    }

    // Select all button
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllDownloads);
    }

    // Delete selected button (in toolbar)
    const deleteSelectedBtn2 = document.getElementById('deleteSelectedBtn2');
    if (deleteSelectedBtn2) {
        deleteSelectedBtn2.addEventListener('click', deleteSelectedDownloads);
    }

    // Event delegation for download control buttons and selection
    const downloadsList = document.getElementById('downloadsList');
    if (downloadsList) {
        downloadsList.addEventListener('click', (e) => {
            // Handle checkbox clicks
            if (e.target.classList.contains('download-checkbox')) {
                const downloadItem = e.target.closest('.download-item');
                if (downloadItem) {
                    const id = downloadItem.dataset.id;
                    toggleDownloadSelection(id, e.target.checked);
                }
                return;
            }

            // Handle item click in select mode (click anywhere on the item to toggle)
            if (selectMode) {
                const downloadItem = e.target.closest('.download-item');
                if (downloadItem && !e.target.classList.contains('download-checkbox')) {
                    const id = downloadItem.dataset.id;
                    const checkbox = downloadItem.querySelector('.download-checkbox');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        toggleDownloadSelection(id, checkbox.checked);
                    }
                }
                return;
            }

            // Handle control buttons (only when not in select mode)
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

    // Folder picker modal buttons
    const closeFolderPickerBtn = document.getElementById('closeFolderPickerBtn');
    if (closeFolderPickerBtn) {
        closeFolderPickerBtn.addEventListener('click', closeFolderPicker);
    }

    const cancelFolderPickerBtn = document.getElementById('cancelFolderPickerBtn');
    if (cancelFolderPickerBtn) {
        cancelFolderPickerBtn.addEventListener('click', closeFolderPicker);
    }

    const confirmFolderPickerBtn = document.getElementById('confirmFolderPickerBtn');
    if (confirmFolderPickerBtn) {
        confirmFolderPickerBtn.addEventListener('click', confirmFolderSelection);
    }

    const createFolderBtn = document.getElementById('createFolderBtn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', createNewFolderInPicker);
    }

    // Enter key in URL input submits the form
    const downloadUrlInput = document.getElementById('downloadUrlInput');
    if (downloadUrlInput) {
        downloadUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmFolderSelection();
            }
        });
    }

    // Event delegation for breadcrumb clicks
    const folderPickerBreadcrumb = document.getElementById('folderPickerBreadcrumb');
    if (folderPickerBreadcrumb) {
        folderPickerBreadcrumb.addEventListener('click', (e) => {
            const breadcrumbItem = e.target.closest('.breadcrumb-item');
            if (breadcrumbItem && breadcrumbItem.dataset.path !== undefined) {
                navigateToFolderInPicker(breadcrumbItem.dataset.path);
            }
        });
    }

    // Event delegation for folder list clicks
    const folderPickerList = document.getElementById('folderPickerList');
    if (folderPickerList) {
        folderPickerList.addEventListener('click', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && folderItem.dataset.path !== undefined) {
                navigateToFolderInPicker(folderItem.dataset.path);
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
        apiKey = result.apiKey;
        document.getElementById('notConfigured').style.display = 'none';
        document.getElementById('mainUI').style.display = 'flex';
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
        if (response && response.globalPaused !== undefined) {
            globalPaused = response.globalPaused;
            updatePauseAllButton();
        }
        console.log('Downloads array:', downloads);
        renderDownloads();
    } catch (error) {
        console.error('Failed to load downloads:', error);
    }
}

// Render downloads list
function renderDownloads() {
    const container = document.getElementById('downloadsList');

    // Update global speed display
    updateGlobalSpeed();

    // Clean up stale selections (downloads that no longer exist)
    const currentDownloadIds = new Set(downloads.map(d => d.id));
    for (const selectedId of selectedDownloads) {
        if (!currentDownloadIds.has(selectedId)) {
            selectedDownloads.delete(selectedId);
        }
    }
    // Update selection count if any were removed
    if (selectMode) {
        updateSelectCount();
    }

    if (downloads.length === 0) {
        downloadIds.clear();
        lastProgress = {};
        container.innerHTML = '<div class="empty-state">No downloads</div>';
        return;
    }

    // Check if the structure changed (new/removed downloads, status changes, or select mode changed)
    const currentIds = new Set(downloads.map(d => d.id));
    const currentStatuses = downloads.map(d => `${d.id}:${d.status}`).join(',');
    const previousStatuses = Array.from(container.querySelectorAll('.download-item')).map(el => {
        return `${el.dataset.id}:${el.dataset.status}`;
    }).join(',');

    // Also check if select mode state matches the rendered state
    const hasSelectableItems = container.querySelector('.download-item.selectable') !== null;
    const selectModeChanged = selectMode !== hasSelectableItems;

    const structureChanged = currentIds.size !== downloadIds.size ||
                            !Array.from(currentIds).every(id => downloadIds.has(id)) ||
                            currentStatuses !== previousStatuses ||
                            selectModeChanged;

    if (structureChanged) {
        // Full re-render needed - structure changed
        downloadIds = currentIds;
        lastProgress = {};
        container.innerHTML = downloads.map(download => {
            const prog = download.progress || {};
            const downloadedBytes = prog.downloaded_bytes || 0;
            const totalBytes = prog.total_bytes || 0;
            const speedBps = prog.speed_bps || 0;

            const progress = totalBytes > 0
                ? Math.round((downloadedBytes / totalBytes) * 100)
                : 0;

            lastProgress[download.id] = progress;

            const statusClass = getStatusClass(download.status);
            const statusText = getStatusText(download.status);

            const isSelected = selectedDownloads.has(download.id);
            return `
                <div class="download-item${selectMode ? ' selectable' : ''}${isSelected ? ' selected' : ''}" data-id="${download.id}" data-status="${download.status}">
                    <div class="download-header">
                        <div class="download-header-left">
                            <div class="download-checkbox-wrapper">
                                <input type="checkbox" class="download-checkbox" ${isSelected ? 'checked' : ''}>
                            </div>
                            <div class="download-filename" title="${escapeHtml(download.filename)}">
                                ${escapeHtml(download.filename)}
                            </div>
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
                        <span data-speed="${download.id}">${download.status === 'downloading' && speedBps > 0 ? formatSpeed(speedBps) : '-'}</span>
                        <span data-bytes="${download.id}">${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        // Only update progress for downloads where percentage actually changed
        downloads.forEach(download => {
            const prog = download.progress || {};
            const downloadedBytes = prog.downloaded_bytes || 0;
            const totalBytes = prog.total_bytes || 0;
            const speedBps = prog.speed_bps || 0;

            const progress = totalBytes > 0
                ? Math.round((downloadedBytes / totalBytes) * 100)
                : 0;

            // Only update if progress percentage changed
            if (lastProgress[download.id] !== progress) {
                lastProgress[download.id] = progress;

                const progressBar = document.querySelector(`[data-progress="${download.id}"]`);
                if (progressBar && progressBar.style.width !== `${progress}%`) {
                    progressBar.style.width = `${progress}%`;
                }
            }

            // Update speed
            const speedEl = document.querySelector(`[data-speed="${download.id}"]`);
            if (speedEl) {
                const newSpeed = download.status === 'downloading' && speedBps > 0 ? formatSpeed(speedBps) : '-';
                if (speedEl.textContent !== newSpeed) {
                    speedEl.textContent = newSpeed;
                }
            }

            // Update byte counts (use textContent to avoid parsing)
            const bytesEl = document.querySelector(`[data-bytes="${download.id}"]`);
            if (bytesEl) {
                const newText = `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
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

// Format speed (bytes per second) to human readable
function formatSpeed(speedBps) {
    if (speedBps >= 1048576) {
        // >= 1 MB/s: show MB/s
        return (speedBps / 1048576).toFixed(2) + ' MB/s';
    } else if (speedBps >= 1024) {
        // >= 1 KB/s: show KB/s
        return (speedBps / 1024).toFixed(2) + ' KB/s';
    } else if (speedBps > 0) {
        // < 1 KB/s: show B/s
        return speedBps.toFixed(0) + ' B/s';
    } else {
        return '0 B/s';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load intercept setting
async function loadInterceptSetting() {
    try {
        const result = await chrome.storage.sync.get(['interceptDownloads']);
        const interceptToggle = document.getElementById('interceptToggle');
        if (interceptToggle) {
            // Default to true if not set
            interceptToggle.checked = result.interceptDownloads !== false;
        }
    } catch (error) {
        console.error('Failed to load intercept setting:', error);
    }
}

// Save intercept setting
async function saveInterceptSetting() {
    try {
        const interceptToggle = document.getElementById('interceptToggle');
        const enabled = interceptToggle.checked;

        await chrome.storage.sync.set({ interceptDownloads: enabled });

        // Notify background script
        chrome.runtime.sendMessage({
            type: 'intercept_setting_changed',
            enabled: enabled
        });

        console.log('Intercept setting saved:', enabled);
    } catch (error) {
        console.error('Failed to save intercept setting:', error);
    }
}

// ============ Folder Picker Functions ============

// Check for pending download from context menu
async function checkPendingDownload() {
    try {
        const result = await chrome.storage.local.get(['pendingDownloadUrl']);
        if (result.pendingDownloadUrl) {
            // Clear from storage
            await chrome.storage.local.remove(['pendingDownloadUrl']);

            // Open folder picker with the pending URL
            await openFolderPicker(result.pendingDownloadUrl);
        }
    } catch (error) {
        console.error('Failed to check pending download:', error);
    }
}

// Open folder picker
async function openFolderPicker(url = '') {
    pendingDownloadUrl = url;
    currentFolderPath = '';

    // Set URL in the input field
    const urlInput = document.getElementById('downloadUrlInput');
    if (urlInput) {
        urlInput.value = url;
        // Focus the input if no URL provided
        if (!url) {
            setTimeout(() => urlInput.focus(), 100);
        }
    }

    // Show modal
    document.getElementById('folderPickerModal').style.display = 'flex';

    // Load root folders
    await navigateToFolderInPicker('');
}

// Close folder picker
function closeFolderPicker() {
    document.getElementById('folderPickerModal').style.display = 'none';
    pendingDownloadUrl = null;
    currentFolderPath = '';
}

// Navigate to a folder in picker
async function navigateToFolderInPicker(path) {
    currentFolderPath = path;

    const folderListEl = document.getElementById('folderPickerList');

    // Show loading state
    folderListEl.innerHTML = '<div class="folder-list-loading">Loading folders...</div>';

    try {
        const endpoint = path ? `/api/folders?path=${encodeURIComponent(path)}` : '/api/folders';
        const response = await fetch(`${serverUrl}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Update breadcrumb
        renderFolderPickerBreadcrumb(path);

        // Render folder list
        renderFolderPickerList(data.folders || [], path);
    } catch (error) {
        console.error('Failed to load folders:', error);
        folderListEl.innerHTML = '<div class="folder-list-empty">Failed to load folders</div>';
    }
}

// Render breadcrumb
function renderFolderPickerBreadcrumb(path) {
    const breadcrumbEl = document.getElementById('folderPickerBreadcrumb');

    if (!path) {
        // Root directory
        breadcrumbEl.innerHTML = '<span class="breadcrumb-item" data-path="">Downloads</span>';
    } else {
        // Build breadcrumb from path parts
        const parts = path.split('/').filter(p => p);
        let html = '<span class="breadcrumb-item" data-path="">Downloads</span>';

        let currentPath = '';
        parts.forEach((part) => {
            currentPath += (currentPath ? '/' : '') + part;
            const pathForClick = currentPath;
            html += '<span class="breadcrumb-separator">/</span>';
            html += `<span class="breadcrumb-item" data-path="${escapeHtml(pathForClick)}">${escapeHtml(part)}</span>`;
        });

        breadcrumbEl.innerHTML = html;
    }

    // Scroll to the right to show current folder
    setTimeout(() => {
        breadcrumbEl.scrollLeft = breadcrumbEl.scrollWidth;
    }, 0);
}

// Render folder list
function renderFolderPickerList(folders, currentPath) {
    const folderListEl = document.getElementById('folderPickerList');

    if (folders.length === 0 && !currentPath) {
        folderListEl.innerHTML = '<div class="folder-list-empty">No folders yet. Click "+" to create one.</div>';
        return;
    }

    let html = '';

    // Add parent folder option if not at root
    if (currentPath) {
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        html += `
            <div class="folder-item parent-folder" data-path="${escapeHtml(parentPath)}">
                <svg class="folder-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 15l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="folder-item-name">..</span>
            </div>
        `;
    }

    // Add folders
    folders.forEach(folder => {
        html += `
            <div class="folder-item" data-path="${escapeHtml(folder.path)}">
                <svg class="folder-item-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-8L9 5H5c-1.1 0-2 .9-2 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
                <span class="folder-item-name">${escapeHtml(folder.name)}</span>
            </div>
        `;
    });

    if (folders.length === 0 && currentPath) {
        html += '<div class="folder-list-empty">No subfolders</div>';
    }

    folderListEl.innerHTML = html;
}

// Create new folder in picker
async function createNewFolderInPicker() {
    const folderName = prompt('Enter the name for the new folder:');

    if (!folderName) {
        return; // User cancelled
    }

    // Validate folder name
    if (folderName.includes('/') || folderName.includes('\\')) {
        alert('Folder name cannot contain / or \\');
        return;
    }

    if (folderName.trim() === '') {
        alert('Folder name cannot be empty');
        return;
    }

    // Construct new folder path
    const newFolderPath = currentFolderPath
        ? `${currentFolderPath}/${folderName}`
        : folderName;

    try {
        const response = await fetch(`${serverUrl}/api/folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ path: newFolderPath })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Reload current folder
        await navigateToFolderInPicker(currentFolderPath);
    } catch (error) {
        console.error('Failed to create folder:', error);
        alert('Failed to create folder: ' + error.message);
    }
}

// Confirm folder selection and add download
async function confirmFolderSelection() {
    // Get URL from input field
    const urlInput = document.getElementById('downloadUrlInput');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        alert('Please enter a download URL');
        if (urlInput) urlInput.focus();
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        if (urlInput) urlInput.focus();
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            type: 'add_download',
            url: url,
            folder: currentFolderPath
        });

        // Close modal
        closeFolderPicker();

        // Reload downloads after short delay
        setTimeout(loadDownloads, 500);
    } catch (error) {
        console.error('Failed to add download:', error);
        alert('Failed to add download');
    }
}

// ============ Global Pause/Resume Functions ============

// Toggle pause all downloads
async function togglePauseAll() {
    try {
        if (globalPaused) {
            await chrome.runtime.sendMessage({ type: 'resume_all_downloads' });
        } else {
            await chrome.runtime.sendMessage({ type: 'pause_all_downloads' });
        }
    } catch (error) {
        console.error('Failed to toggle pause all:', error);
    }
}

// Update the pause all button appearance
function updatePauseAllButton() {
    const pauseAllBtn = document.getElementById('pauseAllBtn');
    const pauseAllIcon = document.getElementById('pauseAllIcon');
    const playAllIcon = document.getElementById('playAllIcon');

    if (!pauseAllBtn || !pauseAllIcon || !playAllIcon) {
        return;
    }

    if (globalPaused) {
        // Show play icon (to resume)
        pauseAllIcon.style.display = 'none';
        playAllIcon.style.display = 'block';
        pauseAllBtn.classList.add('paused');
        pauseAllBtn.title = 'Resume All Downloads';
    } else {
        // Show pause icon (to pause)
        pauseAllIcon.style.display = 'block';
        playAllIcon.style.display = 'none';
        pauseAllBtn.classList.remove('paused');
        pauseAllBtn.title = 'Pause All Downloads';
    }
}

// Update global download speed display
function updateGlobalSpeed() {
    const globalSpeedValue = document.getElementById('globalSpeedValue');
    if (!globalSpeedValue) return;

    // Sum up speed from all downloading items
    let totalSpeed = 0;
    downloads.forEach(download => {
        if (download.status === 'downloading' && download.progress && download.progress.speed_bps) {
            totalSpeed += download.progress.speed_bps;
        }
    });

    globalSpeedValue.textContent = formatSpeed(totalSpeed);
}

// ============ Multi-Select Functions ============

// Toggle select mode
function toggleSelectMode() {
    selectMode = !selectMode;

    const mainUI = document.getElementById('mainUI');
    const selectModeBtn = document.getElementById('selectModeBtn2');

    if (selectMode) {
        mainUI.classList.add('select-mode');
        if (selectModeBtn) {
            selectModeBtn.classList.add('select-active');
            selectModeBtn.title = 'Exit Selection Mode';
        }
    } else {
        mainUI.classList.remove('select-mode');
        if (selectModeBtn) {
            selectModeBtn.classList.remove('select-active');
            selectModeBtn.title = 'Select Downloads';
        }
        // Clear selections when exiting select mode
        selectedDownloads.clear();
    }

    // Re-render to update the UI
    renderDownloads();
    updateSelectCount();
}

// Toggle selection of a single download
function toggleDownloadSelection(id, isSelected) {
    if (isSelected) {
        selectedDownloads.add(id);
    } else {
        selectedDownloads.delete(id);
    }

    // Update visual state of the item
    const downloadItem = document.querySelector(`.download-item[data-id="${id}"]`);
    if (downloadItem) {
        if (isSelected) {
            downloadItem.classList.add('selected');
        } else {
            downloadItem.classList.remove('selected');
        }
    }

    updateSelectCount();
}

// Update the selection count display
function updateSelectCount() {
    const selectCount = document.getElementById('selectCount2');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn2');
    const selectAllBtn = document.getElementById('selectAllBtn');

    const count = selectedDownloads.size;

    if (selectCount) {
        selectCount.textContent = `${count} selected`;
    }

    // Enable/disable delete button based on selection
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = count === 0;
    }

    // Update select all button text
    if (selectAllBtn) {
        const allSelected = downloads.length > 0 && count === downloads.length;
        selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
    }
}

// Select all downloads
function selectAllDownloads() {
    const allSelected = downloads.length > 0 && selectedDownloads.size === downloads.length;

    if (allSelected) {
        // Deselect all
        selectedDownloads.clear();
    } else {
        // Select all
        downloads.forEach(d => selectedDownloads.add(d.id));
    }

    // Force full re-render by clearing cached IDs
    downloadIds.clear();
    renderDownloads();
    updateSelectCount();
}

// Delete all selected downloads
async function deleteSelectedDownloads() {
    if (selectedDownloads.size === 0) {
        return;
    }

    const count = selectedDownloads.size;
    const confirmed = confirm(`Delete ${count} download${count > 1 ? 's' : ''}?`);

    if (!confirmed) {
        return;
    }

    // Convert to array to iterate
    const idsToDelete = Array.from(selectedDownloads);

    // Delete each selected download
    for (const id of idsToDelete) {
        try {
            await chrome.runtime.sendMessage({
                type: 'cancel_download',
                id: id
            });
        } catch (error) {
            console.error(`Failed to delete download ${id}:`, error);
        }
    }

    // Clear selections and exit select mode
    selectedDownloads.clear();
    toggleSelectMode();

    // Reload downloads after a short delay
    setTimeout(loadDownloads, 500);
}
