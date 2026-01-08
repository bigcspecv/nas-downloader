# LLM Tools

Utility scripts for maintaining LLM context documentation with **zero token cost**.

All scripts use section markers to find and update specific parts of `llm-context.md` without requiring the LLM to read the entire file.

---

## update_in_progress.py

Update the "In Progress" section to track current work.

### Usage

```bash
# Start working on a step
python llm-tools/update_in_progress.py start \
    --working-on "Fix progress bar display" \
    --files "app.js, index.html"

# Clear when done
python llm-tools/update_in_progress.py clear
```

### When to use

- **Start**: At the beginning of a step, before writing any code
- **Clear**: In "Before You Stop" checklist, step 1

---

## add_working_context.py

Add a new entry to the Working Context table.

### Usage

```bash
python llm-tools/add_working_context.py --step 19 \
    --description "Fixed progress bar to display downloaded/total bytes correctly"
```

### When to use

In "Before You Stop" checklist, step 2. Script will warn if archiving is needed (4+ entries).

---

## update_current_step.py

Update or increment the Current Step number.

### Usage

```bash
# Set to specific number
python llm-tools/update_current_step.py 19

# Auto-increment by 1
python llm-tools/update_current_step.py --increment
```

### When to use

In "Before You Stop" checklist, step 7 (final step).

---

## add_lesson.py

Add a new Lesson Learned.

### Usage

```bash
python llm-tools/add_lesson.py --step 19 \
    --lesson "Progress bars need explicit null checks for display formatting"
```

### When to use

In "Before You Stop" checklist, step 4 (if applicable).

---

## add_decision.py

Add a new Decision to the decisions table.

### Usage

```bash
python llm-tools/add_decision.py --step 19 \
    --decision "Use Python scripts for context updates" \
    --why "Eliminates token cost of reading files for updates"
```

### When to use

In "Before You Stop" checklist, step 5 (if applicable).

---

## archive_working_context.py

Automatically archive old Working Context entries to `llm-reference.md`.

### Usage

```bash
python llm-tools/archive_working_context.py
```

### How it works

1. Parses Working Context table (between `CONTEXT-START/END` markers)
2. If >3 entries, moves oldest to `llm-reference.md` (before `ARCHIVE-END` marker)
3. Updates both files atomically

### When to use

In "Before You Stop" checklist, step 3 (if Working Context has 4+ entries after adding your entry).

---

## add-icon.sh / add-icon.bat

Add a new Heroicon to the project.

### Usage

**Windows:**
```bash
llm-tools/add-icon.bat arrow-right
```

**Unix/Mac:**
```bash
llm-tools/add-icon.sh arrow-right
```

### How it works

1. Checks if heroicons is installed (runs `npm install` if needed)
2. Copies icon from `node_modules/heroicons/24/outline/` to `server/static/images/icons/`
3. Shows usage examples for HTML and JavaScript

### When to use

When adding a new icon to the UI that doesn't exist in `server/static/images/icons/`. Browse available icons at [heroicons.com](https://heroicons.com).

### Example output

```
✓ Copied arrow-right.svg to server/static/images/icons/

To use it in your HTML:
  <span class="icon-placeholder" data-icon="arrow-right" data-class="icon"></span>

To use it in JavaScript:
  icon('arrow-right', 'icon')
```

---

## Benefits

✅ **Zero tokens burned** - No file reading required
✅ **Atomic operations** - All updates succeed or all fail
✅ **Structured updates** - Can't corrupt markdown format
✅ **Automatic validation** - Scripts validate input and structure
