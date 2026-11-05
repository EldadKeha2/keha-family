# Heading North — Roei Harizi memorial game

Open `?game=north#games`, or choose the first game in the family lobby. All copy is Hebrew/English. The game uses a local snapshot of Roei’s actual profile photograph and original generated art; see `north-art.md`.

The simulation is client-only, with no API calls, writes or persistent game records. The 480 × 760 north-facing road uses continuous horizontal steering, seeded random obstacle positions, and increasingly frequent and crowded waves. Every wave preserves a reachable corridor. Cars, vans, traffic islands, barriers, cones and potholes use the same center-based collision coordinates as the renderer. Collision insets allow forgiving rounded edges.

## Timing

The deadline is 180 active-play seconds. Normal route travel takes 173 seconds. Each impact freezes the road, steering and any active turbo for five seconds while the clock continues. Recovery prevents the same obstacle from counting twice. One five-second turbo doubles forward travel, saving at most five seconds; it never cancels a collision penalty. Thus one impact can be recovered without turbo (178 seconds), two need turbo (178 seconds; otherwise 183), and three cannot be recovered (183 seconds even with turbo).

Mouse movement, keyboard arrows/A/D, touch drag and held directional buttons steer physically left/right regardless of language direction. Double-click, Space, Shift or the Turbo button share the same one-use activation. P, Escape, the pause control, hidden tabs, window blur and leaving the game pause the simulation. Returning requires explicit resume. An unexpected frame gap over one second pauses rather than skipping unseen traffic. Keyboard events in dialogs or editable fields do not control the game.

Success shows the same two-frame applauding family as the approach to the finish line. Handclaps use short, soft, band-limited Web Audio buffers, unlocked only by a user gesture. Sound can be disabled, and all playing sources stop on mute, navigation, restart or pause. Reduced-motion preferences and the site’s accessibility controls stop the optional clap/flame effects while retaining essential road motion. Large-text overlays scroll from the top.

## Verification

`npm run check`: 314 tests passed after integration with the latest Yemeanite Rex randomization update. Engine tests cover exact timing outcomes, coarse and irregular time steps, complete stationary collision penalties, collision recovery, steering limits, deterministic traffic, increasing density, clear corridors and terminal boundaries. Controller/lobby tests cover both languages, controls, shared one-use turbo, pause/resume, listener cleanup, direct links, image assets, user-gesture audio, applause, restart and timeout. An independent offline controller also completed 50 seeded routes with real collision checks and zero impacts. `wrangler deploy --dry-run` bundles successfully with the existing Worker/Durable Object configuration.
