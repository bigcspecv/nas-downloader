# nas-downloader - Reference Document

This file contains archived working context and established coding patterns. It is referenced by `llm-context.md` to reduce token usage while keeping important information accessible.

---

## Working Context Archive

Historical steps that have been archived from the main context document.

<!-- ARCHIVE-START -->
| Step | What happened |
|------|---------------|
| 1 | Created project directory structure: server/ with static/ and db/ subdirectories, extension/ with icons/ subdirectory. All directories created using mkdir -p on Windows. |
| 2 | Created .env.example with all environment variables (API_KEY, PORT, ALLOWED_ORIGINS, etc.). Updated existing .gitignore to add project-specific ignores (downloads/, data/, *.db). Created docker-compose.yml with service definition, volume mounts, and environment variable passing. |
| 3 | Created server/requirements.txt with Python dependencies: Flask 3.0.0, flask-sock 0.7.0, aiohttp 3.9.1, python-dotenv 1.0.0. Created server/Dockerfile using python:3.11-alpine base, installing deps, copying app, creating /downloads and /app/data directories, exposing port 6199. |
| 4 | Created server/db/schema.sql: downloads table with TEXT id (for UUIDs), status enum (queued/downloading/paused/completed/failed), progress tracking (downloaded_bytes, total_bytes), timestamps. Settings table as key-value pairs with default entries for global_rate_limit_bps (0) and max_concurrent_downloads (3). |
| 5 | Created server/app.py with Flask skeleton: CORS support (configurable via ALLOWED_ORIGINS env), Bearer token authentication middleware using constant-time comparison, DB initialization from schema.sql, SQLite connection helper with Row factory, all route placeholders (folders, settings, downloads, WebSocket). Added flask-cors 4.0.0 to requirements.txt. |
| 6 | Implemented folder endpoints: GET /api/folders lists subdirectories (accepts optional ?path= query param), POST /api/folders creates new folder (JSON body with 'path' field). Added validate_path() helper using os.path.commonpath to prevent path traversal attacks - validates resolved paths stay within DOWNLOAD_PATH. Returns normalized paths with forward slashes. |
| 7 | Implemented settings endpoints: GET /api/settings returns all settings as JSON object, PATCH /api/settings updates one or more settings (partial updates). Validates setting keys against whitelist (global_rate_limit_bps, max_concurrent_downloads), validates values are numeric, enforces constraints (rate_limit >= 0, concurrent >= 1). Stores as TEXT, accepts string or int input. |
| 8 | Created server/download_manager.py with Download and DownloadManager classes. Download handles individual downloads via aiohttp with pause/resume using HTTP Range headers, calculates speed/ETA, persists state every 5s. DownloadManager loads existing downloads on init, enforces max concurrent downloads, applies global rate limiting (bytes-per-second tracking), auto-processes queue, resets 'downloading' status to 'queued' on startup for crash recovery. |
| 9 | Code review of download_manager.py confirmed implementation is complete and production-ready. All download logic already implemented in step 8: aiohttp with async/await, pause/resume via HTTP Range headers with 206 status handling, global rate limiting with per-second byte tracking, speed/ETA calculation, concurrent download management, error handling, and resource cleanup. No issues found. |
| 10 | Implemented download endpoints in app.py: GET /api/downloads (list all), POST /api/downloads (create with url/folder/filename), GET/PATCH/DELETE /api/downloads/<id> (get/pause-resume/cancel), POST /api/downloads/pause-all and resume-all. Fixed Flask async compatibility by using background event loop in separate thread with asyncio.run_coroutine_threadsafe(). Fixed process_queue race condition where tasks were cleaned up too late. Added error_message field to download progress response. Tested and verified: HTTP downloads work perfectly, HTTPS downloads work with valid SSL certificates, invalid/expired certificates are properly rejected by aiohttp's default SSL handling, progress tracking accurate (bytes/percentage/speed/ETA), queue management functional. |
| 11 | Implemented WebSocket endpoint at /ws using flask-sock. Authentication via api_key query parameter (constant-time comparison). Sends initial download status on connect, then broadcasts updates every 1 second to all connected clients. WebSocket handler manages client set (add on connect, remove on disconnect). Background broadcast_downloads() task runs in background event loop, sends JSON messages with type='status' and downloads array. Clients can send JSON messages (currently just echoed back for future extensibility). |
| 12 | Created server/static/index.html - complete web UI with WebSocket connectivity, real-time download status display, add download form with URL/folder/filename fields, per-download controls (pause/resume/cancel), bulk operations (pause-all/resume-all), global rate limit settings with unit selector (B/s, KB/s, MB/s), responsive design with dark theme. API key authentication via URL hash, auto-reconnection with exponential backoff. Progress bars show percentage, speed (MB/s), ETA, status badges. |
| 13 | Created server/static/style.css by extracting all CSS from index.html. Complete stylesheet with dark theme colors, responsive grid layout, progress bars with state-specific colors (downloading/paused/completed/failed), status badges, button styles (primary/secondary/danger), form controls, and mobile-responsive media queries for screens under 768px. Updated index.html to link to external stylesheet. |
| 14 | Created server/static/app.js by extracting all JavaScript from index.html. Implements WebSocket client with auto-reconnection (exponential backoff up to 30s, max 10 attempts), real-time download rendering, API key authentication (URL hash or prompt), API wrapper functions for all download/settings operations, DOM manipulation for progress bars and status updates, ETA/speed formatting, HTML escaping for XSS protection. Updated index.html to link to external script. |
| 14+ | Fixed multiple UI bugs: 1) Fixed static file paths to use /static/ prefix for Flask serving. 2) Fixed NaN display for queued downloads by handling null bytes. 3) Fixed pause/resume button logic - queued and paused downloads show correct buttons. 4) Fixed global_paused behavior - new downloads start paused when global pause enabled, resume_download bypasses global pause and starts immediately. 5) Converted Pause All/Resume All to single toggle button that tracks server state via WebSocket. 6) Fixed rate limiting - improved algorithm to calculate expected time and sleep accurately, dynamic chunk sizing based on rate limit. 7) Fixed settings update to apply immediately to download_manager in-memory state. |
| 15-17 | Completed Phase 5 initial refinement: Verified rate limiting works accurately with various speeds (1KB/s to 100KB/s+), confirmed pause/resume behavior for individual downloads and global pause toggle, validated download status display shows correct buttons and data for all states (queued/downloading/paused/completed/failed). All core functionality tested and working. |
| 17 | Improve download status display (queued/downloading/paused/completed/failed states) |
| 17.5 | Restructured project phases based on UX/UI assessment. Split original Phase 5 into 6 focused phases: Phase 5 (Critical UI Bug Fixes - progress bar display), Phase 6 (Multi-User Real-Time Sync - settings broadcast), Phase 7 (Folder Management Interface - browser UI), Phase 8 (Download File Management - in-progress extensions), Phase 9 (Testing & Edge Cases), Phase 10 (UI Polish). Renumbered Chrome Extension to Phase 11 and Finalize to Phase 12. Total checklist now has 50 steps instead of 28. |
| 18 | Fixed progress bar display by updating app.js to access nested progress object (download.progress.downloaded_bytes, etc.). Added lightning bolt icon to download speed display and show last speed for paused downloads. |
| 19 | Fixed progress data display edge cases: added lightning bolt emoji to speed displays (missing from step 18), handle unknown file sizes gracefully (show '?' and 'size unknown' when Content-Length is 0), ensure all progress data displays correctly in all download states (queued/downloading/paused/completed) |
| 20 | Enhanced error handling and user feedback with toast notification system, form validation (client-side with real-time feedback), improved API error messages, loading states on buttons, better WebSocket reconnection logic with user notifications, comprehensive input validation on server (URL format, path traversal, filename sanitization), and specific error handling for different failure modes (network errors, permission errors, validation errors) |
| 21 | Added WebSocket broadcasting for settings changes. Server broadcasts settings_update messages when settings are modified via PATCH /api/settings. Frontend handles settings_update messages and updates UI (rate limit field) automatically for real-time multi-user sync. |
| 22 | Added max concurrent downloads UI control with validation, update function, and real-time sync via WebSocket. All settings (rate limit and max concurrent) now update automatically across all connected users when changed. |
| 23 | Fixed resume_all to respect max_concurrent_downloads limit. Changed resume_all to set paused downloads to queued status instead of starting them immediately, allowing process_queue to enforce concurrency limits properly. |
| 24 | Overhauled WebUI with unique dark theme design: left sidebar navigation with categories (All/Active/Completed/Paused/Failed), teal/cyan gradient accent colors, table-based download list, toolbar with New Download/Pause All/Delete buttons, always-visible search, modals for add download and settings, bottom status bar showing global speed and active downloads. Replaced generic Free Download Manager clone with unique nas-downloader branding. |
| 24 | Completed WebUI overhaul with custom modal system and authentication error handling. Created generic dialog modal (confirm/prompt/alert) with keyboard support and danger mode, replacing all standard JS dialogs. Fixed WebSocket auth failures to send auth_error message type, stop reconnect loop, and prompt for new API key using custom modal. |
| 25-29 | Implemented folder browser UI component with Save As dialog appearance: breadcrumb navigation with compact spacing and auto-scroll to current folder, folder list with click-to-navigate and parent folder (..) support, New Folder button with validation, animated scroll indicator (.../) that fades in when breadcrumb is scrolled. Used llm-tools/add-icon.bat to properly add heroicons (home, folder, folder-plus, arrow-up). |
| 30-32 | Implemented in-progress file extension system: downloads now write to .ndownload temp files during transfer, automatically rename to final filename on completion, and properly handle pause/resume with temp files. Updated cancel() to delete correct file based on completion status. Fixed download-row folder icon: replaced emoji with themed folder icon and aligned with flexbox. |
| 33 | Implemented URL filename parsing in WebUI: auto-extracts filename from URL input, decodes URL-encoded characters (%20 -> space), strips query parameters and fragments. Added onUrlChange() to auto-fill filename field and onFilenameChange() to track manual edits (prevents overwriting user input). Resets userModified flag on modal close. |
| 34.01 | Fixed duplicate temp file issue: made DOWNLOAD_PATH and DATA_PATH always resolve to absolute paths using os.path.abspath(). This prevents path resolution differences based on current working directory. Deleted obsolete server/downloads directory that was created from previous relative path issues. |
| 34.02 | Implemented intelligent filename conflict handling: added /api/downloads/check-filename endpoint and check_filename_conflict() method in DownloadManager. Auto-filled filenames (from URLs) silently rename to unique names (file (1).ext) when conflicts detected. User-typed filenames show yellow warning for conflicts. Overwrite dialog appears on submit with conflicting filename - if confirmed, deletes existing file via overwrite=true flag. Checks both final and .ndownload temp files. Re-checks conflicts when folder changes. Fixed .btn-danger styling to have proper padding/border-radius. |
| 34.03 | Fixed temp file cleanup on cancellation: added await for task.cancel() to ensure download task fully completes before deleting temp file. This ensures file handles are closed before deletion attempt. Added error logging for failed deletions. |
| 34.03 | Fixed temp file cleanup on cancellation: added await for task.cancel() to ensure download task fully completes before deleting temp file. This ensures file handles are closed before deletion attempt. Added error logging for failed deletions. |
| 34.04 | Fixed rate limit input validation: changed from type='number' to type='text' with pattern='[0-9]*' and inputmode='numeric' to prevent decimal entry at input level using inline oninput handler. Added rate limit display to status bar showing current limit (unlimited or formatted speed). Made rate limit display use formatSpeed() for consistency with download speed formatting. |
| 34.05 | Changed temp file naming from filename.ext.ndownload to {download_id}.ndownload for crash recovery and uniqueness. Updated get_temp_file_path() to use ID-based naming, simplified _get_unique_filename() to only check final files, and updated add_download() overwrite logic to only delete final files since temp files are ID-based. |
| 34.06 | Updated download actions UI to show disabled 'Queued' button for queued downloads instead of 'Pause' button. Added .btn-disabled CSS class with reduced opacity and disabled hover effects for status-only buttons. |
| 35 | Added initial page load skeleton screens with shimmer animation for sidebar navigation (5 items) and downloads table (3 rows). Skeletons automatically hide and show real content when first WebSocket status message is received. |
| 36 | Implemented mobile responsive design with 3 breakpoints (968px, 768px, 480px). Added hamburger menu toggle for mobile navigation. Created 4-row CSS Grid layout for mobile download cards following user's CSV specification: checkbox and filename/URL span rows 1-2, action buttons span all rows in column 3, speed in row 3, progress bar spans columns 1-2 in row 4. Scoped initializeIcons() to prevent icon refresh flicker. Progress bars use consistent thin 4px styling across all devices. |
| 36 | Implemented mobile responsive design with 3 breakpoints (968px, 768px, 480px). Added hamburger menu toggle for mobile navigation. Created 4-row CSS Grid layout for mobile download cards: checkbox and filename/URL span rows 1-2, action buttons span all rows in column 3, speed and progress text in row 3 (speed right-aligned), progress bar in row 4. Added Settings to navigation menu for mobile access. Fixed mobile nav collapse with opacity/visibility transitions. Added onchange event handlers alongside oninput for better mobile browser compatibility with filename conflict detection. Scoped initializeIcons() to prevent icon refresh flicker. Progress bars use consistent thin 4px styling across all devices. |
| 37 | Added comprehensive state transition animations: progress bars with shimmer effect (0.5s cubic-bezier), speed indicator pulse animation, download row hover transforms, connection status pulse with box-shadow, modal fade/slide-in animations, navigation and folder browser hover effects, and smooth color transitions for all status changes. All animations use hardware-accelerated CSS transforms with Material Design standard easing. |
| 38 | Polished visual design with comprehensive design system: created CSS custom properties for spacing (4px scale), typography (consistent font sizes and line heights), border radius, and transitions. Applied design tokens across all components for consistent spacing, colors, and typography. Standardized all padding, margins, gaps, font sizes, border-radius, and transitions to use variables. This ensures visual consistency and makes future design changes much easier. |
| 39 | Added error message display in UI for failed downloads. Shows error text with warning icon below URL, 'Failed' status button, and toast notifications when downloads fail. Fixed speed indicator to show 0 when download stalls (no bytes for 3+ seconds). Tested DNS failures (handled correctly with error messages), connection drops (resume automatically), and verified 300s socket read timeout is configured. Added exclamation-triangle icon to icon set. |
| 44 | Created extension/manifest.json with Manifest V3 config: storage/contextMenus/activeTab permissions, host_permissions for all URLs, background service worker, popup action, options page, and icon references for 16/48/128px sizes. |
| 45 | Created extension/options.html + options.js with server URL and API key configuration form. Includes connection testing, settings persistence via chrome.storage.sync, real-time connection status indicator, and matches web UI design system (same color palette, spacing, typography tokens). |
| 46 | Created extension/background.js service worker with WebSocket connection, auto-reconnect logic (5s interval), context menu for 'Download with NAS', badge status indicator, download state management, message handling for popup/options communication, and API methods for pause/resume/cancel operations. |
| 47 | Created extension/popup.html + popup.js with compact popup UI (380px width): connection status, add download form, downloads list with progress bars and status indicators, pause/resume/cancel controls, empty/not-configured states, and links to open web UI and settings. Matches web UI design system. |
| 48 | Created HTML-based icon generator (extension/generate-icons.html) that generates 16x16, 48x48, and 128x128 PNG icons with gradient background and download arrow symbol. Includes instructions in extension/icons/README.md for generating and installing placeholder icons. |
| 48.01 | Fixed Chrome extension popup bugs: Added download speed display (formatSpeed function), fixed progress to access nested progress object (progress.downloaded_bytes/total_bytes instead of direct properties), fixed pause/resume buttons to use PATCH /api/downloads/id with action body instead of non-existent /pause and /resume endpoints, added 1s linear transition to progress bar for smooth animation. |
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission to manifest.json, implemented chrome.downloads.onCreated listener in background.js that cancels browser downloads and sends them to server via existing addDownload() function. All downloads now automatically routed to NAS download manager. |
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission to manifest.json, implemented chrome.downloads.onCreated listener in background.js that cancels browser downloads and sends them to server via existing addDownload() function. Updated context menu items: renamed to 'NAS Download' and added 'NAS Download to' menu item (same functionality for now, will be updated later). |
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission to manifest.json, implemented chrome.downloads.onCreated listener in background.js that cancels browser downloads and sends them to server via existing addDownload() function. Updated context menu items: renamed to 'NAS Download' and added 'NAS Download to' menu item. Added intercept toggle switch in popup footer with CSS styling, popup.js handlers to save/load setting, and background.js logic to respect the setting (defaults to enabled). |
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission to manifest.json, implemented chrome.downloads.onCreated listener in background.js that cancels browser downloads and sends them to server. Updated context menu items: renamed to 'NAS Download' and added 'NAS Download to'. Added intercept toggle switch in popup footer. Moved settings and web UI buttons from footer to header as icon buttons (gear for settings, grid for web UI) to save space and reduce footer clutter. |
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission, implemented chrome.downloads.onCreated listener that intercepts and cancels browser downloads when enabled. Context menu items updated to 'NAS Download' and 'NAS Download to'. Added intercept toggle in popup footer. Moved settings/web UI buttons to header as Heroicons outline icons (window, cog-6-tooth). Toggle persists setting, defaults to enabled, allows normal Chrome downloads when disabled. |
| 48.02.02 | Added folder picker to Chrome extension: Created modal with breadcrumb navigation and folder list UI. Implemented folder navigation functions (navigateToFolderInPicker, renderFolderPickerBreadcrumb, renderFolderPickerList, createNewFolderInPicker). Added 'Add to...' button next to main Add button in popup that opens folder picker. Updated background.js context menu handlers so 'NAS Download to' stores URL and shows notification to open popup. Added checkPendingDownload() function to automatically open folder picker on popup open when context menu 'Download to' was used. Users can now select destination folder when adding downloads via manual URL entry or context menu. |
| 48.02.02 | Added folder picker modal to Chrome extension popup with breadcrumb navigation and folder list UI. Simplified UX by consolidating to single Add button that opens folder picker. Modified background.js context menu handlers so 'NAS Download to' stores URL and auto-opens popup. Users can now select destination folder for manual URL entry and context menu downloads. Fixed footer positioning issue caused by duplicate CSS rules overriding flex-shrink property. |
| 48.02.04 | Added custom scrollbar styling to Chrome extension popup. Downloads list and folder list now have matching dark-themed scrollbars with 8px width, rounded thumb with border padding trick, and hover highlight. Uses existing CSS variables (--bg-secondary, --bg-tertiary, --border-color, --text-muted) for consistency. |
| 48.02.05 | Added multi-select delete feature to Chrome extension popup: toolbar with select mode toggle, selection count with divider, Select All button, and Delete button. Moved URL input to folder picker modal. Add Download button pinned as 32x32 square on right. All toolbar buttons standardized to 28px height. Fixed Select All by forcing full re-render to update checkbox states. |
| 48.02.07 | Added max concurrent downloads setting to Chrome extension settings modal. Input field with validation (1-10 range). Updated loadServerSettings to populate value from server and saveServerSettings to save both rate limit and max concurrent in single PATCH request. |
| 34.07-34.09 | Fixed three Phase 8 bugs: (1) 34.07 - _get_unique_filename now checks in-progress downloads for filename conflicts in same folder, preventing collisions when downloads complete. (2) 34.08 - Added set_max_concurrent_downloads() and enforce_concurrency_limit() methods to pause excess downloads when limit is reduced. (3) 34.09 - Converted webui download rows to card layout matching extension style: card header with checkbox/filename/icon buttons, 4px progress bar, info row with status badge/size/speed. Updated skeleton loaders and responsive CSS. |
<!-- ARCHIVE-END -->

---

## Code Patterns

Established patterns for this project. Each pattern is marked with SECTION-START and SECTION-END comments for efficient lookup via grep.

<!-- SECTION-START: Authentication -->
### Authentication

```python
# Decorator on all protected routes
@require_auth
def my_endpoint():
    # Route implementation
    pass

# Uses Bearer token: Authorization: Bearer {API_KEY}
# Constant-time comparison to prevent timing attacks
```
<!-- SECTION-END: Authentication -->

<!-- SECTION-START: Database Access -->
### Database Access

```python
# Get connection with Row factory for dict-like access
conn = get_db()
cursor = conn.cursor()

# Query example
cursor.execute("SELECT * FROM downloads WHERE id = ?", (download_id,))
row = cursor.fetchone()
# Access by column name: row['id'], row['status'], etc.

# Always close connection
conn.close()
```
<!-- SECTION-END: Database Access -->

<!-- SECTION-START: Download Manager Usage -->
### Download Manager Usage

```python
# Initialize manager (typically at app startup)
from download_manager import DownloadManager
manager = DownloadManager(db_path='/app/data/downloads.db', download_path='/downloads')

# Add download (returns UUID)
download_id = await manager.add_download(url='https://example.com/file.zip', folder='my_folder', filename='custom.zip')

# Control downloads
await manager.pause_download(download_id)
await manager.resume_download(download_id)
await manager.cancel_download(download_id)
await manager.pause_all()
await manager.resume_all()

# Get download info
downloads = await manager.get_downloads()  # Returns list of dicts with progress info

# Set rate limit
await manager.set_rate_limit(1048576)  # bytes per second (0 = unlimited)
```
<!-- SECTION-END: Download Manager Usage -->

<!-- SECTION-START: Download Endpoints -->
### Download Endpoints (Sync with Background Event Loop)

```python
# Background event loop for async operations (daemon thread)
background_loop = asyncio.new_event_loop()
background_thread = threading.Thread(target=start_background_loop, args=(background_loop,), daemon=True)

# Helper to run async functions from sync Flask routes
def run_async(coro):
    future = asyncio.run_coroutine_threadsafe(coro, background_loop)
    return future.result()

# All download endpoints are sync but use run_async() to call download_manager
@app.route('/api/downloads', methods=['POST'])
@require_auth
def create_download():
    data = request.get_json()
    # Validate required fields
    download_id = run_async(download_manager.add_download(url, folder, filename))
    return jsonify(download_info), 201

# PATCH uses 'action' field for operations
@app.route('/api/downloads/<download_id>', methods=['PATCH'])
@require_auth
def update_download(download_id):
    action = data['action']  # 'pause' or 'resume'
    if action == 'pause':
        run_async(download_manager.pause_download(download_id))
    elif action == 'resume':
        run_async(download_manager.resume_download(download_id))
```
<!-- SECTION-END: Download Endpoints -->

<!-- SECTION-START: WebSocket Broadcasting -->
### WebSocket Broadcasting

```python
# WebSocket endpoint with authentication via query parameter
@sock.route('/ws')
def websocket_handler(ws):
    # Authenticate using query parameter
    api_key = request.args.get('api_key')
    if not api_key or not compare_digest(api_key, API_KEY):
        ws.send(json.dumps({'error': 'Authentication failed'}))
        ws.close()
        return

    # Add client to tracking set
    websocket_clients.add(ws)

    try:
        # Send initial status
        downloads = run_async(download_manager.get_downloads())
        ws.send(json.dumps({'type': 'status', 'downloads': downloads}))

        # Keep connection alive
        while True:
            message = ws.receive()
            if message is None:
                break
            # Handle messages here
    finally:
        websocket_clients.discard(ws)

# Background broadcast task (runs in background event loop)
async def broadcast_downloads():
    while True:
        await asyncio.sleep(1)  # Broadcast every second
        if websocket_clients:
            downloads = await download_manager.get_downloads()
            message = json.dumps({'type': 'status', 'downloads': downloads})
            for client in websocket_clients.copy():
                try:
                    client.send(message)
                except:
                    websocket_clients.discard(client)

# Start broadcast task on app startup
broadcast_task = asyncio.run_coroutine_threadsafe(broadcast_downloads(), background_loop)

# Client connection example: ws://localhost:6199/ws?api_key=your-secret-key-here
```
<!-- SECTION-END: WebSocket Broadcasting -->

<!-- SECTION-START: Error Response Format -->
### Error Response Format

```python
# All errors return JSON with 'error' key
return jsonify({'error': 'Error message here'}), status_code

# Examples:
# 401: {'error': 'Invalid API key'}
# 404: {'error': 'Not found'}
# 500: {'error': 'Internal server error'}
```
<!-- SECTION-END: Error Response Format -->

<!-- SECTION-START: Path Traversal Protection -->
### Path Traversal Protection

```python
# Use validate_path() helper for all user-provided paths
target_path = validate_path(user_provided_path)
if target_path is None:
    return jsonify({'error': 'Invalid path'}), 400

# validate_path() uses os.path.commonpath to ensure resolved path
# stays within DOWNLOAD_PATH, preventing ../ attacks
```
<!-- SECTION-END: Path Traversal Protection -->

<!-- SECTION-START: Settings Validation -->
### Settings Validation

```python
# Settings are stored as TEXT, accept string or int
# Validate against whitelist of valid keys
valid_keys = {'global_rate_limit_bps', 'max_concurrent_downloads'}

# Validate value is numeric and meets constraints
int_value = int(value)
if key == 'global_rate_limit_bps' and int_value < 0:
    return error
if key == 'max_concurrent_downloads' and int_value < 1:
    return error
```
<!-- SECTION-END: Settings Validation -->

<!-- SECTION-START: Icon System -->
### Icon System

The project uses individual Heroicons SVG files that are loaded and inlined via JavaScript. This approach avoids the fragility of sprite files while maintaining full CSS styling control.

**Architecture:**
- **Source:** Official Heroicons (npm package) in `node_modules/heroicons/24/outline/`
- **Deployed:** Individual SVG files in `server/static/images/icons/`
- **Loading:** JavaScript fetches and inlines SVGs on page load
- **Styling:** Inlined SVGs support full CSS control (colors via `currentColor`, sizes via classes)

**HTML Usage:**
```html
<!-- Static HTML: Use placeholders that JavaScript will replace -->
<span class="icon-placeholder" data-icon="trash" data-class="icon"></span>
<span class="icon-placeholder" data-icon="arrow-down-tray" data-class="icon icon-lg"></span>
```

**JavaScript Usage:**
```javascript
// Dynamic content: Generate placeholder string
button.innerHTML = `
    <span class="icon-placeholder" data-icon="play" data-class="icon"></span>
    Resume All
`;

// After updating DOM, initialize icons
initializeIcons();
```

**How it works:**
1. Page loads with `<span class="icon-placeholder">` placeholders
2. On `DOMContentLoaded`, `initializeIcons()` runs:
   - Finds all `.icon-placeholder` elements
   - Fetches SVG from `/static/images/icons/{name}.svg` (cached)
   - Parses SVG and replaces placeholder with actual `<svg>` element
   - Applies CSS classes from `data-class` attribute
3. After dynamically updating DOM, call `initializeIcons()` again

**Adding new icons:**
```bash
# Windows
llm-tools/add-icon.bat arrow-right

# Unix/Mac
llm-tools/add-icon.sh arrow-right
```

Script copies icon from `node_modules/heroicons/24/outline/` to `server/static/images/icons/`.

**Icon classes:**
- `.icon` - Default size (18px)
- `.icon-sm` - Small (14px)
- `.icon-lg` - Large (64px)

**Why individual files instead of sprite:**
- ✅ **Isolation:** One broken file doesn't break all icons
- ✅ **Official source:** Direct from Heroicons package, no manual editing
- ✅ **Full CSS control:** Inlined SVGs support `currentColor` and all styling
- ✅ **Easy maintenance:** Add icons by copying files, can't break existing ones
- ✅ **HTTP/2 friendly:** Multiple small files are fine with HTTP/2

**Implementation:** See `app.js` lines 1-49 for icon loading system.

**Available icons:** Browse at [heroicons.com](https://heroicons.com) (300+ icons available)
<!-- SECTION-END: Icon System -->
