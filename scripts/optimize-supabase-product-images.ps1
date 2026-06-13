param(
  [int]$MaxSize = 1400,
  [long]$MinBytes = 300KB,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)
  $values = @{}
  if (!(Test-Path $Path)) { return $values }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (!$line -or $line.StartsWith("#") -or !$line.Contains("=")) { return }
    $key, $value = $line.Split("=", 2)
    $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
  }
  return $values
}

function Invoke-SupabaseStorage {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    $Body = $null,
    [string]$ContentType = "application/json"
  )
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
  }
  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body $Body -ContentType $ContentType
}

function Get-StorageObjects {
  param(
    [string]$BaseUrl,
    [hashtable]$Headers,
    [string]$Bucket,
    [string]$Prefix = ""
  )
  $listUrl = "$BaseUrl/storage/v1/object/list/$Bucket"
  $body = @{
    prefix = $Prefix
    limit = 1000
    offset = 0
    sortBy = @{ column = "name"; order = "asc" }
  } | ConvertTo-Json -Depth 4
  $items = Invoke-SupabaseStorage -Method "POST" -Url $listUrl -Headers $Headers -Body $body
  foreach ($item in $items) {
    $path = if ($Prefix) { "$Prefix/$($item.name)" } else { $item.name }
    if ($null -eq $item.metadata) {
      Get-StorageObjects -BaseUrl $BaseUrl -Headers $Headers -Bucket $Bucket -Prefix $path
    } else {
      $size = 0
      if ($null -ne $item.metadata.size) { $size = [long]$item.metadata.size }
      $mimeType = ""
      if ($null -ne $item.metadata.mimetype) { $mimeType = [string]$item.metadata.mimetype }
      [pscustomobject]@{
        Path = $path
        Size = $size
        MimeType = $mimeType
      }
    }
  }
}

function Resize-Image {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [string]$Extension,
    [int]$MaxSize
  )
  Add-Type -AssemblyName System.Drawing
  $src = [System.Drawing.Image]::FromFile($InputPath)
  try {
    $scale = [Math]::Min(1, $MaxSize / [Math]::Max($src.Width, $src.Height))
    $width = [Math]::Max(1, [int][Math]::Round($src.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($src.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    try {
      $bmp.SetResolution(96, 96)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($src, 0, 0, $width, $height)
      } finally {
        $g.Dispose()
      }

      if ($Extension -match "jpe?g") {
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object { $_.MimeType -eq "image/jpeg" }
        $params = New-Object System.Drawing.Imaging.EncoderParameters 1
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
          [System.Drawing.Imaging.Encoder]::Quality,
          [int64]82
        )
        $bmp.Save($OutputPath, $codec, $params)
      } else {
        $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally {
      $bmp.Dispose()
    }
  } finally {
    $src.Dispose()
  }
}

$envValues = Read-DotEnv ".env"
$supabaseUrl = $env:SUPABASE_URL
if (!$supabaseUrl) { $supabaseUrl = $envValues["SUPABASE_URL"] }
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
if (!$serviceKey) { $serviceKey = $envValues["SUPABASE_SERVICE_ROLE_KEY"] }

if (!$supabaseUrl -or !$serviceKey) {
  throw "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno o .env."
}

$bucket = "product-images"
$headers = @{
  apikey = $serviceKey
  Authorization = "Bearer $serviceKey"
}
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "hotspot-product-images"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$objects = @(Get-StorageObjects -BaseUrl $supabaseUrl -Headers $headers -Bucket $bucket)
$candidates = $objects | Where-Object {
  $_.Path -match "\.(jpe?g|png)$" -and $_.Size -ge $MinBytes
}

Write-Host "Imagenes encontradas: $($objects.Count). Candidatas: $($candidates.Count)."

foreach ($object in $candidates) {
  $encodedPath = ($object.Path -split "/" | ForEach-Object { [uri]::EscapeDataString($_) }) -join "/"
  $downloadUrl = "$supabaseUrl/storage/v1/object/$bucket/$encodedPath"
  $extension = [System.IO.Path]::GetExtension($object.Path).TrimStart(".").ToLowerInvariant()
  $inputPath = Join-Path $tempRoot ([Guid]::NewGuid().ToString() + ".$extension")
  $outputPath = Join-Path $tempRoot ([Guid]::NewGuid().ToString() + ".$extension")

  Invoke-WebRequest -Uri $downloadUrl -Headers $headers -OutFile $inputPath | Out-Null
  Resize-Image -InputPath $inputPath -OutputPath $outputPath -Extension $extension -MaxSize $MaxSize
  $newSize = (Get-Item $outputPath).Length

  if ($newSize -ge $object.Size) {
    Write-Host "Skip $($object.Path): $($object.Size) -> $newSize"
    Remove-Item -LiteralPath $inputPath, $outputPath -Force
    continue
  }

  $saved = [Math]::Round(100 - (($newSize / $object.Size) * 100), 1)
  Write-Host "$($object.Path): $($object.Size) -> $newSize (-$saved%)"
  if (!$DryRun) {
    $uploadUrl = "$supabaseUrl/storage/v1/object/$bucket/$encodedPath"
    $contentType = if ($extension -match "jpe?g") { "image/jpeg" } else { "image/png" }
    Invoke-WebRequest `
      -Method "POST" `
      -Uri $uploadUrl `
      -Headers ($headers + @{ "x-upsert" = "true" }) `
      -ContentType $contentType `
      -InFile $outputPath | Out-Null
  }

  Remove-Item -LiteralPath $inputPath, $outputPath -Force
}

Write-Host "Listo."
