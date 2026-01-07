#!/usr/bin/env python3
"""
Update the "In Progress" section in llm-context.md

Usage:
    # Start working on a step
    python llm-tools/update_in_progress.py start \
        --working-on "Fix progress bar display" \
        --files "app.js, index.html"

    # Clear when done
    python llm-tools/update_in_progress.py clear
"""

import argparse
from pathlib import Path


def find_section(lines, start_marker, end_marker):
    """Find start and end line indices for a marked section."""
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
        elif end_marker in line:
            end_idx = i
            break

    return start_idx, end_idx


def main():
    parser = argparse.ArgumentParser(description='Update In Progress section')
    parser.add_argument('action', choices=['start', 'clear'], help='Action to perform')
    parser.add_argument('--working-on', help='Description of work being done')
    parser.add_argument('--files', help='Comma-separated list of files being touched')

    args = parser.parse_args()

    # Validate arguments
    if args.action == 'start' and not args.working_on:
        print("ERROR: --working-on is required when starting work")
        return 1

    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    context_file = project_root / "llm-context.md"

    # Read file
    with open(context_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find In Progress section
    start_idx, end_idx = find_section(lines, '<!-- IN-PROGRESS-START -->', '<!-- IN-PROGRESS-END -->')

    if start_idx is None or end_idx is None:
        print("ERROR: Could not find IN-PROGRESS-START/IN-PROGRESS-END markers")
        return 1

    # Build new section
    if args.action == 'start':
        status = 'In progress'
        working_on = args.working_on
        files = args.files if args.files else '-'
        print(f"[STARTED] Working on: {working_on}")
    else:  # clear
        status = 'Not started'
        working_on = '-'
        files = '-'
        print("[CLEARED] In Progress section reset")

    new_section = [
        "<!-- IN-PROGRESS-START -->\n",
        f"**Status:** {status}\n",
        f"**Working on:** {working_on}\n",
        f"**Files touched:** {files}\n",
        "<!-- IN-PROGRESS-END -->\n"
    ]

    # Update lines
    new_lines = (
        lines[:start_idx] +
        new_section +
        lines[end_idx + 1:]
    )

    # Write atomically
    temp_file = context_file.with_suffix('.md.tmp')
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    temp_file.replace(context_file)
    print("[SUCCESS] Updated llm-context.md")
    return 0


if __name__ == '__main__':
    exit(main())
