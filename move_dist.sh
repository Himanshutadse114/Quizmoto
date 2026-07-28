#!/bin/bash
# Script to move built files from dist to public_html

# Detect current path
CURRENT_DIR=$(pwd)
SOURCE="$CURRENT_DIR/client/dist"
DEST="/home/platform/public_html"

if [ ! -d "$SOURCE" ]; then
    echo "Error: $SOURCE directory not found."
    echo "Make sure you ran 'npm install' and 'npm run build' in the client folder first."
    exit 1
fi

echo "Copying files from $SOURCE to $DEST..."
cp -r $SOURCE/* $DEST/

# Verify
if [ -f "$DEST/index.html" ]; then
    echo "✅ Frontend successfully moved to $DEST"
else
    echo "❌ Failed to move files. Please check permissions."
fi
