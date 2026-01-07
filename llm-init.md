# Download Manager - Complete Technical Specification

## Overview

A self-hosted download manager with web UI and Chrome extension. Supports pause/resume, rate limiting, folder management, and real-time progress updates via WebSocket.

## Repository Structure

```
download-manager/
├── server/
│   ├── app.py                 # Main Flask application
│   ├── download_manager.py    # Download handling logic
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile            # Container definition
│   ├── static/
│   │   ├── index.html        # Web UI
│   │   ├── style.css         # Styling
│   │   └── app.js            # Frontend logic
│   └── db/
│       └── schema.sql        # SQLite schema
├── extension/
│   ├── manifest.json         # Chrome extension manifest
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Popup logic
│   ├── background.js        # Service worker (WebSocket manager)
│   ├── options.html         # Settings page
│   ├── options.js           # Settings logic
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Technology Stack

### Server

* **Runtime:** Python 3.11+ (Alpine Linux base)
* **Web Framework:** Flask (lightweight, simple)
* **Async HTTP:** aiohttp (download handling with pause/resume)
* **WebSocket:** flask-sock (simple WebSocket support)
* **Database:** SQLite (download queue, settings, state)
* **Container:** Docker with Alpine base

### Chrome Extension

* **Manifest:** V3 (latest standard)
* **UI:** Vanilla HTML/CSS/JavaScript
* **WebSocket:** Native WebSocket API
* **Storage:** chrome.storage.sync (for server URL + API key)

## Server API Specification

### Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer {API_KEY}
```

### REST API Endpoints

#### Folder Management

**GET /api/folders**

* List folders in /downloads
* Query params:
  * `path` (optional): Subdirectory path relative to /downloads
* Response:

```json
{
  "current_path": "subfolder",
  "folders": ["folder1", "folder2"],
  "parent": "." or null
}
```

**POST /api/folders**

* Create new folder
* Body:

```json
{
  "path": "new_folder/subfolder"
}
```

* Response:

```json
{
  "path": "new_folder/subfolder",
  "created": true
}
```

#### Download Management

**GET /api/downloads**

* List all downloads
* Response:

```json
{
  "downloads": [
    {
      "id": "uuid",
      "url": "https://example.com/file.zip",
      "filename": "file.zip",
      "folder": "my_downloads",
      "status": "downloading|paused|completed|failed",
      "progress": {
        "downloaded_bytes": 1024000,
        "total_bytes": 10240000,
        "percentage": 10.0,
        "speed_bps": 102400,
        "eta_seconds": 90
      },
      "created_at": "2026-01-06T12:00:00Z",
      "completed_at": null
    }
  ]
}
```

**POST /api/downloads**

* Start new download
* Body:

```json
{
  "url": "https://example.com/file.zip",
  "folder": "my_downloads/subfolder",  // creates if doesn't exist
  "filename": "custom_name.zip"  // optional, defaults to URL filename
}
```

* Response:

```json
{
  "id": "uuid",
  "status": "queued"
}
```

**GET /api/downloads/{id}**

* Get specific download details
* Response: Same as single download object above

**PATCH /api/downloads/{id}**

* Update download state
* Body:

```json
{
  "action": "pause|resume|cancel"
}
```

**DELETE /api/downloads/{id}**

* Remove download from queue (and delete file if incomplete)

**POST /api/downloads/pause-all**

* Pause all active downloads

**POST /api/downloads/resume-all**

* Resume all paused downloads

#### Settings

**GET /api/settings**

* Get current settings
* Response:

```json
{
  "global_rate_limit_bps": 1048576,  // bytes per second, 0 = unlimited
  "max_concurrent_downloads": 3
}
```

**PATCH /api/settings**

* Update settings
* Body:

```json
{
  "global_rate_limit_bps": 524288,
  "max_concurrent_downloads": 5
}
```

### WebSocket API

**WS /ws**

* Requires authentication via query param:`/ws?token={API_KEY}`
* Bidirectional JSON messages

#### Server → Client Messages

**download_progress**

```json
{
  "type": "download_progress",
  "data": {
    "id": "uuid",
    "downloaded_bytes": 1024000,
    "total_bytes": 10240000,
    "percentage": 10.0,
    "speed_bps": 102400,
    "eta_seconds": 90
  }
}
```

**download_status**

```json
{
  "type": "download_status",
  "data": {
    "id": "uuid",
    "status": "downloading|paused|completed|failed",
    "message": "Optional error message"
  }
}
```

**download_added**

```json
{
  "type": "download_added",
  "data": {
    "id": "uuid",
    "url": "https://example.com/file.zip",
    "filename": "file.zip",
    "folder": "my_downloads"
  }
}
```

**download_removed**

```json
{
  "type": "download_removed",
  "data": {
    "id": "uuid"
  }
}
```

**settings_updated**

```json
{
  "type": "settings_updated",
  "data": {
    "global_rate_limit_bps": 1048576,
    "max_concurrent_downloads": 3
  }
}
```

**initial_state** (sent on connection)

```json
{
  "type": "initial_state",
  "data": {
    "downloads": [...],  // same as GET /api/downloads
    "settings": {...}    // same as GET /api/settings
  }
}
```

#### Client → Server Messages

**set_rate_limit**

```json
{
  "type": "set_rate_limit",
  "data": {
    "rate_limit_bps": 524288
  }
}
```

**pause_download**

```json
{
  "type": "pause_download",
  "data": {
    "id": "uuid"
  }
}
```

**resume_download**

```json
{
  "type": "resume_download",
  "data": {
    "id": "uuid"
  }
}
```

**pause_all**

```json
{
  "type": "pause_all"
}
```

**resume_all**

```json
{
  "type": "resume_all"
}
```

## Server Implementation Details

### Database Schema (SQLite)

```sql
CREATE TABLE downloads (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    folder TEXT NOT NULL,
    status TEXT NOT NULL,  -- queued, downloading, paused, completed, failed
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize default settings
INSERT INTO settings (key, value) VALUES 
    ('global_rate_limit_bps', '0'),
    ('max_concurrent_downloads', '3');
```

### Download Manager Logic

**Requirements:**

1. Support HTTP Range requests for pause/resume
2. Track download progress in real-time
3. Apply global rate limiting across all downloads
4. Handle concurrent downloads (max configurable)
5. Persist state to SQLite
6. Broadcast progress via WebSocket

**Key Classes:**

```python
class DownloadManager:
    """Manages download queue and execution"""
  
    async def add_download(url, folder, filename=None)
    async def pause_download(download_id)
    async def resume_download(download_id)
    async def cancel_download(download_id)
    async def pause_all()
    async def resume_all()
    async def get_downloads()
    async def set_rate_limit(bps)
  
class Download:
    """Individual download handler"""
  
    async def start()
    async def pause()
    async def resume()
    async def cancel()
    def get_progress()
```

**Rate Limiting Implementation:**

* Use`aiohttp.TCPConnector` with custom rate limiter
* Track bytes/second across all active downloads
* Sleep/throttle when limit exceeded
* Update in real-time (no batching needed for simplicity)

**Pause/Resume:**

* Store current byte offset in database
* Use HTTP Range header:`Range: bytes={offset}-`
* Verify server supports ranges (206 response)
* Fall back to restart if ranges unsupported

### Security

**Path Traversal Protection:**

```python
def validate_folder_path(folder_path):
    """Ensure path is within /downloads and contains no traversal"""
    # Resolve to absolute path
    # Check it starts with /downloads
    # Reject if contains .. or absolute paths
    # Sanitize folder names (alphanumeric, hyphens, underscores, slashes)
```

**API Key:**

* Generate secure random key on first run (if not provided via env)
* Store in database or use environment variable
* Validate on every request
* Use constant-time comparison to prevent timing attacks

**CORS:**

* Configurable via`ALLOWED_ORIGINS` env var
* Support wildcard`*` for development
* Recommend specific origin for production

### Environment Variables

```bash
# Required
API_KEY=your-secret-key-here

# Optional
PORT=5000
ALLOWED_ORIGINS=*  # or chrome-extension://extensionid
DOWNLOAD_PATH=/downloads
DATA_PATH=/app/data  # SQLite location
MAX_CONCURRENT_DOWNLOADS=3
DEFAULT_RATE_LIMIT_BPS=0  # 0 = unlimited
```

### Dockerfile

```dockerfile
FROM python:3.11-alpine

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p /downloads /app/data

# Expose port
EXPOSE 5000

# Run application
CMD ["python", "app.py"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  download-manager:
    build: ./server
    ports:
      - "5000:5000"
    volumes:
      - ./downloads:/downloads
      - ./data:/app/data
    environment:
      - API_KEY=${API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}
      - PORT=5000
    restart: unless-stopped
```

### requirements.txt

```
Flask==3.0.0
flask-sock==0.7.0
aiohttp==3.9.1
python-dotenv==1.0.0
```

## Chrome Extension Implementation

### Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Download Manager",
  "version": "1.0.0",
  "description": "Remote download manager client",
  "permissions": [
    "storage"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "options_page": "options.html"
}
```

### Extension Architecture

**background.js** (Service Worker)

* Maintains WebSocket connection to server
* Reconnects on disconnect
* Stores connection state
* Relays messages to popup
* Uses chrome.runtime.sendMessage for popup communication

**popup.js**

* Displays current downloads
* Shows progress bars
* Pause/resume controls
* Global rate limit input
* Add new download form
* Browse folders
* Communicates with background worker

**options.js**

* Server URL configuration
* API key configuration
* Save to chrome.storage.sync

### Key Features

**Settings Page (options.html):**

```html
<form>
  <label>Server URL:</label>
  <input type="url" id="serverUrl" placeholder="https://downloads.example.com">
  
  <label>API Key:</label>
  <input type="password" id="apiKey">
  
  <button type="submit">Save</button>
</form>
```

**Popup UI (popup.html):**

* Connection status indicator
* Global rate limit control (with units: KB/s, MB/s)
* Folder browser/selector
* Add download form (URL + folder selector)
* Download list with:
  * Filename
  * Progress bar
  * Speed & ETA
  * Pause/resume button
  * Cancel button
* Pause all / Resume all buttons

**WebSocket Connection Management:**

```javascript
class DownloadManagerClient {
  constructor(serverUrl, apiKey) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }
  
  connect() {
    // WebSocket connection with auth
    // Handle reconnection with exponential backoff
  }
  
  send(message) {
    // Send JSON message
  }
  
  onMessage(callback) {
    // Register message handler
  }
}
```

## User Experience Flow

### First-Time Setup

1. User clones repository
2. User copies`.env.example` to`.env`
3. User generates API key (or app generates on first run)
4. User runs`docker-compose up -d`
5. User installs Chrome extension (load unpacked from`extension/`)
6. User opens extension options, enters server URL + API key
7. Extension connects via WebSocket

### Adding a Download

**Via Web UI:**

1. Navigate to http://localhost:5000
2. Browse or create folder
3. Paste URL
4. Click "Add Download"
5. See real-time progress

**Via Extension:**

1. Click extension icon
2. Select folder from dropdown (or create new)
3. Paste URL
4. Click "Add Download"
5. See real-time progress in popup

### Managing Downloads

* Click pause/resume on individual downloads
* Use "Pause All" / "Resume All" for batch control
* Set global rate limit (applies immediately to all downloads)
* Cancel removes download and deletes partial file

## Development Notes

### Testing Considerations

1. **Large file downloads:** Test with files >1GB
2. **Network interruptions:** Test pause/resume with connection drops
3. **Rate limiting:** Verify accurate throttling
4. **Concurrent downloads:** Test max concurrent limit
5. **Path traversal:** Test with malicious paths (`../../etc/passwd`)
6. **WebSocket reconnection:** Kill connection, verify auto-reconnect
7. **Extension offline mode:** Test behavior when server unreachable

### Error Handling

**Server:**

* Invalid URLs → 400 Bad Request
* Path traversal attempts → 400 Bad Request
* Unauthorized → 401 Unauthorized
* Download failures → Update status to "failed" with error message
* Disk full → Pause download, set error status
* Network errors → Retry with exponential backoff (3 attempts)

**Extension:**

* Server unreachable → Show offline indicator, attempt reconnect
* Invalid settings → Show validation errors
* WebSocket disconnect → Auto-reconnect with backoff

### Performance Optimizations

1. **Progress updates:** Throttle to 1 update/second per download
2. **Database writes:** Batch progress updates (every 5 seconds or 1MB)
3. **WebSocket broadcasts:** Only send updates to connected clients
4. **File I/O:** Use buffered writes, flush periodically

## Documentation Requirements

### README.md

Should include:

1. Feature overview
2. Quick start (docker-compose up)
3. Environment variables
4. Extension installation steps
5. Reverse proxy setup examples (nginx, Caddy)
6. Security recommendations
7. API documentation link
8. Troubleshooting section

### API Documentation

* OpenAPI/Swagger spec (optional but nice)
* Example curl commands
* WebSocket message examples
* Authentication setup

## Future Enhancements (Out of Scope)

* Multi-part downloads (chunked parallel downloading)
* Download scheduling
* Bandwidth scheduling (different limits by time of day)
* Browser integration (capture download links)
* Torrent support
* YouTube-dl integration
* Queue prioritization
* Download history/statistics
* User accounts (multi-user)

## Success Criteria

The implementation is complete when:

1. ✅ Docker container runs and serves on configurable port
2. ✅ Web UI can add downloads and see progress
3. ✅ Chrome extension can connect and control downloads
4. ✅ Pause/resume works reliably
5. ✅ Global rate limiting works accurately
6. ✅ Folder browsing and creation works
7. ✅ Path traversal protection prevents escaping /downloads
8. ✅ WebSocket auto-reconnects on disconnect
9. ✅ All downloads persist across container restarts
10. ✅ README provides clear setup instructions

---

**This specification is complete and ready for implementation. The stack is intentionally simple to minimize complexity while meeting all requirements.**
