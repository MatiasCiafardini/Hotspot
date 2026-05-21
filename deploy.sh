#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/hotspot}"
APP_NAME="${APP_NAME:-hotspot}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-3003}"
RUN_GIT_PULL="${RUN_GIT_PULL:-0}"
RUN_SUPABASE_PUSH="${RUN_SUPABASE_PUSH:-0}"
RUN_PRISMA_MIGRATE="${RUN_PRISMA_MIGRATE:-1}"

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf "\n[deploy:error] %s\n" "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta instalar '$1'."
}

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    if nvm ls 22 >/dev/null 2>&1; then
      nvm use 22 >/dev/null
    elif nvm current >/dev/null 2>&1; then
      nvm use default >/dev/null || true
    fi
  fi
}

check_env_file() {
  [ -f ".env" ] || fail "No existe .env en $APP_DIR."

  local missing=0
  for key in \
    SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY \
    GOOGLE_CLIENT_ID \
    VITE_GOOGLE_CLIENT_ID \
    CUSTOMER_SESSION_SECRET \
    SUPABASE_SERVICE_ROLE_KEY; do
    if ! grep -qE "^${key}=" .env; then
      printf "[deploy:warn] Falta %s en .env\n" "$key" >&2
      missing=1
    fi
  done

  if [ "$missing" -eq 1 ]; then
    fail "Completá las variables faltantes en .env antes de deployar."
  fi
}

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx --yes supabase "$@"
  fi
}

push_supabase_migrations() {
  [ "$RUN_SUPABASE_PUSH" = "1" ] || {
    log "Saltando Supabase por RUN_SUPABASE_PUSH=0."
    return
  }

  [ -d "supabase/migrations" ] || {
    log "No hay supabase/migrations; nada para aplicar."
    return
  }

  log "Aplicando migraciones Supabase."

  if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
    run_supabase link --project-ref "$SUPABASE_PROJECT_REF"
  fi

  if [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
    run_supabase db push --password "$SUPABASE_DB_PASSWORD"
  else
    run_supabase db push
  fi
}

run_prisma_migrations() {
  [ "$RUN_PRISMA_MIGRATE" = "1" ] || {
    log "Saltando Prisma por RUN_PRISMA_MIGRATE=0."
    return
  }

  if [ -f "prisma/schema.prisma" ] || [ -f "schema.prisma" ]; then
    log "Aplicando migraciones Prisma."
    npx prisma migrate deploy
  else
    log "No hay schema Prisma; nada para aplicar."
  fi
}

restart_pm2() {
  require_command pm2

  local npm_bin
  npm_bin="$(command -v npm)"

  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    log "Recreando proceso PM2: $APP_NAME."
    pm2 delete "$APP_NAME"
  else
    log "Creando proceso PM2: $APP_NAME."
  fi

  pm2 start "$npm_bin" \
    --name "$APP_NAME" \
    --cwd "$APP_DIR" \
    -- run preview -- --host "$APP_HOST" --port "$APP_PORT"

  pm2 save
}

healthcheck() {
  log "Verificando http://$APP_HOST:$APP_PORT."
  local attempt
  for attempt in {1..30}; do
    if curl -fsSI "http://$APP_HOST:$APP_PORT" >/dev/null; then
      return 0
    fi
    sleep 1
  done

  fail "La app no respondio en http://$APP_HOST:$APP_PORT despues de 30 segundos."
}

main() {
  cd "$APP_DIR" || fail "No pude entrar a $APP_DIR."

  load_nvm
  require_command node
  require_command npm
  require_command curl

  log "Node: $(node -v)"
  log "NPM: $(npm -v)"

  check_env_file

  if [ "$RUN_GIT_PULL" = "1" ] && [ -d ".git" ]; then
    require_command git
    log "Actualizando repo con git pull --ff-only."
    git pull --ff-only
  fi

  log "Instalando dependencias."
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi

  push_supabase_migrations
  run_prisma_migrations

  log "Compilando app."
  npm run build

  log "Creando wrapper dist/server/server.js para preview."
  mkdir -p dist/server
  cat > dist/server/server.js <<'EOF'
export { default } from './index.js'
EOF

  restart_pm2
  healthcheck

  log "Deploy listo."
}

main "$@"
