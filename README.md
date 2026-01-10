# NAS Downloader

A self-hosted download manager designed for NAS devices and home servers. Manage downloads through a web interface or Chrome extension, with real-time progress updates and full control over your download queue.

## Features

- **Pause/Resume Downloads** - Individual or global pause/resume control with Range header support
- **Rate Limiting** - Global bandwidth throttling to keep your network usable
- **Concurrent Downloads** - Configure how many downloads run simultaneously
- **Folder Management** - Organize downloads into folders with a built-in folder browser
- **Real-Time Updates** - WebSocket-powered progress updates across all clients
- **Chrome Extension** - Right-click any link to send it to your download manager
- **Multi-Client Sync** - Settings and download status sync across all connected browsers
- **Crash Recovery** - Downloads resume from where they left off after server restart

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended), or
- Python 3.11+ for local development

### Docker Deployment (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/bigcspecv/nas-downloader.git
   cd nas-downloader
   ```

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set a secure API key:
   ```
   API_KEY=your-secure-api-key-here
   ```

4. Start the server:
   ```bash
   docker-compose up -d
   ```

5. Access the web UI at `http://localhost:5000`

### Local Development

1. Install dependencies:
   ```bash
   cd server
   pip install -r requirements.txt
   ```

2. Create `.env` file in the project root:
   ```
   API_KEY=your-secret-key-here
   DOWNLOAD_PATH=./downloads
   DATA_PATH=./data
   ```

3. Run the server:
   ```bash
   python app.py
   ```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | (required) | Authentication key for API and WebSocket |
| `PORT` | `5000` | Server port |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated) |
| `DOWNLOAD_PATH` | `/downloads` | Where to save downloaded files |
| `DATA_PATH` | `/app/data` | Where to store the SQLite database |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Default concurrent download limit |
| `DEFAULT_RATE_LIMIT_BPS` | `0` | Default rate limit in bytes/sec (0 = unlimited) |

## Architecture

```
nas-downloader/
├── server/                 # Python/Flask backend
│   ├── app.py             # Main Flask application & API routes
│   ├── download_manager.py # Download logic with aiohttp
│   ├── static/            # Web UI (HTML, CSS, JS)
│   └── db/                # SQLite schema
├── extension/             # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js      # Service worker with WebSocket
│   ├── popup.html/js      # Extension popup UI
│   └── options.html/js    # Extension settings
└── docker-compose.yml
```

## API Reference

All API endpoints require authentication via Bearer token:
```
Authorization: Bearer YOUR_API_KEY
```

### Downloads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/downloads` | List all downloads |
| `POST` | `/api/downloads` | Add a new download |
| `GET` | `/api/downloads/:id` | Get download details |
| `PATCH` | `/api/downloads/:id` | Pause or resume download |
| `DELETE` | `/api/downloads/:id` | Cancel and remove download |
| `POST` | `/api/downloads/pause-all` | Pause all downloads |
| `POST` | `/api/downloads/resume-all` | Resume all downloads |
| `POST` | `/api/downloads/check-filename` | Check for filename conflicts |

### Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/folders?path=` | List folders in directory |
| `POST` | `/api/folders` | Create a new folder |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get all settings |
| `PATCH` | `/api/settings` | Update settings |

### WebSocket

Connect to `/ws?api_key=YOUR_API_KEY` for real-time updates.

**Message Types:**
- `status` - Download list and global pause state (sent every second)
- `settings_update` - Settings changed notification

## Chrome Extension

The Chrome extension lets you send downloads to your server from any webpage.

### Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder

### Configuration

1. Click the extension icon
2. Open settings (gear icon)
3. Enter your server URL (e.g., `http://192.168.1.100:5000`)
4. Enter your API key

### Usage

- **Right-click any link** → "NAS Download" or "NAS Download to..."
- **Click extension icon** → View and manage downloads
- **Multi-select** → Delete multiple downloads at once
- **Intercept downloads** → Automatically capture browser downloads

## Screenshots

*Coming soon*

## Docker Volumes

The `docker-compose.yml` mounts two volumes:

- `./downloads:/downloads` - Downloaded files
- `./data:/app/data` - SQLite database (persists download history)

## Security Notes

- Always use a strong, unique API key
- Use HTTPS in production (put behind a reverse proxy like nginx or Traefik)
- The `ALLOWED_ORIGINS` setting controls CORS - set it to your specific domain in production
- API keys are compared using constant-time comparison to prevent timing attacks

## License

MIT License - see [LICENSE](LICENSE) for details.
