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


# API Routes (to be implemented in later steps)

# Folder endpoints (Step 6)
@app.route('/api/folders', methods=['GET'])
@require_auth
def get_folders():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/folders', methods=['POST'])
@require_auth
def create_folder():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


# Settings endpoints (Step 7)
@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


@app.route('/api/settings', methods=['PATCH'])
@require_auth
def update_settings():
    # To be implemented
    return jsonify({'error': 'Not implemented'}), 501


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
