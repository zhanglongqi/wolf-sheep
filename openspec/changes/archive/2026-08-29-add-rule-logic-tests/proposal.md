## Why

`Board` (jump-capture legality, the block-off rule, win detection) and `AIPlayer` (three difficulty tiers) are pure logic with zero test coverage today — every regression in the rule engine or AI has only ever been caught by manually clicking through the game. But `src/game.js` has no `export` statements at all, and unconditionally boots a live `Phaser.Game` at module load (reads `window.innerWidth`, touches `document.body`, constructs a real canvas) — so there is currently no way to import `Board`/`AIPlayer` into a test file without also triggering that boot sequence. Adding tests requires solving this first, not just adding a test file.

## What Changes

- Extract `Piece`, `Board`, `AIPlayer`, `BOARD_CONFIGS`, and `assertAdjacencySymmetry` out of `src/game.js` into a new `src/board.js` module with proper `export` statements. Verified to have zero references to `window`/`document`/`Phaser` today, so the move requires no behavior changes to these classes themselves — pure relocation plus adding `export`.
- `src/game.js` imports these from `./board.js` instead of defining them inline. `GameScene`, `SFX`, the cartoon piece-art drawing functions, the stats persistence helpers, and the module-load side effects (`isPortrait` detection, `new Phaser.Game(config)`) all stay exactly where they are.
- Add Vitest as a dev dependency and a minimal config — the natural fit for a Vite project (shares Vite's module resolution/transform pipeline, no separate bundler setup). Tests run in Vitest's default `node` environment; no `jsdom` needed since `Board`/`AIPlayer` never touch the DOM.
- Add a test suite covering `Board` (move/capture legality, the block-off rule, `placeSheep`'s reserve/phase transition, both win conditions) and `AIPlayer` (legal-action selection across all three difficulties, medium's forced-capture and safety-filter behavior, hard's actual best-scoring selection) — see design.md for the full breakdown.
- **Correcting the originating backlog item's scope**: it described this as covering "win/draw detection," but that's not accurate — `Board.checkWin()` only ever returns `'wolf' | 'sheep' | null`. The 5-fold-repetition draw rule (`_positionSignature`/`_recordPositionAndCheckRepetition`) is implemented on `GameScene`, not `Board`, and `GameScene` is out of scope for this change. Draw detection is therefore **not** covered here.
- **Not in scope**: any change to `GameScene`, Phaser rendering/interaction, the stats persistence feature, draw detection, or CI configuration (a follow-up change if wanted).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — `skip_specs: true` is set in `.openspec.yaml`: this is test infrastructure and an internal module split with no user-visible behavior change, not a new or modified product capability.)

## Impact

- `src/game.js` — loses the `Piece`/`Board`/`AIPlayer`/`BOARD_CONFIGS`/`assertAdjacencySymmetry` definitions, gains an import from `./board.js`. No behavior change.
- `src/board.js` — new file, holds the extracted pure logic with `export` statements added.
- `src/board.test.js` (or similar, per design.md) — new test suite.
- `package.json` / `vite.config.js` (or a new `vitest.config.js`) — Vitest added as a devDependency, plus a `test` script.
- No changes to `GameScene`, rule behavior, AI behavior, or any rendered output.
