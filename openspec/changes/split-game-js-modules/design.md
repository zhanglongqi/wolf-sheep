## Context

`src/game.js` (1641 lines) currently defines, top to bottom: the `SFX` class (Web Audio synthesis, lines 9-110), stats persistence functions (`statsBucketKey`/`readStats`/`writeStats`/`clearStats`, lines 112-158), cartoon-art drawing functions (`fillOval`/`drawWolfArt`/`drawSheepArt`, lines 160-313), and the `GameScene` Phaser scene (lines 314-1612) plus the Phaser `config`/`game` bootstrap (lines 1614-1641). All call sites into the three extracted groups are simple, direct calls with no shared mutable state beyond what's passed as arguments (`fillOval`/`drawWolfArt`/`drawSheepArt` take a Phaser `Graphics` object `g`; `SFX` is instantiated once per scene as `this.sfx`; the stats functions read/write `localStorage` independently of scene state). See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Move `SFX`, the stats persistence functions, and the cartoon-art functions into their own files with no behavior change.
- Keep each extracted module self-contained (no import back into `game.js`, no Phaser dependency beyond the `Graphics` type used structurally in `cartoon-art.js`).

**Non-Goals:**
- Not changing `SFX`'s Web Audio implementation, the stats `localStorage` schema, or the rendered art.
- Not adding new tests as part of this change beyond confirming the existing suite still passes — dedicated unit tests for the newly isolated modules can be a follow-up, not required here.
- Not touching `src/board.js` or the rule engine.

## Decisions

- **Three new files, one concern each**: `src/sfx.js` (the `SFX` class), `src/stats.js` (the four stats functions), `src/cartoon-art.js` (`fillOval` + `drawWolfArt` + `drawSheepArt`). Considered a single `src/game-support.js` catch-all instead, but that just recreates the original problem (unrelated concerns bundled together) one level down — separate files match how `board.js` was already split out by concern.
- **Named exports, no default exports**: matches the existing `export { BOARD_CONFIGS, Board, AIPlayer }` style in `board.js`.
- **`fillOval` stays private to `cartoon-art.js`**: it's only called by `drawWolfArt`/`drawSheepArt` within that file; only those two need to be exported.
- **Import order in `game.js`**: `import { SFX } from "./sfx.js"`, `import { statsBucketKey, readStats, writeStats, clearStats } from "./stats.js"`, `import { drawWolfArt, drawSheepArt } from "./cartoon-art.js"`, placed after the existing `board.js` import.

## Risks / Trade-offs

- [Copy-paste error during extraction silently changes behavior (e.g. a dropped `const`, a wrong relative import)] → Run the existing Vitest suite and manually smoke-test the game (start a game, verify SFX plays, place/move pieces to see cartoon art renders, finish a game to confirm stats persist) after extraction, before considering the change done.
- [Extracted files could drift into importing `GameScene` internals later, recreating coupling] → Not mitigated structurally in this change; the module boundaries are a convention, not enforced by tooling. Acceptable given the project's current size.
