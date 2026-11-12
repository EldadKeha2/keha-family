!macro customInstall
  ; Evergreen is part of Windows 11 and is already installed on most Windows 10 PCs.
  ; Only install Microsoft's shared runtime if its registration is absent.
  SetRegView 32
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ReadRegStr $R1 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  SetRegView 64
  ${If} $R0 == ""
  ${OrIf} $R0 == "0.0.0.0"
    ${If} $R1 == ""
    ${OrIf} $R1 == "0.0.0.0"
      DetailPrint "Preparing Microsoft WebView2..."
      ExecWait '"$INSTDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $R2
    ${EndIf}
  ${EndIf}
!macroend
