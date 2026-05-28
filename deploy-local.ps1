param(
  [string]$RemoteUser = "mati",
  [string]$RemoteHost = "187.127.13.225",
  [string]$RemoteAppDir = "/var/www/hotspot"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Cyan
}

$Remote = "${RemoteUser}@${RemoteHost}"

$RemoteScript = @"
set -Eeuo pipefail

APP_DIR="$RemoteAppDir"

echo ""
echo "[remote] Preparando sudo"
sudo -v
APP_PARENT="`$(dirname "`$APP_DIR")"
sudo mkdir -p "`$APP_PARENT"
sudo chown "`$(id -un):`$(id -gn)" "`$APP_PARENT"
if [ -d "`$APP_DIR" ]; then
  sudo chown -R "`$(id -un):`$(id -gn)" "`$APP_DIR"
fi

echo "[remote] Descargando deploy.sh actual desde GitHub"
TMP_DEPLOY="/tmp/hotspot-deploy.sh"
curl -fsSL "https://raw.githubusercontent.com/MatiasCiafardini/Hotspot/main/deploy.sh" -o "`$TMP_DEPLOY"
chmod +x "`$TMP_DEPLOY"
APP_DIR="`$APP_DIR" RUN_GIT_PULL=1 "`$TMP_DEPLOY"
"@

Write-Step "Ejecutando deploy remoto"
$RemoteScript | ssh -t $Remote "bash -s"

Write-Step "Deploy finalizado"
