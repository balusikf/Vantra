# Popup restriction compatibility - 22 October 2026

A browser-enforced iframe sandbox was tested with `allow-scripts allow-same-origin allow-presentation allow-orientation-lock`. It omitted popup, top-navigation, download, modal and form permissions.

A local cross-origin test with nested frames confirmed that JavaScript window.open, target=_blank links and top-level redirects were blocked. Nested frames could not grant themselves permissions denied by their ancestor.

However, all four checked providers rejected that configuration inside the production VANTRA player:

- MultiEmbed: Sandboxing is not allowed!
- VidCore: Please Disable Sandbox
- VidFast: Please Disable Sandbox
- VidNest: Please Disable Sandbox, followed by a client exception

The experimental sandbox was removed to preserve working playback. No popup blocking or complete ad removal is claimed for VANTRA. No provider checks were bypassed and no browser protections were disabled.

A normal parent website cannot inject CSS into, remove ads from, or intercept arbitrary link handlers inside a cross-origin player. Parent window.open overrides and parent script-src directives do not solve that boundary. Sandboxing can restrict new browsing contexts but cannot remove ads rendered in the iframe or prevent all navigation within the iframe itself.

A browser content blocker can filter requests and page elements with user-granted browser privileges. Availability and effectiveness depend on the browser, filter lists and provider. A provider's official ad-free embed would be another option if offered; no such integration was established here.

References:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox
- https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
