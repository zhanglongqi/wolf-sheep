# Backlog

Ideas surfaced during `/opsx:explore` sessions, parked until picked up. Not
OpenSpec changes yet — promote an item to `openspec/changes/<name>/` when
someone's ready to scope it.

## 传统棋盘（19 节点 / 对角线拓扑）

`BOARD_CONFIGS.traditional` existed once (commit `92088af`) and was removed in
`b9427a9` because the diagonal adjacency was wrong and not worth patching.
[REQUIREMENTS.md](../REQUIREMENTS.md) §02/§07 still has the full corrected
node layout + adjacency spec (TL↔MC, TC↔ML, TC↔MR, …) — this is a redo, not a
from-scratch design. `Board.placeSheep()` and the placement-phase flag already
exist in the engine and just need a config with `sheepReserve > 0` to exercise
them.

## 步数 / 最快获胜统计

Deferred out of `game-stats` (archived at
`openspec/changes/archive/2026-08-29-game-stats/`; `mode+difficulty`
win/loss/draw counts, plus a stats panel and end-game-overlay shortcut) —
that one only tracks win/loss/draw. This would add a per-game move counter
and a "fastest win"
record on top of it. Needs new instrumentation `game.js` doesn't have yet: a
move counter wired into `executeAction`/`executeAITurn`, and a start
timestamp set in `create()`/`resetGame()`. Open question carried over from
that exploration: rank "fastest" by move count (clean, immune to the player
tabbing away) or wall-clock time (more intuitive, noisier)?

## 视听打磨

Mute/volume toggle for the synthesized SFX (currently no way to silence it).
End-game overlay could borrow the squash/spin/poof technique from the
capture-death animation for a bit more ceremony on a win/loss.
