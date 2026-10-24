# Notes for the future README

## Provider reliability and advertising (requested 22 October 2026)

When writing the new README, include a short section explaining:

- Some third-party providers may have better title availability or more reliable playback, while also displaying advertisements or opening popups. Reliability varies by title, episode, region and time; do not present an unverified permanent ranking.
- Recommend a reputable, enabled and updated content blocker. Link to the authentic uBlock Origin for Firefox/Zen and the appropriate official variant for other supported browsers, verifying compatibility when the README is written.
- An ad blocker reduces exposure to unwanted requests, advertisements and popups; it does not guarantee safety or block every scam. Keep the browser updated and do not grant permissions, install software or enter credentials in provider/ad prompts.
- VANTRA does not control third-party advertising or separately opened tabs. Its permission restrictions reduce access to supported browser APIs, but are not a complete ad blocker or a guarantee against compromise.
- Popup-denying iframe sandboxing was tested and rejected by MultiEmbed, VidCore, VidFast and VidNest. Do not promise universal built-in popup blocking while these integrations remain unchanged.

Suggested README wording:

> Provider availability and playback reliability vary. Some sources offer broader availability but include third-party advertisements and popups. We recommend using an up-to-date browser with a reputable content blocker, such as uBlock Origin where supported. This reduces unwanted ads and popups but does not guarantee safety. VANTRA does not control third-party advertisements.

This is a planning note for the later README rewrite; the current README has not been rewritten.
