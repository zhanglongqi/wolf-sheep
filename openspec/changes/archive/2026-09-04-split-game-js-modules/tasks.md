## 1. Extract SFX

- [x] 1.1 Create `src/sfx.js` with the `SFX` class (currently `src/game.js` lines 9-110) and `export { SFX }`
- [x] 1.2 Update `src/game.js` to `import { SFX } from "./sfx.js"` and remove the inline class definition; verify `grep -n "class SFX" src/game.js` returns nothing

## 2. Extract stats persistence

- [x] 2.1 Create `src/stats.js` with `statsBucketKey`, `readStats`, `writeStats`, `clearStats` (currently `src/game.js` lines 112-158) and export all four
- [x] 2.2 Update `src/game.js` to import the four functions from `./stats.js` and remove the inline definitions; verify `grep -n "^function readStats" src/game.js` returns nothing

## 3. Extract cartoon art

- [x] 3.1 Create `src/cartoon-art.js` with `fillOval` (private), `drawWolfArt`, `drawSheepArt` (currently `src/game.js` lines 160-313); export only `drawWolfArt` and `drawSheepArt`
- [x] 3.2 Update `src/game.js` to import `drawWolfArt`/`drawSheepArt` from `./cartoon-art.js` and remove the inline definitions; verify `grep -n "^function drawWolfArt" src/game.js` returns nothing

## 4. Verify

- [x] 4.1 Run the existing test suite (`npm test` or `npx vitest run`) and confirm all tests pass
- [x] 4.2 Run `npm run build` (or the project's dev server) and manually smoke-test: start a game, place/move a piece to confirm cartoon art renders and SFX plays, finish a game to confirm win/loss/draw stats still persist and display correctly
- [x] 4.3 Confirm `src/game.js` line count dropped by roughly the size of the three extracted blocks (~300 lines) via `wc -l src/game.js`
