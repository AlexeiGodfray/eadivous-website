#!/usr/bin/env bash
set -euo pipefail

# Run once on the VPS as root (Ubuntu).
# Usage: bash vps-setup.sh

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y nginx rsync

mkdir -p /var/www/eadivous
chown -R www-data:www-data /var/www/eadivous

cat >/etc/nginx/sites-available/eadivous <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name 74.208.73.225 eadivous.tech www.eadivous.tech eadivous.com www.eadivous.com;

    root /var/www/eadivous;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location = /favicon.png {
        try_files $uri =404;
    }
}
EOF

ln -sf /etc/nginx/sites-available/eadivous /etc/nginx/sites-enabled/eadivous
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
fi

echo "Nginx is ready. Upload site files to /var/www/eadivous"
