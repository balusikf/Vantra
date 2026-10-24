# bloub animation engine

Source: https://github.com/jeremy-prt/bloub
Pinned revision: `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`.
Copyright (c) 2026 Jérémy Perret. MIT; see LICENSE in this directory.

Only the framework-independent `src/bot/*.ts` runtime is vendored.
VANTRA's small `engine.ts` adapter adds read-only attachment anchors to BotFrame:
the sampled silhouette, pre-blink face tangents, depth and face visibility. It
does not change upstream state, shape, expression, timing or eye rendering.
No Vue runtime, editor, export encoders or external runtime services are included.
VANTRA's React SVG renderer and interactions live in `components/nook/`.
Nook uses a VANTRA red pebble shape with the upstream animation states.

Upstream notes that its MIT licence covers the code, not the x.ai avatar design
that the original project imitates. VANTRA is not affiliated with x.ai.
