# Independent family installations

The original Keha PWA has scope `/`. Chrome therefore treats every existing
`/nakash/.../` page as part of that installed app and may suppress the other
families' installation prompts. Distinct manifest IDs alone do not fix this.

Each configuration here deploys a small Worker on a separate origin. Its service
binding forwards to the existing `keha-family` backend. Profiles, edits, galleries, uploads and
media are shared; no database or media collection is copied. Each manifest keeps
its existing family name, logo color and launch URL, with self-related app links
adjusted to the dedicated origin.

## Activation

The production `main` build runs `scripts/prepare-family-apps.mjs` using its
existing Cloudflare API connection. It creates or updates only `family-haim`,
`family-yehuda`, `family-medina`, and the available `family-extended` /
`family-shlomo` portals, then verifies each live page, manifest identity
and PNG icon before compiling the returned origins into the main site. The
original root Keha installation is retained. Local checks and preview builds do
not deploy these apps. An API or verification failure stops the main deployment,
leaving the existing live site and installation links in place.

For manual activation instead:

1. Connect each `family-<branch>` Worker to this repository with the corresponding
   `family-apps/<branch>` root, or deploy that directory's Wrangler configuration.
   The configurations are `haim`, `yehuda`, `medina`, `keha`, `extended`, and `shlomo`.
2. Verify the actual returned production URL for each Worker. Open its home,
   manifest, a profile and a media file. Check installation with the root Keha
   app already installed. Never activate a guessed or undeployed hostname.
3. Set the main `keha-family` Worker's optional `FAMILY_APP_ORIGINS` variable to JSON
   mapping each verified branch to its HTTPS origin, without a path. Keep the
   original root Keha app at its current URL.
4. Installation buttons and invitation/page/media shares then use the verified
   family origin. Existing family URLs continue to work. Until configured, they
   retain their current behavior.

## Validation

`node --test test/family-app-proxy.test.mjs test/home-install-ui.test.mjs test/nakash-tree.test.mjs test/media-share-ui.test.mjs`

`node node_modules/wrangler/bin/wrangler.js deploy --config family-apps/yehuda/wrangler.jsonc --dry-run`

The proxy preserves streaming bodies, range requests, redirects, status codes
and existing API credentials. It rejects foreign-origin writes before
translating the family origin for the backend's existing same-origin check.

## Shlomo Keha portal

The original site's Grandpa Shlomo olive-tree link opens the extended Keha hub
at `/keha-extended/`. The hub's “משפחת שלמה קהא” circle opens
`/keha-extended/shlomo/#home`, with the same four gallery, tree, directory and
video options as the other family portals. This view includes Yona, Shlomo and
their descendants only. It reuses their canonical IDs, biographies, portraits
and tagged media; no Nakash or Medina tree is included.

The first production deployment introduces the new route and manifest. A
subsequent production build can then verify that route, create its dedicated
Worker, and activate the verified installation origin. The hub uses the working
shared-origin route until that verification succeeds. The separate manifest and
origin retain the name “משפחת שלמה קהא” when installing alongside the extended
Keha app.
