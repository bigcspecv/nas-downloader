#!/usr/bin/env python3
"""
Archive old Working Context entries from llm-context.md to llm-reference.md

This script maintains the "last 3 entries" rule in the Working Context table.
When there are more than 3 entries, the oldest ones are moved to the archive.

Usage:
    python llm-tools/archive_working_context.py
"""

import os
import re
from pathlib import Path


def find_table_boundaries(lines, start_marker, end_marker):
    """Find the start and end line indices for a marked table section."""
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
        elif end_marker in line:
            end_idx = i
            break

    return start_idx, end_idx


def parse_table_rows(lines, start_idx, end_idx):
    """
    Parse markdown table rows between start and end indices.
    Returns list of (step, description) tuples.
    """
    if start_idx is None or end_idx is None:
        return []

    rows = []
    in_table = False

    for i in range(start_idx, end_idx + 1):
        line = lines[i].strip()

        # Skip marker lines and empty lines
        if '<!--' in line or not line:
            continue

        # Skip table header
        if line.startswith('| Step |'):
            in_table = True
            continue

        # Skip separator line
        if line.startswith('|---'):
            continue

        # Parse data rows
        if in_table and line.startswith('|'):
            # Extract cells: | Step | What happened |
            parts = [cell.strip() for cell in line.split('|')[1:-1]]
            if len(parts) == 2:
                rows.append((parts[0], parts[1]))

    return rows


def format_table_row(step, description):
    """Format a table row with proper markdown syntax."""
    return f"| {step} | {description} |"


def main():
    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    context_file = project_root / "llm-context.md"
    reference_file = project_root / "llm-reference.md"

    # Read files
    with open(context_file, 'r', encoding='utf-8') as f:
        context_lines = f.readlines()

    with open(reference_file, 'r', encoding='utf-8') as f:
        reference_lines = f.readlines()

    # Find Working Context table in llm-context.md
    ctx_start, ctx_end = find_table_boundaries(
        context_lines,
        '<!-- CONTEXT-START -->',
        '<!-- CONTEXT-END -->'
    )

    if ctx_start is None or ctx_end is None:
        print("ERROR: Could not find CONTEXT-START/CONTEXT-END markers in llm-context.md")
        return 1

    # Find Archive table in llm-reference.md
    arch_start, arch_end = find_table_boundaries(
        reference_lines,
        '<!-- ARCHIVE-START -->',
        '<!-- ARCHIVE-END -->'
    )

    if arch_start is None or arch_end is None:
        print("ERROR: Could not find ARCHIVE-START/ARCHIVE-END markers in llm-reference.md")
        return 1

    # Parse current Working Context entries
    context_rows = parse_table_rows(context_lines, ctx_start, ctx_end)

    if len(context_rows) <= 3:
        print(f"[OK] Working Context has {len(context_rows)} entries (<=3). No archiving needed.")
        return 0

    # Determine how many to move
    num_to_move = len(context_rows) - 3
    rows_to_archive = context_rows[:num_to_move]
    rows_to_keep = context_rows[num_to_move:]

    print(f"[ARCHIVING] Moving {num_to_move} old entries (keeping last 3 in Working Context)")

    # Rebuild Working Context table
    new_context_table = [
        "<!-- CONTEXT-START -->\n",
        "| Step | What happened |\n",
        "|------|---------------|\n"
    ]
    for step, desc in rows_to_keep:
        new_context_table.append(format_table_row(step, desc) + "\n")
    new_context_table.append("<!-- CONTEXT-END -->\n")

    # Update llm-context.md
    new_context_lines = (
        context_lines[:ctx_start] +
        new_context_table +
        context_lines[ctx_end + 1:]
    )

    # Find insertion point in archive (before ARCHIVE-END marker)
    archive_insertion_idx = arch_end

    # Build new archive entries
    new_archive_entries = []
    for step, desc in rows_to_archive:
        new_archive_entries.append(format_table_row(step, desc) + "\n")
        print(f"  -> Step {step}")

    # Update llm-reference.md (insert before ARCHIVE-END)
    new_reference_lines = (
        reference_lines[:archive_insertion_idx] +
        new_archive_entries +
        reference_lines[archive_insertion_idx:]
    )

    # Write files atomically (write to temp, then rename)
    context_temp = context_file.with_suffix('.md.tmp')
    reference_temp = reference_file.with_suffix('.md.tmp')

    with open(context_temp, 'w', encoding='utf-8') as f:
        f.writelines(new_context_lines)

    with open(reference_temp, 'w', encoding='utf-8') as f:
        f.writelines(new_reference_lines)

    # Atomic rename
    context_temp.replace(context_file)
    reference_temp.replace(reference_file)

    print(f"[SUCCESS] Archived {num_to_move} entries")
    return 0


if __name__ == '__main__':
    exit(main())
