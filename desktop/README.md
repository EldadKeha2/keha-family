# Keha Family for Windows

The Windows app loads the live family website in an isolated Electron window. It opens maximized on its first launch, then remembers normal bounds, monitor position, maximized state and fullscreen state in the current user's application-data directory. Off-screen saved positions are brought back onto an available monitor.

Use **F11** for fullscreen. **Alt** reveals the app menu, including Maximize and Reload. The desktop and Start-menu shortcuts launch this native window rather than the browser-installed PWA. Installing this app does not remove the existing PWA.

Website content and styling load from the production site on every launch. The native shell is versioned separately; publish a new installer when upgrading Electron or changing native behavior.

## Build

Run `npm ci`, `npm test`, then `npm run dist` inside `desktop/` on Windows. The `Build Windows desktop app` workflow also checks real Windows maximize/fullscreen behavior before packaging the NSIS installer and publishing its GitHub download. Desktop source changes trigger this build; ordinary site edits do not rebuild the installer.

The installer uses a guided setup: the family logo appears in the setup screens, the executable and the shortcuts; the install-folder step shows where the app goes and permits choosing another folder. The build verifies the actual embedded app and installer icons on Windows before publishing.

The trial installer is unsigned. It is installed per-user and does not request administrator rights. Remote pages have no Node integration, preload bridge, webview support or filesystem API. Navigation is restricted to the live family origin; approved sharing/video links open in the system browser. No system, storage or certificate protections are disabled.
