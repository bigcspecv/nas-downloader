import os
import sqlite3
import asyncio
import threading
import json
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sock import Sock
from dotenv import load_dotenv
from download_manager import DownloadManager

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv('API_KEY', 'your-secret-key-here')
PORT = int(os.getenv('PORT', 5000))
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*')
DOWNLOAD_PATH = os.getenv('DOWNLOAD_PATH', '/downloads')
DATA_PATH = os.getenv('DATA_PATH', '/app/data')
DB_PATH = os.path.join(DATA_PATH, 'downloads.db')

# Initialize Flask app
app = Flask(__name__)
sock = Sock(app)

# Configure CORS
if ALLOWED_ORIGINS == '*':
    CORS(app)
else:
    origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(',')]
    CORS(app, origins=origins)

# Global download manager instance (initialized after DB setup)
download_manager = None

# Background event loop for async operations
background_loop = None
background_thread = None

# WebSocket client tracking
websocket_clients = set()
broadcast_task = None


# Database initialization
def init_db():
    """Initialize database with schema if it doesn't exist"""
    os.makedirs(DATA_PATH, exist_ok=True)
    os.makedirs(DOWNLOAD_PATH, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Read and execute schema
    schema_path = os.path.join(os.path.dirname(__file__), 'db', 'schema.sql')
    with open(schema_path, 'r') as f:
        schema = f.read()
        cursor.executescript(schema)

    conn.commit()
    conn.close()


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn


# Authentication middleware
def require_auth(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'Authorization header required'}), 401

        # Extract Bearer token
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid authorization header format'}), 401

        token = parts[1]

        # Constant-time comparison to prevent timing attacks
        if not compare_digest(token, API_KEY):
            return jsonify({'error': 'Invalid API key'}), 401

        return f(*args, **kwargs)

    return decorated_function


def compare_digest(a, b):
    """Constant-time string comparison"""
    # Simple implementation using secrets module would be better in production
    # but this is sufficient for our use case
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


# Helper function for path traversal protection
def validate_path(relative_path):
    """
    Validate that a relative path doesn't escape DOWNLOAD_PATH.
    Returns absolute path if valid, None if invalid.
    """
    # Normalize and resolve the full path
    full_path = os.path.normpath(os.path.join(DOWNLOAD_PATH, relative_path))
    full_path = os.path.abspath(full_path)

    # Ensure the resolved path is within DOWNLOAD_PATH
    base_path = os.path.abspath(DOWNLOAD_PATH)

    # Check that full_path starts with base_path
    # Use os.path.commonpath to handle edge cases properly
    try:
        common = os.path.commonpath([base_path, full_path])
        if common != base_path:
            return None
    except ValueError:
        # Paths are on different drives (Windows)
        return None

    return full_path


# API Routes (to be implemented in later steps)

# Folder endpoints (Step 6)
@app.route('/api/folders', methods=['GET'])
@require_auth
def get_folders():
    """List folders in the download directory"""
    # Get optional subfolder parameter
    subfolder = request.args.get('path', '')

    # Validate path to prevent traversal
    target_path = validate_path(subfolder)
    if target_path is None:
        return jsonify({'error': 'Invalid path'}), 400

    # Check if path exists
    if not os.path.exists(target_path):
        return jsonify({'error': 'Path does not exist'}), 404

    if not os.path.isdir(target_path):
        return jsonify({'error': 'Path is not a directory'}), 400

    # List subdirectories
    try:
        folders = []
        for entry in os.listdir(target_path):
            entry_path = os.path.join(target_path, entry)
            if os.path.isdir(entry_path):
                # Return relative path from DOWNLOAD_PATH
                rel_path = os.path.relpath(entry_path, DOWNLOAD_PATH)
                folders.append({
                    'name': entry,
                    'path': rel_path.replace('\\', '/')  # Normalize to forward slashes
                })

        return jsonify({'folders': folders}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to list folders: {str(e)}'}), 500


@app.route('/api/folders', methods=['POST'])
@require_auth
def create_folder():
    """Create a new folder in the download directory"""
    data = request.get_json()

    if not data or 'path' not in data:
        return jsonify({'error': 'Missing path in request body'}), 400

    folder_path = data['path']

    # Validate path to prevent traversal
    target_path = validate_path(folder_path)
    if target_path is None:
        return jsonify({'error': 'Invalid path'}), 400

    # Check if folder already exists
    if os.path.exists(target_path):
        return jsonify({'error': 'Folder already exists'}), 409

    # Create the folder
    try:
        os.makedirs(target_path, exist_ok=False)

        # Return the created folder info
        rel_path = os.path.relpath(target_path, DOWNLOAD_PATH)
        return jsonify({
            'name': os.path.basename(target_path),
            'path': rel_path.replace('\\', '/')
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500


# Settings endpoints (Step 7)
@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    """Get all settings as a JSON object"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        # Get all settings
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        conn.close()

        # Convert to dictionary
        settings = {row['key']: row['value'] for row in rows}

        return jsonify(settings), 200
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve settings: {str(e)}'}), 500


@app.route('/api/settings', methods=['PATCH'])
@require_auth
def update_settings():
    """Update one or more settings (partial update)"""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    # List of valid setting keys
    valid_keys = {'global_rate_limit_bps', 'max_concurrent_downloads'}

    # Validate all keys are allowed
    invalid_keys = set(data.keys()) - valid_keys
    if invalid_keys:
        return jsonify({'error': f'Invalid setting keys: {", ".join(invalid_keys)}'}), 400

    # Validate values (all settings should be numeric strings)
    for key, value in data.items():
        # Ensure value is a string and can be converted to int
        try:
            if not isinstance(value, (str, int)):
                return jsonify({'error': f'Setting {key} must be a string or integer'}), 400

            # Convert to int to validate it's numeric
            int_value = int(value)

            # Validate specific constraints
            if key == 'global_rate_limit_bps' and int_value < 0:
                return jsonify({'error': 'global_rate_limit_bps must be >= 0'}), 400

            if key == 'max_concurrent_downloads' and int_value < 1:
                return jsonify({'error': 'max_concurrent_downloads must be >= 1'}), 400

        except ValueError:
            return jsonify({'error': f'Setting {key} must be a valid integer'}), 400

    # Update settings in database
    try:
        conn = get_db()
        cursor = conn.cursor()

        for key, value in data.items():
            # Convert to string for storage
            value_str = str(value)
            cursor.execute(
                "UPDATE settings SET value = ? WHERE key = ?",
                (value_str, key)
            )

        conn.commit()

        # Return updated settings
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        conn.close()

        settings = {row['key']: row['value'] for row in rows}
        return jsonify(settings), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update settings: {str(e)}'}), 500


# Background event loop setup
def start_background_loop(loop):
    """Start the background event loop in a separate thread"""
    asyncio.set_event_loop(loop)
    loop.run_forever()


def init_background_loop():
    """Initialize background event loop in a separate thread"""
    global background_loop, background_thread
    background_loop = asyncio.new_event_loop()
    background_thread = threading.Thread(target=start_background_loop, args=(background_loop,), daemon=True)
    background_thread.start()


# Helper to run async functions in sync context
def run_async(coro):
    """Run an async coroutine in the background event loop"""
    if background_loop is None:
        raise RuntimeError("Background event loop not initialized")
    future = asyncio.run_coroutine_threadsafe(coro, background_loop)
    return future.result()


# Download endpoints (Step 10)
@app.route('/api/downloads', methods=['GET'])
@require_auth
def get_downloads():
    """Get list of all downloads with progress info"""
    try:
        downloads = run_async(download_manager.get_downloads())
        return jsonify({'downloads': downloads}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get downloads: {str(e)}'}), 500


@app.route('/api/downloads', methods=['POST'])
@require_auth
def create_download():
    """Create a new download"""
    data = request.get_json()

    if not data or 'url' not in data:
        return jsonify({'error': 'Missing url in request body'}), 400

    url = data['url']
    folder = data.get('folder', '')
    filename = data.get('filename')

    # Validate folder path if provided
    if folder:
        target_path = validate_path(folder)
        if target_path is None:
            return jsonify({'error': 'Invalid folder path'}), 400

    try:
        download_id = run_async(download_manager.add_download(url, folder, filename))

        # Get the created download info
        downloads = run_async(download_manager.get_downloads())
        created_download = next((d for d in downloads if d['id'] == download_id), None)

        return jsonify(created_download), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create download: {str(e)}'}), 500


@app.route('/api/downloads/<download_id>', methods=['GET'])
@require_auth
def get_download(download_id):
    """Get specific download by ID"""
    try:
        downloads = run_async(download_manager.get_downloads())
        download = next((d for d in downloads if d['id'] == download_id), None)

        if download is None:
            return jsonify({'error': 'Download not found'}), 404

        return jsonify(download), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get download: {str(e)}'}), 500


@app.route('/api/downloads/<download_id>', methods=['PATCH'])
@require_auth
def update_download(download_id):
    """Update download (pause/resume)"""
    data = request.get_json()

    if not data or 'action' not in data:
        return jsonify({'error': 'Missing action in request body'}), 400

    action = data['action']

    try:
        if action == 'pause':
            run_async(download_manager.pause_download(download_id))
        elif action == 'resume':
            run_async(download_manager.resume_download(download_id))
        else:
            return jsonify({'error': f'Invalid action: {action}. Use "pause" or "resume"'}), 400

        # Return updated download info
        downloads = run_async(download_manager.get_downloads())
        download = next((d for d in downloads if d['id'] == download_id), None)

        if download is None:
            return jsonify({'error': 'Download not found'}), 404

        return jsonify(download), 200
    except ValueError as e:
        # Status validation error (e.g., trying to pause a completed download)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to update download: {str(e)}'}), 500


@app.route('/api/downloads/<download_id>', methods=['DELETE'])
@require_auth
def delete_download(download_id):
    """Cancel and delete a download

    Query parameters:
        delete_file (optional): 'true' to always delete file, 'false' to never delete.
                               If omitted, deletes file only if download is incomplete.
    """
    try:
        # Check if download exists
        downloads = run_async(download_manager.get_downloads())
        download = next((d for d in downloads if d['id'] == download_id), None)

        if download is None:
            return jsonify({'error': 'Download not found'}), 404

        # Get delete_file parameter from query string
        delete_file_param = request.args.get('delete_file')
        delete_file = None
        if delete_file_param is not None:
            delete_file = delete_file_param.lower() == 'true'

        run_async(download_manager.cancel_download(download_id, delete_file=delete_file))
        return jsonify({'message': 'Download removed from manager'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete download: {str(e)}'}), 500


@app.route('/api/downloads/pause-all', methods=['POST'])
@require_auth
def pause_all_downloads():
    """Pause all active downloads"""
    try:
        run_async(download_manager.pause_all())
        return jsonify({'message': 'All downloads paused'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to pause downloads: {str(e)}'}), 500


@app.route('/api/downloads/resume-all', methods=['POST'])
@require_auth
def resume_all_downloads():
    """Resume all paused downloads"""
    try:
        run_async(download_manager.resume_all())
        return jsonify({'message': 'All downloads resumed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to resume downloads: {str(e)}'}), 500


# WebSocket endpoint (Step 11)
@sock.route('/ws')
def websocket_handler(ws):
    """WebSocket endpoint for real-time download updates"""
    # Authenticate using query parameter
    api_key = request.args.get('api_key')

    if not api_key:
        ws.send(json.dumps({'error': 'Missing api_key query parameter'}))
        ws.close(reason='Authentication required')
        return

    # Constant-time comparison to prevent timing attacks
    if not compare_digest(api_key, API_KEY):
        ws.send(json.dumps({'error': 'Invalid API key'}))
        ws.close(reason='Invalid credentials')
        return

    # Add client to the set of connected clients
    websocket_clients.add(ws)

    try:
        # Send initial download status
        downloads = run_async(download_manager.get_downloads())
        ws.send(json.dumps({
            'type': 'status',
            'downloads': downloads
        }))

        # Keep connection alive and handle incoming messages
        while True:
            message = ws.receive()

            if message is None:
                # Connection closed
                break

            # Handle client messages (currently we don't expect any specific messages)
            # But we can extend this to support commands like pause/resume from WS
            try:
                data = json.loads(message)
                # Could handle commands here in future
                # For now, just echo back an acknowledgment
                ws.send(json.dumps({'type': 'ack', 'received': data}))
            except json.JSONDecodeError:
                ws.send(json.dumps({'error': 'Invalid JSON'}))

    except Exception as e:
        # Handle any errors during WebSocket communication
        print(f"WebSocket error: {e}")
    finally:
        # Remove client from the set when disconnected
        websocket_clients.discard(ws)


# Broadcast function to send updates to all connected WebSocket clients
async def broadcast_downloads():
    """Periodically broadcast download status to all connected WebSocket clients"""
    while True:
        try:
            # Wait 1 second between broadcasts
            await asyncio.sleep(1)

            if not websocket_clients:
                # No clients connected, skip
                continue

            # Get current download status
            downloads = await download_manager.get_downloads()

            # Prepare message
            message = json.dumps({
                'type': 'status',
                'downloads': downloads
            })

            # Send to all connected clients
            # Make a copy of the set to avoid modification during iteration
            clients = websocket_clients.copy()
            for client in clients:
                try:
                    client.send(message)
                except Exception as e:
                    # If send fails, remove the client (it's probably disconnected)
                    print(f"Failed to send to WebSocket client: {e}")
                    websocket_clients.discard(client)

        except Exception as e:
            print(f"Broadcast error: {e}")
            # Continue broadcasting even if there's an error


# Serve static files
@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/test.html')
def test_page():
    return app.send_static_file('test.html')


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Initialize database on startup
    init_db()

    # Initialize background event loop
    init_background_loop()

    # Initialize download manager in the background loop
    import time
    time.sleep(0.1)  # Give background loop time to start
    download_manager = DownloadManager(db_path=DB_PATH, download_path=DOWNLOAD_PATH)

    # Start WebSocket broadcast task
    broadcast_task = asyncio.run_coroutine_threadsafe(broadcast_downloads(), background_loop)

    print(f"Starting Download Manager on port {PORT}")
    print(f"Download path: {DOWNLOAD_PATH}")
    print(f"Database path: {DB_PATH}")
    print("Background event loop initialized")
    print("WebSocket broadcast task started")

    # Run Flask app
    app.run(host='0.0.0.0', port=PORT, debug=False)
