## Why

The Phaser canvas is a hardcoded 1280×800 with no `Scale` config, and the desktop layout spends its width on two fixed 240px sidebars flanking the board. On a phone this doesn't shrink to fit — it gets clipped or forces horizontal scrolling — and even a naive fit-to-screen scale would leave a portrait viewport showing a squashed landscape board with sidebars still eating over a third of the width. The game is already deployed on GitHub Pages, so people opening it on a phone today get a broken experience.

## What Changes

- Add a `Phaser.Scale` config (FIT + center) so the game scales into whatever viewport it's given, instead of a fixed-size canvas that clips or scrolls sideways on anything smaller than 1280×800.
- Detect orientation once at load time (`viewport width < height` → portrait). The desktop landscape layout (left/right sidebars flanking the board) is unchanged when the check says landscape.
- Add a distinct portrait layout that re-stacks the same content vertically instead of horizontally:
  - Top band: turn indicator, sheep count, reserve/phase labels, and the restart/resign buttons — the current right sidebar's content, laid out in horizontal rows instead of a narrow vertical stack.
  - Middle band: the board itself.
  - Bottom band: mode and AI-difficulty selection — the current left sidebar's content, also laid out in horizontal button rows instead of stacked vertically.
- Top band + middle band are sized to always fit within one viewport height on realistic phone/tablet portrait aspect ratios, so the board and current game status are visible without scrolling. The bottom band (settings) is reachable by scrolling down; on a device tall enough relative to its width it may already be visible too — only "board never requires scrolling" is a hard guarantee, not "settings are hidden until scrolled."
- Scrolling to the bottom band SHALL be native browser scrolling over a taller-than-viewport canvas — not a Phaser-internal camera or masked scroll region. This requires removing the current hard `height: 100vh` constraint on `#game-container` in `index.html` for the portrait case.
- The orientation check runs once at scene boot. Resizing the window or rotating the device mid-game does not re-run it — the user needs to reload the page to switch layouts. This is an explicit non-goal, not an oversight.
- **Not in scope**: any change to game rules, AI behavior, sound, or the capture animation. This is a layout/rendering change only. Whether to clean up the leftover unused Vite scaffold CSS in `src/style.css` is left as an optional, separately-flagged task — not required for this change to be considered done.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `board-ui`: Adds viewport-driven scaling and an orientation-dependent layout. The existing "left sidebar" and "right sidebar" requirements become landscape-specific; new requirements describe the portrait top/middle/bottom stacking, the fill-then-scroll sizing rule, and the load-time-only orientation check.

## Impact

- `src/game.js` — `GameScene` gains an orientation check at boot and a second code path for building the HUD/buttons/settings layout in portrait mode; the Phaser `config` object gains a `scale` block; canvas logical height becomes taller than the viewport in portrait mode to accommodate the bottom band.
- `index.html` — `#game-container`'s hardcoded `height: 100vh` needs to allow natural overflow/scroll in the portrait case.
- No new dependencies, no backend, no changes to `Board`/`AIPlayer` rule logic.
