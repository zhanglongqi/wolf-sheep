## Why

`src/game.js` is 1641 lines and bundles four unrelated concerns — the synthesized `SFX` class, the cartoon-art drawing functions (`fillOval`/`drawWolfArt`/`drawSheepArt`), win/loss/draw stats persistence (`statsBucketKey`/`readStats`/`writeStats`/`clearStats`), and the `GameScene` Phaser scene itself. `add-rule-logic-tests` already pulled the pure rule engine and AI out into `src/board.js` (367 lines), driven by testability — but `design.md`'s original call to leave the rest alone ("too small to bother splitting") was made when the file was a fraction of its current size. Splitting the remaining concerns into their own modules makes each one independently readable and testable (SFX and stats persistence in particular have no Phaser dependency and can be unit-tested in isolation, the way `board.js` now is).

## What Changes

- Extract `SFX` into `src/sfx.js`.
- Extract `statsBucketKey`/`readStats`/`writeStats`/`clearStats` into `src/stats.js`.
- Extract `fillOval`/`drawWolfArt`/`drawSheepArt` into `src/cartoon-art.js`.
- `src/game.js` keeps only `GameScene`, the Phaser `config`, and the module-load setup (`isPortrait`, canvas sizing), importing the three extracted modules.
- No behavior, API, or rendering output changes — pure module reorganization.

## Capabilities

No capability changes — this is a pure internal refactor with no spec-level behavior change (`skip_specs: true` set in `.openspec.yaml`).

## Impact

- Affected files: `src/game.js` (shrinks significantly), new `src/sfx.js`, `src/stats.js`, `src/cartoon-art.js`.
- No changes to `src/board.js`, build config, or public behavior.
- Existing Vitest suite (`src/board.test.js` or similar) should continue to pass unchanged; no new engine logic is introduced.
