# Keha Family for Windows

Version 2 loads the live family website in a native .NET Framework 4.8 / WebView2 window. The installer packages the small native host and Microsoft's signed Evergreen bootstrapper; it does not ship Electron or a second browser runtime. Windows 11 already includes WebView2; on a machine without it, the installer installs Microsoft's shared runtime once. The native window and family logo appear before browser initialization or the network request.

It opens maximized on its first launch, then remembers normal bounds, monitor position, maximized state and fullscreen state. The existing per-user window-state file and NSIS application identity are retained for upgrades from version 1. Off-screen saved positions are brought back onto an available monitor.

Use **F11** for fullscreen. **Alt** reveals the app menu, including Maximize and Reload. The desktop and Start-menu shortcuts launch this native window rather than the browser-installed PWA. Installing this app does not remove the existing PWA.

Website content and styling load from the production site on every launch. The native shell is versioned separately; publish a new installer when upgrading Electron or changing native behavior.

## Build

Run `npm ci`, `npm test`, then `npm run dist` inside `desktop/` on Windows with the .NET SDK and PowerShell 7 installed. `build-native.ps1` builds the native host and verifies Microsoft's signature on the bootstrapper. The NSIS packager receives only `dist/native`; Electron is retained as an old development dependency for legacy packager metadata and is excluded from the shipped folder. CI checks WebView2 rendering, immediate window display, actual native maximize/fullscreen restoration, installer/app logos, and a 15 MB upper bound before publishing. Ordinary site edits do not rebuild the installer.

The installer uses a guided setup: the family logo appears in the setup screens, the executable and the shortcuts; the install-folder step shows where the app goes and permits choosing another folder. The build verifies the actual embedded app and installer icons on Windows before publishing.

The trial installer is unsigned. It is installed per-user and does not request administrator rights. Remote pages have no Node integration, preload bridge, webview support or filesystem API. Navigation is restricted to the live family origin; approved sharing/video links open in the system browser. No system, storage or certificate protections are disabled.
