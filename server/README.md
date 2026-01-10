# NAS Downloader Server

The backend server for nas-downloader, providing a REST API, WebSocket real-time updates, and a web UI for managing downloads.

## Features

- RESTful API for download management
- Real-time progress updates via WebSocket
- Web-based dashboard UI
- Pause/resume with HTTP Range header support
- Global rate limiting (bandwidth throttling)
- Concurrent download limits
- Folder organization
- SQLite database for persistence
- Crash recovery (resume interrupted downloads)

## Installation

### Docker (Recommended)

#### Quick Start

1. Create a directory for nas-downloader:
   ```bash
   mkdir nas-downloader && cd nas-downloader
   ```

2. Create a `docker-compose.yml`:
   ```yaml
   version: '3.8'

   services:
     nas-downloader:
       image: ghcr.io/bigcspecv/nas-downloader:latest
       ports:
         - "5000:5000"
       volumes:
         - ./downloads:/downloads
         - ./data:/app/data
       environment:
         - API_KEY=your-secure-api-key-here
       restart: unless-stopped
   ```

3. Start the server:
   ```bash
   docker-compose up -d
   ```

4. Access the web UI at `http://localhost:5000`

#### Synology Container Manager (DSM 7.2+)

For Synology NAS users running DSM 7.2 or later with Container Manager:

1. **Create folder structure** on your NAS:
   ```
   /volume1/docker/nas-downloader/
   ├── downloads/
   └── data/
   ```
   You can create these folders via File Station or SSH.

2. **Open Container Manager** from the DSM main menu.

3. **Create a new Project**:
   - Go to the **Project** tab in the left sidebar
   - Click **Create**
   - Set **Project name** to `nas-downloader`
   - Set **Path** to `/volume1/docker/nas-downloader`
   - Select **Create docker-compose.yml**

4. **Paste the following configuration** in the editor:
   ```yaml
   version: '3.8'

   services:
     nas-downloader:
       image: ghcr.io/bigcspecv/nas-downloader:latest
       container_name: nas-downloader
       ports:
         - "5000:5000"
       volumes:
         - /volume1/docker/nas-downloader/downloads:/downloads
         - /volume1/docker/nas-downloader/data:/app/data
       environment:
         - API_KEY=your-secure-api-key-here
       restart: unless-stopped
   ```

   > **Important:** Synology requires absolute paths with the volume number (e.g., `/volume1/`). Adjust paths if your docker folder is on a different volume or shared folder.

5. Click **Next**, review the settings, and click **Done**.

6. When prompted, select **Start the project** to deploy the container.

7. Access the web UI at `http://your-nas-ip:5000`

**Tips for Synology users:**
- To view logs, go to **Container Manager > Project > nas-downloader > Container** and click the container name
- For CLI access, enable SSH in **Control Panel > Terminal & SNMP**, then use `sudo docker logs nas-downloader`
- If port 5000 conflicts with another service, change the left side of the port mapping (e.g., `5001:5000`)

#### Building from Source

If you prefer to build the image locally:

```bash
git clone https://github.com/bigcspecv/nas-downloader.git
cd nas-downloader
docker-compose up -d --build
```

#### Docker Run (without Compose)

```bash
docker run -d \
  --name nas-downloader \
  -p 5000:5000 \
  -v /path/to/downloads:/downloads \
  -v /path/to/data:/app/data \
  -e API_KEY=your-secure-api-key-here \
  --restart unless-stopped \
  ghcr.io/bigcspecv/nas-downloader:latest
```

### Volume Mounts

| Container Path | Purpose |
|----------------|---------|
| `/downloads` | Where downloaded files are saved |
| `/app/data` | SQLite database storage (persists download history and settings) |

## Configuration

All configuration is done via environment variables.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | - | Authentication key for API and WebSocket connections |
| `PORT` | No | `5000` | Server port |
| `ALLOWED_ORIGINS` | No | `*` | CORS allowed origins (comma-separated for multiple) |
| `DOWNLOAD_PATH` | No | `/downloads` | Base directory for downloaded files |
| `DATA_PATH` | No | `/app/data` | Directory for SQLite database |
| `MAX_CONCURRENT_DOWNLOADS` | No | `3` | Initial max concurrent downloads |
| `DEFAULT_RATE_LIMIT_BPS` | No | `0` | Initial rate limit in bytes/sec (0 = unlimited) |

### Example .env File

```bash
# Required
API_KEY=my-super-secret-key-12345

# Optional - uncomment to customize
# PORT=5000
# ALLOWED_ORIGINS=https://mydomain.com,https://app.mydomain.com
# DOWNLOAD_PATH=/downloads
# DATA_PATH=/app/data
# MAX_CONCURRENT_DOWNLOADS=5
# DEFAULT_RATE_LIMIT_BPS=1048576  # 1 MB/s
```

### CORS Configuration

For production, restrict `ALLOWED_ORIGINS` to your specific domains:

```bash
ALLOWED_ORIGINS=https://nas.mydomain.com,chrome-extension://your-extension-id
```

## API Reference

See [API.md](API.md) for complete API documentation including:

- REST API endpoints (downloads, folders, settings)
- WebSocket real-time updates
- Authentication details
- Request/response examples
- cURL examples

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/downloads` | GET | List all downloads |
| `/api/downloads` | POST | Add new download |
| `/api/downloads/:id` | GET | Get download details |
| `/api/downloads/:id` | PATCH | Pause/resume download |
| `/api/downloads/:id` | DELETE | Remove download |
| `/api/downloads/pause-all` | POST | Pause all downloads |
| `/api/downloads/resume-all` | POST | Resume all downloads |
| `/api/folders` | GET | List folders |
| `/api/folders` | POST | Create folder |
| `/api/settings` | GET | Get settings |
| `/api/settings` | PATCH | Update settings |
| `/ws?api_key=KEY` | WebSocket | Real-time updates |

## Database Schema

The server uses SQLite with the following schema:

```sql
-- Downloads table
CREATE TABLE downloads (
    id TEXT PRIMARY KEY,           -- UUID
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    folder TEXT NOT NULL,
    status TEXT NOT NULL,          -- queued|downloading|paused|completed|failed
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Settings table (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name nas.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Traefik (Docker Labels)

```yaml
services:
  nas-downloader:
    # ... other config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nas-downloader.rule=Host(`nas.yourdomain.com`)"
      - "traefik.http.routers.nas-downloader.entrypoints=websecure"
      - "traefik.http.routers.nas-downloader.tls.certresolver=letsencrypt"
      - "traefik.http.services.nas-downloader.loadbalancer.server.port=5000"
```

## Troubleshooting

### Downloads stuck at 0%
- Check if the download URL is accessible from the server
- Verify the server has write permissions to the download directory
- Check server logs: `docker-compose logs -f`

### WebSocket connection fails
- Ensure the API key matches in both client and server
- If using a reverse proxy, verify WebSocket upgrade headers are passed
- Check browser console for connection errors

### Permission denied errors
- Ensure the download directory is writable by the container user
- Check volume mount permissions: `ls -la /path/to/downloads`

### Rate limiting not working
- Rate limit is shared across all concurrent downloads
- Very small rate limits (< 1KB/s) may be inaccurate due to chunk sizes
- Verify the setting was saved: `GET /api/settings`

## Development

### Running Locally

```bash
cd server
pip install -r requirements.txt

# Set environment variables
export API_KEY=dev-key
export DOWNLOAD_PATH=./downloads
export DATA_PATH=./data

python app.py
```

### Dependencies

- Python 3.11+
- Flask 3.0.0
- flask-cors 4.0.0
- flask-sock 0.7.0
- aiohttp 3.9.1
- python-dotenv 1.0.0
