param(
  [string]$RemoteUser = "mati",
  [string]$RemoteHost = "187.127.13.225",
  [string]$RemoteAppDir = "/var/www/hotspot",
  [string]$ArchiveName = "hotspot.tar.gz"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Cyan
}

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ArchivePath = Join-Path $ProjectDir $ArchiveName
$Remote = "${RemoteUser}@${RemoteHost}"

Set-Location $ProjectDir

Write-Step "Creando paquete $ArchiveName"
if (Test-Path $ArchivePath) {
  Remove-Item $ArchivePath -Force
}

tar `
  --exclude=node_modules `
  --exclude=.git `
  --exclude=.tanstack `
  --exclude=.wrangler `
  --exclude=dist `
  --exclude="$ArchiveName" `
  --exclude=source.zip `
  --exclude=src.zip `
  -czf $ArchivePath .

Write-Step "Subiendo paquete a $Remote"
scp $ArchivePath "${Remote}:~/hotspot.tar.gz"

$RemoteScript = @"
set -Eeuo pipefail

APP_DIR="$RemoteAppDir"
NEW_DIR="/var/www/hotspot_new"
BACKUP_DIR="/var/www/hotspot_backup_`$(date +%Y%m%d_%H%M%S)"

echo ""
echo "[remote] Preparando sudo"
sudo -v

echo "[remote] Descomprimiendo nuevo release"
cd /var/www
sudo rm -rf "`$NEW_DIR"
sudo mkdir -p "`$NEW_DIR"
sudo tar -xzf ~/hotspot.tar.gz -C "`$NEW_DIR"

if [ -f "`$APP_DIR/.env" ]; then
  sudo cp "`$APP_DIR/.env" "`$NEW_DIR/.env"
else
  echo "[remote:error] No existe `$APP_DIR/.env. Crealo antes de deployar." >&2
  exit 1
fi

echo "[remote] Reemplazando app actual"
if [ -d "`$APP_DIR" ]; then
  sudo mv "`$APP_DIR" "`$BACKUP_DIR"
fi
sudo mv "`$NEW_DIR" "`$APP_DIR"
sudo chown -R $RemoteUser:$RemoteUser "`$APP_DIR"
sudo chmod -R u+rwX "`$APP_DIR"

echo "[remote] Ejecutando deploy.sh"
cd "`$APP_DIR"
chmod +x deploy.sh
RUN_GIT_PULL=0 ./deploy.sh
"@

Write-Step "Ejecutando deploy remoto"
$RemoteScript | ssh -t $Remote "bash -s"

Write-Step "Deploy finalizado"
