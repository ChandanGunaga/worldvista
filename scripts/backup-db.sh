#!/usr/bin/env bash
# Daily PostgreSQL backup with 14-day retention.
# Usage: DATABASE_URL=postgresql://... ./scripts/backup-db.sh [backup_dir]
# Cron (VPS, 2am daily):
#   0 2 * * * cd /opt/worldvista && docker compose exec -T db pg_dump -U worldvista -Fc worldvista > backups/wv-$(date +\%F).dump && find backups -name 'wv-*.dump' -mtime +14 -delete
set -euo pipefail
DIR="${1:-./backups}"
: "${DATABASE_URL:?Set DATABASE_URL}"
mkdir -p "$DIR"
FILE="$DIR/worldvista-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
find "$DIR" -name 'worldvista-*.dump' -mtime +14 -delete
# Restore: pg_restore --clean --no-owner -d "$DATABASE_URL" "$FILE"
