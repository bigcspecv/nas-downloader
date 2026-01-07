import os
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

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

# Configure CORS
if ALLOWED_ORIGINS == '*':
    CORS(app)
else:
    origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(',')]
    CORS(app, origins=origins)


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


# Download endpoints (Step 10)
@app.route('/api/downloads', methods=['GET'])
@require_auth
def get_downloads():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads', methods=['POST'])
@require_auth
def create_download():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads/<download_id>', methods=['GET'])
@require_auth
def get_download(download_id):
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads/<download_id>', methods=['PATCH'])
@require_auth
def update_download(download_id):
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads/<download_id>', methods=['DELETE'])
@require_auth
def delete_download(download_id):
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads/pause-all', methods=['POST'])
@require_auth
def pause_all_downloads():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/downloads/resume-all', methods=['POST'])
@require_auth
def resume_all_downloads():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


# WebSocket endpoint (Step 11)
# Will be implemented with flask-sock


# Serve static files
@app.route('/')
def index():
    return app.send_static_file('index.html')


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

    print(f"Starting Download Manager on port {PORT}")
    print(f"Download path: {DOWNLOAD_PATH}")
    print(f"Database path: {DB_PATH}")

    # Run Flask app
    app.run(host='0.0.0.0', port=PORT, debug=False)
