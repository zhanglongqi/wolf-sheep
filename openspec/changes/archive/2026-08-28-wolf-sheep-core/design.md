## Context

`src/game.js` currently draws a static board; `update()` is empty and no interaction exists. The stack is Phaser 4.2.0 + Vite 8; ES module import of Phaser works. The new implementation is a complete replacement — all existing classes are discarded. There is no backend, no persistence, and no network requirement.

## Goals / Non-Goals

**Goals:**
- Fully playable 狼吃羊 on both the 5×5 grid and the 19-node traditional board
- Three game modes: player-wolf, player-sheep, two-player
- Simple AI (wolf: prefer captures, else random step; sheep: random legal action)
- Click-driven interaction with color-coded move hints and piece animations
- In-game HUD (turn indicator, live sheep count, reserve count for traditional board)

**Non-Goals:**
- Strong AI / minimax strategy
- Saved games, undo, replay
- Mobile touch events (pointer events only; Phaser abstracts mouse/touch similarly but not explicitly tested)
- Multiple simultaneous game instances

## Decisions

### 1. Single-file implementation

All logic stays in `src/game.js`. Rationale: the project has no other source modules; splitting into multiple files would require updating `index.html` or Vite entry config for no real gain at this scale. Vite already handles the single ES module entry.

Alternative considered: `src/board.js`, `src/ai.js`, `src/scene.js`. Rejected because Vite + Phaser wires through a single entry point and the game is self-contained enough that module boundaries add ceremony without benefit.

### 2. String node IDs + flat adjacency map

Both board configs expose the same shape:
```js
{
  nodes: { [id]: { x, y } },          // pixel coords per node
  adjacency: { [id]: string[] },       // neighbor IDs (bidirectional)
  wolfStart: string[],                 // initial wolf node IDs
  sheepStart: string[],                // initial sheep node IDs (on-board at game start)
  sheepReserve: number,                // count of sheep waiting off-board
}
```
`Board` and `GameScene` only reference node IDs — they never branch on board type. The config object is the only thing that changes between boards.

Alternative considered: integer-indexed 2D array (the existing `positions[col][row]` approach). Rejected because the traditional board is not a grid; a sparse map with named nodes is cleaner and avoids special-casing non-rectangular topology.

### 3. Sheep placement phase as a state-machine flag

The `Board` class holds a `placingPhase: boolean` that is `true` when `sheepReserve > 0` on the traditional board. Grid board always starts with `placingPhase: false`. `GameScene` routes sheep-turn input through `board.placeSheep(nodeId)` vs `board.moveSheep(piece, nodeId)` based on this flag. No separate "phase" scene or screen.

### 4. Traditional board pixel layout

Canvas: 800×800. Coordinate system (all positions hard-coded in the config):

```
Main 3×3 grid (gs=100, centered at 400,400):
  TL(300,300)  TC(400,300)  TR(500,300)
  ML(300,400)  MC(400,400)  MR(500,400)
  BL(300,500)  BC(400,500)  BR(500,500)

neck_t (400,200)  ←  connects to TL,TC,TR + upper diamond
neck_b (400,600)  ←  connects to BL,BC,BR + lower diamond

Upper diamond (gs=50 horizontal, above neck_t):
  left_t(350,150)  ctr_t(400,150)  right_t(450,150)
  apex_t(400,100)

Lower diamond (symmetric below neck_b):
  left_b(350,650)  ctr_b(400,650)  right_b(450,650)
  apex_b(400,700)
```

Total board spans y=100 to y=700 (600px), leaving 100px margin top/bottom in the 800px canvas. The 200px margins left/right of the board (x=100–300 and x=500–700) are available for HUD elements.

### 5. Piece rendering via Phaser Graphics objects (no sprites)

Wolves: filled red circle (r=18). Sheep: filled white circle (r=14). Selection ring: drawn as a separate `Graphics` object cleared and redrawn on state changes. Rationale: no external assets needed; Graphics are fast enough for ≤45 pieces; the design produces the same visual result on any platform.

Alternative considered: sprite texture with pre-drawn images. Rejected because it introduces asset loading complexity for a shape that can be drawn programmatically in two lines.

### 6. AI executes with a short delay

When it is the AI's turn, `GameScene` schedules AI action via `this.time.delayedCall(400, ...)`. This prevents the AI from acting before the previous move's animation completes and makes the AI feel responsive rather than instant.

### 7. HUD rendered as Phaser Text objects, not DOM elements

All text (turn indicator, sheep counts, phase label) is rendered via `this.add.text()` inside the Phaser canvas. Rationale: avoids DOM/canvas z-index issues and keeps the entire UI in one coordinate space.

## Risks / Trade-offs

- **Traditional adjacency map correctness** → Mitigation: verify each of the 19 nodes' neighbor lists against the board diagram; add a startup assertion that the map is symmetric (if A lists B as neighbor, B must list A).
- **Animation race conditions** (user clicks during a tween) → Mitigation: `GameScene` sets a boolean `animating: true` during tweens and rejects input until it clears. Tweens are ≤200ms so the window is small.
- **Wolf AI delay makes game feel slow** → Mitigation: 400ms delay is configurable via a constant; no complex retry logic.
- **Single file grows large** → Acceptable trade-off; the file stays under ~600 lines including comments and the config data.

## Migration Plan

1. Replace `src/game.js` entirely (no in-place edits to existing classes).
2. `index.html` and `src/style.css` may need minor updates if a settings panel modal is added via DOM — but the core game is canvas-only and does not require HTML changes.
3. No database, no API, no environment variables — rollback is `git revert` on `src/game.js`.

## Open Questions

- Should the settings panel (board type + mode selection) be a DOM modal (HTML/CSS) or a Phaser overlay scene? The simpler path is a Phaser overlay scene (no DOM) but DOM gives richer styling. Decision deferred to tasks phase — default: Phaser overlay.
- Exact reserve sheep count for traditional board: requirements say "≈30". Using 22 reserve (8 on-board + 22 reserve = 30 total). Validate this against the original game rules during implementation.
