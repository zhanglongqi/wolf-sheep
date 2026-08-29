## 1. Storage layer

- [x] 1.1 Add `STATS_STORAGE_KEY = "wolf-sheep:stats:v1"` and `statsBucketKey(mode, difficulty)` (returns `"2p"` for two-player, `` `${mode}|${difficulty}` `` otherwise); verify by calling it with each of the 7 valid (mode, difficulty) combinations and confirming the expected 7 distinct keys
- [x] 1.2 Add `readStats()` / `writeStats(stats)` / `clearStats()` helpers wrapping `localStorage`, treating a missing key, unparseable JSON, or a thrown access error as "all buckets empty" rather than propagating an error; verify by reading with no key set (empty object back), writing then reading (round-trips), and manually corrupting the stored value in devtools then reading (empty object back, no thrown error)

## 2. Recording

- [x] 2.1 Add `this._resultRecorded = false` and `this._resultOverlayWinner = null` to per-game state in `create()` and `resetGame()`, alongside `this.positionHistory = new Map()`; verify both fields exist and are `false`/`null` immediately after a fresh game starts
- [x] 2.2 Add `_recordResult(winner)`: bucket key from current `activeMode`/`difficulty`, increment `wolfWins`/`sheepWins`/`draws` in that bucket via `readStats()`+`writeStats()`; verify by calling it directly for each `winner` value and inspecting the written `localStorage` value
- [x] 2.3 Guard `showResult(winner)` with the `_resultRecorded` flag (set it and call `_recordResult(winner)` only the first time `showResult` runs per game); verify by calling `showResult` twice in a row for the same ended game and confirming the stored counts only increased once
- [x] 2.4 Verify via full playthroughs that a wolf win, a sheep win, a 5-fold-repetition draw, and a resignation each record exactly one result in the correct bucket, and that switching mode, switching difficulty, or clicking restart mid-game records nothing

## 3. Overlay content-replacement mechanism

- [x] 3.1 Extract `_clearOverlayContent()`: destroys every object currently in `this.overlayObjects` and empties the array, without touching board or game state; verify it can be called with an empty `overlayObjects` array (no-op, no error) and with existing content (fully cleared)
- [x] 3.2 Refactor `showResult(winner)` to call `_clearOverlayContent()` first, then draw the result content as before, and set `this._resultOverlayWinner = winner` after drawing; verify the end-game overlay still renders identically to before this change (background, result text, "再来一局" button) for a win, a loss, and a draw
- [x] 3.3 Clear `this._resultOverlayWinner = null` at the point the overlay is closed back to a live, interactive board; implemented via a shared `_statsPanelCloseCallback()` helper (used by all three stats entry points, not just the persistent buttons) rather than inlining the branch at each call site — same behavior, single source of truth; verify that after closing an overlay opened with no prior result, `_resultOverlayWinner` is `null`, and after `showResult` runs, it holds the current `winner`

## 4. Stats panel

- [x] 4.1 Add `_showStatsPanel(onClose)`: calls `_clearOverlayContent()`, reads stats via `readStats()`, draws a table (7 rows: `wolf|easy`, `wolf|medium`, `wolf|hard`, `sheep|easy`, `sheep|medium`, `sheep|hard`, `2p` — columns 狼胜/羊胜/平局) plus a "清空战绩" button and a close/back button wired to `onClose`; verify the panel renders all 7 rows with correct current totals for a `localStorage` state seeded with known values
- [x] 4.2 Wire the "清空战绩" button to call `clearStats()` then redraw the same panel (call `_showStatsPanel(onClose)` again with the same `onClose`) so the zeroed totals show immediately without closing; verify by opening the panel with non-zero stats, clicking clear, and confirming all visible totals become zero while the panel stays open
- [x] 4.3 Give the close/back button in the panel the label "关闭" when opened with no prior result, or "返回" when opened from an end-game result — reuse `this._resultOverlayWinner != null` (already tracked) to decide which; verify both labels appear in their respective situations

## 5. End-game overlay shortcut

- [x] 5.1 Add a "战绩" button next to "再来一局" in `showResult()`'s drawn content, wired to `this._showStatsPanel(() => this.showResult(this._resultOverlayWinner))`; verify clicking it from a win/loss/draw overlay opens the panel, and its close button redisplays the same result (not a fresh/blank board), and the result is not re-recorded (per 2.3)

## 6. Persistent stats control — landscape

- [x] 6.1 In `_initRightSidebarButtons()`, add a third button "战绩" below restart (y=620) and resign (y=680) at y=740, included in the existing `Math.max(...)`/`setFixedSize(...)` width-matching call alongside the other two; verify all three buttons render at the same width and the vertical spacing/margin to the canvas bottom looks consistent with the existing pair
- [x] 6.2 Wire its click handler to compute the context-sensitive `onClose` from `this._resultOverlayWinner` (per design.md Decision 3a) and call `_showStatsPanel(onClose)`; verify clicking it with no overlay showing opens the panel over the live board and closing returns to the interactive board, and clicking it while the end-game overlay is showing replaces that overlay's content and closing redisplays the result

## 7. Persistent stats control — portrait

- [x] 7.1 In `_initPortraitTopBand()`, change the button row from two (重新开始/认输) to three (战绩/重新开始/认输) at the same `y`, all three width-matched via the existing `_measureTextWidth`-based letter-spacing technique against the widest label ("重新开始"); verify all three render at equal width and stay within `PORTRAIT_TOP_HEIGHT` without needing to change that constant
- [x] 7.2 Wire the portrait "战绩" button's click handler identically to the landscape one (6.2); verify the same open/close behavior in both the "no overlay" and "result already showing" cases, in portrait

## 8. Regression pass

- [x] 8.1 At a desktop-sized viewport, play through a full game ending in each of a wolf win, sheep win, draw, and resignation; confirm the stats panel (opened from the sidebar) shows the expected totals after each, and confirm no double-counting when opening/closing the panel repeatedly on the same finished game
- [x] 8.2 At an emulated narrow portrait viewport, repeat the same checks: three-button top row renders and functions correctly, stats panel opens/closes correctly from both entry points, board+status still fit in one screen without scrolling per the existing `mobile-responsive-layout` guarantee (unaffected by this change, but confirm nothing regressed)
- [x] 8.3 Confirm "清空战绩" zeroes the table in place without closing the panel, and that a subsequent game played afterward starts that bucket back from zero correctly
