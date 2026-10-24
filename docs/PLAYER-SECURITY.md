# Player security hardening - 22 October 2026

## Protections added

- Site-wide Permissions-Policy denies camera, microphone, geolocation, clipboard read/write, display capture, payments, USB, serial, HID, Bluetooth, MIDI and Web Share in browsers supporting each directive.
- The same explicit denials are applied directly to playback and YouTube trailer iframe allow attributes. This matters for Firefox/Zen, where iframe permissions have broader support than the Permissions-Policy HTTP header. Unsupported directives are ignored; capability support varies by browser.
- Video autoplay permission, encrypted media, fullscreen and picture-in-picture permissions remain available. The existing no-referrer iframe setting is retained.
- CSP limits document base URLs and form destinations to self, blocks object/plugin embeds and restricts sites that can frame VANTRA to its own origin. This is a limited CSP, not a full script/XSS policy, and does not filter scripts or ads in third-party players.
- SAMEORIGIN X-Frame-Options supplies a framing restriction fallback; nosniff disables MIME type guessing; strict-origin-when-cross-origin avoids sending paths/query strings to external sites while retaining the origin required by YouTube embeds. Streaming player iframes retain their stricter no-referrer override.

## Boundaries

These changes reduce access to specific APIs and protect VANTRA's own document. They do not prevent all exploits, scams, tracking, ads, downloads or popups. A separate popup tab is outside VANTRA's permissions policy and uses that site's browser permissions. No browser settings/extensions, Supabase permissions, credentials or accounts were changed.

The prior popup-denying sandbox experiment made MultiEmbed, VidCore, VidFast and VidNest refuse playback, so no sandbox is applied. See PROVIDER-POPUP-COMPATIBILITY.md. Provider rejection was not bypassed.

The user reports that tabs close immediately in Zen, likely due to uBlock Origin or browser protection; the active extension and its settings were not inspected. VANTRA does not contain code that closes external popup tabs. uBlock Origin offers a per-site No popups switch; browser filtering remains the practical popup/ad layer for these sources.

## Checks

- 37 tests and ESLint pass, including security policy regressions and header/iframe denial parity.
- Production build uses the previously verified Webpack command and Windows UV_THREADPOOL_SIZE=1 workaround.
- Live production response headers on /login confirmed Permissions-Policy, CSP, nosniff, a restricted referrer policy and SAMEORIGIN (rechecked after the final build).
- With the initial header-only changes, Frieren on VidNest advanced to 0:29 and seeking reached 0:56. Fullscreen confirmation was interrupted by an upstream ad; no fullscreen success is asserted.
- Final iframe allow attributes were verified in the production DOM with all explicit denials present. MultiEmbed and VidFast loaded the correct House of the Dragon S2E3 player without sandbox rejection. Continuous playback was not established for those sources in this check.
- VidNest's final check remained at Loading; a direct provider control outside VANTRA also initially showed Loading. No conclusion about its current availability or the cause of that loading state is asserted.
- The final production response was rechecked for all five security headers, including strict-origin-when-cross-origin; the four focused policy tests were rerun and passed after that compatibility adjustment.
- Tests and browser observations establish the specific checks above, not a complete security audit or a guarantee that all providers and browser versions work.
- Anime metadata remained unavailable during the check, producing the existing history-save notice independently of playback.

## References

- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/http/headers/Permissions-Policy.json
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/html/elements/iframe.json
- https://github.com/gorhill/uBlock/wiki/Per-site-switches
- https://docs.zen-browser.app/user-manual/extensions

YouTube compatibility: https://developers.google.com/youtube/terms/required-minimum-functionality#youtube-embedded-player-and-video-playback
