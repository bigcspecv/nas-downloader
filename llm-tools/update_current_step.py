#!/usr/bin/env python3
"""
Update the Current Step number in llm-context.md

Usage:
    python llm-tools/update_current_step.py 19
    python llm-tools/update_current_step.py --increment  # Auto-increment by 1
"""

import argparse
import re
from pathlib import Path


def find_line(lines, marker):
    """Find line index containing marker."""
    for i, line in enumerate(lines):
        if marker in line:
            return i
    return None


def main():
    parser = argparse.ArgumentParser(description='Update Current Step number')
    parser.add_argument('step', nargs='?', type=int, help='New step number')
    parser.add_argument('--increment', action='store_true', help='Increment current step by 1')

    args = parser.parse_args()

    if not args.step and not args.increment:
        print("ERROR: Provide either a step number or --increment")
        return 1

    if args.step and args.increment:
        print("ERROR: Cannot use both step number and --increment")
        return 1

    # File paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    context_file = project_root / "llm-context.md"

    # Read file
    with open(context_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find Current Step line
    step_idx = find_line(lines, '<!-- CURRENT-STEP -->')

    if step_idx is None:
        print("ERROR: Could not find CURRENT-STEP marker")
        return 1

    # Parse current step number
    match = re.search(r'## Current Step: (\d+)', lines[step_idx])
    if not match:
        print("ERROR: Could not parse current step number")
        return 1

    current_step = int(match.group(1))

    # Calculate new step
    if args.increment:
        new_step = current_step + 1
    else:
        new_step = args.step

    # Update line
    new_line = f"## Current Step: {new_step} <!-- CURRENT-STEP -->\n"
    lines[step_idx] = new_line

    # Write atomically
    temp_file = context_file.with_suffix('.md.tmp')
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    temp_file.replace(context_file)
    print(f"[SUCCESS] Updated Current Step: {current_step} -> {new_step}")
    return 0


if __name__ == '__main__':
    exit(main())
