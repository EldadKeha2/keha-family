$ErrorActionPreference = 'Stop'
$folder = Join-Path $env:RUNNER_TEMP ('keha-native-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $folder | Out-Null
$runtime = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
$userRuntime = Get-ItemProperty 'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if (!$runtime.pv -and !$userRuntime.pv) {
  $setup = Start-Process (Join-Path $PSScriptRoot 'dist/native/MicrosoftEdgeWebview2Setup.exe') -ArgumentList '/silent', '/install' -Wait -PassThru
  if ($setup.ExitCode -ne 0) { throw 'Microsoft WebView2 could not be prepared on the test runner.' }
}
$exe = Join-Path $PSScriptRoot 'dist/native/KehaFamily.exe'
$watch = [Diagnostics.Stopwatch]::StartNew()
$process = Start-Process $exe -ArgumentList '--smoke-test', ('"' + $folder + '"') -PassThru
if (!$process.WaitForExit(60000)) { $process.Kill(); throw 'The native window check timed out.' }
if ($process.ExitCode -ne 0) { if (Test-Path (Join-Path $folder 'failure.txt')) { Get-Content (Join-Path $folder 'failure.txt') }; throw 'The native Windows checks failed.' }
Get-Content (Join-Path $folder 'result.json')
Write-Host "Native Windows verification completed in $($watch.ElapsedMilliseconds) ms."
