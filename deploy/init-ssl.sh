#!/usr/bin/env bash
# ===========================================================================
# ORCA Maritime Platform — One-Click Let's Encrypt SSL Initializer
# Usage: sudo ./deploy/init-ssl.sh yourdomain.com admin@yourdomain.com
# ===========================================================================

set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: ./deploy/init-ssl.sh <domain_name> <email_address>"
    echo "Example: ./deploy/init-ssl.sh orca.example.com admin@example.com"
    exit 1
fi

echo "=========================================================="
echo "  Initializing Production SSL for: $DOMAIN ($EMAIL)"
echo "=========================================================="

mkdir -p ./deploy/certbot/www
mkdir -p ./deploy/certbot/conf

# 1. Update Nginx configuration with the actual domain name
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" ./deploy/nginx/nginx.conf

# 2. Create dummy certificates so Nginx can start the first time
echo "--> Creating temporary self-signed certificate for initial boot..."
CERT_DIR="./deploy/certbot/conf/live/$DOMAIN"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=localhost"
fi

# 3. Start the stack
echo "--> Starting ORCA stack with reverse proxy..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d reverse-proxy

# 4. Request real Let's Encrypt certificates
echo "--> Requesting official Let's Encrypt TLS Certificate..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN" certbot

# 5. Reload Nginx to pick up real certificates
echo "--> Reloading Nginx with official certificate..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec reverse-proxy nginx -s reload

echo "=========================================================="
echo "  SUCCESS! ORCA is live at https://$DOMAIN"
echo "=========================================================="
