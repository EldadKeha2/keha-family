# Family AI / בינה משפחתית

The `#family-ai` section collects vintage, black-and-white and old dated family photos. Removing a card excludes it from this section without changing the original picture or its other albums. Excluded photos can be restored.

Real animation uses Runway Gen-4 Turbo image-to-video. The Worker always requests a 10-second clip, preserves the photograph's original appearance in the prompt, and copies successful MP4 output into the existing Hugging Face media bucket. Videos are played and downloaded through the site's own origin. Provider output links and storage keys are never exposed to visitors.

## Activate generation

The tab and gallery work without a generation account. To enable the Bring to life button, add these Cloudflare Worker secrets through the Cloudflare dashboard or the existing deployment process:

- `RUNWAYML_API_SECRET`: an API key from the Runway developer portal (`https://dev.runway.com`).
- `FAMILY_AI_ACCESS_CODE`: a separate family creation code of at least eight characters. Visitors enter this code to start a paid generation; it is never saved in a photo, job record or browser storage.

The existing `HF_NAMESPACE`, `HF_BUCKET`, `HF_ACCESS_KEY_ID` and `HF_SECRET_ACCESS_KEY` media settings must be available. Optional runtime variable `FAMILY_AI_DAILY_LIMIT` sets the family's combined daily accepted-generation cap from 1 to 100 (default 20). Cloudflare `keep_vars` preserves dashboard runtime variables during deployment.

A funded Runway developer account is required; the ChatGPT subscription does not provide website API credits. At implementation time Gen-4 Turbo costs five credits per second at $0.01 per credit, or approximately $0.50 for a 10-second clip, before tax. Runway's developer setup lists a $10 minimum initial credit purchase. No account purchase, credit purchase or real generation is performed during installation or testing. Check current provider pricing before enabling.

Official references:

- API: `https://docs.dev.runwayml.com/api/`
- Input restrictions: `https://docs.dev.runwayml.com/assets/inputs/`
- Output retention: `https://docs.dev.runwayml.com/assets/outputs/`
- Pricing: `https://docs.dev.runwayml.com/guides/pricing/`
- Setup: `https://docs.dev.runwayml.com/guides/setup/`

## Generation behavior

A valid creation code is required only to start a new paid job. Repeated clicks reuse the same pending or completed job, with the Durable Object serializing claims. Deliberate retries of failed jobs count against the daily cap. A submission whose response was lost is marked uncertain and is not automatically resubmitted, preventing duplicate charges.

The browser polls local job status; the Worker polls Runway at most once every 30 seconds per job. A two-minute lease and token-checked updates prevent concurrent viewers from racing copies or overwriting completed jobs. Successful video bytes are saved with a deterministic key, and an ambiguous failed upload never schedules deletion of a later retry's video.

Creation continues on Runway when the section closes. The existing hourly Worker schedule also checks unfinished jobs and retains completed videos, so output can be saved without an open browser. On return, the gallery resumes checking status. Saving while the browser is closed may take up to the next hourly check. Provider URLs expire in 24–48 hours, so the existing schedule must remain enabled.

The browser can prepare a resized JPEG to accommodate GIF/AVIF and large original images. Otherwise the Worker supplies a one-hour signed source URL for a compatible original or preview (JPEG/PNG/WebP up to 16 MB). Source URLs validate photo revision and support HEAD without redirects. No arbitrary visitor-supplied remote URLs are fetched.

## Checks

`node --test test/family-ai-state.test.mjs test/family-ai-route.test.mjs` exercises durable selection/restore, shared quota and duplicate claims, lease takeover, paid-request gating, actual provider request shape, same-origin input, polling, persistent video storage/retry, safe errors and download behavior. Requests use local mocks and incur no provider charges.
