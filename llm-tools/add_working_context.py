#!/usr/bin/env python3
"""
Add a new entry to Working Context in llm-context.md

Usage:
    python llm-tools/add_working_context.py --step 19 \
        --description "Fixed progress bar display to show bytes correctly"

Note: After adding, if there are 4+ entries, run archive_working_context.py
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
    parser = argparse.ArgumentParser(description='Add Working Context entry')
    parser.add_argument('--step', required=True, help='Step number')
    parser.add_argument('--description', required=True, help='Description of what was done')

    args = parser.parse_args()

    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    context_file = project_root / "llm-context.md"

    # Read file
    with open(context_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find Working Context section
    start_idx, end_idx = find_section(lines, '<!-- CONTEXT-START -->', '<!-- CONTEXT-END -->')

    if start_idx is None or end_idx is None:
        print("ERROR: Could not find CONTEXT-START/CONTEXT-END markers")
        return 1

    # Build new row
    new_row = f"| {args.step} | {args.description} |\n"

    # Insert before CONTEXT-END marker
    new_lines = (
        lines[:end_idx] +
        [new_row] +
        lines[end_idx:]
    )

    # Write atomically
    temp_file = context_file.with_suffix('.md.tmp')
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    temp_file.replace(context_file)
    print(f"[SUCCESS] Added step {args.step} to Working Context")

    # Count entries to warn if archiving is needed
    entry_count = sum(1 for line in new_lines[start_idx:end_idx+1]
                     if line.strip().startswith('|') and not line.strip().startswith('| Step |')
                     and not line.strip().startswith('|---'))

    if entry_count >= 4:
        print(f"[WARNING] Working Context now has {entry_count} entries. Run: python llm-tools/archive_working_context.py")

    return 0


if __name__ == '__main__':
    exit(main())
