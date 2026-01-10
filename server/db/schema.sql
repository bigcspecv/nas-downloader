CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    folder TEXT NOT NULL,
    status TEXT NOT NULL,  -- queued, downloading, paused, completed, failed
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    error_message TEXT,
    user_agent TEXT,  -- Browser User-Agent for download requests
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Migration: Add user_agent column if it doesn't exist (for existing databases)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a pragma check
-- This will fail silently if column already exists

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize default settings (only if not already present)
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('global_rate_limit_bps', '0'),
    ('max_concurrent_downloads', '3'),
    ('default_download_folder', '');
