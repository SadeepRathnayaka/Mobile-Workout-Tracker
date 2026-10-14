# Generates the PNG app icons in .\icons (run once on Windows before pushing):
#   powershell -ExecutionPolicy Bypass -File .\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(15, 17, 21))
  $blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(79, 140, 255))
  $s = $size / 100.0
  # Same shapes as icons/icon.svg: x, y, width, height on a 100x100 grid.
  $rects = @(
    @(22, 46, 56, 8),
    @(24, 28, 10, 44),
    @(66, 28, 10, 44),
    @(14, 36, 8, 28),
    @(78, 36, 8, 28)
  )
  foreach ($r in $rects) {
    $g.FillRectangle($blue, [single]($r[0] * $s), [single]($r[1] * $s), [single]($r[2] * $s), [single]($r[3] * $s))
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $blue.Dispose(); $g.Dispose(); $bmp.Dispose()
}

New-Icon 180 (Join-Path $dir "apple-touch-icon.png")
New-Icon 192 (Join-Path $dir "icon-192.png")
New-Icon 512 (Join-Path $dir "icon-512.png")
Write-Host "Icons written to $dir"
