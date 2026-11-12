[CmdletBinding()]
param(
  [string]$IdentityName,
  [string]$Publisher,
  [string]$PublisherDisplayName,
  [switch]$Preview,
  [switch]$SkipNativeBuild
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$config = Get-Content (Join-Path $PSScriptRoot 'store-config.json') -Raw | ConvertFrom-Json
if (!$IdentityName) { $IdentityName = $config.identityName }
if (!$Publisher) { $Publisher = $config.publisher }
if (!$PublisherDisplayName) { $PublisherDisplayName = $config.publisherDisplayName }
if ($Preview) {
  $IdentityName = 'EldadKeha.KehaFamily.Preview'
  $Publisher = 'CN=KehaFamily Build Verification'
}
if (!$IdentityName -or !$Publisher -or !$PublisherDisplayName) {
  throw 'Store identity is missing. Copy Package/Identity/Name, Package/Identity/Publisher and Package/Properties/PublisherDisplayName from Partner Center > Product management > Product identity. Use -Preview only for build verification.'
}
if (!$Preview -and ($IdentityName -match '(Preview|PLACEHOLDER|Contoso)' -or $Publisher -match '(Build Verification|PLACEHOLDER|Contoso)')) { throw 'A preview identity cannot be submitted to the Store.' }
if ($IdentityName -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$' -or $Publisher -notmatch '^CN=') { throw 'The package name or publisher distinguished name is invalid.' }
if ($config.distribution.price -ne 'Free' -or $config.distribution.discoverability -ne 'Make this product available but not discoverable in the Store' -or $config.distribution.acquisition -ne 'Direct link only') { throw 'This project requires a free, unlisted, direct-link Store submission.' }
$version = [version]((Get-Content (Join-Path $root 'desktop/package.json') -Raw | ConvertFrom-Json).version)
$storeVersion = "$($version.Major).$($version.Minor).$($version.Build).0"
if ($version.Major -lt 1 -or @($version.Major, $version.Minor, $version.Build | Where-Object { $_ -gt 65535 -or $_ -lt 0 }).Count) { throw 'Store package version must be Major.Minor.Build.0 with a positive major version.' }
if (!$SkipNativeBuild) { & (Join-Path $root 'desktop/build-native.ps1') }
$native = Join-Path $root 'desktop/dist/native'
if (!(Test-Path (Join-Path $native 'KehaFamily.exe'))) { throw 'Build the native Windows app first.' }
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$makeAppx = Get-ChildItem $sdk -Filter makeappx.exe -Recurse | Where-Object { $_.Directory.Name -eq 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1
if (!$makeAppx) { throw 'Install the Windows SDK with MakeAppx.exe.' }
$output = Join-Path $root 'desktop/dist/store'
$stage = Join-Path $output 'staging'
if (Test-Path $output) { Remove-Item $output -Recurse -Force }
New-Item -ItemType Directory (Join-Path $stage 'Assets') -Force | Out-Null
Get-ChildItem $native -File | Where-Object { $_.Name -eq 'KehaFamily.exe' -or $_.Name -eq 'MicrosoftEdgeWebview2Setup.exe' -or $_.Extension -eq '.dll' -or $_.Extension -eq '.config' } | Copy-Item -Destination $stage
Add-Type -AssemblyName System.Drawing
$logo = [Drawing.Image]::FromFile((Join-Path $root 'desktop/icon.png'))
try {
  foreach ($asset in @(@('StoreLogo',50,50), @('Square44x44Logo',44,44), @('Square150x150Logo',150,150), @('Square310x310Logo',310,310), @('Wide310x150Logo',310,150))) {
    $image = [Drawing.Bitmap]::new($asset[1], $asset[2])
    $graphics = [Drawing.Graphics]::FromImage($image)
    try {
      $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#F7F3E9'))
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $size = [int]([Math]::Min($asset[1], $asset[2]) * 0.86)
      $graphics.DrawImage($logo, [int](($asset[1]-$size)/2), [int](($asset[2]-$size)/2), $size, $size)
      $image.Save((Join-Path $stage "Assets/$($asset[0]).png"), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $image.Dispose() }
  }
} finally { $logo.Dispose() }
$manifest = Get-Content (Join-Path $PSScriptRoot 'AppxManifest.xml') -Raw
$values = @{ IDENTITY_NAME=$IdentityName; PUBLISHER=$Publisher; VERSION=$storeVersion; DISPLAY_NAME=$config.displayName; PUBLISHER_DISPLAY_NAME=$PublisherDisplayName; MINIMUM_WINDOWS_VERSION=$config.minimumWindowsVersion }
foreach ($key in $values.Keys) { $manifest = $manifest.Replace("__$($key)__", [Security.SecurityElement]::Escape($values[$key])) }
[xml]$manifest | Out-Null
[IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, [Text.UTF8Encoding]::new($false))
$suffix = if ($Preview) { '-preview' } else { '' }
$package = Join-Path $output "Keha-Family-$storeVersion-x64$suffix.msix"
& $makeAppx.FullName pack /o /h SHA256 /d $stage /p $package
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation or packaging failed.' }
$size = (Get-Item $package).Length
if ($size -gt 15MB) { throw 'The Store package exceeds the lightweight budget.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$upload = [IO.Path]::ChangeExtension($package, '.msixupload')
$zip = [IO.Compression.ZipFile]::Open($upload, [IO.Compression.ZipArchiveMode]::Create)
try { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $package, [IO.Path]::GetFileName($package), [IO.Compression.CompressionLevel]::NoCompression) | Out-Null } finally { $zip.Dispose() }
$metadata = [ordered]@{ identityName=$IdentityName; publisher=$Publisher; publisherDisplayName=$PublisherDisplayName; version=$storeVersion; architecture='x64'; preview=[bool]$Preview; signed=$false; bytes=$size; package=[IO.Path]::GetFileName($package); upload=[IO.Path]::GetFileName($upload); distribution=$config.distribution; note='For Microsoft Store submission. The Store signs the package after certification; this build is not a signed direct-download installer.' }
$metadata | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $output 'package-info.json') -Encoding utf8
$metadata | ConvertTo-Json -Depth 5
