# iPhone shortcut profile trial

`/install/iphone.html?lang=he` offers an optional profile download alongside the usual Safari installation flow. English uses `lang=en-US` or `lang=en-GB`. The normal website sharing URL and Android installation flow are unchanged.

Each `.mobileconfig` file is an unsigned XML property list with exactly one `com.apple.webClip.managed` payload. It adds a removable, standalone Home Screen shortcut to the production HTTPS site, with the existing 180px Apple touch icon embedded in the profile. It includes no MDM enrollment, certificates, accounts, network configuration, or removal restriction. Both the profile and shortcut have stable identifiers and UUIDs across languages so changing language replaces the same profile.

The download page discloses the unsigned status before the download. Safari and Settings own the actual download and installation prompts; the page never claims that a click or download confirms installation. The download is a normal HTTPS link with `application/x-apple-aspen-config`; there is no automatic download or unsupported Settings URL scheme.

After downloading on an iPhone, installation continues in Settings → Profile Downloaded, or General → VPN & Device Management. Apple requires installation within eight minutes; the file can be downloaded again if it expires. Users can remove the icon or remove the profile from Settings. The number of system confirmations depends on the device; this trial does not promise fewer taps.

Regenerate the three static files after changing the icon or profile content:

```sh
node scripts/build-ios-profiles.mjs
```

Keep the identifiers and UUIDs stable when regenerating. Native installation must be checked on a real iPhone; browser and HTTP checks verify only the page, payload, and download response.

Apple references:

- https://developer.apple.com/documentation/devicemanagement/webclip
- https://developer.apple.com/documentation/devicemanagement/configuring-multiple-devices-using-profiles
- https://support.apple.com/102400
