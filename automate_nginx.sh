#!/bin/bash
# Nginx Auto-Config for Realtime Quiz
# Run this script as root on your VPS

DOMAIN="innvikta.co.in"
BACKEND_PORT=5001

# Search for the config file containing the domain
echo "Searching for Nginx config for $DOMAIN..."
NGINX_CONF=$(grep -r -l "server_name.*$DOMAIN" /usr/local/apps/nginx/etc/ /etc/nginx/ 2>/dev/null | head -n 1)

if [ -z "$NGINX_CONF" ]; then
    echo "Error: Could not find Nginx configuration for $DOMAIN"
    echo "Please specify the full path to your nginx config file as an argument."
    echo "Example: bash automate_nginx.sh /path/to/your/domain.conf"
    [ ! -z "$1" ] && NGINX_CONF=$1 || exit 1
fi

echo "Found Nginx config at $NGINX_CONF"

# Create the proxy configuration block
PROXY_BLOCK="
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
"

# Inject the block before the last closing brace of the server block
# This is a bit risky with sed, so we'll create a backup first
cp "$NGINX_CONF" "${NGINX_CONF}.bak"

# This sed command finds the last '}' and inserts the block before it
# Note: This assumes a standard server { ... } block structure
sed -i '$i '"$PROXY_BLOCK"'' "$NGINX_CONF"

echo "Configuration injected successfully into $NGINX_CONF"
echo "Restarting Nginx..."
service nginx restart || systemctl restart nginx

echo "All done! Check your site at http://$DOMAIN"
