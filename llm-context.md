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
4. **Before coding:** Run `python llm-tools/update_in_progress.py start --working-on "..." --files "..."`
5. Complete ONE step, then STOP
6. **After coding:** Follow "Before You Stop" checklist (uses llm-tools scripts - ZERO tokens!)
7. Mark your step complete with `[x]` in the checklist

**Reference:** `llm-init.md` has the full project spec. Use it for guidance, but adapt based on what's actually built. Note any divergence.

**Important:** Use `llm-tools/*.py` scripts for all context updates. See [llm-tools/README.md](llm-tools/README.md) for details.

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

After completing your step, use the llm-tools scripts to update this file with ZERO token cost:

1. **Clear "In Progress"**
   ```bash
   python llm-tools/update_in_progress.py clear
   ```

2. **Update "Working Context"**
   ```bash
   python llm-tools/add_working_context.py --step STEP_NUM --description "What you did"
   ```

3. **Archive if needed** - If script warned that Working Context has 4+ entries:
   ```bash
   python llm-tools/archive_working_context.py
   ```

4. **Add to "Lessons Learned"** - If you hit a problem or discovered something important:
   ```bash
   python llm-tools/add_lesson.py --step STEP_NUM --lesson "Lesson text"
   ```

5. **Add to "Decisions"** - If you made a choice that affects future steps:
   ```bash
   python llm-tools/add_decision.py --step STEP_NUM --decision "What" --why "Why"
   ```

6. **Update "Code Patterns"** - If you established a pattern others should follow:
   - Add/update pattern in [llm-reference.md](llm-reference.md) under appropriate SECTION markers
   - If new pattern type, add section name to Code Patterns index below

7. **Increment "Current Step"**
   ```bash
   python llm-tools/update_current_step.py --increment
   ```

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

## Current Step: 50 <!-- CURRENT-STEP -->

## In Progress

<!-- Update this IMMEDIATELY when you start working, BEFORE writing any code -->

<!-- IN-PROGRESS-START -->
**Status:** Not started
**Working on:** -
**Files touched:** -
<!-- IN-PROGRESS-END -->

---

## Reference Document: llm-reference.md

The [llm-reference.md](llm-reference.md) file contains archived context and coding patterns to reduce token usage in this file.

**How to look up a pattern efficiently (2 tool calls only):**
1. Grep: `pattern="SECTION-\\w+: [PatternName]"` with `-n=true` and `output_mode="content"`
2. Parse the two line numbers from results (SECTION-START and SECTION-END lines)
3. Read: `file_path="llm-reference.md"` with `offset=[start_line]` and `limit=[end_line - start_line]`

**Example:** To get "Authentication" pattern:
- Grep for `SECTION-\\w+: Authentication` → Returns lines 25 and 35
- Read with `offset=25, limit=10` → Gets just that section

**Contents:**
- Working Context Archive (historical steps 1-15)
- Code Patterns (see index in Code Patterns section below)

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
- [x] 18. Fix progress bar display (currently shows 0.00/0.00 MB even during/after download)
- [x] 19. Fix progress data updates (downloaded_bytes, total_bytes, percentage not displaying)
- [x] 20. Add error handling and user feedback (better alerts, status messages, validation)

### Phase 6: UX - Multi-User & Real-Time Sync
- [x] 21. Broadcast settings changes via WebSocket (rate limit, max concurrent, etc.)
- [x] 22. Update UI to reflect settings changes from other users in real-time
- [x] 23. Test multi-user scenarios (two browsers, settings sync, download visibility)
- [x] 24. Overhaul WebUI

### Phase 7: UX - Folder Management Interface
- [x] 25. Create folder browser UI component (replace simple text field)
- [x] 26. Implement folder navigation (list folders, navigate into subfolders, go up)
- [x] 27. Add "New Folder" button within folder browser
- [x] 28. Show current path and breadcrumb navigation
- [x] 29. Integrate folder browser into "Add Download" form

### Phase 8: UX - Download File Management
- [x] 30. Implement in-progress file extension (e.g., .download or .crdownload)
- [x] 31. Rename file on completion (remove in-progress extension)
- [x] 32. Handle resume/pause with in-progress filenames
- [x] 33. Implement filename parsing in the webui when entering a url (strip urlenc values, etc.)
- [x] 34. Fix bugs:
   - [x] 34.01 There are two temp files being created when a user starts a download. One in the /server/downloads directory and one in the user selected downloads directory. We need the temporary download file to exist only in the user selected download directory.
   - [x] 34.02 When the user tries to download a file that has the same name as a file in the target directory, we need to append incremental numbers to the file name rather than arbitrarily overwriting the file. for example, if file.iso exists in the download directory and the user downloads a new file.iso we should change the name to file (1).iso. if file.iso and file (1).iso exist then we should name the file: file (2).iso. If file (1).iso exists and the user tries to donwload a file named file (1).iso then we should name the file file (1) (1).iso.
   - [x] 34.03 When the user cancels an in progress download the temp file in the user selected downloads directory reamins in place
   - [x] 34.04 The global rate limit in the UI does not reflect the actual value. It seems like anything less than 1MB/s is being shown as zero but zero MB/s should represent unlimited download speed. If the user selects 10KB/s or 10 B/s then they should see 10KB/s or 10B/s (respectively) the next time they open the settings modal.
   - [x] 34.05 We should name the temp download file something qunique like the ID from the DB until it completes so that if the server crashes the user can resume the download.
   - [x] 34.06 Update the pause button for individual downloads to show "Queued" when the download is queued.
   - [ ] 34.07 If the user downloads a file that has the same name as an inprogress download, treate it the same way as we handle downloading files where a file with the same name exists in the download folder.

### Phase 9: UI Polish
- [x] 35. Add loading states (spinners, skeleton screens)
- [x] 36. Improve responsive design for mobile/tablet
- [x] 37. Add animations for state transitions (smooth progress updates)
- [x] 38. Polish visual design (consistent spacing, colors, typography)

### Phase 10: Testing & Edge Cases
- [x] 39. Test network errors (timeout, connection drop, DNS failure)
- [x] 40. Test server restart (downloads resume correctly, state preserved)
- [x] 41. Test concurrent downloads (queue management, rate limiting applies correctly)
- [ ] 42. Test disk space issues (handle out-of-space gracefully)
- [x] 43. Test invalid URLs and server errors (404, 500, etc.)

### Phase 11: Chrome Extension
- [x] 44. Create `extension/manifest.json` (Manifest V3)
- [x] 45. Create `extension/options.html` + `options.js` (server URL, API key config)
- [x] 46. Create `extension/background.js` (WebSocket connection, reconnect logic)
- [x] 47. Create `extension/popup.html` + `popup.js` (UI mirroring web UI features)
- [x] 48. Create placeholder icons (16, 48, 128px)

### Phase 11.1 Fix Bugs in and add features to chrome extension
- [x] 48.01 Download card bugs:
   - [x] 48.01.01 download speed not showing up on card
   - [x] 48.01.02 Download Progress not working. Always shows 0 B / 0 B
   - [x] 48.01.03 Download Pause Button not working
   - [ ] 48.01.04 Scroll bar dows not match styling
- [ ] 48.02 Missing features:
   - [x] 48.02.01 Add the ability to intecept download links in the browser
   - [x] 48.02.02 Add the ability to pick a folder to download to like we do in the web-app when someone chooses to download with the context menu or manually enters a url in the extension popup
   - [x] 48.02.03 Add ability to pause all downloads (global pause button on main popup)
   - [ ] 48.02.04 Add ability to delete multiple downloads by selecting them (multi-select with checkboxes on main popup)
   - [ ] 48.02.05 Add ability to set the server's global download speed in settings on the main popup by clicking on the global download speed in the footer and bringing up a modal
   - [ ] 48.02.06 Add ability to set the server's max concurrent downloads in settings on the main popup by adding this setting to the modal from the previous step

### Phase 12: Download History - Core Infrastructure
- [ ] 49. Add `load_history` setting to settings table (default '1' = enabled)
- [ ] 50. Create `get_history_downloads()` method to query DB for completed/failed downloads
- [ ] 51. Modify `get_downloads()` to merge active (memory) + history (DB query)
- [ ] 52. Add pagination support: limit (default 50) and offset params
- [ ] 53. Update WebSocket broadcast to include history based on filter
- [ ] 54. Test with 100+ downloads to verify performance
- [ ] 55. Update UI filter tabs to show correct counts including history
- [ ] 56. Verify real-time updates work smoothly for active downloads

### Phase 13: Download History - Deletion Management
- [ ] 57. Create `delete_history_download(id)` method (DB-only, no memory lookup)
- [ ] 58. Modify DELETE `/api/downloads/<id>` to check DB if not in memory
- [ ] 59. Verify `delete_file=true/false` query param works for completed downloads
- [ ] 60. Make delete buttons visible for completed/failed downloads in UI
- [ ] 61. Add delete confirmation with checkbox "Also delete downloaded file"
- [ ] 62. Disable pause/resume buttons for completed/failed (show status only)
- [ ] 63. Broadcast deletion events via WebSocket to all clients
- [ ] 64. Test deletion with/without file removal across multiple clients

### Phase 14: Download History - Bulk Operations
- [ ] 65. Add POST `/api/downloads/clear-completed` endpoint
- [ ] 66. Add POST `/api/downloads/clear-failed` endpoint
- [ ] 67. Add `delete_files=true/false` query param for bulk clear
- [ ] 68. Add "Clear Completed" / "Clear Failed" buttons to UI toolbar
- [ ] 69. Show confirmation: "Clear 23 completed downloads?"
- [ ] 70. Add checkbox to dialog: "Also delete all downloaded files"
- [ ] 71. Show progress notification: "Clearing downloads... (15/23)"
- [ ] 72. Broadcast bulk deletion to refresh all connected clients

### Phase 15: Finalize
- [ ] 73. Test full flow (docker-compose up, add download, pause/resume, rate limit)
- [ ] 74. Test extension (connect, add download, verify sync)
- [ ] 75. Create `README.md`

---

## Working Context

<!-- Recent work. Keep last 3 entries here. Run `python llm-tools/archive_working_context.py` after adding 4th entry. -->

<!-- CONTEXT-START -->
| Step | What happened |
|------|---------------|
| 48.02.01 | Added download interception to Chrome extension: Added 'downloads' permission, implemented chrome.downloads.onCreated listener that intercepts and cancels browser downloads when enabled. Context menu items updated to 'NAS Download' and 'NAS Download to'. Added intercept toggle in popup footer. Moved settings/web UI buttons to header as Heroicons outline icons (window, cog-6-tooth). Toggle persists setting, defaults to enabled, allows normal Chrome downloads when disabled. |
| 48.02.02 | Added folder picker to Chrome extension: Created modal with breadcrumb navigation and folder list UI. Implemented folder navigation functions (navigateToFolderInPicker, renderFolderPickerBreadcrumb, renderFolderPickerList, createNewFolderInPicker). Added 'Add to...' button next to main Add button in popup that opens folder picker. Updated background.js context menu handlers so 'NAS Download to' stores URL and shows notification to open popup. Added checkPendingDownload() function to automatically open folder picker on popup open when context menu 'Download to' was used. Users can now select destination folder when adding downloads via manual URL entry or context menu. |
| 48.02.02 | Added folder picker modal to Chrome extension popup with breadcrumb navigation and folder list UI. Simplified UX by consolidating to single Add button that opens folder picker. Modified background.js context menu handlers so 'NAS Download to' stores URL and auto-opens popup. Users can now select destination folder for manual URL entry and context menu downloads. Fixed footer positioning issue caused by duplicate CSS rules overriding flex-shrink property. |
| 48.02.03 | Added global pause/resume all button to Chrome extension popup footer. Button shows pause icon (to pause) or play icon with orange color (to resume). Added global download speed display next to pause button with download icon. Footer layout: [Pause] | [Speed] | [Intercept Toggle]. Also added dynamic context menu that shows only 'NAS Download to...' when intercept is enabled, or both 'NAS Download' and 'NAS Download to...' when disabled. |
<!-- CONTEXT-END -->

---

## Lessons Learned (PERMANENT)

<!-- Things discovered that prevent future mistakes. Never delete these. -->

<!-- LESSONS-START -->
- Step 6: Use os.path.commonpath() for path traversal protection instead of simple string prefix checking - it properly handles edge cases like different drives on Windows and normalized path separators
- Step 10: Flask's built-in development server doesn't support async def route handlers. Use a background event loop in a daemon thread with asyncio.run_coroutine_threadsafe() to run async operations from sync Flask routes. Initialize with asyncio.new_event_loop() and run in threading.Thread(daemon=True).
- Step 10: When tracking async tasks in a list, clean up completed tasks (filter out done() tasks) BEFORE checking if list is empty to avoid race conditions where newly created tasks haven't started yet.
- Step 10: aiohttp's default SSL handling works correctly on all platforms including Windows. When a download fails with SSL errors, check if the server's SSL certificate is valid (not expired/invalid) before assuming it's a platform issue. The default aiohttp behavior properly validates certificates and rejects invalid ones.
- Step 14: Flask serves static files from /static/ URL path by default, not from root. Always use /static/ prefix in HTML links (e.g., href="/static/style.css") unless you configure a custom static_url_path.
- Step 14: When updating database settings, also update the in-memory state of the manager object. Database changes alone don't affect running code - you must sync both DB and runtime state for settings to take effect immediately.
- Step 14: Rate limiting with large chunk sizes is ineffective. Adjust chunk size based on rate limit (e.g., rate_limit/4) to enable smooth throttling. Calculate expected download time vs actual time and sleep the difference for accurate rate limiting.
- Step 14: When creating Download objects, the __init__ method sets default values (like status='queued'). Always override these with actual database values after construction to preserve saved state.
- Step 23: resume_all() must not call resume_download() for each download, as resume_download() bypasses the queue and concurrency limits. Instead, change paused downloads to queued status and let process_queue() enforce limits.
- Step 24: simple_websocket library: Using ws.close(reason=1008, message='...') causes 'Invalid frame header' errors. Sending a message immediately before close also breaks the close handshake. Solution: send auth_error message type, add small delay (10ms), then call ws.close() without parameters. Client detects message type instead of close code.
- Step 34.01: Always use os.path.abspath() on environment variable paths to ensure consistent resolution regardless of current working directory. Without this, /downloads can resolve to different locations (c:\downloads vs server\downloads) depending on where the script is run from.
- Step 34.04: For numeric-only input fields, use type='text' with pattern='[0-9]*' and inputmode='numeric' instead of type='number'. Add inline oninput handler: this.value = this.value.replace(/[^0-9]/g, '') to immediately strip invalid characters. This prevents decimal entry without cursor jumping and provides better mobile keyboard support.
- Step 39: When displaying real-time metrics like download speed, always detect stalls/disconnections by checking time since last update. If no new data for N seconds (e.g., 3s), reset displayed speed to 0. Without this, UI shows stale speed values that mislead users about connection status.
- Step 48.02.02: When using flexbox layouts, duplicate CSS rules can override critical properties. Always check for duplicate selectors that may override flex-shrink, flex-grow, or other flex properties. In Chrome extensions, footer positioning requires proper flex-shrink: 0 on fixed elements to prevent them from following content height.
<!-- LESSONS-END -->

---

## Decisions (PERMANENT)

<!-- Choices made that affect future steps. Include reasoning. Never delete. -->

<!-- DECISIONS-START -->
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
| Toast notification system instead of browser alerts | Provides better UX with non-blocking notifications, auto-dismiss after timeout, visual feedback with icons/colors for different message types (success/error/warning/info), and allows multiple notifications to stack | 20 |
| Use auth_error message type instead of WebSocket close codes for authentication failures | simple_websocket library has issues with custom close codes and sending messages before close. Message-based approach is more reliable and allows sending detailed error information before closing connection | 24 |
| Folder browser with breadcrumb navigation and scroll indicator | Provides Save As dialog-like UX with compact breadcrumb showing full path, auto-scrolls to show current location, animated scroll indicator (.../) reveals hidden path segments, uses existing /api/folders endpoints for navigation and creation | 25-29 |
| Use .ndownload extension for in-progress downloads | Clearly identifies temp files as belonging to nas-downloader, prevents conflicts with browser .download or .crdownload files, and provides visual indication that file is incomplete | 30-32 |
| Smart filename conflict handling with auto-rename for auto-fills | Auto-filled filenames (from URL) silently rename to unique names when conflicts detected - user sees final name in textbox. User-typed filenames show yellow warning but keep original name. Overwrite dialog appears on submit if conflict exists, allowing intentional overwrites. This prevents accidental overwrites for auto-fills while giving users full control when they manually specify names. | 34.02 |
| Dual-source pattern for downloads (active + history) | Active downloads loaded into memory for real-time updates (fast), completed/failed downloads queried from DB on-demand (lazy loading). Maintains performance for active downloads while enabling unlimited history viewing without memory overhead. | 49-56 |
| Lazy loading download history | History only queried when UI filter is 'completed' or 'failed', not on every broadcast. Reduces unnecessary DB queries and WebSocket payload size. Cache results for 1 second to prevent duplicate queries during same broadcast cycle. | 49-56 |
| Pagination default of 50 items for history | Balances UI performance with user convenience - most users don't need hundreds of completed downloads visible at once, but 50 is enough for recent history. Prevents unbounded memory usage as download history grows. | 52 |
| Bulk operations continue on file deletion failures | When clearing completed/failed downloads in bulk, continue processing if individual file deletions fail (permission errors, missing files, etc.). Log errors and show summary notification. One failure shouldn't block clearing entire history. | 65-72 |
| Use download ID for temp file naming instead of filename-based | Enables crash recovery by matching temp files to DB records via ID. Eliminates temp file conflicts since IDs are unique. Simplifies file management logic. | 34.05 |
| Design token system with CSS custom properties | Centralizes all design values (spacing on 4px scale, typography scale, color palette, border radius, transitions) into CSS variables. Ensures visual consistency across all components, makes global design changes trivial (change one variable instead of hundreds of values), improves maintainability, and provides clear design constraints for future development. Based on industry-standard 4px spacing grid system. | 38 |
| HTML canvas-based icon generator instead of pre-generated PNGs | Avoids binary files in git, provides easy customization for users, generates proper PNG files on-demand, and includes visual preview. Users can regenerate icons with different designs without needing image editing tools. | 48 |
<!-- DECISIONS-END -->

---

## Code Patterns (PERMANENT)

<!-- Coding patterns are documented in llm-reference.md. Use grep to look up specific patterns as needed. -->

Coding patterns are documented in [llm-reference.md](llm-reference.md). Use the efficient lookup method described in the Reference Document section above.

**Available patterns:**
- Authentication
- Database Access
- Download Manager Usage
- Download Endpoints (Sync with Background Event Loop)
- WebSocket Broadcasting
- Error Response Format
- Path Traversal Protection
- Settings Validation
- Icon System

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
11. **NEVER use inline styling** - all styles must be defined in CSS files, not in HTML style attributes

---
