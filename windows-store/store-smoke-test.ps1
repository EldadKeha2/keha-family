$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$output = Join-Path $root 'desktop/dist/store'
$info = Get-Content (Join-Path $output 'package-info.json') -Raw | ConvertFrom-Json
if (!$info.preview) { throw 'This isolated CI check only installs preview packages.' }
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$signTool = Get-ChildItem $sdk -Filter signtool.exe -Recurse | Where-Object { $_.Directory.Name -eq 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1
$work = Join-Path $env:RUNNER_TEMP ('keha-store-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null
$original = Join-Path $output $info.package
$signed = Join-Path $work 'ci-only.msix'
Copy-Item $original $signed
$unsignedHash = (Get-FileHash $original -Algorithm SHA256).Hash
$certificate = $null
$installed = $null
try {
  $certificate = New-SelfSignedCertificate -Type Custom -Subject $info.publisher -KeyUsage DigitalSignature -FriendlyName 'Disposable Keha Store CI verification' -CertStoreLocation Cert:\CurrentUser\My -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
  $publicCertificate = Join-Path $work 'ci-only.cer'
  Export-Certificate -Cert $certificate -FilePath $publicCertificate | Out-Null
  Import-Certificate -FilePath $publicCertificate -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
  & $signTool.FullName sign /fd SHA256 /sha1 $certificate.Thumbprint $signed
  if ($LASTEXITCODE -ne 0) { throw 'Could not sign the disposable CI package.' }
  & $signTool.FullName verify /pa $signed
  if ($LASTEXITCODE -ne 0) { throw 'The disposable CI package signature did not verify.' }
  Add-AppxPackage -Path $signed
  $installed = Get-AppxPackage -Name $info.identityName
  if (!$installed) { throw 'The MSIX did not install.' }
  $manifest = Get-AppxPackageManifest -Package $installed.PackageFullName
  if ($manifest.Package.Applications.Application.Id -ne 'Family') { throw 'The packaged app entry point is missing.' }
  # Invoke the same package activation API the Start menu uses, with isolated self-test data.
  Add-Type @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IKehaApplicationActivationManager {
  [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
  [PreserveSig] int ActivateForFile(IntPtr appUserModelId, IntPtr itemArray, IntPtr verb, out uint processId);
  [PreserveSig] int ActivateForProtocol(IntPtr appUserModelId, IntPtr itemArray, out uint processId);
}
public static class KehaStoreActivation {
  public static uint Launch(string id, string arguments) {
    var manager = (IKehaApplicationActivationManager)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")));
    uint pid; var result = manager.ActivateApplication(id, arguments, 0, out pid);
    if (result < 0) Marshal.ThrowExceptionForHR(result);
    Marshal.ReleaseComObject(manager); return pid;
  }
}
'@
  $appId = "$($installed.PackageFamilyName)!Family"
  $pidValue = [KehaStoreActivation]::Launch($appId, ('--smoke-test "' + $work + '"'))
  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($process -and !$process.WaitForExit(90000)) { $process.Kill(); throw 'The packaged app self-test timed out.' }
  $failure = Join-Path $work 'failure.txt'
  if (Test-Path $failure) { throw (Get-Content $failure -Raw) }
  $resultFile = Join-Path $work 'result.json'
  if (!(Test-Path $resultFile)) { throw 'The Store-activated app did not produce its verification report.' }
  $result = Get-Content $resultFile -Raw | ConvertFrom-Json
  if (!$result.webViewRendered -or !$result.fullscreenRestored -or !$result.normalRestored -or !$result.safeNavigation) { throw 'The packaged app did not pass the rendering and saved-window checks.' }
  if ((Get-FileHash $original -Algorithm SHA256).Hash -ne $unsignedHash) { throw 'The Store submission package was modified during CI signing.' }
  [ordered]@{ installed=$true; storeActivation=$true; appId=$appId; packageBytes=$info.bytes; originalUnsignedPackageUnchanged=$true; native=$result } | ConvertTo-Json -Depth 5 | Tee-Object -FilePath (Join-Path $output 'verification.json')
} finally {
  if ($installed) { Remove-AppxPackage -Package $installed.PackageFullName }
  if ($certificate) {
    Remove-Item "Cert:\LocalMachine\TrustedPeople\$($certificate.Thumbprint)" -ErrorAction SilentlyContinue
    Remove-Item "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -ErrorAction SilentlyContinue
  }
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
