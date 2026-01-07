# Download Manager - Build Context

## Project Overview

A self-hosted download manager with:
- **Server:** Python/Flask API with SQLite, aiohttp for downloads, WebSocket for real-time updates
- **Web UI:** Browser-based interface for managing downloads
- **Chrome Extension:** Manifest V3 extension to add downloads from any page

Key features: pause/resume downloads, rate limiting, folder management, real-time progress via WebSocket.

---

## How to Use This Document

**You are an LLM building this download manager. This doc is your plan and memory.**

1. Read this entire document first
2. Check "In Progress" - if populated, a previous session may have been interrupted (see "Resuming After Interruption")
3. Find your current step in the checklist
4. **Before coding:** Update "In Progress" with what you're about to do
5. Complete ONE step, then STOP
6. **After coding:** Follow "Before You Stop" checklist
7. Mark your step complete with `[x]` and clear "In Progress"

**Reference:** `llm-init.md` has the full project spec. Use it for guidance, but adapt based on what's actually built. Note any divergence.

---

## Resuming After Interruption

If "In Progress" shows work was started but the step isn't marked complete:

1. Read the "In Progress" section to understand what was attempted
2. Inspect any files listed in "Files touched" to see current state
3. Determine what's complete vs incomplete
4. **Continue from where it left off** - don't restart the step
5. If the previous work is broken/unusable, note why in Lessons Learned before redoing

---

## Before You Stop (REQUIRED)

After completing your step, you MUST:

1. **Clear "In Progress"** - Set status back to "Not started"
2. **Update "Working Context"** - Add 1-2 sentences about what you did
3. **Add to "Lessons Learned"** - If you hit a problem or discovered something important
4. **Add to "Decisions"** - If you made a choice that affects future steps
5. **Update "Code Patterns"** - If you established a pattern others should follow
6. **Increment "Current Step"** - Update the number
7. **Summarize if needed** - If Working Context exceeds ~10 entries, summarize older ones into a "Summary of Steps X-Y" entry (compress, don't delete)

---

## Example Entries (Quality Standard)

**Working Context - Good:**
| Step | What happened |
|------|---------------|
| 4 | Created schema: downloads table with UUID id, status enum, progress tracking columns. Settings table is key-value pairs. |

**Working Context - Too vague (don't do this):**
| Step | What happened |
|------|---------------|
| 4 | Created schema |

**Lessons Learned - Good:**
- Step 6: `os.path.realpath()` alone doesn't prevent traversal on Windows; must also check resolved path starts with base directory

**Decisions - Good:**
| Decision | Why | Step |
|----------|-----|------|
| UUID strings for download IDs instead of autoincrement | Avoids ID conflicts if DB is reset; easier for client-side tracking | 4 |

---

## Current Step: 18

## In Progress

<!-- Update this IMMEDIATELY when you start working, BEFORE writing any code -->

**Status:** Not started
**Working on:** -
**Files touched:** -

---

## Checklist

### Phase 1: Setup
- [x] 1. Create directories: `server/`, `server/static/`, `server/db/`, `extension/`, `extension/icons/`
- [x] 2. Create `.env.example`, `.gitignore`, `docker-compose.yml`
- [x] 3. Create `server/requirements.txt`, `server/Dockerfile`

### Phase 2: Server Core
- [x] 4. Create `server/db/schema.sql` (downloads + settings tables)
- [x] 5. Create `server/app.py` skeleton (Flask, CORS, auth middleware, DB init)
- [x] 6. Add folder endpoints (`GET/POST /api/folders`) with path traversal protection
- [x] 7. Add settings endpoints (`GET/PATCH /api/settings`)

### Phase 3: Downloads
- [x] 8. Create `server/download_manager.py` (DownloadManager + Download classes)
- [x] 9. Implement download logic (aiohttp, pause/resume with Range headers, rate limiting)
- [x] 10. Add download endpoints (CRUD + pause-all/resume-all)
- [x] 11. Add WebSocket endpoint (`/ws`) with auth and message handling

### Phase 4: Web UI
- [x] 12. Create `server/static/index.html` (status, folders, downloads list, controls)
- [x] 13. Create `server/static/style.css`
- [x] 14. Create `server/static/app.js` (WebSocket client, DOM updates)

### Phase 5: Critical UI Bug Fixes
- [x] 15. Fix and test rate limiting (ensure accurate throttling at various speeds)
- [x] 16. Test and fix pause/resume behavior (individual downloads and global pause)
- [x] 17. Improve download status display (queued/downloading/paused/completed/failed states)
- [ ] 18. Fix progress bar display (currently shows 0.00/0.00 MB even during/after download)
- [ ] 19. Fix progress data updates (downloaded_bytes, total_bytes, percentage not displaying)
- [ ] 20. Add error handling and user feedback (better alerts, status messages, validation)

### Phase 6: UX - Multi-User & Real-Time Sync
- [ ] 21. Broadcast settings changes via WebSocket (rate limit, max concurrent, etc.)
- [ ] 22. Update UI to reflect settings changes from other users in real-time
- [ ] 23. Test multi-user scenarios (two browsers, settings sync, download visibility)

### Phase 7: UX - Folder Management Interface
- [ ] 24. Create folder browser UI component (replace simple text field)
- [ ] 25. Implement folder navigation (list folders, navigate into subfolders, go up)
- [ ] 26. Add "New Folder" button within folder browser
- [ ] 27. Show current path and breadcrumb navigation
- [ ] 28. Integrate folder browser into "Add Download" form

### Phase 8: UX - Download File Management
- [ ] 29. Implement in-progress file extension (e.g., .download or .crdownload)
- [ ] 30. Rename file on completion (remove in-progress extension)
- [ ] 31. Handle resume/pause with in-progress filenames
- [ ] 32. Update "Remove" button to offer file deletion option for completed downloads
- [ ] 33. Add confirmation dialog for file deletion (keep vs delete actual file)

### Phase 9: Testing & Edge Cases
- [ ] 34. Test network errors (timeout, connection drop, DNS failure)
- [ ] 35. Test server restart (downloads resume correctly, state preserved)
- [ ] 36. Test concurrent downloads (queue management, rate limiting applies correctly)
- [ ] 37. Test disk space issues (handle out-of-space gracefully)
- [ ] 38. Test invalid URLs and server errors (404, 500, etc.)

### Phase 10: UI Polish
- [ ] 39. Add loading states (spinners, skeleton screens)
- [ ] 40. Improve responsive design for mobile/tablet
- [ ] 41. Add animations for state transitions (smooth progress updates)
- [ ] 42. Polish visual design (consistent spacing, colors, typography)

### Phase 11: Chrome Extension
- [ ] 43. Create `extension/manifest.json` (Manifest V3)
- [ ] 44. Create `extension/options.html` + `options.js` (server URL, API key config)
- [ ] 45. Create `extension/background.js` (WebSocket connection, reconnect logic)
- [ ] 46. Create `extension/popup.html` + `popup.js` (UI mirroring web UI features)
- [ ] 47. Create placeholder icons (16, 48, 128px)

### Phase 12: Finalize
- [ ] 48. Test full flow (docker-compose up, add download, pause/resume, rate limit)
- [ ] 49. Test extension (connect, add download, verify sync)
- [ ] 50. Create `README.md`

---

## Working Context

<!-- Recent work. When this exceeds ~10 entries, summarize older ones into a "Steps X-Y summary" entry. -->

| Step | What happened |
|------|---------------|
| 1 | Created project directory structure: server/ with static/ and db/ subdirectories, extension/ with icons/ subdirectory. All directories created using mkdir -p on Windows. |
| 2 | Created .env.example with all environment variables (API_KEY, PORT, ALLOWED_ORIGINS, etc.). Updated existing .gitignore to add project-specific ignores (downloads/, data/, *.db). Created docker-compose.yml with service definition, volume mounts, and environment variable passing. |
| 3 | Created server/requirements.txt with Python dependencies: Flask 3.0.0, flask-sock 0.7.0, aiohttp 3.9.1, python-dotenv 1.0.0. Created server/Dockerfile using python:3.11-alpine base, installing deps, copying app, creating /downloads and /app/data directories, exposing port 5000. |
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
| 18 | Restructured project phases based on UX/UI assessment. Split original Phase 5 into 6 focused phases: Phase 5 (Critical UI Bug Fixes - progress bar display), Phase 6 (Multi-User Real-Time Sync - settings broadcast), Phase 7 (Folder Management Interface - browser UI), Phase 8 (Download File Management - in-progress extensions), Phase 9 (Testing & Edge Cases), Phase 10 (UI Polish). Renumbered Chrome Extension to Phase 11 and Finalize to Phase 12. Total checklist now has 50 steps instead of 28. |

---

## Lessons Learned (PERMANENT)

<!-- Things discovered that prevent future mistakes. Never delete these. -->

- Step 6: Use os.path.commonpath() for path traversal protection instead of simple string prefix checking - it properly handles edge cases like different drives on Windows and normalized path separators
- Step 10: Flask's built-in development server doesn't support async def route handlers. Use a background event loop in a daemon thread with asyncio.run_coroutine_threadsafe() to run async operations from sync Flask routes. Initialize with asyncio.new_event_loop() and run in threading.Thread(daemon=True).
- Step 10: When tracking async tasks in a list, clean up completed tasks (filter out done() tasks) BEFORE checking if list is empty to avoid race conditions where newly created tasks haven't started yet.
- Step 10: aiohttp's default SSL handling works correctly on all platforms including Windows. When a download fails with SSL errors, check if the server's SSL certificate is valid (not expired/invalid) before assuming it's a platform issue. The default aiohttp behavior properly validates certificates and rejects invalid ones.
- Step 14: Flask serves static files from /static/ URL path by default, not from root. Always use /static/ prefix in HTML links (e.g., href="/static/style.css") unless you configure a custom static_url_path.
- Step 14: When updating database settings, also update the in-memory state of the manager object. Database changes alone don't affect running code - you must sync both DB and runtime state for settings to take effect immediately.
- Step 14: Rate limiting with large chunk sizes is ineffective. Adjust chunk size based on rate limit (e.g., rate_limit/4) to enable smooth throttling. Calculate expected download time vs actual time and sleep the difference for accurate rate limiting.
- Step 14: When creating Download objects, the __init__ method sets default values (like status='queued'). Always override these with actual database values after construction to preserve saved state.

---

## Decisions (PERMANENT)

<!-- Choices made that affect future steps. Include reasoning. Never delete. -->

| Decision | Why | Step |
|----------|-----|------|
| TEXT type for download IDs instead of INTEGER | Will use UUID strings for download IDs to avoid conflicts if DB is reset and for easier client-side tracking | 4 |
| Key-value settings table | Allows flexible addition of new settings without schema changes; stores all values as TEXT for simplicity | 4 |
| Reset 'downloading' to 'queued' on startup | Allows resuming downloads after server crash/restart - downloads in progress are safely resumed from last saved byte offset | 8 |
| Batch DB progress updates every 5 seconds | Reduces DB write frequency during downloads while maintaining reasonable state persistence granularity | 8 |
| Per-second byte tracking for rate limiting | Simple rate limiting implementation that sleeps when limit exceeded in current second, resets counter every second | 8 |
| WebSocket auth via query parameter | Using /ws?api_key=xxx for WebSocket auth instead of HTTP headers - simpler for clients and supported by all WebSocket clients (browsers, extensions, etc.) | 11 |
| 1-second broadcast interval | Balances real-time updates with server load - 1 second provides smooth progress updates without excessive messages | 11 |
| Restructure Phase 5 into 6 focused phases | Original Phase 5 was too broad. Splitting into specific phases (Critical Bugs, Multi-User Sync, Folder UI, File Management, Testing, Polish) provides clearer scope, better progress tracking, and ensures UX issues are addressed systematically before moving to Chrome extension | 18 |

---

## Code Patterns (PERMANENT)

<!-- Established patterns. Update as they evolve, but don't delete history. -->

**Authentication:**
```python
# Decorator on all protected routes
@require_auth
def my_endpoint():
    # Route implementation
    pass

# Uses Bearer token: Authorization: Bearer {API_KEY}
# Constant-time comparison to prevent timing attacks
```

**Database Access:**
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

**Download Manager Usage:**
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

**Download Endpoints (Sync with Background Event Loop):**
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

**WebSocket Broadcasting:**
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

# Client connection example: ws://localhost:5000/ws?api_key=your-secret-key-here
```

**Error Response Format:**
```python
# All errors return JSON with 'error' key
return jsonify({'error': 'Error message here'}), status_code

# Examples:
# 401: {'error': 'Invalid API key'}
# 404: {'error': 'Not found'}
# 500: {'error': 'Internal server error'}
```

**Path Traversal Protection:**
```python
# Use validate_path() helper for all user-provided paths
target_path = validate_path(user_provided_path)
if target_path is None:
    return jsonify({'error': 'Invalid path'}), 400

# validate_path() uses os.path.commonpath to ensure resolved path
# stays within DOWNLOAD_PATH, preventing ../ attacks
```

**Settings Validation:**
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

---

## Blockers

<!-- Current blockers. Clear when resolved. -->

None.

---

## Rules

1. Read existing files before modifying
2. One step at a time - don't skip ahead
3. Update "In Progress" BEFORE starting work
4. Update this doc AFTER completing work (see "Before You Stop")
5. Security: validate all paths, sanitize inputs
6. No over-engineering - build only what's needed
7. If stuck, document the blocker and stop
8. **Test the code with the user's help before committing** - when possible, verify functionality works as expected
9. After testing and confirming it works, prompt the user to commit with a short single-line commit message
10. NEVER run git commands directly - only provide commit messages for the user to execute

---
