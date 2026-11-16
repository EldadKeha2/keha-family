# Ten family photographs, three prepared actions

The main `#family-ai` view presents ten reviewed photographs. Nine are original
black-and-white photographs. On 16 November 2026 the owner explicitly replaced
the Ora/Eddie wedding selection with Tedhar in his red toy car, photo
`89b5dd6a048342ecb9cd4b29b73ca197`. This is the only color exception; preserve
its original faded colors. All other color photographs remain ineligible even
if vintage, old, or converted to grayscale. Generation labels and the duplicate
introductory card are omitted from the public view.
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

Every production-plan photo requires a `blackAndWhiteReview` recording
`kind: "original-black-and-white"`, `reviewed: true`, its reviewed `revision`,
and the SHA-256 of the actual original source bytes. Record this only after
visually inspecting the image. Both scripts reject missing reviews, changed
source revisions, or changed bytes. Replacement color jobs remain archived in
`excludedJobs`, and their provider quota reset still blocks all new submissions.
The generator adds a monochrome-only instruction to every new movement prompt.
The named Tedhar exception instead requires `requestedColorException: true`
and `sourceReview` with `kind: "owner-requested-color"`, its unchanged revision
and SHA-256. Its output requires `colorPreservationReviewed: true` in place of
`monochromeReviewed`. The shared helper accepts this exception only for that
exact photo ID; it cannot relax the rule for another selection.

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
