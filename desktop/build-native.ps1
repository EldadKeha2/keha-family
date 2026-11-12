$ErrorActionPreference = 'Stop'
$output = Join-Path $PSScriptRoot 'dist/native'
if (Test-Path $output) { Remove-Item $output -Recurse -Force }
dotnet build (Join-Path $PSScriptRoot 'native/KehaFamily.csproj') --configuration Release --output $output --nologo
if ($LASTEXITCODE -ne 0) { throw 'The native Windows app could not be built.' }
$loader = Join-Path $output 'WebView2Loader.dll'
if (!(Test-Path $loader)) {
  $x64 = Get-ChildItem $output -Filter WebView2Loader.dll -Recurse | Where-Object { $_.FullName -match '(win-x64|\\x64\\)' } | Select-Object -First 1
  if (!$x64) { throw 'The x64 WebView2 loader is missing.' }
  Copy-Item $x64.FullName $loader
}
foreach ($folder in @('runtimes', 'x86', 'x64', 'arm64')) { $path = Join-Path $output $folder; if (Test-Path $path) { Remove-Item $path -Recurse -Force } }
Get-ChildItem $output -Filter '*.xml' | Remove-Item
Get-ChildItem $output -Filter '*.pdb' | Remove-Item
$wpf = Join-Path $output 'Microsoft.Web.WebView2.Wpf.dll'; if (Test-Path $wpf) { Remove-Item $wpf }
$bootstrapper = Join-Path $output 'MicrosoftEdgeWebview2Setup.exe'
Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
$signature = Get-AuthenticodeSignature $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'The WebView2 bootstrapper is not signed by Microsoft.' }
& (Join-Path $PSScriptRoot 'installer-branding.ps1')
$size = (Get-ChildItem $output -File | Measure-Object Length -Sum).Sum
if ($size -gt 15MB) { throw 'The native payload unexpectedly includes heavy runtime files.' }
Write-Host "Native Windows payload: $size bytes"
