#!/bin/bash
# Helper script to add new Heroicons to the project
#
# Usage: ./add-icon.sh icon-name
# Example: ./add-icon.sh arrow-right

if [ -z "$1" ]; then
    echo "Usage: ./add-icon.sh <icon-name>"
    echo "Example: ./add-icon.sh arrow-right"
    echo ""
    echo "Available icons can be found at:"
    echo "  - https://heroicons.com"
    echo "  - node_modules/heroicons/24/outline/"
    exit 1
fi

ICON_NAME="$1"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SOURCE_FILE="$PROJECT_ROOT/node_modules/heroicons/24/outline/${ICON_NAME}.svg"
DEST_FILE="$PROJECT_ROOT/server/static/images/icons/${ICON_NAME}.svg"

# Check if heroicons is installed
if [ ! -d "$PROJECT_ROOT/node_modules/heroicons" ]; then
    echo "Installing heroicons..."
    cd "$PROJECT_ROOT" && npm install
fi

# Check if the icon exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: Icon '${ICON_NAME}' not found in node_modules/heroicons/24/outline/"
    echo ""
    echo "Available icons:"
    ls "$PROJECT_ROOT/node_modules/heroicons/24/outline/" | head -20
    echo "... (and more)"
    exit 1
fi

# Copy the icon
cp "$SOURCE_FILE" "$DEST_FILE"
echo "✓ Copied ${ICON_NAME}.svg to server/static/images/icons/"
echo ""
echo "To use it in your HTML:"
echo "  <span class=\"icon-placeholder\" data-icon=\"${ICON_NAME}\" data-class=\"icon\"></span>"
echo ""
echo "To use it in JavaScript:"
echo "  icon('${ICON_NAME}', 'icon')"
