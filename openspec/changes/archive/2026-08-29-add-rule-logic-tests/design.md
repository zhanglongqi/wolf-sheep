## Context

See proposal.md for motivation. Precise current-file mapping (verified by reading `src/game.js` directly, not assumed from section-comment banners, which don't line up with the actual extractable boundary):

- Extractable (zero references to `window`/`document`/`Phaser` anywhere in their bodies): `_grid5x5Nodes` (~L71-79), `_grid5x5Adjacency` (~L81-94), `BOARD_CONFIGS` (~L174-187), `assertAdjacencySymmetry` + its startup call (~L189-203), `Piece` (~L373-380), `Board` (~L384-513), `AIPlayer` (~L528-678).
- These are **not** one contiguous block today — `BOARD_CONFIGS` sits after an interleaved chunk of UI-only constants (`BOARD_OFFSET_X`, `CANVAS_WIDTH`/`HEIGHT`, sidebar X positions, the `isPortrait` detection + `document.body.classList.toggle` side effect, portrait canvas constants) and after the entire stats-persistence block (`STATS_STORAGE_KEY`, `statsBucketKey`, `readStats`/`writeStats`/`clearStats`). `Piece`/`Board`/`AIPlayer` come later still, after the cartoon piece-art functions. None of the extractable pieces reference any of the interleaved UI/stats/art code (verified with a targeted grep over each class body) — the interleaving is incidental to file history, not a real dependency.
- `game.js` has zero `export` statements today, and unconditionally runs `new Phaser.Game(config)` at module load — the actual blocker this change exists to route around.

## Goals / Non-Goals

**Goals:**
- `src/board.js` can be imported by a test file with no DOM, no Phaser, no side effects — a plain Node module.
- `src/game.js`'s runtime behavior is bit-for-bit unchanged (this is a relocation + `export` addition, not a rewrite).

**Non-Goals:**
- Splitting anything else out of `game.js` (`GameScene`, `SFX`, art functions, stats persistence all stay — see the `工程健康度` backlog item for that larger, separate question).
- Testing `GameScene`, rendering, or draw detection (see proposal.md's scope correction).
- Setting up CI to run the suite automatically — this change only makes the suite runnable locally via a script.

## Decisions

### 1. Extract by identifier, not by contiguous line range

Because the six extractable pieces aren't contiguous in the current file (see Context), tasks.md directs moving them by name by grep'ing each one from `game.js`, not by cutting a single line range. `src/board.js`'s internal order can be whatever reads best (e.g., node/adjacency generation → `BOARD_CONFIGS` → `assertAdjacencySymmetry` + call → `Piece` → `Board` → `AIPlayer`), independent of their original order in `game.js`.

### 2. `game.js` imports what it still uses; nothing it doesn't

`game.js` currently uses `BOARD_CONFIGS`, `Piece` (indirectly, via `Board`/`AIPlayer` return values — `GameScene` never constructs a `Piece` directly, so it may not need the import at all; confirm during implementation and only import what's actually referenced), `Board`, and `AIPlayer` directly (`new Board(...)`, `new AIPlayer(...)`, `BOARD_CONFIGS.grid5x5`). `assertAdjacencySymmetry` only needs to run once, at module load, inside `board.js` itself (it already self-invokes today via the trailing `assertAdjacencySymmetry(BOARD_CONFIGS.grid5x5, "grid5x5")` call — that call moves into `board.js` too, so the assertion still runs automatically whenever `board.js` is imported, including from a test file — a nice free win: importing `board.js` in a test re-validates the adjacency map on every test run).

### 3. Vitest, default `node` environment, no config beyond the essentials

Vitest is added as a `devDependency` alongside a `test` script in `package.json` (`"test": "vitest run"`). No `vitest.config.js` is needed beyond what a default Vite project already provides unless Vitest's auto-detection of `vite.config.js` needs a `test` block added there instead (check during implementation; both are valid, prefer extending the existing `vite.config.js` over adding a second config file if it works cleanly). Environment stays the default (`node`) — no `jsdom`/`happy-dom` dependency, since nothing under test touches the DOM.

### 4. Testing non-deterministic AI behavior

`AIPlayer` uses `Math.random()` for tie-breaking (`_bestByScore`) and for `easy`/`medium` random selection. Tests assert *properties* of the output rather than exact values:
- The chosen action is always a member of the actual legal-action set for that position.
- `medium` wolf: capture is chosen whenever at least one capture is legal (never a plain step when a capture exists).
- `medium` sheep: an action landing in immediate wolf-capture range is avoided whenever a safe alternative exists (constructed test positions where exactly one candidate is safe).
- `hard`: independently compute each candidate's score using the same scoring logic the AI itself would use (either by importing `AIPlayer`'s private scoring via a constructed instance, or by re-deriving the expected best score from the constructed position), then assert the AI's chosen action's score equals the maximum — not that a specific action string was chosen, since ties are broken randomly.

No seeding/mocking of `Math.random()` — the properties above hold regardless of which random draw occurs, so there's no need to control it.

## Risks / Trade-offs

- **Splitting the file reverses a documented decision in the original `wolf-sheep-core` design.md** ("single-file implementation... module boundaries add ceremony without benefit") → Accepted and explicitly scoped: that call was made before there was a testing need; this change only extracts the pure-logic slice that the testing need actually requires, and leaves the rest of the single-file structure untouched.
- **A hand-copy-paste extraction could silently drop or alter a line** → Mitigation: after extraction, run the existing manual regression steps (or, more directly, boot the dev server and play one full game per mode) to confirm `game.js`'s behavior is unchanged; the extraction is complete only when the game still plays identically.
- **Vitest version drift from Vite** → Mitigation: pin a Vitest major version known compatible with the project's Vite 8.x at install time; not expected to be a real issue given Vitest's explicit Vite-version support matrix.

## Migration Plan

Additive/relocation change only — no data, no deployed behavior change. Rollback is `git revert`; `src/board.js` and the test file can be deleted with no cleanup elsewhere since nothing outside `game.js` and the test suite references them.
