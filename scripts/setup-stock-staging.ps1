$ErrorActionPreference = "Stop"

$projectId = (Select-String -Path "supabase/config.toml" -Pattern '^project_id\s*=\s*"(.+)"$').Matches.Groups[1].Value
if (-not $projectId) { throw "No se pudo identificar el proyecto local de Supabase." }

Write-Host "1/5 Reconstruyendo la base local hasta la migracion anterior..."
npx supabase db reset --local --version 20260801130000 --no-seed
if ($LASTEXITCODE -ne 0) { throw "Fallo el reset local." }

$container = "supabase_db_$projectId"
Write-Host "2/5 Cargando 100 items ficticios previos a la migracion..."
Get-Content -Raw "supabase/tests/stock_before_manual_control.sql" |
  docker exec -i $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw "Fallo la carga del fixture." }

Write-Host "3/5 Aplicando la migracion nueva..."
npx supabase migration up --local
if ($LASTEXITCODE -ne 0) { throw "Fallo la migracion nueva." }

Write-Host "4/5 Cargando datos ficticios posteriores..."
Get-Content -Raw "supabase/seed.sql" |
  docker exec -i $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw "Fallo el seed." }

Write-Host "5/5 Validando preservacion y estructura..."
$status = npx supabase status -o json | ConvertFrom-Json
$env:STAGING_SUPABASE_URL = $status.API_URL
$env:STAGING_SUPABASE_SERVICE_ROLE_KEY = $status.SERVICE_ROLE_KEY
node scripts/sync-staging-env.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallo la sincronizacion del entorno local." }
node scripts/seed-stock-users.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallo la creacion de usuarios locales." }
node scripts/test-stock-staging.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallaron las validaciones." }
