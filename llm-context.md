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
4. **Before coding:** Update "In Progress" with what you're about to do
5. Complete ONE step, then STOP
6. **After coding:** Follow "Before You Stop" checklist
7. Mark your step complete with `[x]` and clear "In Progress"

**Reference:** `llm-init.md` has the full project spec. Use it for guidance, but adapt based on what's actually built. Note any divergence.

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

After completing your step, you MUST:

1. **Clear "In Progress"** - Set status back to "Not started"
2. **Update "Working Context"** - Add 1-2 sentences about what you did
3. **Add to "Lessons Learned"** - If you hit a problem or discovered something important
4. **Add to "Decisions"** - If you made a choice that affects future steps
5. **Update "Code Patterns"** - If you established a pattern others should follow
6. **Increment "Current Step"** - Update the number
7. **Summarize if needed** - If Working Context exceeds ~10 entries, summarize older ones into a "Summary of Steps X-Y" entry (compress, don't delete)

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

## Current Step: 3

## In Progress

<!-- Update this IMMEDIATELY when you start working, BEFORE writing any code -->

**Status:** Not started
**Working on:** -
**Files touched:** -

---

## Checklist

### Phase 1: Setup
- [x] 1. Create directories: `server/`, `server/static/`, `server/db/`, `extension/`, `extension/icons/`
- [x] 2. Create `.env.example`, `.gitignore`, `docker-compose.yml`
- [ ] 3. Create `server/requirements.txt`, `server/Dockerfile`

### Phase 2: Server Core
- [ ] 4. Create `server/db/schema.sql` (downloads + settings tables)
- [ ] 5. Create `server/app.py` skeleton (Flask, CORS, auth middleware, DB init)
- [ ] 6. Add folder endpoints (`GET/POST /api/folders`) with path traversal protection
- [ ] 7. Add settings endpoints (`GET/PATCH /api/settings`)

### Phase 3: Downloads
- [ ] 8. Create `server/download_manager.py` (DownloadManager + Download classes)
- [ ] 9. Implement download logic (aiohttp, pause/resume with Range headers, rate limiting)
- [ ] 10. Add download endpoints (CRUD + pause-all/resume-all)
- [ ] 11. Add WebSocket endpoint (`/ws`) with auth and message handling

### Phase 4: Web UI
- [ ] 12. Create `server/static/index.html` (status, folders, downloads list, controls)
- [ ] 13. Create `server/static/style.css`
- [ ] 14. Create `server/static/app.js` (WebSocket client, DOM updates)

### Phase 5: Chrome Extension
- [ ] 15. Create `extension/manifest.json` (Manifest V3)
- [ ] 16. Create `extension/options.html` + `options.js` (server URL, API key config)
- [ ] 17. Create `extension/background.js` (WebSocket connection, reconnect logic)
- [ ] 18. Create `extension/popup.html` + `popup.js` (UI mirroring web UI features)
- [ ] 19. Create placeholder icons (16, 48, 128px)

### Phase 6: Finalize
- [ ] 20. Test full flow (docker-compose up, add download, pause/resume, rate limit)
- [ ] 21. Test extension (connect, add download, verify sync)
- [ ] 22. Create `README.md`

---

## Working Context

<!-- Recent work. When this exceeds ~10 entries, summarize older ones into a "Steps X-Y summary" entry. -->

| Step | What happened |
|------|---------------|
| 1 | Created project directory structure: server/ with static/ and db/ subdirectories, extension/ with icons/ subdirectory. All directories created using mkdir -p on Windows. |
| 2 | Created .env.example with all environment variables (API_KEY, PORT, ALLOWED_ORIGINS, etc.). Updated existing .gitignore to add project-specific ignores (downloads/, data/, *.db). Created docker-compose.yml with service definition, volume mounts, and environment variable passing. |

---

## Lessons Learned (PERMANENT)

<!-- Things discovered that prevent future mistakes. Never delete these. -->

- (none yet)

---

## Decisions (PERMANENT)

<!-- Choices made that affect future steps. Include reasoning. Never delete. -->

| Decision | Why | Step |
|----------|-----|------|
| - | - | - |

---

## Code Patterns (PERMANENT)

<!-- Established patterns. Update as they evolve, but don't delete history. -->

**Authentication:**
```
(defined in Step 5)
```

**Database Access:**
```
(defined in Step 5)
```

**WebSocket Broadcasting:**
```
(defined in Step 11)
```

**Error Response Format:**
```
(defined in Step 5)
```

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
8. After completing each step, prompt the user to commit with a short single-line commit message

---
