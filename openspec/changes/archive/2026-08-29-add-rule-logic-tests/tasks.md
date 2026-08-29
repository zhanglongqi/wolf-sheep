## 1. Test runner setup

- [x] 1.1 Add `vitest` as a devDependency (a version compatible with the project's Vite 8.x) and a `"test": "vitest run"` script in `package.json`; verify `npm run test` runs (even with zero test files, it should report "no tests found" rather than erroring)
- [x] 1.2 Confirm no separate `vitest.config.js` is needed — extend `vite.config.js` with a `test` block only if Vitest doesn't pick up the project cleanly by default; verify by running `npm run test` again once step 2 has at least one test file, confirming it's discovered and run

## 2. Extract pure logic into `src/board.js`

- [x] 2.1 Create `src/board.js`. Move `_grid5x5Nodes`, `_grid5x5Adjacency`, `BOARD_CONFIGS`, `assertAdjacencySymmetry` (plus its startup call `assertAdjacencySymmetry(BOARD_CONFIGS.grid5x5, "grid5x5")`), `Piece`, `Board`, and `AIPlayer` out of `game.js` into it, adding `export` to each top-level binding that `game.js` (or a test file) needs; verify the identifiers no longer exist in `game.js` and do exist, exported, in `board.js`
- [x] 2.2 Update `game.js` to `import` whatever it still references from `./board.js` (at minimum `BOARD_CONFIGS`, `Board`, `AIPlayer` — confirm during this task whether `Piece` is referenced directly anywhere in `game.js` or only indirectly through `Board`/`AIPlayer`, and only import it if it's actually used); verify the app still builds (`npm run dev`, no console errors on load)
- [x] 2.3 Play one full game through to a win/loss/draw/resign in each of the three modes (玩家执狼/玩家执羊/双人对战) against the dev server, confirming behavior is bit-for-bit unchanged from before the extraction — this is the real verification that the copy-paste didn't drop or alter anything

## 3. `Board` tests

- [x] 3.1 Test `getValidMoves`/`getValidEats` legality on constructed positions, including the block-off rule (a wolf with an adjacent sheep and no empty landing beyond it has that direction fully sealed — neither a step nor a capture); verify each assertion against a hand-constructed board state, not just the default starting position
- [x] 3.2 Test `move` and `eat` state transitions: occupancy updates correctly, `eat` removes the correct captured piece and relocates the wolf to the correct landing node; verify via before/after occupancy snapshots
- [x] 3.3 Test `placeSheep`: reserve count decrements, `placingPhase` flips to `false` exactly when reserve hits zero, placement is rejected on an occupied node or with zero reserve; verify all three branches
- [x] 3.4 Test `checkWin`: wolf wins when all sheep are gone and reserve is zero; sheep wins when every wolf simultaneously has zero valid moves and zero valid captures; verify both conditions with constructed positions, plus a "no winner yet" case returning `null`

## 4. `AIPlayer` tests

- [x] 4.1 Test that `makeWolfMove`/`makeSheepMove` always return an action that is a member of the actual legal-action set for the given position, across all three difficulties (`easy`/`medium`/`hard`); verify by cross-checking the returned action against `Board.getValidMoves`/`getValidEats`/`getValidSheepMoves` independently
- [x] 4.2 Test `medium` wolf: constructed position with at least one legal capture always results in a capture being chosen, never a plain step; verify across several different constructed positions with multiple candidate captures
- [x] 4.3 Test `medium` sheep: constructed position where exactly one candidate action is safe (others would let a wolf capture on the next turn) always results in the safe action being chosen; verify the unsafe candidates are never selected across repeated calls (since selection has a random component among safe candidates, call it enough times — e.g. 20+ — to make a missed unsafe-avoidance failure vanishingly unlikely to be a false negative)
- [x] 4.4 Test `hard`: for a constructed position, independently compute the best achievable score across all candidates using the same scoring logic the AI uses, then verify the AI's chosen action's score equals that maximum (not that one specific action was chosen, since ties break randomly)

## 5. Final verification

- [x] 5.1 Run `npm run test` and confirm the full suite passes with zero failures
- [x] 5.2 Re-run the manual full-game check from 2.3 one more time after all test-writing is done, confirming nothing introduced during test authoring (e.g. an accidental edit to `board.js` while iterating) changed `game.js`'s behavior
