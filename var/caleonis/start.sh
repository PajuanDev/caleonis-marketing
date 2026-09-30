#!/usr/bin/env bash
set -euo pipefail
cd /app
for name in DATABASE_URL REDIS_URL JWT_SECRET TEMPORAL_ADDRESS FRONTEND_URL NEXT_PUBLIC_BACKEND_URL; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Caléonis startup blocked: required variable %s is missing.\n' "$name" >&2
    exit 1
  fi
done
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo 'Caléonis startup blocked: JWT_SECRET must contain at least 32 random characters.' >&2
  exit 1
fi
if [[ "${STORAGE_PROVIDER:-local}" == 'local' ]]; then
  if ! mountpoint -q /uploads; then
    echo 'Caléonis startup blocked: attach a persistent Railway volume at /uploads before deploying.' >&2
    exit 1
  fi
  mkdir -p /uploads
  chmod 755 /uploads
fi
# Never auto-accept data loss, reset, or delete the upstream database.
pnpm exec prisma db push --skip-generate --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma
# Reviewed additive migration in the separate caleonis schema.
node /app/var/caleonis/workspace-schema.mjs
exec pm2-runtime start /app/var/caleonis/ecosystem.config.cjs
