# Visitor accessibility preferences

The header's Accessibility button opens a native modal dialog in Hebrew or either English locale. All site-specific preferences start off. Device reduced-motion preferences remain respected even after reset. Preferences are validated, saved locally under `keha-accessibility-v1`, and synchronized across tabs. No additional server requests or external overlay service are used.

Options include six text sizes (100–200%), high contrast, underlined links, reading spacing, strong keyboard focus, fewer ornaments and reduced motion. Reset restores the original appearance without changing the active page, language, family content or media. Photos keep their original colors. The text-size token is applied to existing absolute CSS font sizes; relative sizes inherit it. Canvas game drawings and fixed-coordinate visual game markers remain unchanged.

The keyboard skip link focuses main content without replacing hash-based routes. The modal has labelled controls, pressed states, a live status, contained focus, Escape/close and focus return. The readable family directory is linked from the panel. Existing family-tree arrow/zoom keyboard controls remain available.

Reduced motion disables decorative CSS animation and scrolling effects. Home slideshow auto advance and tree inertia also honor it in JavaScript; manual slideshow navigation remains available. Active gameplay and user-played videos retain their existing controls.

Behavioral tests cover persistence, reset, malformed values, storage failures, device preferences, independent toggles, cross-tab updates, labels, modal state and safe skip navigation. Browser checks include Hebrew/English, narrow portrait and landscape viewports, maximum text size, keyboard focus, dialog scrolling, and unchanged photo rendering. Automated and browser checks do not substitute for testing with a human screen-reader user.

Reference: https://www.w3.org/TR/WCAG22/ (resize text, reflow, contrast, keyboard, focus, pause/stop/hide).
