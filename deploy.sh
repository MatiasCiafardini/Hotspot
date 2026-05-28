#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/hotspot}"
APP_NAME="${APP_NAME:-hotspot}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-3003}"
APP_REPO="${APP_REPO:-https://github.com/MatiasCiafardini/Hotspot.git}"
APP_BRANCH="${APP_BRANCH:-main}"
RUN_GIT_PULL="${RUN_GIT_PULL:-1}"
RUN_SUPABASE_PUSH="${RUN_SUPABASE_PUSH:-1}"
RUN_PRISMA_MIGRATE="${RUN_PRISMA_MIGRATE:-1}"
ALLOW_DIRTY_DEPLOY="${ALLOW_DIRTY_DEPLOY:-0}"

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

prepare_app_dir() {
  if [ -d "$APP_DIR/.git" ]; then
    return
  fi

  [ "$RUN_GIT_PULL" = "1" ] || return

  require_command git

  log "Clonando $APP_REPO#$APP_BRANCH en $APP_DIR."
  mkdir -p "$(dirname "$APP_DIR")"
  local env_backup=""
  local backup_dir=""
  if [ -f "$APP_DIR/.env" ]; then
    env_backup="$(mktemp)"
    cp "$APP_DIR/.env" "$env_backup"
  fi

  if [ -d "$APP_DIR" ]; then
    backup_dir="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    log "$APP_DIR existe sin .git; moviendo backup a $backup_dir."
    mv "$APP_DIR" "$backup_dir"
  fi

  if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
  fi

  git clone --branch "$APP_BRANCH" --single-branch "$APP_REPO" "$APP_DIR"

  if [ -n "$env_backup" ]; then
    cp "$env_backup" "$APP_DIR/.env"
    rm -f "$env_backup"
  fi
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

ensure_preview_server() {
  if [ -f "scripts/ensure-preview-server.mjs" ]; then
    node scripts/ensure-preview-server.mjs
  else
    mkdir -p dist/server
    printf "export { default } from './index.js'\n" > dist/server/server.js
  fi

  [ -f "dist/server/server.js" ] || fail "No se pudo crear dist/server/server.js."
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

update_repo() {
  [ "$RUN_GIT_PULL" = "1" ] || {
    log "Saltando GitHub por RUN_GIT_PULL=0."
    return
  }

  require_command git
  [ -d ".git" ] || fail "$APP_DIR no es un repo git. No puedo actualizar desde GitHub."

  local dirty
  dirty="$(git status --porcelain)"
  if [ -n "$dirty" ] && [ "$ALLOW_DIRTY_DEPLOY" != "1" ]; then
    printf "%s\n" "$dirty" >&2
    fail "El repo tiene cambios locales. Commit/stash o usa ALLOW_DIRTY_DEPLOY=1 si querés pisarlos."
  fi

  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "$APP_REPO"
  fi

  log "Actualizando $APP_BRANCH desde GitHub."
  git fetch --prune origin "$APP_BRANCH"
  git checkout -B "$APP_BRANCH" "origin/$APP_BRANCH"
  git reset --hard "origin/$APP_BRANCH"
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
  prepare_app_dir
  cd "$APP_DIR" || fail "No pude entrar a $APP_DIR."

  load_nvm
  require_command node
  require_command npm
  require_command curl

  log "Node: $(node -v)"
  log "NPM: $(npm -v)"

  update_repo
  check_env_file

  if [ -f "dist/server/index.js" ]; then
    log "Reparando wrapper preview existente antes del deploy."
    ensure_preview_server
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

  log "Verificando wrapper dist/server/server.js para preview."
  ensure_preview_server

  restart_pm2
  healthcheck

  log "Deploy listo."
}

main "$@"
