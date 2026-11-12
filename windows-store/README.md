# Microsoft Store package

This packages the existing .NET Framework 4.8 / WebView2 app as a small x64 MSIX for Windows 10 version 2004 and later, including Windows 11. It preserves the family logo, native window, maximized first launch and saved fullscreen state. A missing WebView2 Runtime can be installed per-user from the bundled, Microsoft-signed bootstrapper using the app's completion button; the Store package does not rely on NSIS custom actions or download a second browser.

## Distribution requirement: unlisted, direct link only

The owner requested access through a shared link, without a searchable Store listing. In Partner Center > Pricing and availability > Visibility, select:

- Audience: **Public audience** (required for an unrestricted shared link; this is not a Microsoft-account allowlist).
- Discoverability: **Make this product available but not discoverable in the Store**.
- Acquisition: **Direct link only**.
- Price: **Free**.

Do not select the default discoverable listing. These are Partner Center submission settings, not MSIX manifest properties. `store-config.json` records the required settings and the build checks the intended distribution, but a successful build does not set portal visibility or publish anything. Confirm the actual portal choices before submitting.

Anyone who receives or discovers the direct listing URL can view and install the app. This is unlisted distribution, not an access-control boundary. It does not add authentication to the underlying website. For a future requirement to restrict named people rather than link holders, use Private audience from the first submission and Microsoft-account known user groups instead.

## Account and package identity

The owner completed free account registration, identity verification and reserved **KehaFamily**, Store ID **9MTDJ73268RR**. `store-config.json` contains the exact package identity supplied from Partner Center. The native window keeps its existing Hebrew family title. Do not submit a discoverable public listing.

Open Product management > Product identity and copy these exact, case-sensitive values into `store-config.json` (or the manual workflow inputs):

| Partner Center field | Configuration |
| --- | --- |
| Package/Identity/Name | `identityName` |
| Package/Identity/Publisher | `publisher` |
| Package/Properties/PublisherDisplayName | `publisherDisplayName` |

These are public package metadata, not passwords or signing keys. The build deliberately refuses to create a submission with an empty or preview identity. Use the Store-reserved display name in `displayName` as well.

Run `pwsh -NoProfile -File windows-store/build-store.ps1` on Windows with the .NET SDK and Windows SDK installed. The output is `desktop/dist/store/Keha-Family-<version>-x64.msixupload`. Upload that archive to the MSIX submission, not the existing NSIS EXE. Microsoft signs the package after certification. The generated unsigned MSIX is not an end-user download or a workaround for SmartScreen.

For build verification without a Store account, use `-Preview`. CI validates the MakeAppx manifest, installs a temporary signed copy on its disposable Windows runner, activates the actual packaged app through its Store application ID, and verifies WebView2 rendering and fullscreen/window restoration. The ephemeral CI signing certificate is never distributed. The original upload archive remains unsigned for Microsoft to sign.

## Submission preparation

Draft listing copy and the reason for the desktop capability are in `listing.json`. Before submission, supply real application screenshots, a hosted privacy-policy URL reflecting the site's actual handling of family data, age-rating answers and support details. These cannot be inferred from package identity. Do not claim Store approval or a signed download until Partner Center reports certification success and the link has been verified.

References: [MSIX package requirements](https://learn.microsoft.com/windows/apps/publish/publish-your-app/msix/app-package-requirements), [visibility options](https://learn.microsoft.com/windows/apps/publish/publish-your-app/msix/visibility-options), [manual packaging](https://learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-manual-conversion).
