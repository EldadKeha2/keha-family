$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$logo = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'icon.png'))
$folder = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force $folder | Out-Null
function Write-BrandBitmap($filename, $width, $height, $logoSize, $left, $top) {
  $image = New-Object System.Drawing.Bitmap($width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb))
  $graphics = [System.Drawing.Graphics]::FromImage($image)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(248, 244, 233))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($logo, $left, $top, $logoSize, $logoSize)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(193, 173, 120), 1)
    try {
      if ($height -gt 100) {
        $graphics.DrawLine($pen, 22, 175, ($width - 22), 175)
        $graphics.DrawLine($pen, 22, 288, ($width - 22), 288)
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(94, 112, 76))
        $font = New-Object System.Drawing.Font('Segoe UI', 12)
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        try {
          $graphics.DrawString("KEHA`nFAMILY", $font, $brush, ([System.Drawing.RectangleF]::new(5, 198, ($width - 10), 65)), $format)
        } finally { $format.Dispose(); $font.Dispose(); $brush.Dispose() }
      }
    } finally { $pen.Dispose() }
    $image.Save((Join-Path $folder $filename), [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally { $graphics.Dispose(); $image.Dispose() }
}
try {
  Write-BrandBitmap 'installerHeader.bmp' 150 57 52 92 2
  Write-BrandBitmap 'installerSidebar.bmp' 164 314 140 12 20
} finally { $logo.Dispose() }
Write-Host 'Prepared the family logo for the Windows installation screens.'
