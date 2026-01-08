import asyncio
import aiohttp
import os
import sqlite3
import uuid
import time
from datetime import datetime
from typing import Optional, Dict, List


class Download:
    """Individual download handler"""

    def __init__(self, download_id: str, url: str, folder: str, filename: str,
                 db_path: str, download_path: str, manager):
        self.id = download_id
        self.url = url
        self.folder = folder
        self.filename = filename
        self.db_path = db_path
        self.download_path = download_path
        self.manager = manager

        self.status = 'queued'
        self.downloaded_bytes = 0
        self.total_bytes = 0
        self.speed_bps = 0
        self.eta_seconds = 0
        self.error_message = None

        self.session = None
        self.task = None
        self.cancelled = False
        self.paused = False

        # For speed calculation
        self.last_update_time = None
        self.last_update_bytes = 0

    def get_file_path(self) -> str:
        """Get full path to download file"""
        folder_path = os.path.join(self.download_path, self.folder)
        return os.path.join(folder_path, self.filename)

    def update_db(self):
        """Save current state to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        completed_at = datetime.utcnow().isoformat() if self.status == 'completed' else None

        cursor.execute("""
            UPDATE downloads
            SET status = ?, downloaded_bytes = ?, total_bytes = ?,
                error_message = ?, completed_at = ?
            WHERE id = ?
        """, (self.status, self.downloaded_bytes, self.total_bytes,
              self.error_message, completed_at, self.id))

        conn.commit()
        conn.close()

    def calculate_speed(self, current_bytes: int):
        """Calculate download speed and ETA"""
        current_time = time.time()

        if self.last_update_time is None:
            self.last_update_time = current_time
            self.last_update_bytes = current_bytes
            return

        time_diff = current_time - self.last_update_time

        # Update every second
        if time_diff >= 1.0:
            bytes_diff = current_bytes - self.last_update_bytes
            self.speed_bps = bytes_diff / time_diff

            if self.speed_bps > 0 and self.total_bytes > 0:
                remaining_bytes = self.total_bytes - current_bytes
                self.eta_seconds = remaining_bytes / self.speed_bps
            else:
                self.eta_seconds = 0

            self.last_update_time = current_time
            self.last_update_bytes = current_bytes

    async def start(self):
        """Start downloading"""
        try:
            self.status = 'downloading'
            self.update_db()

            # Ensure folder exists
            folder_path = os.path.join(self.download_path, self.folder)
            os.makedirs(folder_path, exist_ok=True)

            file_path = self.get_file_path()

            # Check if partial download exists
            if os.path.exists(file_path):
                self.downloaded_bytes = os.path.getsize(file_path)

            # Prepare headers for resume
            headers = {}
            if self.downloaded_bytes > 0:
                headers['Range'] = f'bytes={self.downloaded_bytes}-'

            # Create aiohttp session
            timeout = aiohttp.ClientTimeout(total=None, sock_read=300)
            self.session = aiohttp.ClientSession(timeout=timeout)

            async with self.session.get(self.url, headers=headers) as response:
                # Check if server supports ranges
                if self.downloaded_bytes > 0 and response.status != 206:
                    # Server doesn't support ranges, restart download
                    self.downloaded_bytes = 0
                    file_mode = 'wb'
                else:
                    file_mode = 'ab' if self.downloaded_bytes > 0 else 'wb'

                # Get total size
                if 'Content-Length' in response.headers:
                    content_length = int(response.headers['Content-Length'])
                    if response.status == 206:
                        # Partial content, add to existing bytes
                        self.total_bytes = self.downloaded_bytes + content_length
                    else:
                        self.total_bytes = content_length

                self.update_db()

                # Download in chunks
                # Use smaller chunk size if rate limiting is enabled
                if self.manager.global_rate_limit_bps > 0:
                    # Use 1/4 of rate limit or 1KB minimum to allow smooth throttling
                    chunk_size = max(1024, self.manager.global_rate_limit_bps // 4)
                else:
                    chunk_size = 8192

                last_db_update = time.time()

                with open(file_path, file_mode) as f:
                    async for chunk in response.content.iter_chunked(chunk_size):
                        if self.cancelled:
                            break

                        # Wait if paused
                        while self.paused and not self.cancelled:
                            await asyncio.sleep(0.1)

                        if self.cancelled:
                            break

                        # Apply rate limiting BEFORE writing
                        await self.manager.rate_limit(len(chunk))

                        # Write chunk
                        f.write(chunk)
                        self.downloaded_bytes += len(chunk)

                        # Calculate speed
                        self.calculate_speed(self.downloaded_bytes)

                        # Update DB periodically (every 5 seconds)
                        current_time = time.time()
                        if current_time - last_db_update >= 5.0:
                            self.update_db()
                            last_db_update = current_time

                # Final update
                if not self.cancelled:
                    self.status = 'completed'
                    self.speed_bps = 0
                    self.eta_seconds = 0
                    self.update_db()

        except asyncio.CancelledError:
            self.status = 'paused'
            self.speed_bps = 0
            self.eta_seconds = 0
            self.update_db()

        except Exception as e:
            self.status = 'failed'
            self.error_message = str(e)
            self.speed_bps = 0
            self.eta_seconds = 0
            self.update_db()

        finally:
            if self.session:
                await self.session.close()

    async def pause(self):
        """Pause download - only if queued or downloading"""
        if self.status not in ['queued', 'downloading']:
            raise ValueError(f"Cannot pause download with status '{self.status}'")
        self.paused = True
        self.status = 'paused'
        self.speed_bps = 0
        self.eta_seconds = 0
        self.update_db()

    async def resume(self):
        """Resume download - only if paused"""
        if self.status != 'paused':
            raise ValueError(f"Cannot resume download with status '{self.status}'")
        self.paused = False
        # Will be restarted by manager

    async def cancel(self, delete_file: bool = None):
        """Cancel download and optionally delete file

        Args:
            delete_file: If True, always delete file. If False, never delete.
                        If None (default), delete only if download is incomplete.
        """
        self.cancelled = True
        original_status = self.status
        self.status = 'cancelled'

        if self.task:
            self.task.cancel()

        # Determine if we should delete the file
        should_delete = delete_file
        if delete_file is None:
            # Default behavior: only delete if download was incomplete
            should_delete = original_status != 'completed'

        # Delete file if requested or if incomplete
        if should_delete:
            file_path = self.get_file_path()
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass

    def get_progress(self) -> Dict:
        """Get current progress info"""
        percentage = 0.0
        if self.total_bytes > 0:
            percentage = (self.downloaded_bytes / self.total_bytes) * 100

        return {
            'id': self.id,
            'url': self.url,
            'filename': self.filename,
            'folder': self.folder,
            'status': self.status,
            'error_message': self.error_message,
            'progress': {
                'downloaded_bytes': self.downloaded_bytes,
                'total_bytes': self.total_bytes,
                'percentage': round(percentage, 2),
                'speed_bps': int(self.speed_bps),
                'eta_seconds': int(self.eta_seconds)
            }
        }


class DownloadManager:
    """Manages download queue and execution"""

    def __init__(self, db_path: str, download_path: str):
        self.db_path = db_path
        self.download_path = download_path
        self.downloads: Dict[str, Download] = {}
        self.active_tasks: List[asyncio.Task] = []

        # Global pause state
        self.global_paused = False

        # Rate limiting
        self.global_rate_limit_bps = 0
        self.last_rate_limit_time = time.time()
        self.bytes_this_second = 0

        # Load settings from DB
        self.load_settings()

        # Load existing downloads from DB
        self.load_downloads()

        # Start processing loop
        self.processing = False

    def load_settings(self):
        """Load settings from database"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT key, value FROM settings")
        settings = {row['key']: int(row['value']) for row in cursor.fetchall()}

        self.global_rate_limit_bps = settings.get('global_rate_limit_bps', 0)
        self.max_concurrent_downloads = settings.get('max_concurrent_downloads', 3)

        conn.close()

    def load_downloads(self):
        """Load existing downloads from database"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, url, filename, folder, status, downloaded_bytes, total_bytes
            FROM downloads
            WHERE status IN ('queued', 'downloading', 'paused')
        """)

        for row in cursor.fetchall():
            download = Download(
                row['id'], row['url'], row['folder'], row['filename'],
                self.db_path, self.download_path, self
            )
            download.status = row['status']
            download.downloaded_bytes = row['downloaded_bytes']
            download.total_bytes = row['total_bytes']

            # Reset downloading status to queued on startup
            if download.status == 'downloading':
                download.status = 'queued'
                download.update_db()

            self.downloads[download.id] = download

        conn.close()

    async def rate_limit(self, bytes_downloaded: int):
        """Apply rate limiting - ensures download speed doesn't exceed global_rate_limit_bps"""
        if self.global_rate_limit_bps == 0:
            return

        current_time = time.time()
        elapsed = current_time - self.last_rate_limit_time

        # Reset counter every second
        if elapsed >= 1.0:
            self.last_rate_limit_time = current_time
            self.bytes_this_second = 0
            elapsed = 0

        self.bytes_this_second += bytes_downloaded

        # Calculate how long we should have taken to download this many bytes
        expected_time = self.bytes_this_second / self.global_rate_limit_bps

        # If we're going too fast, sleep to match the rate limit
        if expected_time > elapsed:
            sleep_time = expected_time - elapsed
            await asyncio.sleep(sleep_time)

        # If we've completed a full second worth of data, reset
        if self.bytes_this_second >= self.global_rate_limit_bps:
            self.last_rate_limit_time = time.time()
            self.bytes_this_second = 0

    async def add_download(self, url: str, folder: str, filename: Optional[str] = None) -> str:
        """Add new download to queue"""
        # Generate filename if not provided
        if filename is None:
            filename = url.split('/')[-1].split('?')[0]
            if not filename:
                filename = 'download'

        # Generate download ID
        download_id = str(uuid.uuid4())

        # Set initial status based on global pause state
        initial_status = 'paused' if self.global_paused else 'queued'

        # Insert into database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO downloads (id, url, filename, folder, status)
            VALUES (?, ?, ?, ?, ?)
        """, (download_id, url, filename, folder, initial_status))

        conn.commit()
        conn.close()

        # Create Download object
        download = Download(
            download_id, url, folder, filename,
            self.db_path, self.download_path, self
        )

        # Set status to match what was saved in DB (Download.__init__ defaults to 'queued')
        download.status = initial_status
        if initial_status == 'paused':
            download.paused = True

        self.downloads[download_id] = download

        # Start processing if not already running
        if not self.processing:
            print(f"Starting process_queue task for download {download_id}")
            asyncio.create_task(self.process_queue())
        else:
            print(f"Process queue already running for download {download_id}")

        return download_id

    async def process_queue(self):
        """Process download queue respecting concurrency limits"""
        self.processing = True
        print("process_queue started")

        while True:
            # Count active downloads (check both status and tasks)
            active_count = sum(1 for d in self.downloads.values()
                             if d.status == 'downloading')

            # Find queued downloads
            queued = [d for d in self.downloads.values() if d.status == 'queued']

            # Clean up completed tasks FIRST
            self.active_tasks = [t for t in self.active_tasks if not t.done()]

            print(f"process_queue: active={active_count}, queued={len(queued)}, tasks={len(self.active_tasks)}, max={self.max_concurrent_downloads}, global_paused={self.global_paused}")

            # Start new downloads if under limit and not globally paused
            if not self.global_paused and active_count < self.max_concurrent_downloads and queued:
                for download in queued[:self.max_concurrent_downloads - active_count]:
                    print(f"Starting download {download.id}")
                    task = asyncio.create_task(download.start())
                    download.task = task
                    self.active_tasks.append(task)

            # If no active tasks and no queued downloads, stop processing
            # Use active_tasks instead of status check to avoid race condition
            if not self.active_tasks and not queued:
                print("process_queue stopping - no work to do")
                self.processing = False
                break

            await asyncio.sleep(1)

    async def pause_download(self, download_id: str):
        """Pause specific download"""
        if download_id in self.downloads:
            await self.downloads[download_id].pause()

    async def resume_download(self, download_id: str):
        """Resume specific download - starts immediately even if globally paused"""
        if download_id in self.downloads:
            download = self.downloads[download_id]
            await download.resume()  # This will raise ValueError if not paused

            # Start download immediately, bypassing global pause
            download.status = 'downloading'
            download.update_db()

            # Start the download task directly
            task = asyncio.create_task(download.start())
            download.task = task
            self.active_tasks.append(task)

            # Ensure processing loop is running for queue management
            if not self.processing:
                asyncio.create_task(self.process_queue())

    async def cancel_download(self, download_id: str, delete_file: bool = None):
        """Cancel download and remove from queue

        Args:
            download_id: ID of download to cancel
            delete_file: If True, always delete file. If False, never delete.
                        If None (default), delete only if download is incomplete.
        """
        if download_id in self.downloads:
            await self.downloads[download_id].cancel(delete_file=delete_file)
            del self.downloads[download_id]

            # Remove from database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM downloads WHERE id = ?", (download_id,))
            conn.commit()
            conn.close()

    async def pause_all(self):
        """Enable global pause mode - pauses all downloads and prevents new ones from starting"""
        self.global_paused = True

        # Pause all downloads that are downloading or queued
        for download in self.downloads.values():
            if download.status in ['downloading', 'queued']:
                await download.pause()

    async def resume_all(self):
        """Disable global pause mode - resumes all paused downloads"""
        self.global_paused = False

        # Change paused downloads to queued status
        # Let process_queue() handle starting them with proper concurrency limits
        for download in self.downloads.values():
            if download.status == 'paused':
                download.paused = False
                download.status = 'queued'
                download.update_db()

        # Start processing queue if not already running
        if not self.processing:
            asyncio.create_task(self.process_queue())

    async def get_downloads(self) -> List[Dict]:
        """Get all downloads with progress info"""
        return [download.get_progress() for download in self.downloads.values()]

    async def set_rate_limit(self, bps: int):
        """Set global rate limit"""
        self.global_rate_limit_bps = max(0, bps)

        # Update database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE settings SET value = ? WHERE key = 'global_rate_limit_bps'",
            (str(bps),)
        )
        conn.commit()
        conn.close()
