## Context

See proposal.md for motivation. Relevant current state:

- Every ending path (`finishAction()`'s win/draw branches, `resign()`) calls `showResult(winner)` exactly once per finished game, with `winner ∈ {"wolf","sheep","draw"}`. Nothing else in `GameScene` reads or writes that value.
- `showResult()` currently does one job: draw the end-game overlay (dim background rect + result text + "再来一局" button), pushing each object into `this.overlayObjects`. `resetGame()` is the only place that tears `overlayObjects` down today, and it does so as part of a full board reset — there is no existing "close the overlay without resetting the game" operation.
- `this.activeMode ∈ {"wolf","sheep","2p"}` and `this.difficulty ∈ {"easy","medium","hard"}` are both live instance fields at the moment a game ends. `this.difficulty` is stored even in `"2p"` mode but never read by anything (the AI is never invoked), so it carries no real information there.
- The landscape/portrait button-matching technique (`_measureTextWidth` + per-button `letterSpacing` + `setFixedSize`) already exists for the restart/resign pair (from `mobile-responsive-layout`) and generalizes to three buttons without changes to the technique itself.
- The project has never used `localStorage` before this change.

## Goals / Non-Goals

**Goals:**
- Recording a result is exactly as safe to call as it is today — one hook, no new call sites in `finishAction`/`resign`.
- Opening the stats panel, from either entry point, never stacks a second overlay on top of the first.
- Closing the stats panel always lands the player back where they'd expect: on the result screen if a game just ended, on the live board otherwise.

**Non-Goals:**
- Any UI for viewing stats history over time (a chart, a trend) — just current totals per bucket.
- Syncing stats across devices/browsers — `localStorage` is inherently per-browser, and that's accepted as-is.
- Migrating or preserving stats if the storage schema changes later — see Decision 4.

## Decisions

### 1. Recording is guarded by a per-game flag, not moved out of `showResult`

The stats panel's "返回" (back) button, when opened from inside the end-game overlay, needs to redraw the same result content — the natural way to do that is to call `this.showResult(winner)` again (the `winner` value is already sitting in the closure that built that button). But if `showResult()` unconditionally records a result every time it runs, that second call would double-count the same game.

Decision: split concerns inside `showResult()`. Add `this._resultRecorded = false` to per-game state (initialized in `create()` and `resetGame()`, right next to `this.positionHistory = new Map()`). At the top of `showResult(winner)`:

```js
if (!this._resultRecorded) {
  this._resultRecorded = true;
  this._recordResult(winner);
}
```

`_recordResult()` does the actual bucket lookup and `localStorage` write (Decision 3). The rest of `showResult()` — drawing the overlay content — runs every time, recording or not. This keeps the proposal's "one hook" property (`finishAction`/`resign` are untouched) while making `showResult()` idempotent with respect to recording, safe to call as many times as the UI needs to re-render it.

Alternative considered: move the recording call out to the three call sites (two in `finishAction`, one in `resign`) instead of flag-guarding `showResult` itself. Rejected — three call sites to keep in sync is strictly worse than one self-guarding function, and the flag is a two-line addition.

### 2. Single-overlay content replacement, not a real overlay stack

`this.overlayObjects` stays a flat array of destroyable objects — no new "stack" data structure. A new `_clearOverlayContent()` helper destroys everything currently in it and empties the array, without touching board/game state (unlike `resetGame()`, which does much more). Both `showResult()` and the new `_showStatsPanel()` start by calling `_clearOverlayContent()`, then push their own objects into the now-empty array. This means:

- Opening stats from the persistent button (no existing overlay): clears an empty array (no-op), draws the panel.
- Opening stats from inside the result overlay: clears the result content, draws the panel in its place.
- "返回"/"关闭" clears the panel content and draws whatever the close callback decides (Decision 3a below).

No second dim background, no coordinate collisions, no new concept beyond "one replaceable overlay region" — which is what already existed, just not yet factored out as its own step.

### 3a. The persistent button's close callback is context-sensitive

A subtlety the proposal's description glosses over: the *persistent* "战绩" button (sidebar/top-band) is reachable even while a result overlay is already showing, because sidebar/top-band buttons are never gated by `overlayObjects.length > 0` (only board clicks are, via `onPointerDown`'s existing guard). So a player can click the persistent stats button while "羊方获胜！" is still up. If its close callback always just cleared the overlay (`_clearOverlayContent()`), closing the panel in that situation would silently drop the result screen — the game is technically still over (nothing calls `nextTurn()` past a win), but the player loses the "再来一局" button and has to know to use the sidebar's own restart instead. Not broken, but a rough edge worth avoiding for a two-line fix.

Decision: track `this._resultOverlayWinner` (the last `winner` a result screen was drawn for, `null` when no result is showing — reset in `create()`/`resetGame()`, and cleared back to `null` inside `_clearOverlayContent()` only when the caller confirms it's tearing down a *result*, not a panel — see implementation note in tasks). The persistent button computes its close callback at click time:

```js
const onClose = this._resultOverlayWinner != null
  ? () => this.showResult(this._resultOverlayWinner)
  : () => this._clearOverlayContent();
this._showStatsPanel(onClose);
```

The in-overlay shortcut button doesn't need this branch — it already knows `winner` from its own closure.

### 3b. Stats panel content

One table, one row per bucket, always all 7 rows rendered together (no per-mode filtering/tabs): `wolf|easy`, `wolf|medium`, `wolf|hard`, `sheep|easy`, `sheep|medium`, `sheep|hard`, `2p`. Columns: 狼胜 / 羊胜 / 平局. This is 3×3 for the two AI-opponent modes (**not** 3×3 for all three modes — `2p` doesn't have a difficulty axis, so it contributes exactly one row, not three). A "清空战绩" button clears the `localStorage` key and redraws the same panel with all buckets back at zero — it does not close the panel, so the player sees the table actually go to zero rather than having to reopen it to confirm.

### 4. Storage shape and key

```js
const STATS_STORAGE_KEY = "wolf-sheep:stats:v1";
// { [bucketKey]: { wolfWins: number, sheepWins: number, draws: number } }

function statsBucketKey(mode, difficulty) {
  return mode === "2p" ? "2p" : `${mode}|${difficulty}`;
}
```

The `:v1` suffix is there so a future incompatible schema change can move to `:v2` and simply leave old data orphaned under the old key, rather than needing a migration — acceptable because this is low-stakes local data (win/loss counts), not something worth building migration machinery for. A read that finds no key (first run) or fails to parse (corrupted/edited-by-hand) is treated as "all buckets empty," not an error — `localStorage` access itself is wrapped so a disabled/unavailable `localStorage` (private browsing edge cases, though rare in practice for a same-origin key like this) degrades to "stats just don't persist" rather than throwing and breaking the button.

### 5. Button width-matching generalizes to three buttons

The existing pattern (measure each label's bare glyph width, stretch the shorter ones via `letterSpacing` to match the widest, then `setFixedSize` all of them to the same box) already generalizes from two buttons to three without changing the technique — the target width is just `max(width("重新开始"), width("战绩"), width("认输"))`, which in practice is `width("重新开始")` since it's the longest label, same as it already is today. Landscape's vertical stack doesn't need the letter-spacing trick at all (it's a difference of visual rhythm, not text-glyph alignment) — it just needs the third button included in the same `Math.max(...)`/`setFixedSize(...)` pair the existing two already go through.

## Risks / Trade-offs

- **`localStorage` write on every game end is a synchronous main-thread call** → Negligible in practice (a few bytes, once per finished game, not per frame); no mitigation needed.
- **A player could edit `localStorage` by hand to inflate their record** → Accepted; this is a local, single-player vanity stat with no competitive stakes, not worth defending against.
- **Corrupted/malformed stored JSON** → Treated as empty stats on read (Decision 4), never thrown as an error toward the UI.
- **The `_resultOverlayWinner` tracking (Decision 3a) is one more piece of per-game state to keep in sync with `overlayObjects`** → Mitigation: it's only ever set in one place (inside `showResult`, when it actually draws result content) and only ever cleared alongside a genuine result-teardown, not a panel-teardown — call sites are enumerated explicitly in tasks.md rather than left to be inferred during implementation.

## Migration Plan

Additive change to `GameScene` only; no data migration (nothing existed to migrate). Rollback is `git revert` — the only persistent artifact this change creates is the `wolf-sheep:stats:v1` `localStorage` key, which simply stops being read or written if reverted, with no cleanup required.
