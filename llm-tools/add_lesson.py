#!/usr/bin/env python3
"""
Add a new Lesson Learned to llm-context.md

Usage:
    python llm-tools/add_lesson.py --step 19 \
        --lesson "Progress bars need explicit null checks for display formatting"
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
    parser = argparse.ArgumentParser(description='Add Lesson Learned')
    parser.add_argument('--step', required=True, help='Step number where lesson was learned')
    parser.add_argument('--lesson', required=True, help='The lesson learned')

    args = parser.parse_args()

    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    context_file = project_root / "llm-context.md"

    # Read file
    with open(context_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find Lessons Learned section
    start_idx, end_idx = find_section(lines, '<!-- LESSONS-START -->', '<!-- LESSONS-END -->')

    if start_idx is None or end_idx is None:
        print("ERROR: Could not find LESSONS-START/LESSONS-END markers")
        return 1

    # Build new lesson
    new_lesson = f"- Step {args.step}: {args.lesson}\n"

    # Insert before LESSONS-END marker
    new_lines = (
        lines[:end_idx] +
        [new_lesson] +
        lines[end_idx:]
    )

    # Write atomically
    temp_file = context_file.with_suffix('.md.tmp')
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    temp_file.replace(context_file)
    print(f"[SUCCESS] Added lesson for step {args.step}")
    return 0


if __name__ == '__main__':
    exit(main())
