<?php
/**
 * Nginx Configuration Helper for Realtime Quiz
 * Upload this to your public_html and access it via browser to get your Nginx config.
 */

$domain = $_SERVER['HTTP_HOST'] ?? 'innvikta.co.in';
$backend_port = 5001;

$nginx_config = <<<EOD
# Copy this block into your Webuzo Nginx Configuration for $domain

location /api/ {
    proxy_pass http://localhost:$backend_port/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
}

location /socket.io/ {
    proxy_pass http://localhost:$backend_port/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
}
EOD;

header('Content-Type: text/plain');
echo "--- Nginx Configuration Block for $domain ---\n\n";
echo $nginx_config;
echo "\n\n--- Instructions ---\n";
echo "1. Go to Webuzo -> Nginx -> Domain Configuration\n";
echo "2. Paste the block above into the configuration for $domain\n";
echo "3. Restart Nginx\n";
?>
