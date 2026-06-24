## Why

The project has a static board rendering with no game logic — `src/game.js` draws pieces but `update()` is empty and there is no interaction. This change delivers the complete playable implementation of 狼吃羊 (Wolf Eats Sheep), a traditional Chinese board game with checkers-style capture mechanics.

## What Changes

- **BREAKING**: Full rewrite of `src/game.js` — all existing classes (`Cheese`, `WolfSheep`, `Example`) are replaced
- Two selectable board types: 5×5 grid (3 wolves, 15 sheep) and 19-node traditional board (2 wolves, 8+reserve sheep)
- Wolf movement rules: step to adjacent empty node, or jump-capture over a single adjacent sheep to the empty node behind it
- Sheep movement rules: step to adjacent empty node; traditional board adds a placement phase where reserve sheep enter one per turn before movement is allowed
- Win detection: wolf wins when all sheep are eaten; sheep wins when every wolf simultaneously has no legal action
- Three game modes: player controls wolf (sheep AI), player controls sheep (wolf AI), two-player same-device
- Piece selection UI with color-coded move hints (blue = step, orange = capture landing) and piece animations (150 ms move, 200 ms fade-out on capture)
- In-game HUD: current turn indicator, live sheep count, reserve count and phase label (traditional board only)
- Settings panel (board type + game mode), restart button, and end-game overlay

## Capabilities

### New Capabilities

- `board-engine`: Board topology for both board types — node coordinates, adjacency maps, and piece-placement state. The shared engine that both board configs plug into.
- `game-rules`: Legal-move computation for wolves and sheep (step, jump-capture, placement), the blocking rule (sheep-behind-no-empty seals that direction), and win-condition detection.
- `game-modes`: The three play modes and the AI player logic (wolf AI: prefer capture, else random step; sheep AI: random legal placement or step).
- `board-ui`: Phaser 4 rendering layer — board lines, piece sprites, selection highlights, move-hint overlays, piece animations, HUD text, settings panel, restart button, and end-game overlay.

### Modified Capabilities

## Impact

- `src/game.js` — complete replacement; no code survives
- `index.html` / `src/style.css` — may need minor updates to support the settings panel and overlay (DOM elements outside the canvas)
- `package.json` — no new dependencies; Phaser 4.2.0 and Vite already present
- No backend, no API, no shared state outside the browser tab
