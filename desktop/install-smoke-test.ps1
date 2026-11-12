$ErrorActionPreference = 'Stop'
$package = Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$installer = Join-Path $PSScriptRoot "dist/Keha-Family-Setup-$($package.version).exe"
$folder = Join-Path $env:RUNNER_TEMP ('keha-install-' + [Guid]::NewGuid().ToString('N'))
$state = Join-Path $env:RUNNER_TEMP ('keha-installed-state-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $state | Out-Null
$watch = [Diagnostics.Stopwatch]::StartNew()
$setup = Start-Process $installer -ArgumentList '/S', "/D=$folder" -PassThru
if (!$setup.WaitForExit(90000)) { $setup.Kill(); throw 'The installation did not complete in time.' }
$installMs = $watch.ElapsedMilliseconds
if ($setup.ExitCode -ne 0) { throw "Installation failed: $($setup.ExitCode)" }
$exe = Join-Path $folder 'KehaFamily.exe'
if (!(Test-Path $exe) -or !(Test-Path (Join-Path $folder 'Microsoft.Web.WebView2.Core.dll'))) { throw 'The native app was not installed correctly.' }
if (Get-ChildItem $folder -Filter '*.pak' -Recurse) { throw 'The installer unexpectedly includes a browser runtime.' }
Get-Process -Name KehaFamily -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | ForEach-Object { $_.CloseMainWindow() | Out-Null;if (!$_.WaitForExit(5000)) { $_.Kill() } }
$app = Start-Process $exe -ArgumentList '--smoke-test', ('"' + $state + '"') -PassThru
if (!$app.WaitForExit(60000)) { $app.Kill(); throw 'The installed app did not complete verification.' }
if ($app.ExitCode -ne 0) { if (Test-Path (Join-Path $state 'failure.txt')) { Get-Content (Join-Path $state 'failure.txt') };throw 'The installed app failed verification.' }
$shell = New-Object -ComObject WScript.Shell
$desktopPaths = @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('CommonDesktopDirectory')) | Select-Object -Unique
$links = @($desktopPaths | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Filter '*.lnk' } | ForEach-Object { [PSCustomObject]@{ File = $_.FullName; Target = $shell.CreateShortcut($_.FullName).TargetPath } })
$shortcut = $links | Where-Object { $_.Target -eq $exe } | Select-Object -First 1
if (!$shortcut) { $links | ConvertTo-Json | Write-Host;Write-Host "Expected target: $exe";throw 'The desktop shortcut is missing or points to the old app.' }
$result = Get-Content (Join-Path $state 'result.json') -Raw | ConvertFrom-Json
$report = [ordered]@{ installerBytes = (Get-Item $installer).Length; installationMs = $installMs; windowShownMs = $result.shownMs; browserReadyMs = $result.browserReadyMs; installedAppVerified = $true; desktopShortcutVerified = $true }
$report | ConvertTo-Json | Set-Content (Join-Path $env:RUNNER_TEMP 'keha-install-result.json')
$report | ConvertTo-Json | Write-Host
