$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$package = Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$expected = New-Object System.Drawing.Icon((Join-Path $PSScriptRoot 'icon.ico'), 32, 32)
$expectedImage = $expected.ToBitmap()
try {
  foreach ($filename in @("dist/Keha-Family-Setup-$($package.version).exe", 'dist/win-unpacked/KehaFamily.exe')) {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $PSScriptRoot $filename))
    if ($null -eq $icon) { throw "Missing family icon: $filename" }
    $raw = $icon.ToBitmap()
    $bitmap = New-Object System.Drawing.Bitmap($raw, 32, 32)
    try {
      $difference = 0.0
      for ($y = 0; $y -lt 32; $y++) {
        for ($x = 0; $x -lt 32; $x++) {
          $actual = $bitmap.GetPixel($x, $y)
          $wanted = $expectedImage.GetPixel($x, $y)
          $difference += [Math]::Abs([int]$actual.R - [int]$wanted.R) + [Math]::Abs([int]$actual.G - [int]$wanted.G) + [Math]::Abs([int]$actual.B - [int]$wanted.B)
        }
      }
      if (($difference / (32 * 32 * 3)) -gt 30) { throw "The executable does not display the family logo: $filename" }
      Write-Host "Verified the family logo: $filename"
    } finally { $bitmap.Dispose(); $raw.Dispose(); $icon.Dispose() }
  }
} finally { $expectedImage.Dispose(); $expected.Dispose() }
