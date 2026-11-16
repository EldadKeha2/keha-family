# Family photographs, three prepared actions

The main `#family-ai` view presents nineteen reviewed photographs: eight original
black-and-white sources and eleven exact owner-selected color or sepia sources.
Tedhar in the red toy car (`89b5dd6a048342ecb9cd4b29b73ca197`) replaced the
Ora/Eddie wedding selection. The restored family picnic
(`d76e78dc736a404fac0f36d68d2a760f`) replaces the young-Shlomo card while the
portrait stays intact in its original personal album. Preserve each selected
source's existing colors. Every independent future addition must still be
originally black-and-white. Generation labels and the duplicate introductory
card are omitted from the public view.
`src/living-family-catalog.mjs` identifies
the photographs and the three actions: smile, wave, and a little dance.
The existing larger archival collection remains available below the curated
album. Original photographs open in the normal shared gallery.

Each button plays its own stored video. Visiting the page, choosing an action,
changing actions, and replaying a clip never submit a generation request.
Unavailable actions remain disabled and marked in preparation. The displayed
ready count comes from stored clips, rather than from the number of plans or
submitted jobs. The page refreshes readiness while visible and stops polling
once all three actions for every available photograph are ready.

## Production

The owner approved sending these family photographs to Hugging Face for free
animation generation. The initial approved wedding clip uses the public
`zerogpu-aoti/wan2-2-fp8da-aoti-faster` Space, eight inference steps, seed 42,
and five seconds (the encoded output is 5.0625 seconds). Two other actions use
their own movement prompts. Preserve original monochrome tones without colorization,
recognizable people, apparent ages, clothing, framing, and setting.

`scripts/prepare-family-living.py` keeps the production plan, source images,
request identifiers, error reports, and successful MP4 files in an external
work directory. Do not commit family image or video bytes to this public
repository. The official `gradio_client` SDK handles uploads and queue sessions;
`token=False` prevents using any cached account token. Existing completed jobs
are skipped. Interrupted submissions and rejected requests stop the batch for
reconciliation before another job is submitted. A confirmed free-quota rejection
records the provider reset time; `--resume-free-after-reset` can resume it only
after that timestamp. It never retries early or rotates accounts. A public demo
may throttle, exhaust its free
allowance, or fail; a submitted job is not a completed video. Do not purchase
credits, switch to paid APIs, or rotate accounts/Spaces to bypass a limit.

Every originally black-and-white production-plan photo requires a `blackAndWhiteReview` recording
`kind: "original-black-and-white"`, `reviewed: true`, its reviewed `revision`,
and the SHA-256 of the actual original source bytes. Record this only after
visually inspecting the image. Both scripts reject missing reviews, changed
source revisions, or changed bytes. Replacement color jobs remain archived in
`excludedJobs`, and their provider quota reset still blocks all new submissions.
The generator adds a monochrome-only instruction to every new movement prompt.
Each exact owner-selected color or sepia exception instead requires `requestedColorException: true`
and `sourceReview` with `kind: "owner-requested-color"`, its unchanged revision
and SHA-256. Its output requires `colorPreservationReviewed: true` in place of
`monochromeReviewed`. The shared helper accepts exceptions only for the exact eleven owner-selected photo IDs;
it cannot relax the rule for another selection.

Inspect generated frames for identity, natural motion, monochrome preservation,
extra people, and hand artifacts. Set `reviewed: true` and
`monochromeReviewed: true` only for inspected successful clips. The
attachment script imports only reviewed completed outputs:

```sh
python scripts/attach-family-living.py --work-dir /path/to/production
```

## Durable attachment and playback

`GET /api/family-ai/featured` returns the current curated photographs and the
three actual clip statuses for each one. Clip records live separately from
gallery metadata in the existing SQLite Durable Object. They are included in
the normal backup export under `familyAi.living`.

The existing same-origin public contribution protection applies to imports:

```text
POST /api/family-ai/photos/PHOTO_ID/clips/smile
  ?revision=PHOTO_REVISION&operation=32_HEX_ID&expected=none&filename=memory.mp4
Content-Type: video/mp4
Origin: SITE_ORIGIN
X-Family-Token: the existing public contribution marker

[actual MP4 bytes]
```

The server validates actual MP4 structure, H.264 video, duration between half
a second and fifteen seconds, and a 25 MiB limit. It rechecks source revision
and action version atomically after storage. Each action has its own record,
immutable object key, and import receipt. An idempotent delayed retry cannot
restore an older clip over a newer one or affect another action. Replacing an
existing action requires its current version as `expected`.

Media stays in the site's existing private bucket and plays through
`/api/family-ai/video/PHOTO_ID/ACTION?v=VERSION`. Playback supports HEAD, Range,
and downloads, and uses no expiring generation-provider URL. Deleted or
excluded source photographs are not exposed by the curated album. Later
source edits mark an older animation as based on a previous image version.

## AI-page-only restored source

`POST /api/family-ai/photos/PHOTO_ID/source` accepts a bounded, structurally
validated PNG only for the catalog entry explicitly marked `ownerRestoredSource`.
The existing same-origin public contribution guard still applies. The saved
record uses the separate `family-ai` media category and has no gallery, personal
album, profile, or collection membership. The original portrait is never edited
or deleted. The prepared source and its three pending actions appear only on
the selected AI card. Repeating the same bytes is idempotent; changing an
existing source or importing into another photo ID is rejected.


## Explicit owner uploads and protected removal — 16 November 2026

The owner explicitly added nine original PNG photographs (seven from the supplied
media ZIP, plus Photo_05_Page_02.png and Photo_10_Page_02.png). The exact IDs,
source SHA-256 digests and original filenames are in the catalog. The curated
album now has nineteen photos with fifty-seven planned actions. These exact nine
uploads are additional owner-selected exceptions preserving their existing colors
or sepia; independent future selections remain originally black-and-white.
Sources use the dedicated family-ai category, never public repository image bytes.
Source upload is idempotent, validates actual PNG structure up to 32 MiB and
32 megapixels, and rejects bytes not matching the catalog's source digest.

Each card has a small, separate trash control beside the effects. Removal uses
the shared styled password dialog. The server validates a salted PBKDF2 verifier
in private Durable Object storage, with per-client and global attempt limits.
No password is embedded in client code, stored in the browser or included in
public backups. A one-time challenge initializes the verifier through
POST /api/family-ai/removal/setup; subsequent setup attempts are rejected.
The existing exclusion endpoint requires the password on every removal. Restoring
an excluded card does not require it. Exclusion leaves original media and all
other album memberships intact. The generator checks the live featured list
before each action; the importer skips absent/excluded photos and the server
rejects imports for excluded photos, including an import racing a removal.

The same password gate covers AI-viewer deletion and multiple-photo selection.
Legacy deletion requests naming an AI scope or a dedicated AI-only source are
protected by the same server verifier and resolve to AI-only exclusion.
