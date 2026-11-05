# Heading North — Roei Harizi memorial game

Open `?game=north#games`, or choose the first game in the family lobby. The game is available in Hebrew and English. It retains Roi’s memorial story and his actual profile photograph, with a black Chevrolet Cruze and an illustrated roadside stop. See `north-art.md` for artwork sources. The interface keeps the trip timer and short control hints beside the road; the former instruction sidebar and collision-formula warnings have been removed.

The simulation runs entirely in the browser, with no API calls, writes or persistent game records. The 480 × 760 road faces north and uses continuous horizontal steering. Seeded random traffic includes cars, vans, traffic islands, barriers, cones and potholes. The base scroll speed rises from 210 to 500 pixels per second; turbo can double it. After 62% of the route, many waves become paired barriers with a 70-pixel passage, and late passages deliberately alternate more widely. Inter-row spacing accounts for the next opening, vehicle heights and the maximum turbo speed, preserving a physically reachable path. Obstacles and the renderer use the same center-based coordinates, while collision insets allow forgiving rounded edges.

## Timing and mandatory stop

The deadline is 180 active-play seconds. The route contains 163 seconds of normal forward travel and one mandatory ten-second station stop at its midpoint, for a nominal 173-second journey. During the stop, Roi gets out for a cigarette break. The station countdown and trip clock continue, while road movement, steering and turbo are suspended. Completing the stop records it for the current journey, so resuming or returning to the game cannot repeat it. Restarting begins a new journey with a new stop.

Each collision adds a complete five-second standstill while the deadline keeps counting. Recovery prevents one obstacle from counting repeatedly. A single five-second turbo doubles route progress and saves at most five seconds; it does not erase a collision or station penalty. One collision can therefore be recovered without turbo (178 seconds). Two collisions require turbo (178 seconds; otherwise 183), while three collisions cannot be recovered (183 seconds even with turbo). These details describe the implementation and tests; the gameplay interface does not expose the difficulty formula.

Mouse movement, keyboard arrows/A/D, touch drag and held directional buttons steer physically left/right regardless of language direction. Double-click, Space, Shift and the Turbo button share one activation. P, Escape, the pause control, hidden tabs, window blur and leaving the game pause the simulation, including a station stop in progress. Returning requires explicit resume. An unexpected frame gap over one second pauses rather than skipping unseen traffic. Editable fields and open dialogs do not control the car.

## Family welcome and sound

The finish uses actual family faces from the reviewed `PREPARED_HEADS` snapshots, cropped with their existing `headCrop` settings and placed on animated cheering figures. It no longer loads the fictional family crowd artwork. Profile changes elsewhere on the site cannot silently replace these fixed game portraits.

Success plays soft overlapping handclaps using band-limited Web Audio buffers, unlocked by a user gesture. Sound can be disabled; playing sources stop on mute, navigation, restart or pause. Reduced-motion preferences and the site’s accessibility controls stop optional applause and flame effects while retaining essential road motion. Large-text overlays scroll from the top.

## Verification

Run `node --test test/north.test.mjs test/north-ui.test.mjs test/games-ui.test.mjs` for focused engine, controller and lobby coverage, then `npm run check` for the repository suite. Timing tests include the mandatory stop, collision outcomes, turbo preservation, irregular frame sizes and terminal boundaries. Controller tests cover the removed sidebar, fixed art and real family faces, physical steering, shared one-use turbo, the station countdown and disabled inputs, pause/resume through the same stop, listener cleanup, direct links, user-gesture audio, applause, restart and timeout. `wrangler deploy --dry-run` checks bundling with the existing Worker and Durable Object configuration.

Current verification: 318 repository tests and 45 focused tests pass. Visual fixtures checked the station, black car and real-family finish at desktop width and a 390-pixel phone frame, with no horizontal overflow. The actual browser-based preview was static-only; Worker bundling was verified separately.
