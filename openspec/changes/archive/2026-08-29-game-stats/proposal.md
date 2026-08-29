## Why

The game has no memory of past results — every win, loss, and draw disappears the moment "再来一局" is clicked. All game-ending paths already converge on a single function (`GameScene.showResult(winner)`), making this a natural, low-risk place to start persisting outcomes locally and giving players a way to see their history.

## What Changes

- Persist win/loss/draw counts to `localStorage`, bucketed by `mode+difficulty` (six buckets for the two AI-opponent modes × three difficulties) plus one difficulty-less bucket for two-player mode. Each bucket stores raw `{wolfWins, sheepWins, draws}` counts rather than a "player win/loss" framing, since two-player mode has no single "player" to frame a result around.
- Record a result once per completed game, inside `showResult(winner)` — the one function every ending path (win, draw, resignation) already calls. No other code path is touched for recording purposes.
- Add a "战绩" (stats) button alongside the existing restart/resign controls:
  - Landscape: a third stacked button in the right sidebar, below restart and resign.
  - Portrait: the top band's button row grows from two to three (战绩 / 重新开始 / 认输), all sized to the same width using the existing letter-spacing technique.
- Add a "战绩" shortcut button next to "再来一局" in the end-game overlay, so a result is checkable immediately after a game ends without first dismissing the result (which would restart the game).
- Both entry points open the same stats panel content, reusing the existing single-overlay mechanism (`this.overlayObjects`) rather than stacking a second overlay — opening the panel replaces the current overlay's content, and its close/back action either tears the overlay down (opened from the persistent button) or redraws the end-game result (opened from within it).
- The stats panel shows one row per bucket (10 rows: 3 modes × 3 difficulties, minus the 2 modes without a two-player difficulty axis, plus the single 2p row) with wolf-wins/sheep-wins/draws columns, plus a "清空战绩" (clear stats) button that resets all buckets and refreshes the table in place.
- **Not in scope**: move counters, "fastest win" records, or any timing/step instrumentation — deferred to a separate backlog item. No changes to `Board`, `AIPlayer`, or any rule/AI behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `board-ui`: Adds a persistent stats entry point (landscape sidebar, portrait top band), a stats panel rendered as overlay content, an end-game-overlay shortcut into that same panel, and the underlying win/loss/draw recording tied to the existing `showResult` win/draw/resign paths.

## Impact

- `src/game.js` — `GameScene.showResult()` gains a recording call and a "战绩" button; `_initRightSidebarButtons()` (landscape) and `_initPortraitTopBand()` (portrait) each gain a third button; a new stats-panel renderer and a small `localStorage` read/write/clear helper are added.
- No new dependencies. First use of `localStorage` in this project — no backend, no network, no change to `Board`/`AIPlayer`.
