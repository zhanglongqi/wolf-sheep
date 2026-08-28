## 1. Scale config and orientation detection

- [x] 1.1 In `GameScene.create()`, determine `isPortrait` once from `window.innerWidth < window.innerHeight` before building any layout; verify by logging the value at a desktop-sized and a narrow emulated viewport and confirming it flips correctly
- [x] 1.2 Add a `scale` block to the Phaser `config` object: `Phaser.Scale.FIT` when landscape, `Phaser.Scale.WIDTH_CONTROLS_HEIGHT` when portrait, with `autoCenter: CENTER_HORIZONTALLY`; verify a desktop-sized viewport still renders the canvas at its previous size and a narrow emulated viewport (e.g. 390px wide, via devtools device toolbar) shows the canvas scaled to that width with no horizontal scrollbar
- [x] 1.3 Toggle a `portrait` class on `document.body` based on `isPortrait`, before constructing `Phaser.Game`; add the corresponding CSS rule in `index.html` (`body.portrait #game-container { height: auto; min-height: 100vh; align-items: flex-start; }`); verify that in a narrow emulated viewport, a canvas taller than the viewport causes the page to scroll natively (drag/scroll-wheel reveals content below the fold) instead of being clipped

## 2. Portrait coordinate space

- [x] 2.1 Define `PORTRAIT_CANVAS_WIDTH` (800), `PORTRAIT_TOP_HEIGHT`, `PORTRAIT_BOTTOM_HEIGHT`, and `PORTRAIT_CANVAS_HEIGHT` (sum) constants per design.md's starting values (160/200); verify the file still builds with no runtime errors after adding unused-for-now constants
- [x] 2.2 Make `_screenPos`/`_boardPoint` branch on `isPortrait`: offset `{x: 0, y: PORTRAIT_TOP_HEIGHT}` in portrait vs. the existing `{x: BOARD_OFFSET_X, y: 0}` in landscape; verify by rendering the board in both modes and confirming node positions land inside the expected band in each

## 3. Portrait layout — top band

- [x] 3.1 Add `_initPortraitTopBand()`: turn label, sheep count, and reserve/phase labels arranged in a horizontal row within `PORTRAIT_TOP_HEIGHT`; verify the HUD updates identically to landscape (`updateHUD()` still drives these labels) by playing a move and observing the text change
- [x] 3.2 Move the restart/resign buttons into the top band, arranged horizontally next to or below the status row; verify both buttons still trigger `resetGame()`/`resign()` when tapped in the portrait layout

## 4. Portrait layout — bottom band

- [x] 4.1 Add `_initPortraitBottomBand()`: mode buttons (`玩家执狼`/`玩家执羊`/`双人对战`) and AI difficulty buttons (`简单`/`普通`/`困难`) each arranged as a horizontal row, positioned starting at `y = PORTRAIT_TOP_HEIGHT + 800`; verify clicking an option changes the active mode/difficulty and restarts the game, matching landscape's `_initLeftSidebar()` behavior
- [x] 4.2 At a representative narrow viewport (e.g. 390×844), verify the top+middle bands are fully visible without scrolling on load, and the bottom band is reachable by scrolling down (it may already be visible too — see design.md Decision 3a; only "board never requires scrolling" is a hard requirement)

## 5. Touch tap tolerance

- [x] 5.1 Add a portrait-only margin to the radius checks in `_hitPiece` and the `HIT` threshold in `_hitNode` (per design.md Decision 4, roughly +10 logical units); verify by simulating a tap offset from a piece/node center (not dead-center) in an emulated narrow viewport and confirming it still registers as selecting that piece/node
- [x] 5.2 At the smallest viewport tested, verify taps near the midpoint between two adjacent nodes do not ambiguously register both — confirm the enlarged tolerance stays well under half the scaled node spacing

## 6. Wiring and orchestration

- [x] 6.1 In `create()` and `resetGame()`, call `_initPortraitTopBand()` + `_initPortraitBottomBand()` when `isPortrait`, or the existing `_initLeftSidebar()` + `_initRightSidebarButtons()` otherwise; verify a desktop-sized viewport produces a visually identical layout to before this change (no regression)

## 7. Cross-orientation regression pass

- [x] 7.1 At a desktop-sized viewport, play a full game (select, step, capture, trigger win/draw/resign, restart, switch mode and difficulty) and confirm no landscape behavior changed
- [x] 7.2 At 2–3 emulated narrow viewports (e.g. 360×740, 390×844, 428×926), play a full game via simulated taps and confirm: board+status visible without scrolling on load, settings reachable by scrolling (whether or not already visible), all actions (select/move/capture/restart/resign/mode/difficulty) work
- [x] 7.3 Adjust `PORTRAIT_TOP_HEIGHT`/`PORTRAIT_BOTTOM_HEIGHT` if 7.2 reveals cramped or excessively empty bands, and re-verify 4.2 — no adjustment needed; both bands render with sensible spacing at all three tested widths

## 8. Optional cleanup

- [x] 8.1 (Optional, not required for this change to be done) Remove the unused Vite scaffold CSS rules in `src/style.css` — the whole file turned out to be unlinked from `index.html` and unimported anywhere, so it was deleted outright rather than just trimming the named classes; `README.md`'s project-structure listing updated to match
