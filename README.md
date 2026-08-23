# 狼吃羊 (Wolf Eats Sheep)

一款传统中国民间棋盘游戏的数字复现，基于 [Phaser 4](https://phaser.io/) + [Vite](https://vitejs.dev/) 实现，纯前端、无后端、无需网络。

A digital recreation of the traditional Chinese folk board game "Wolf Eats Sheep" (狼吃羊), built with [Phaser 4](https://phaser.io/) + [Vite](https://vitejs.dev/). Pure front-end, no backend, no network required.

在线仓库 / Repository: <https://github.com/zhanglongqi/wolf-sheep>

---

## 游戏规则 · Rules

**棋盘 · Board** — 5×5 方格棋盘，横纵连线（无对角线）。3 只狼初始位于第 0 行（第 0/2/4 列），15 只羊初始占据第 2~4 行。

A 5×5 grid board with horizontal/vertical connections only (no diagonals). 3 wolves start on row 0 (columns 0, 2, 4); 15 sheep start filling rows 2–4.

| 规则 Rule | 说明 Description |
|---|---|
| 狼方移步 Wolf step | 沿连线走到紧邻的空位 / Move to an adjacent empty node |
| 狼方跳吃 Wolf capture | 隔一只相邻的羊跳到其背后的空位，羊被吃掉；只能跳一次，不能连续多跳 / Jump over one adjacent sheep to the empty node directly behind it; the sheep is removed. Only a single jump per turn, no chain captures |
| 堵死机制 Blocking | 若狼相邻的羊背后没有空位（越界或被占），该方向对狼完全封死，既不能移步也不能跳吃 / If the node behind an adjacent sheep is occupied or off the board, that direction is fully sealed — the wolf can neither step nor capture that way |
| 羊方移步 Sheep step | 每回合选一只羊走到紧邻空位 / Each turn, move one sheep to an adjacent empty node |
| 狼方获胜 Wolf wins | 所有羊被吃光 / All sheep have been captured |
| 羊方获胜 Sheep wins | 所有狼同时无任何合法操作（无法移步也无法跳吃）/ Every wolf simultaneously has zero legal moves or captures |
| 平局 Draw | 完全相同的局面（棋子布局 + 该谁走）连续出现 5 次，判和棋，避免无限重复 / The exact same position (piece layout + side to move) recurs 5 times, declared a draw to prevent infinite repetition |

狼方先走，之后双方交替。

Wolves always move first; the two sides then alternate turns.

## 玩法模式 · Game Modes

| 模式 Mode | 狼方 Wolf | 羊方 Sheep |
|---|---|---|
| 玩家执狼 Play as Wolf | 玩家 Human | AI |
| 玩家执羊 Play as Sheep | AI | 玩家 Human |
| 双人对战 Two Player | 玩家 1 Player 1 | 玩家 2 Player 2（同设备轮流 / same device, alternating turns）|

点击底部「⚙ 设置」可随时切换模式、AI 难度，并重新开局。

Click "⚙ 设置" (Settings) at any time to change the mode, AI difficulty, and restart.

### AI 难度 · AI Difficulty

三档难度分别应用在当前由 AI 控制的一方：

Three difficulty tiers, applied to whichever side is currently AI-controlled:

- **简单 Easy** — 在所有合法操作中随机选择，不刻意抓吃机会，也不避险 / Picks uniformly at random among all legal actions — doesn't prioritize captures or avoid danger.
- **普通 Medium**（默认 default）— 狼：有吃必吃，否则随机移步；羊：随机行动，但会避开走一步就会被下一手吃掉的位置（有安全选项时）/ Wolf always takes a free capture if one exists, otherwise steps randomly. Sheep moves randomly but avoids any move that would be immediately capturable next turn, when a safer option exists.
- **困难 Hard** — 单步前瞻：把每个候选动作在克隆棋盘上模拟一遍再打分；狼倾向选择能带来更多后续吃子机会/机动性的走法，羊倾向选择能压缩狼方合法操作总数的走法 / 1-ply lookahead — every candidate action is simulated on a cloned board and scored. The wolf favors moves that open up more future captures/mobility; the sheep favors moves that shrink the wolves' total legal actions (actively trying to trap them).

## 界面功能 · UI Features

- 点击己方棋子高亮合法目标：蓝色 = 可移步，橙色 = 可跳吃落点，红色描边 = 被吃的羊 / Click your piece to highlight legal targets: blue = step, orange = capture landing, red outline = the sheep that would be captured.
- 棋子移动 / 跳吃动画，以及箭头标记最近一步棋（一直显示到下一步棋走完）/ Move/capture animations, plus a persistent arrow marking the most recent move (stays visible until the next move replaces it).
- 合成音效（Web Audio API 实时生成，无需音频文件）：狼步、羊步、吃子、放置、棋子无法行动时的提示音，均各不相同 / Synthesized sound effects (generated live via the Web Audio API, no audio files needed) — distinct tones for wolf steps, sheep steps, captures, placements, and a "denied" cue when a piece has no legal action.
- 「认输」按钮：单人模式下玩家一方认输，对方获胜；双人模式下当前操作方认输 / "认输" (Resign) button: in single-player modes the human side resigns and the opponent wins; in two-player mode, whichever side currently has the turn resigns.
- 「重新开始」随时重置棋盘 / "重新开始" (Restart) resets the board at any time.

## 本地运行 · Getting Started

```bash
npm install
npm run dev
```

打开终端输出的本地地址（默认 <http://localhost:5173>）即可开始游戏。

Open the local URL printed in the terminal (default <http://localhost:5173>) to start playing.

### 构建生产版本 · Production Build

```bash
npm run build    # 输出到 dist/ 目录 / outputs to dist/
npm run preview  # 本地预览构建结果 / preview the production build locally
```

## 技术栈 · Tech Stack

- [Phaser 4](https://phaser.io/) — 游戏渲染与场景管理 / rendering and scene management
- [Vite](https://vitejs.dev/) — 开发服务器与构建工具 / dev server and build tool
- 全部游戏逻辑（棋盘引擎、AI、渲染、交互）集中在单文件 `src/game.js` 中 / All game logic (board engine, AI, rendering, interaction) lives in the single file `src/game.js`

## 项目结构 · Project Structure

```
src/
  game.js       # 棋盘配置、规则引擎、AI、Phaser 场景 / board config, rules engine, AI, Phaser scene
  style.css     # 页面样式 / page styles
index.html      # 入口页面 / entry page
```
