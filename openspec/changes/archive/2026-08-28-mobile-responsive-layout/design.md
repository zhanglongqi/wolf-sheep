## Context

See proposal.md for motivation. Relevant current state:

- `GameScene.create()` hardcodes `CANVAS_WIDTH = 1280`, `CANVAS_HEIGHT = 800` and a `BOARD_OFFSET_X = 240` used by `_screenPos`/`_boardPoint` to shift the board right past the left sidebar. The Phaser `config` object has no `scale` block at all (mode defaults to `NONE` — canvas renders at exactly 1280×800 CSS pixels, unscaled).
- Board node coordinates (`_grid5x5Nodes`) are authored in a fixed local space: `x, y ∈ [100, 700]`, an 600×600 square with 100px margin, independent of the sidebars.
- `index.html`'s `#game-container` is `height: 100vh` with flex centering — this already permits natural page overflow/scroll if a child grows taller than the viewport (no `overflow: hidden` anywhere in the chain), so "native scroll" mostly falls out of removing/relaxing that one rule for portrait, not building new scroll machinery.
- `_hitPiece` and `_hitNode` (click/tap hit-testing) both operate in the same unscaled logical coordinate space as rendering. Phaser's input plugin maps a pointer event through the active Scale Manager back into this logical space automatically — adding a `scale` config does not require touching either hit-test function.

## Goals / Non-Goals

**Goals:**
- Landscape desktop experience is visually unchanged (same sidebars, same positions), just now scales gracefully on narrower desktop/tablet windows via `Phaser.Scale.FIT`.
- Portrait phones get a layout designed for the shape they actually have, not a shrunk copy of the landscape one.
- No changes to `Board` or `AIPlayer` — this is `GameScene` + `index.html` only.

**Non-Goals:**
- Live re-layout on resize/rotation (proposal.md already scopes this out — checked once at boot).
- Matching landscape's exact pixel positions in portrait — portrait gets its own band heights, tuned during implementation.
- Making the tap targets as large as platform guidelines recommend (~44px) in absolute terms — see Decision 4. "Usable," not "ideal," is the bar.

## Decisions

### 1. Orientation check gates two independent layout builders, not a shared parameterized one

`GameScene.create()` calls `window.innerWidth < window.innerHeight` once, and branches to either the existing `_initLeftSidebar()`/`_initRightSidebarButtons()` pair (landscape, untouched) or a new `_initPortraitLayout()` (portrait). The board-drawing code (`drawBoard`, `drawPieces`, `_screenPos`, `_boardPoint`) stays shared — only the coordinate offset it uses and the surrounding chrome differ.

Alternative considered: one layout function with an `isPortrait` flag threaded through every positioning call. Rejected — the two layouts don't share enough structure (three columns vs. three rows, vertical stacks vs. horizontal rows) for parameterization to save code; it would just add conditionals to every button/label call site.

### 2. Portrait coordinate space: reuse board-local coordinates, shift by a top-band offset instead of `BOARD_OFFSET_X`

Board nodes stay authored in the same `[100, 700]` local space (no change to `BOARD_CONFIGS`). Portrait mode defines:

```
PORTRAIT_CANVAS_WIDTH  = 800   // matches the board's own [100,700] span, no side content anymore
PORTRAIT_TOP_HEIGHT    = 160   // turn/count row + restart/resign row — tune during implementation
PORTRAIT_BOTTOM_HEIGHT = 200   // mode row + difficulty row — tune during implementation
PORTRAIT_CANVAS_HEIGHT = PORTRAIT_TOP_HEIGHT + 800 + PORTRAIT_BOTTOM_HEIGHT
```

`_screenPos`/`_boardPoint` become orientation-aware: in portrait, the offset is `{x: 0, y: PORTRAIT_TOP_HEIGHT}` instead of `{x: BOARD_OFFSET_X, y: 0}`. The board itself is drawn identically either way — only the additive offset changes.

Alternative considered: re-author a separate portrait-specific node coordinate set. Rejected — the board's shape doesn't change between orientations, only what surrounds it; duplicating coordinates would let the two boards drift and is pure risk for no benefit.

### 3. Scale mode differs by orientation: `FIT` for landscape, `WIDTH_CONTROLS_HEIGHT` for portrait

Phaser's `FIT` mode scales *both* dimensions down to fit inside the parent box — correct for landscape (nothing should overflow; everything is meant to be visible at once), but wrong for portrait: it would shrink the whole logical canvas, including the board, to squeeze everything into view, working against the goal of keeping the board as large as the viewport's width allows.

`WIDTH_CONTROLS_HEIGHT` scales so the canvas's CSS width matches the viewport width and derives height from the canvas's own fixed aspect ratio (`height = width × logicalHeight / logicalWidth`) — it does not clamp to, or compare against, the viewport's height at all. This is the right choice for guaranteeing no horizontal overflow (width is always driven by the viewport), but it means whether the resulting canvas height exceeds the viewport is purely a function of the logical canvas's own aspect ratio vs. the device's — **not** something this mode can be told to do "let it overflow." Initial implementation assumed the ≈1160-tall/800-wide logical canvas (aspect ≈1.45) would exceed a typical phone's viewport-relative aspect ratio (≈1.7–2.2 tall) and overflow into a scrollable bottom band; measurement during task 4.2 showed the opposite — 1.45 < 2.2, so the whole canvas renders *shorter* than the viewport, and the bottom band ends up visible without scrolling on most real phones. See Decision 3a for the resolution.

Concretely (the top-level `width`/`height` set the fixed aspect ratio the scale mode then honors; `scale.width`/`scale.height` are not used — the aspect ratio comes from `Size`'s own width/height, set once from the top-level config):

```js
const config = {
  width: isPortrait ? PORTRAIT_CANVAS_WIDTH : CANVAS_WIDTH,
  height: isPortrait ? PORTRAIT_CANVAS_HEIGHT : CANVAS_HEIGHT,
  scale: {
    mode: isPortrait ? Phaser.Scale.WIDTH_CONTROLS_HEIGHT : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  // ...
}
```

### 3a. Resolution: relax "settings only visible after scrolling" instead of forcing overflow

Forcing the canvas to always exceed viewport height (so the bottom band is genuinely scroll-gated on every device) would require inflating `PORTRAIT_BOTTOM_HEIGHT` from ~200 to ~940 — i.e., padding the settings band with roughly 700px of dead space just to push it below the fold on tall phones. Rejected as a real UX cost (users scroll through a large empty gap) paid to satisfy a requirement that was never load-bearing in the first place.

Decision: keep `PORTRAIT_TOP_HEIGHT`/`PORTRAIT_BOTTOM_HEIGHT` at their original modest values (160/200). The hard guarantee is narrowed to "the top and middle sections (status + board) always fit within one viewport height, on any realistic phone/tablet portrait aspect ratio" — this holds because `PORTRAIT_TOP_HEIGHT + 800` (≈960) divided by `PORTRAIT_CANVAS_WIDTH` (800) gives an aspect ratio of ≈1.2, comfortably under every mainstream phone/tablet's portrait aspect ratio (≈1.3–2.2). The bottom band is reachable by scrolling on every device, and on shorter/wider portrait viewports it may already be visible without scrolling too — that's an accepted, harmless outcome, not a defect. `specs/board-ui/spec.md`'s "Portrait layout stacks..." requirement is worded to this narrower, honest guarantee.

Alternative considered: split the canvas so top+board is sized to exactly the viewport height (independent of width-driven scaling) and render the settings band as real DOM/HTML below it, letting native page flow create the scroll boundary on any device. Rejected for this change — it would work, but introduces DOM-based UI into a codebase whose original design (see the archived `wolf-sheep-core` design.md) deliberately keeps all UI as Phaser canvas content to avoid split coordinate spaces and DOM/canvas z-index issues; worth considering later as its own change if pixel-perfect scroll-gating ever becomes a real requirement, not a side effect of this one.

### 4. Tap hit-tolerance gets a portrait-only bump; visual art size does not change

On a typical phone viewport (~360–430 CSS px wide), `WIDTH_CONTROLS_HEIGHT` scales the 800-wide portrait board down to roughly 0.45–0.55×, putting piece footprints (`PIECE_RADIUS` 26–27 logical units) at only ~12–15 screen px radius — under the ~44px touch-target guideline. Node spacing (150 logical units) scales down alongside, but stays proportionally large relative to the piece itself (~70–80 screen px between adjacent nodes), so there's headroom to grow the *tap tolerance* without pieces starting to overlap each other.

Decision: keep `PIECE_RADIUS` (art size) unchanged, but define a separate, portrait-only hit-tolerance constant used only inside `_hitPiece` and `_hitNode` — e.g. add a fixed margin (~10 logical units) on top of the existing radius/`HIT` threshold when `isPortrait` is true. This is a hit-testing tweak, not a rendering one: pieces look the same, they're just more forgiving to tap.

Alternative considered: scale up `PIECE_RADIUS` itself in portrait so pieces render bigger. Rejected — bigger pieces on an already-tight 5×5 board would start visually crowding/overlapping at these node-spacing-to-radius ratios, and it conflates a rendering decision with a touch-precision one; better to solve the actual problem (tap forgiveness) directly.

Alternative considered: detect touch capability (`'ontouchstart' in window` / `pointerType`) instead of piggybacking on the portrait flag. Rejected — proposal.md already commits to a single load-time orientation check as the one layout fork; a second independent detection axis adds a combinatorial case (portrait+mouse, landscape+touch) nothing in this change needs to handle.

### 5. `index.html` relaxes its height constraint conditionally, driven by the same JS check

`GameScene.create()` adds a `portrait` class to `document.body` when the orientation check says portrait, before the `Phaser.Game` is constructed. `index.html`'s CSS gets:

```css
#game-container { height: 100vh; display: flex; justify-content: center; align-items: center; }
body.portrait #game-container { height: auto; min-height: 100vh; align-items: flex-start; }
```

Alternative considered: an independent CSS `@media (orientation: portrait)` query. Rejected — a CSS media query and the JS `innerWidth < innerHeight` check can disagree at the exact boundary (e.g. a square-ish window), and having two independent sources of truth for "are we in portrait mode" is a bug waiting to happen. One JS check drives both the Phaser layout and the CSS class.

## Risks / Trade-offs

- **Reload-to-rotate feels janky on a device that autorotates** → Accepted trade-off per proposal.md's explicit non-goal; not solving live re-layout here.
- **`WIDTH_CONTROLS_HEIGHT`'s fixed-aspect-ratio behavior doesn't match a naive "let it overflow" expectation** → Materialized during task 4.2: the ≈1.45 logical aspect ratio is shorter than real phone aspect ratios (≈1.7–2.2), so the canvas never overflows on real devices. Resolved by narrowing the requirement rather than fighting the mechanism — see Decision 3a.
- **Band height constants (160/200) are guesses** → Mitigation: called out explicitly as tunable in Decision 2; tasks.md includes a pass to adjust them once the portrait layout is actually rendered and visually checked. (Confirmed reasonable at 390×844 — see task 4.2/7.2 notes.)
- **Touch-tolerance bump could make adjacent nodes ambiguous if tuned too high** → Mitigation: keep the margin well under half the scaled node spacing (~35 screen px at the low end); verify no overlap at the smallest viewport tested.

## Migration Plan

Additive change to `GameScene` and `index.html`; no data migration. Rollback is `git revert` — nothing persists outside the page.
