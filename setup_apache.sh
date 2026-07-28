#!/bin/bash
# Apache .htaccess Auto-Config for Realtime Quiz
# Run this in your public_html folder

DEST="/home/platform/public_html/.htaccess"
BACKEND_PORT=5001

echo "Creating .htaccess in $DEST..."

cat > "$DEST" <<EOF
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Proxy /api to Node.js backend
    RewriteRule ^api/(.*) http://localhost:$BACKEND_PORT/api/\$1 [P,L]
    
    # Proxy /socket.io to Node.js backend
    RewriteRule ^socket.io/(.*) http://localhost:$BACKEND_PORT/socket.io/\$1 [P,L]
    
    # SPA routing - redirect all other non-file requests to index.html
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>
EOF

echo "✅ .htaccess created successfully!"
echo "Note: Ensure 'mod_proxy' and 'mod_rewrite' are enabled in your Apache configuration."
