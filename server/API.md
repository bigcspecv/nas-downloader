# NAS Downloader API Reference

Complete API documentation for the nas-downloader server.

## Authentication

All API endpoints require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

Requests without valid authentication receive a `401 Unauthorized` response.

## Base URL

```
http://your-server:5000/api
```

---

## Downloads

### List All Downloads

```http
GET /api/downloads
```

Returns all downloads with their current status and progress.

**Response:** `200 OK`
```json
{
  "downloads": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com/file.zip",
      "filename": "file.zip",
      "folder": "software",
      "status": "downloading",
      "downloaded_bytes": 52428800,
      "total_bytes": 104857600,
      "percentage": 50.0,
      "speed_bps": 1048576,
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": null,
      "error_message": null
    }
  ]
}
```

### Add Download

```http
POST /api/downloads
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com/file.zip",
  "folder": "software",
  "filename": "custom-name.zip",
  "overwrite": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to download (must start with `http://` or `https://`) |
| `folder` | string | No | Subfolder within download directory (default: root) |
| `filename` | string | No | Custom filename (default: extracted from URL) |
| `overwrite` | boolean | No | Overwrite existing file if present (default: `false`) |

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/file.zip",
  "filename": "custom-name.zip",
  "folder": "software",
  "status": "queued",
  "downloaded_bytes": 0,
  "total_bytes": 0,
  "percentage": 0,
  "speed_bps": 0,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid URL, missing required fields, or validation error
- `409 Conflict` - File already exists and `overwrite` is `false`

### Get Download

```http
GET /api/downloads/:id
```

Returns a specific download by ID.

**Response:** `200 OK` with download object

**Error Responses:**
- `404 Not Found` - Download ID does not exist

### Pause/Resume Download

```http
PATCH /api/downloads/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "pause"
}
```

| Action | Description |
|--------|-------------|
| `pause` | Pause an active or queued download |
| `resume` | Resume a paused download (queues it for processing) |

**Response:** `200 OK` with updated download object

**Error Responses:**
- `400 Bad Request` - Invalid action or download cannot be paused/resumed in current state
- `404 Not Found` - Download ID does not exist

### Delete Download

```http
DELETE /api/downloads/:id
DELETE /api/downloads/:id?delete_file=true
DELETE /api/downloads/:id?delete_file=false
```

Removes a download from the list and optionally deletes the file.

| Query Parameter | Behavior |
|-----------------|----------|
| `delete_file=true` | Always delete the downloaded file |
| `delete_file=false` | Keep the file, only remove from list |
| (omitted) | Delete file only if download is incomplete |

**Response:** `200 OK`
```json
{
  "message": "Download removed successfully"
}
```

**Error Responses:**
- `404 Not Found` - Download ID does not exist
- `403 Forbidden` - Permission denied when deleting file

### Check Filename Conflict

```http
POST /api/downloads/check-filename
Content-Type: application/json
```

Check if a filename would conflict with existing files or in-progress downloads.

**Request Body:**
```json
{
  "filename": "file.zip",
  "folder": "software"
}
```

**Response:** `200 OK`
```json
{
  "original_filename": "file.zip",
  "suggested_filename": "file (1).zip",
  "conflict": true
}
```

If no conflict exists, `suggested_filename` equals `original_filename` and `conflict` is `false`.

### Pause All Downloads

```http
POST /api/downloads/pause-all
```

Pauses all active and queued downloads.

**Response:** `200 OK`
```json
{
  "message": "All downloads paused"
}
```

### Resume All Downloads

```http
POST /api/downloads/resume-all
```

Resumes all paused downloads (queues them for processing).

**Response:** `200 OK`
```json
{
  "message": "All downloads resumed"
}
```

---

## Folders

### List Folders

```http
GET /api/folders
GET /api/folders?path=subfolder/path
```

Lists subdirectories within the download directory.

| Query Parameter | Description |
|-----------------|-------------|
| `path` | Relative path to list (default: root download directory) |

**Response:** `200 OK`
```json
{
  "folders": [
    { "name": "movies", "path": "movies" },
    { "name": "software", "path": "software" },
    { "name": "music", "path": "music" }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid path (path traversal attempt)
- `404 Not Found` - Path does not exist

### Create Folder

```http
POST /api/folders
Content-Type: application/json
```

**Request Body:**
```json
{
  "path": "movies/2024"
}
```

Creates nested directories as needed.

**Response:** `201 Created`
```json
{
  "name": "2024",
  "path": "movies/2024"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid path or path traversal attempt
- `403 Forbidden` - Permission denied
- `409 Conflict` - Folder already exists

---

## Settings

### Get Settings

```http
GET /api/settings
```

Returns all server settings.

**Response:** `200 OK`
```json
{
  "global_rate_limit_bps": "0",
  "max_concurrent_downloads": "3"
}
```

### Update Settings

```http
PATCH /api/settings
Content-Type: application/json
```

Update one or more settings. Only include settings you want to change.

**Request Body:**
```json
{
  "global_rate_limit_bps": "1048576",
  "max_concurrent_downloads": "5"
}
```

| Setting | Type | Constraints | Description |
|---------|------|-------------|-------------|
| `global_rate_limit_bps` | string/int | >= 0 | Bandwidth limit in bytes/sec (`0` = unlimited) |
| `max_concurrent_downloads` | string/int | >= 1 | Maximum simultaneous active downloads |

**Response:** `200 OK` with all current settings

**Error Responses:**
- `400 Bad Request` - Invalid setting key or value

**Side Effects:**
- Changes are broadcast to all connected WebSocket clients
- `max_concurrent_downloads` reduction immediately pauses excess downloads

---

## WebSocket

Real-time updates are available via WebSocket connection.

### Connection

```
ws://your-server:5000/ws?api_key=YOUR_API_KEY
wss://your-server:5000/ws?api_key=YOUR_API_KEY  (with TLS)
```

Authentication is done via the `api_key` query parameter.

### Connection Example (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:5000/ws?api_key=your-api-key');

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'status':
      console.log('Downloads:', data.downloads);
      console.log('Global paused:', data.global_paused);
      break;

    case 'settings_update':
      console.log('Settings changed:', data.settings);
      break;

    case 'auth_error':
      console.error('Authentication failed:', data.error);
      break;
  }
};

ws.onclose = () => {
  console.log('Disconnected from server');
  // Implement reconnection logic here
};
```

### Message Types

#### `status` (Server → Client)

Sent immediately on connection and every second thereafter.

```json
{
  "type": "status",
  "downloads": [
    {
      "id": "...",
      "url": "...",
      "filename": "...",
      "folder": "...",
      "status": "downloading",
      "downloaded_bytes": 52428800,
      "total_bytes": 104857600,
      "percentage": 50.0,
      "speed_bps": 1048576,
      "created_at": "...",
      "completed_at": null,
      "error_message": null
    }
  ],
  "global_paused": false
}
```

#### `settings_update` (Server → Client)

Sent when any client updates settings via the API.

```json
{
  "type": "settings_update",
  "settings": {
    "global_rate_limit_bps": "1048576",
    "max_concurrent_downloads": "5"
  }
}
```

#### `auth_error` (Server → Client)

Sent when authentication fails. Connection closes after this message.

```json
{
  "type": "auth_error",
  "error": "Invalid API key"
}
```

#### `ack` (Server → Client)

Acknowledgment of client messages (if any are sent).

```json
{
  "type": "ack",
  "received": { ... }
}
```

---

## Download States

| Status | Description |
|--------|-------------|
| `queued` | Waiting for an available download slot |
| `downloading` | Actively downloading |
| `paused` | Paused by user action |
| `completed` | Download finished successfully |
| `failed` | Download failed (check `error_message` for details) |

### State Transitions

```
queued ──────► downloading ──────► completed
   │                │
   │                ▼
   │             failed
   │                │
   ▼                ▼
paused ◄────────────┘
   │
   ▼
queued (on resume)
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Description of the error"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (new resource) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid API key) |
| `403` | Forbidden (permission denied) |
| `404` | Not Found |
| `409` | Conflict (resource already exists) |
| `500` | Internal Server Error |

---

## Rate Limiting Notes

- Rate limit is **global** and shared across all concurrent downloads
- The limit is in **bytes per second**
- Set to `0` for unlimited bandwidth
- Common values:
  - `1048576` = 1 MB/s
  - `5242880` = 5 MB/s
  - `10485760` = 10 MB/s
  - `104857600` = 100 MB/s

---

## Examples with cURL

### Add a download
```bash
curl -X POST http://localhost:5000/api/downloads \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/file.zip"}'
```

### Pause a download
```bash
curl -X PATCH http://localhost:5000/api/downloads/download-id-here \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "pause"}'
```

### Set rate limit to 5 MB/s
```bash
curl -X PATCH http://localhost:5000/api/settings \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"global_rate_limit_bps": "5242880"}'
```

### List all downloads
```bash
curl http://localhost:5000/api/downloads \
  -H "Authorization: Bearer your-api-key"
```

### Create a folder
```bash
curl -X POST http://localhost:5000/api/folders \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"path": "movies/2024"}'
```
