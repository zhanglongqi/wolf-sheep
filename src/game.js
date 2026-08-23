import Phaser from "phaser";

// ─── Sound Effects ────────────────────────────────────────────────────────────

// Synthesized via Web Audio API — no external audio assets required.
// AudioContext starts suspended until resumed inside a user-gesture call stack,
// which _ensureCtx() does on every call (cheap no-op once already running).
class SFX {
  constructor() {
    this.ctx = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  _tone({ freq, startFreq, endFreq, duration, type = "sine", gain = 0.15, delay = 0 }) {
    const ctx = this._ensureCtx();
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    if (startFreq != null && endFreq != null) {
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    } else {
      osc.frequency.setValueAtTime(freq, now);
    }
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Sheep step — light, bright blip
  sheepStep() {
    this._tone({ freq: 520, duration: 0.08, type: "sine", gain: 0.12 });
  }

  // Wolf step — lower, heavier blip so it reads as a different piece type
  wolfStep() {
    this._tone({ freq: 220, duration: 0.09, type: "triangle", gain: 0.14 });
  }

  // Sheep placement — light pop, slightly higher than a sheep step
  place() {
    this._tone({ freq: 660, duration: 0.07, type: "sine", gain: 0.1 });
  }

  // Wolf capture — descending growl
  capture() {
    this._tone({ startFreq: 320, endFreq: 90, duration: 0.18, type: "sawtooth", gain: 0.09 });
  }

  // Piece has no legal action (e.g. a blocked wolf) — low double-buzz "denied" cue
  stuck() {
    this._tone({ freq: 160, duration: 0.07, type: "square", gain: 0.1 });
    this._tone({ freq: 130, duration: 0.09, type: "square", gain: 0.1, delay: 0.08 });
  }
}

// ─── Board Configurations ─────────────────────────────────────────────────────

// Task 1.1: grid5x5 — 25 nodes in "col,row" format, horizontal/vertical adjacency only
const _grid5x5Nodes = (() => {
  const nodes = {};
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      nodes[`${col},${row}`] = { x: 100 + col * 150, y: 100 + row * 150 };
    }
  }
  return nodes;
})();

const _grid5x5Adjacency = (() => {
  const adj = {};
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const id = `${col},${row}`;
      adj[id] = [];
      if (col > 0) adj[id].push(`${col - 1},${row}`);
      if (col < 4) adj[id].push(`${col + 1},${row}`);
      if (row > 0) adj[id].push(`${col},${row - 1}`);
      if (row < 4) adj[id].push(`${col},${row + 1}`);
    }
  }
  return adj;
})();

const BOARD_CONFIGS = {
  // Task 1.1 & 1.4
  grid5x5: {
    nodes: _grid5x5Nodes,
    adjacency: _grid5x5Adjacency,
    wolfStart: ["0,0", "2,0", "4,0"],
    sheepStart: [
      "0,2", "1,2", "2,2", "3,2", "4,2",
      "0,3", "1,3", "2,3", "3,3", "4,3",
      "0,4", "1,4", "2,4", "3,4", "4,4",
    ],
    sheepReserve: 0,
  },
};

// Task 1.5: Startup assertion — adjacency map must be symmetric
function assertAdjacencySymmetry(config, name) {
  const { adjacency } = config;
  for (const [a, neighbors] of Object.entries(adjacency)) {
    for (const b of neighbors) {
      if (!adjacency[b] || !adjacency[b].includes(a)) {
        throw new Error(
          `[${name}] Adjacency asymmetry: ${a} lists ${b} as neighbor but ${b} does not list ${a}`
        );
      }
    }
  }
}

assertAdjacencySymmetry(BOARD_CONFIGS.grid5x5, "grid5x5");

// ─── Data types ───────────────────────────────────────────────────────────────

// Piece: represents a single wolf or sheep on the board
class Piece {
  constructor(type, nodeId) {
    this.type = type;       // 'wolf' | 'sheep'
    this.nodeId = nodeId;
    this.alive = true;
    this.graphics = null;   // Phaser Graphics reference, set by GameScene
  }
}

// ─── Board Engine ─────────────────────────────────────────────────────────────

class Board {
  // Task 2.1: constructor
  constructor(config) {
    this.config = config;
    this.wolves = [];
    this.sheep = [];
    this.occupancy = {};           // nodeId → Piece | null
    this.sheepReserve = config.sheepReserve;
    this.placingPhase = config.sheepReserve > 0;

    for (const nodeId of Object.keys(config.nodes)) {
      this.occupancy[nodeId] = null;
    }
    for (const nodeId of config.wolfStart) {
      const p = new Piece("wolf", nodeId);
      this.wolves.push(p);
      this.occupancy[nodeId] = p;
    }
    for (const nodeId of config.sheepStart) {
      const p = new Piece("sheep", nodeId);
      this.sheep.push(p);
      this.occupancy[nodeId] = p;
    }
  }

  // Task 2.2
  isEmpty(nodeId) {
    return this.occupancy[nodeId] === null;
  }

  pieceAt(nodeId) {
    return this.occupancy[nodeId];
  }

  // Task 2.3: valid wolf steps — empty neighbors only
  // The blocking rule is naturally satisfied: wolf can't step to a sheep-occupied
  // node, and can't capture without an empty landing (handled in getValidEats).
  getValidMoves(wolf) {
    return this.config.adjacency[wolf.nodeId].filter(nId => this.isEmpty(nId));
  }

  // Task 2.4: collinear node lookup
  // Given wolf at A and neighbor B, return the node C that is the neighbor of B
  // continuing in the same direction (A→B→C), or null if none exists.
  _collinearNode(aId, bId) {
    const a = this.config.nodes[aId];
    const b = this.config.nodes[bId];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const targetX = b.x + dx;
    const targetY = b.y + dy;
    for (const cId of this.config.adjacency[bId]) {
      if (cId === aId) continue;
      const c = this.config.nodes[cId];
      if (c.x === targetX && c.y === targetY) return cId;
    }
    return null;
  }

  // Task 2.5: valid wolf captures
  getValidEats(wolf) {
    const result = [];
    for (const bId of this.config.adjacency[wolf.nodeId]) {
      const bp = this.occupancy[bId];
      if (!bp || bp.type !== "sheep" || !bp.alive) continue;
      const cId = this._collinearNode(wolf.nodeId, bId);
      if (cId && this.isEmpty(cId)) {
        result.push({ landAt: cId, remove: bId });
      }
    }
    return result;
  }

  // Task 2.6: valid sheep steps — empty neighbors
  getValidSheepMoves(sheep) {
    return this.config.adjacency[sheep.nodeId].filter(nId => this.isEmpty(nId));
  }

  // Task 2.7: move piece to nodeId
  move(piece, nodeId) {
    this.occupancy[piece.nodeId] = null;
    piece.nodeId = nodeId;
    this.occupancy[nodeId] = piece;
  }

  // Task 2.8: wolf jump-capture
  // Find the sheep node B between wolf (A) and landId (C), then remove it.
  eat(wolf, landId) {
    let sheepId = null;
    for (const bId of this.config.adjacency[wolf.nodeId]) {
      if (this._collinearNode(wolf.nodeId, bId) === landId) {
        sheepId = bId;
        break;
      }
    }
    const captured = this.occupancy[sheepId];
    captured.alive = false;
    this.occupancy[sheepId] = null;
    this.occupancy[wolf.nodeId] = null;
    wolf.nodeId = landId;
    this.occupancy[landId] = wolf;
    return captured;
  }

  // Task 2.9: place a reserve sheep at nodeId
  placeSheep(nodeId) {
    if (!this.isEmpty(nodeId) || this.sheepReserve <= 0) return null;
    const p = new Piece("sheep", nodeId);
    this.sheep.push(p);
    this.occupancy[nodeId] = p;
    this.sheepReserve--;
    if (this.sheepReserve === 0) this.placingPhase = false;
    return p;
  }

  // Task 2.10: check win condition
  // Wolf wins when all on-board sheep are gone AND no reserve remains.
  // Sheep wins when every wolf has zero legal moves AND zero captures.
  checkWin() {
    const aliveSheep = this.sheep.filter(s => s.alive);
    if (aliveSheep.length === 0 && this.sheepReserve === 0) return "wolf";

    const allImmobile = this.wolves.every(
      w => this.getValidMoves(w).length === 0 && this.getValidEats(w).length === 0
    );
    if (allImmobile) return "sheep";

    return null;
  }
}

// ─── AI Player ────────────────────────────────────────────────────────────────

// Three difficulty tiers, applied independently to whichever side(s) the AI
// controls:
//   easy   — a uniform-random legal action; no preference for captures or safety.
//   medium — wolf: current baseline behavior (always capture if possible, else
//            random step). sheep: random, but avoids moves/placements that let
//            a wolf capture that sheep on its very next turn, when a safer
//            option exists (pure self-preservation, no active planning).
//   hard   — 1-ply lookahead: every candidate action is simulated on a cloned
//            board and scored by a small heuristic, then the AI plays the
//            best-scoring action (ties broken at random so it isn't fully
//            deterministic).
class AIPlayer {
  constructor(difficulty = "medium") {
    this.difficulty = difficulty; // 'easy' | 'medium' | 'hard'
  }

  // Deep-enough clone for 1-ply simulation: copies piece state and occupancy
  // onto a fresh Board instance without re-running the constructor (which
  // would reset pieces to their starting positions instead of the current ones).
  _cloneBoard(board) {
    const clone = Object.create(Board.prototype);
    clone.config = board.config;
    clone.sheepReserve = board.sheepReserve;
    clone.placingPhase = board.placingPhase;
    clone.wolves = board.wolves.map(w => ({ type: w.type, nodeId: w.nodeId, alive: w.alive, graphics: null }));
    clone.sheep = board.sheep.map(s => ({ type: s.type, nodeId: s.nodeId, alive: s.alive, graphics: null }));
    clone.occupancy = {};
    for (const nodeId of Object.keys(board.config.nodes)) {
      const orig = board.occupancy[nodeId];
      if (!orig) { clone.occupancy[nodeId] = null; continue; }
      const idx = orig.type === "wolf" ? board.wolves.indexOf(orig) : board.sheep.indexOf(orig);
      clone.occupancy[nodeId] = orig.type === "wolf" ? clone.wolves[idx] : clone.sheep[idx];
    }
    return clone;
  }

  // Score every candidate, return one of the top-scoring actions at random.
  _bestByScore(candidates, scoreFn) {
    let best = [];
    let bestScore = -Infinity;
    for (const action of candidates) {
      const s = scoreFn(action);
      if (s > bestScore) { bestScore = s; best = [action]; }
      else if (s === bestScore) { best.push(action); }
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  // Simulates a wolf action and scores the resulting position: captures are
  // always worth taking; beyond that, prefer positions that keep/create more
  // future capture threats and step options, and that leave fewer sheep alive.
  _scoreWolfAction(board, action) {
    const clone = this._cloneBoard(board);
    const cloneWolf = clone.wolves[board.wolves.indexOf(action.wolf)];
    if (action.type === "eat") clone.eat(cloneWolf, action.nodeId);
    else clone.move(cloneWolf, action.nodeId);

    let score = action.type === "eat" ? 1000 : 0;
    for (const w of clone.wolves) {
      score += clone.getValidEats(w).length * 30;
      score += clone.getValidMoves(w).length * 2;
    }
    score -= clone.sheep.filter(s => s.alive).length * 5;
    return score;
  }

  // Simulates a sheep action (step or placement) and scores it: reducing the
  // total legal actions available to wolves is good (that's the trapping
  // goal); landing somewhere a wolf could capture next turn is heavily
  // penalized.
  _scoreSheepAction(board, action) {
    const clone = this._cloneBoard(board);
    if (action.type === "place") {
      clone.placeSheep(action.nodeId);
    } else {
      clone.move(clone.sheep[board.sheep.indexOf(action.sheep)], action.nodeId);
    }

    let score = 0;
    for (const w of clone.wolves) {
      score -= (clone.getValidMoves(w).length + clone.getValidEats(w).length) * 10;
      for (const { remove } of clone.getValidEats(w)) {
        if (remove === action.nodeId) score -= 500;
      }
    }
    return score;
  }

  // Task 3.1: wolf AI — behavior depends on this.difficulty.
  // Returns {type:'eat'|'step', wolf, nodeId, removeId?} or null if no legal move.
  makeWolfMove(board) {
    const allCaptures = [];
    for (const wolf of board.wolves) {
      for (const { landAt, remove } of board.getValidEats(wolf)) {
        allCaptures.push({ type: "eat", wolf, nodeId: landAt, removeId: remove });
      }
    }
    const allSteps = [];
    for (const wolf of board.wolves) {
      for (const nodeId of board.getValidMoves(wolf)) {
        allSteps.push({ type: "step", wolf, nodeId });
      }
    }
    const allActions = [...allCaptures, ...allSteps];
    if (allActions.length === 0) return null;

    if (this.difficulty === "easy") {
      return allActions[Math.floor(Math.random() * allActions.length)];
    }

    if (this.difficulty === "hard") {
      return this._bestByScore(allActions, action => this._scoreWolfAction(board, action));
    }

    // medium (default): always capture if possible, else random step.
    if (allCaptures.length > 0) {
      return allCaptures[Math.floor(Math.random() * allCaptures.length)];
    }
    return allSteps[Math.floor(Math.random() * allSteps.length)];
  }

  // Task 3.2: sheep AI — behavior depends on this.difficulty.
  // Returns {type:'place'|'step', sheep, nodeId} or null if no legal move.
  makeSheepMove(board) {
    if (board.placingPhase) {
      const empty = Object.keys(board.config.nodes).filter(id => board.isEmpty(id));
      if (empty.length === 0) return null;
      const candidates = empty.map(nodeId => ({ type: "place", sheep: null, nodeId }));
      return this._pickSheepAction(board, candidates);
    }

    const movable = board.sheep
      .filter(s => s.alive)
      .map(s => ({ sheep: s, moves: board.getValidSheepMoves(s) }))
      .filter(({ moves }) => moves.length > 0);
    if (movable.length === 0) return null;

    const candidates = [];
    for (const { sheep, moves } of movable) {
      for (const nodeId of moves) candidates.push({ type: "step", sheep, nodeId });
    }
    return this._pickSheepAction(board, candidates);
  }

  // Shared by placement and movement: pick among a candidate list per difficulty.
  _pickSheepAction(board, candidates) {
    if (this.difficulty === "easy") {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (this.difficulty === "hard") {
      return this._bestByScore(candidates, action => this._scoreSheepAction(board, action));
    }

    // medium: random among actions that don't hand a wolf an immediate
    // capture next turn, falling back to any action if none are safe.
    const safe = candidates.filter(action => this._scoreSheepAction(board, action) > -500);
    const pool = safe.length > 0 ? safe : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// ─── Phaser Scene ─────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  // Task 4.2: initialize board and kick off rendering
  create() {
    // Phaser Text objects render their own internal canvas texture at
    // resolution 1 by default, which looks blurry once the browser upscales
    // it on a HiDPI/Retina screen — and even on a standard 1x screen, a
    // higher internal resolution supersamples the glyphs to noticeably
    // crisper edges. This game has no top-level GameConfig resolution
    // option, so instead every `this.add.text(...)` call in this scene is
    // patched to default to at least 2x, or the display's real pixel
    // density if that's higher.
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    const originalText = this.add.text.bind(this.add);
    // Centering a text object (setOrigin(0.5), used by every button in this
    // game) shifts its rendered top-left corner by half its width/height —
    // a fractional pixel whenever that's an odd number. The renderer then
    // has to blend between pixels to draw it, which reads as blur no matter
    // how high the texture resolution is. Snapping the origin-adjusted
    // position back to a whole pixel (immediately, and again whenever
    // setOrigin is called later) fixes it without touching every call site.
    const snapToPixel = (t) => {
      t.x = Math.round(t.x - t.displayOriginX) + t.displayOriginX;
      t.y = Math.round(t.y - t.displayOriginY) + t.displayOriginY;
    };
    this.add.text = (x, y, text, style) => {
      const t = originalText(x, y, text, { resolution: dpr, ...style });
      const originalSetOrigin = t.setOrigin.bind(t);
      t.setOrigin = (...args) => {
        originalSetOrigin(...args);
        snapToPixel(t);
        return t;
      };
      snapToPixel(t);
      return t;
    };

    this.activeBoardConfig = BOARD_CONFIGS.grid5x5;
    this.activeMode = "wolf";   // 'wolf' | 'sheep' | '2p'
    this.difficulty = "medium"; // 'easy' | 'medium' | 'hard'
    this.activeSide = "wolf";   // wolves always move first
    this.animating = false;
    this.selected = null;
    this.highlights = [];
    this.overlayObjects = [];
    this.lastMoveGraphics = null;
    this.positionHistory = new Map();
    this.ai = new AIPlayer(this.difficulty);
    this.sfx = new SFX();
    this.hudObjects = {};

    this.board = new Board(this.activeBoardConfig);
    this.drawBoard();
    this.drawPieces();

    // Task 5.1 — register pointer input (handler implemented in task 5)
    this.input.on("pointerdown", this.onPointerDown, this);

    // Task 8.1 — HUD init stub (implemented in task 8)
    this._initHUD();

    // Task 4.6 — set initial opacity for active side
    this.updateOpacity();

    // Task 11.1 — restart button stub (implemented in task 11)
    this._initRestartButton();

    // Schedule AI if the starting side is AI-controlled
    const isAIFirst =
      (this.activeMode === "wolf"  && this.activeSide === "sheep") ||
      (this.activeMode === "sheep" && this.activeSide === "wolf");
    if (isAIFirst) {
      this.time.delayedCall(400, this.executeAITurn, [], this);
    }
  }

  // Task 4.3: draw board edges — each adjacency pair drawn once
  drawBoard() {
    const { adjacency, nodes } = this.board.config;
    const g = this.add.graphics();
    g.lineStyle(2, 0xaaaaaa, 0.8);
    const drawn = new Set();
    for (const [aId, neighbors] of Object.entries(adjacency)) {
      for (const bId of neighbors) {
        const key = [aId, bId].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = nodes[aId], b = nodes[bId];
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    this.boardGraphics = g;
  }

  // Task 4.4: draw all pieces as circles; store Graphics ref on each piece
  drawPieces() {
    for (const piece of [...this.board.wolves, ...this.board.sheep]) {
      if (!piece.alive) continue;
      const pos = this.board.config.nodes[piece.nodeId];
      const g = this.add.graphics();
      g.setPosition(pos.x, pos.y);
      this._drawPieceShape(g, piece);
      piece.graphics = g;
    }
  }

  // Shared: clear and fill the circle for a piece on its Graphics object
  _drawPieceShape(g, piece) {
    g.clear();
    if (piece.type === "wolf") {
      g.fillStyle(0xff4444, 1);
      g.fillCircle(0, 0, 18);
    } else {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, 14);
    }
  }

  // Task 4.5: move Graphics to current node position and redraw shape
  redrawPiece(piece) {
    const pos = this.board.config.nodes[piece.nodeId];
    piece.graphics.setPosition(pos.x, pos.y);
    this._drawPieceShape(piece.graphics, piece);
  }

  // Task 4.6: dim pieces on the active side that have no legal actions
  updateOpacity() {
    if (this.activeSide === "wolf") {
      for (const wolf of this.board.wolves) {
        const active =
          this.board.getValidMoves(wolf).length > 0 ||
          this.board.getValidEats(wolf).length > 0;
        wolf.graphics.setAlpha(active ? 1.0 : 0.4);
      }
      // Opponent pieces always full opacity when not their turn
      for (const s of this.board.sheep) {
        if (s.alive && s.graphics) s.graphics.setAlpha(1.0);
      }
    } else {
      for (const wolf of this.board.wolves) {
        wolf.graphics.setAlpha(1.0);
      }
      // During placing phase every node is a candidate — no dimming
      if (!this.board.placingPhase) {
        for (const s of this.board.sheep.filter(sh => sh.alive)) {
          const active = this.board.getValidSheepMoves(s).length > 0;
          if (s.graphics) s.graphics.setAlpha(active ? 1.0 : 0.4);
        }
      } else {
        for (const s of this.board.sheep.filter(sh => sh.alive)) {
          if (s.graphics) s.graphics.setAlpha(1.0);
        }
      }
    }
  }

  // ─── Task 5.2: route pointer events ──────────────────────────────────────

  onPointerDown(pointer) {
    if (this.animating || this.overlayObjects.length > 0) return;

    const isHumanTurn =
      this.activeMode === "2p" ||
      (this.activeMode === "wolf" && this.activeSide === "wolf") ||
      (this.activeMode === "sheep" && this.activeSide === "sheep");
    if (!isHumanTurn) return;

    // Task 6.1: sheep placing phase — click on empty node to place a reserve sheep
    if (this.activeSide === "sheep" && this.board.placingPhase) {
      const nodeId = this._hitNode(pointer);
      if (nodeId && this.board.isEmpty(nodeId)) {
        const placed = this.board.placeSheep(nodeId);
        if (placed) {
          const pos = this.board.config.nodes[nodeId];
          const g = this.add.graphics();
          g.setPosition(pos.x, pos.y);
          this._drawPieceShape(g, placed);
          placed.graphics = g;
          this.sfx.place();
          this._drawLastMoveMarker(null, pos);
          this.clearHighlights();
          this.finishAction();
        }
      }
      return;
    }

    const clickedPiece = this._hitPiece(pointer);
    const clickedNode  = this._hitNode(pointer);

    if (this.selected) {
      // Click on a valid action target → execute
      if (clickedNode && this._isValidTarget(this.selected, clickedNode)) {
        this.executeAction(clickedNode);
        return;
      }
      // Click on another own piece → reselect (or signal it's stuck)
      if (clickedPiece && clickedPiece.type === this.activeSide) {
        if (this._hasAction(clickedPiece)) this.selectPiece(clickedPiece);
        else this.sfx.stuck();
        return;
      }
      // Anything else → deselect
      this.clearHighlights();
      this.selected = null;
      return;
    }

    // No selection yet — select a piece that has legal actions
    if (clickedPiece && clickedPiece.type === this.activeSide) {
      if (this._hasAction(clickedPiece)) this.selectPiece(clickedPiece);
      else this.sfx.stuck();
    }
  }

  // Whether a piece currently has any legal action (step, or capture for wolves)
  _hasAction(piece) {
    return piece.type === "wolf"
      ? this.board.getValidMoves(piece).length > 0 || this.board.getValidEats(piece).length > 0
      : this.board.getValidSheepMoves(piece).length > 0;
  }

  // Task 5.3
  selectPiece(piece) {
    this.selected = piece;
    this.drawHighlights();
  }

  // Task 5.4: selection ring + move/capture hints
  drawHighlights() {
    this.clearHighlights();
    const piece = this.selected;
    if (!piece) return;
    const nodes = this.board.config.nodes;

    // White ring around selected piece
    const selPos = nodes[piece.nodeId];
    const selRing = this.add.graphics();
    selRing.lineStyle(3, 0xffffff, 1.0);
    selRing.strokeCircle(selPos.x, selPos.y, piece.type === "wolf" ? 24 : 20);
    this.highlights.push(selRing);

    if (piece.type === "wolf") {
      // Blue dots on valid step targets
      for (const nodeId of this.board.getValidMoves(piece)) {
        const pos = nodes[nodeId];
        const g = this.add.graphics();
        g.fillStyle(0x4488ff, 0.5);
        g.fillCircle(pos.x, pos.y, 12);
        this.highlights.push(g);
      }
      // Orange dots on capture landings + red rings on would-be-captured sheep
      for (const { landAt, remove } of this.board.getValidEats(piece)) {
        const og = this.add.graphics();
        og.fillStyle(0xff8800, 0.5);
        og.fillCircle(nodes[landAt].x, nodes[landAt].y, 12);
        this.highlights.push(og);

        const rg = this.add.graphics();
        rg.lineStyle(3, 0xff2222, 1.0);
        rg.strokeCircle(nodes[remove].x, nodes[remove].y, 20);
        this.highlights.push(rg);
      }
    } else {
      // Blue dots on valid sheep step targets
      for (const nodeId of this.board.getValidSheepMoves(piece)) {
        const pos = nodes[nodeId];
        const g = this.add.graphics();
        g.fillStyle(0x4488ff, 0.5);
        g.fillCircle(pos.x, pos.y, 12);
        this.highlights.push(g);
      }
    }
  }

  // Task 5.5
  clearHighlights() {
    for (const h of this.highlights) h.destroy();
    this.highlights = [];
  }

  // Persistent marker for the most recent action, kept visible until the next
  // one replaces it (separate from `highlights`, which clear on deselect).
  // An arrow from fromPos to toPos for a step/capture; a plain ring at toPos
  // for a placement, which has no origin to point from.
  _drawLastMoveMarker(fromPos, toPos) {
    if (this.lastMoveGraphics) { this.lastMoveGraphics.destroy(); this.lastMoveGraphics = null; }
    const g = this.add.graphics();
    const color = 0xffdd33;

    if (fromPos) {
      const dx = toPos.x - fromPos.x, dy = toPos.y - fromPos.y;
      const dist = Math.hypot(dx, dy);
      const ux = dx / dist, uy = dy / dist;
      const pad = 20; // keep the line clear of the piece circles at both ends
      const sx = fromPos.x + ux * pad, sy = fromPos.y + uy * pad;
      const ex = toPos.x - ux * pad, ey = toPos.y - uy * pad;

      const headLen = 30, headAngle = Math.PI / 10;
      const angle = Math.atan2(ey - sy, ex - sx);
      // Stop the shaft at the arrowhead's base, not its tip — otherwise the
      // thick line pokes through the point and blunts it.
      const baseX = ex - headLen * Math.cos(angle), baseY = ey - headLen * Math.sin(angle);

      g.lineStyle(7, color, 0.9);
      g.lineBetween(sx, sy, baseX, baseY);

      g.fillStyle(color, 0.9);
      g.fillTriangle(
        ex, ey,
        ex - headLen * Math.cos(angle - headAngle), ey - headLen * Math.sin(angle - headAngle),
        ex - headLen * Math.cos(angle + headAngle), ey - headLen * Math.sin(angle + headAngle)
      );
    } else {
      g.lineStyle(5, color, 0.9);
      g.strokeCircle(toPos.x, toPos.y, 26);
    }
    this.lastMoveGraphics = g;
  }

  // Task 5.6: apply the action to board state, trigger animations, then finish
  executeAction(targetNodeId) {
    const piece = this.selected;
    this.clearHighlights();
    this.selected = null;

    if (piece.type === "wolf") {
      const eat = this.board.getValidEats(piece).find(e => e.landAt === targetNodeId);
      if (eat) {
        const oldPos = this.board.config.nodes[piece.nodeId];
        const captured = this.board.eat(piece, targetNodeId);
        const newPos = this.board.config.nodes[piece.nodeId];
        this.sfx.capture();
        this._drawLastMoveMarker(oldPos, newPos);
        this._animateCapture(captured);
        this._animateMove(piece, oldPos, newPos, () => this.finishAction());
      } else {
        const oldPos = this.board.config.nodes[piece.nodeId];
        this.board.move(piece, targetNodeId);
        const newPos = this.board.config.nodes[piece.nodeId];
        this.sfx.wolfStep();
        this._drawLastMoveMarker(oldPos, newPos);
        this._animateMove(piece, oldPos, newPos, () => this.finishAction());
      }
    } else {
      const oldPos = this.board.config.nodes[piece.nodeId];
      this.board.move(piece, targetNodeId);
      const newPos = this.board.config.nodes[piece.nodeId];
      this.sfx.sheepStep();
      this._drawLastMoveMarker(oldPos, newPos);
      this._animateMove(piece, oldPos, newPos, () => this.finishAction());
    }
  }

  // ─── Task 6.2: placement-phase visual hints ───────────────────────────────

  _drawPlacingHints() {
    this.clearHighlights();
    for (const [id, pos] of Object.entries(this.board.config.nodes)) {
      if (!this.board.isEmpty(id)) continue;
      const g = this.add.graphics();
      g.fillStyle(0x4488ff, 0.4);
      g.fillCircle(pos.x, pos.y, 12);
      this.highlights.push(g);
    }
  }

  // ─── Task 7.1: smooth move tween (150 ms) ────────────────────────────────

  _animateMove(piece, _oldPos, newPos, onComplete) {
    this.animating = true;
    this.tweens.add({
      targets: piece.graphics,
      x: newPos.x,
      y: newPos.y,
      duration: 150,
      ease: "Linear",
      onComplete: () => {
        this.animating = false;
        onComplete?.();
      },
    });
  }

  // ─── Task 7.2: captured sheep fade-out tween (200 ms) ────────────────────

  _animateCapture(piece) {
    if (!piece.graphics) return;
    this.tweens.add({
      targets: piece.graphics,
      alpha: 0,
      duration: 200,
      ease: "Linear",
      onComplete: () => {
        if (piece.graphics) { piece.graphics.destroy(); piece.graphics = null; }
      },
    });
  }

  // ─── Hit-test helpers ────────────────────────────────────────────────────

  _hitPiece(pointer) {
    const all = [
      ...this.board.wolves,
      ...this.board.sheep.filter(s => s.alive),
    ];
    for (const piece of all) {
      const pos = this.board.config.nodes[piece.nodeId];
      const r = piece.type === "wolf" ? 18 : 14;
      const dx = pointer.x - pos.x, dy = pointer.y - pos.y;
      if (dx * dx + dy * dy <= r * r) return piece;
    }
    return null;
  }

  _hitNode(pointer) {
    const HIT = 30;
    let closest = null, closestDist = HIT;
    for (const [id, pos] of Object.entries(this.board.config.nodes)) {
      const dx = pointer.x - pos.x, dy = pointer.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) { closest = id; closestDist = dist; }
    }
    return closest;
  }

  _isValidTarget(piece, nodeId) {
    if (piece.type === "wolf") {
      return (
        this.board.getValidMoves(piece).includes(nodeId) ||
        this.board.getValidEats(piece).some(e => e.landAt === nodeId)
      );
    }
    return this.board.getValidSheepMoves(piece).includes(nodeId);
  }

  // ─── Task 9.1: check win, else advance turn ───────────────────────────────

  finishAction() {
    this.updateOpacity();
    this.updateHUD();
    const winner = this.board.checkWin();
    if (winner) {
      this.showResult(winner);
      return;
    }
    if (this._recordPositionAndCheckRepetition() >= 5) {
      this.showResult("draw");
      return;
    }
    this.nextTurn();
  }

  // A "position" is the full board layout + reserve count + whose turn it
  // is next — if the exact same one recurs 5 times (e.g. two pieces
  // shuffling back and forth), the game is a draw rather than looping forever.
  _positionSignature() {
    const layout = Object.keys(this.board.config.nodes)
      .map(id => {
        const piece = this.board.occupancy[id];
        return piece ? piece.type[0] : "_";
      })
      .join("");
    return `${this.activeSide}|${this.board.sheepReserve}|${layout}`;
  }

  _recordPositionAndCheckRepetition() {
    const sig = this._positionSignature();
    const count = (this.positionHistory.get(sig) || 0) + 1;
    this.positionHistory.set(sig, count);
    return count;
  }

  // Task 9.2: toggle active side; schedule AI turn if needed
  nextTurn() {
    this.activeSide = this.activeSide === "wolf" ? "sheep" : "wolf";
    this.clearHighlights();
    this.selected = null;
    this.updateOpacity();
    this.updateHUD();

    // Show placement hints when it becomes sheep's turn in placing phase
    if (this.activeSide === "sheep" && this.board.placingPhase) {
      this._drawPlacingHints();
    }

    const isAITurn =
      (this.activeMode === "wolf"  && this.activeSide === "sheep") ||
      (this.activeMode === "sheep" && this.activeSide === "wolf");
    if (isAITurn) {
      this.time.delayedCall(400, this.executeAITurn, [], this);
    }
  }

  // Task 9.3: ask AI for a move and apply it
  executeAITurn() {
    const action =
      this.activeSide === "wolf"
        ? this.ai.makeWolfMove(this.board)
        : this.ai.makeSheepMove(this.board);

    if (!action) return; // no legal move — checkWin should have caught this

    if (action.type === "eat") {
      const oldPos = this.board.config.nodes[action.wolf.nodeId];
      const captured = this.board.eat(action.wolf, action.nodeId);
      const newPos = this.board.config.nodes[action.wolf.nodeId];
      this.sfx.capture();
      this._drawLastMoveMarker(oldPos, newPos);
      this._animateCapture(captured);
      this._animateMove(action.wolf, oldPos, newPos, () => this.finishAction());
    } else if (action.type === "step") {
      const piece = action.wolf ?? action.sheep;
      const oldPos = this.board.config.nodes[piece.nodeId];
      this.board.move(piece, action.nodeId);
      const newPos = this.board.config.nodes[piece.nodeId];
      if (piece.type === "wolf") this.sfx.wolfStep();
      else this.sfx.sheepStep();
      this._drawLastMoveMarker(oldPos, newPos);
      this._animateMove(piece, oldPos, newPos, () => this.finishAction());
    } else if (action.type === "place") {
      const placed = this.board.placeSheep(action.nodeId);
      if (placed) {
        const pos = this.board.config.nodes[action.nodeId];
        const g = this.add.graphics();
        g.setPosition(pos.x, pos.y);
        this._drawPieceShape(g, placed);
        placed.graphics = g;
        this.sfx.place();
        this._drawLastMoveMarker(null, pos);
        this.clearHighlights();
        this.finishAction();
      }
    }
  }

  // ─── Stubs for tasks 8, 10, 11 ───────────────────────────────────────────

  // Task 10.1 + 10.2: end-game overlay with "再来一局" button
  showResult(winner) {
    const bg = this.add.rectangle(400, 400, 800, 800, 0x000000, 0.75);
    this.overlayObjects.push(bg);

    const resultText =
      winner === "wolf" ? "狼方获胜！" : winner === "sheep" ? "羊方获胜！" : "平局！";
    const resultColor =
      winner === "wolf" ? "#ff6666" : winner === "sheep" ? "#88ccff" : "#cccccc";
    const label = this.add
      .text(400, 330, resultText, {
        fontSize: "52px",
        color: resultColor,
        fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      })
      .setOrigin(0.5);
    this.overlayObjects.push(label);

    const playAgainBtn = this.add
      .text(400, 440, "再来一局", {
        fontSize: "28px",
        color: "#ffffff",
        backgroundColor: "#335533",
        padding: { x: 20, y: 10 },
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayObjects.push(playAgainBtn);
    playAgainBtn.on("pointerover", () => playAgainBtn.setStyle({ backgroundColor: "#447744" }));
    playAgainBtn.on("pointerout",  () => playAgainBtn.setStyle({ backgroundColor: "#335533" }));
    playAgainBtn.on("pointerdown", () => this.resetGame());
  }

  // Task 10.3: tear down everything and re-initialise from current config
  resetGame() {
    for (const o of this.overlayObjects) {
      if (o && typeof o.destroy === "function") o.destroy();
    }
    this.overlayObjects = [];

    for (const piece of [...this.board.wolves, ...this.board.sheep]) {
      if (piece.graphics) { piece.graphics.destroy(); piece.graphics = null; }
    }
    if (this.boardGraphics) { this.boardGraphics.destroy(); this.boardGraphics = null; }
    if (this.lastMoveGraphics) { this.lastMoveGraphics.destroy(); this.lastMoveGraphics = null; }
    this.positionHistory = new Map();

    this.clearHighlights();
    this.selected = null;
    this.animating = false;
    this.activeSide = "wolf";   // wolves always move first

    this.board = new Board(this.activeBoardConfig);
    this.drawBoard();
    this.drawPieces();
    this.updateOpacity();
    this.updateHUD();

    // Schedule AI if the starting side is AI-controlled
    const isAIFirst =
      (this.activeMode === "wolf"  && this.activeSide === "sheep") ||
      (this.activeMode === "sheep" && this.activeSide === "wolf");
    if (isAIFirst) {
      this.time.delayedCall(400, this.executeAITurn, [], this);
    }
  }

  // Task 8.1: create persistent HUD text objects
  _initHUD() {
    const baseStyle = {
      fontSize: "20px",
      color: "#ffffff",
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    };
    const smallStyle = { ...baseStyle, fontSize: "16px", color: "#cccccc" };

    // Turn indicator — top-left
    this.hudObjects.turnLabel = this.add.text(16, 16, "", baseStyle);

    // On-board sheep count — top-right
    this.hudObjects.sheepCountLabel = this.add
      .text(784, 16, "", baseStyle)
      .setOrigin(1, 0);

    // Reserve count — below sheep count (shown during a placement phase)
    this.hudObjects.reserveLabel = this.add
      .text(784, 44, "", smallStyle)
      .setOrigin(1, 0)
      .setVisible(false);

    // Phase label — below reserve count (shown during a placement phase)
    this.hudObjects.phaseLabel = this.add
      .text(784, 66, "", smallStyle)
      .setOrigin(1, 0)
      .setVisible(false);

    this.updateHUD();
  }

  // Task 8.2: refresh all HUD text from current board state
  updateHUD() {
    const hud = this.hudObjects;
    if (!hud.turnLabel) return; // called before _initHUD during early resets

    hud.turnLabel.setText(this.activeSide === "wolf" ? "请狼走" : "请羊走");

    const aliveSheep = this.board.sheep.filter(s => s.alive).length;
    hud.sheepCountLabel.setText(`羊：${aliveSheep}`);

    // Reserve/phase labels only appear during a placement phase
    const showReserve = this.board.placingPhase;
    hud.reserveLabel.setVisible(showReserve);
    hud.phaseLabel.setVisible(showReserve);
    if (showReserve) {
      hud.reserveLabel.setText(`储备：${this.board.sheepReserve}`);
      hud.phaseLabel.setText("放置阶段");
    }
  }

  // Task 11.1: persistent restart + settings buttons at bottom of canvas
  _initRestartButton() {
    // All three bottom buttons share the same font size and padding so
    // they're equally legible; color is the only thing that marks settings
    // as the primary action.
    const btnFontStyle = {
      fontSize: "20px",
      fontFamily: '"Microsoft YaHei", sans-serif',
      padding: { x: 22, y: 10 },
    };

    const settingsBtn = this.add
      .text(400, 764, "⚙ 设置", {
        ...btnFontStyle,
        color: "#ffffff",
        backgroundColor: "#3355aa",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerover", () => settingsBtn.setStyle({ backgroundColor: "#4466cc" }));
    settingsBtn.on("pointerout",  () => settingsBtn.setStyle({ backgroundColor: "#3355aa" }));
    settingsBtn.on("pointerdown", () => this._showSettingsPanel());

    const restartBtn = this.add
      .text(130, 764, "重新开始", {
        ...btnFontStyle,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on("pointerover", () => restartBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    restartBtn.on("pointerout",  () => restartBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    restartBtn.on("pointerdown", () => this.resetGame());

    // Resign mirrors restart on the other side of settings.
    const resignBtn = this.add
      .text(670, 764, "认输", {
        ...btnFontStyle,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resignBtn.on("pointerover", () => resignBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    resignBtn.on("pointerout",  () => resignBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    resignBtn.on("pointerdown", () => this.resign());
  }

  // Concedes the game. In single-human modes the human's assigned side
  // resigns regardless of whose turn it currently is; in two-player mode
  // whoever currently has the turn is the one clicking, so that side resigns.
  resign() {
    if (this.animating || this.overlayObjects.length > 0) return;
    const resigningSide =
      this.activeMode === "wolf" ? "wolf" :
      this.activeMode === "sheep" ? "sheep" :
      this.activeSide;
    const winner = resigningSide === "wolf" ? "sheep" : "wolf";
    this.showResult(winner);
  }

  // Task 11.2 + 11.3: settings panel overlay — game mode
  _showSettingsPanel() {
    if (this.animating || this.overlayObjects.length > 0) return;

    const panelObjs = [];

    const backdrop = this.add
      .rectangle(400, 400, 800, 800, 0x000000, 0.55)
      .setInteractive();
    panelObjs.push(backdrop);

    const card = this.add.rectangle(400, 365, 580, 360, 0x1e2840, 1);
    card.setStrokeStyle(1, 0x4466aa, 1);
    panelObjs.push(card);

    panelObjs.push(
      this.add.text(400, 230, "游戏设置", {
        fontSize: "28px", color: "#ffffff",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0.5)
    );

    let pendingMode = this.activeMode;
    let pendingDifficulty = this.difficulty;

    const MODE_OPTS = [
      { key: "wolf",  label: "玩家执狼" },
      { key: "sheep", label: "玩家执羊" },
      { key: "2p",    label: "双人对战" },
    ];
    const DIFFICULTY_OPTS = [
      { key: "easy",   label: "简单" },
      { key: "medium", label: "普通" },
      { key: "hard",   label: "困难" },
    ];

    // Larger, well-spaced option buttons — each row is centered as a group.
    const makeBtns = (opts, centerX, xStep, y, getActive) => {
      const xStart = centerX - ((opts.length - 1) * xStep) / 2;
      return opts.map((opt, i) => {
        const active = getActive() === opt.key;
        const btn = this.add
          .text(xStart + i * xStep, y, opt.label, {
            fontSize: "20px",
            color: active ? "#ffffff" : "#888888",
            backgroundColor: active ? "#3355aa" : "#2a2a3a",
            padding: { x: 18, y: 10 },
            fontFamily: '"Microsoft YaHei", sans-serif',
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        panelObjs.push(btn);
        return { btn, key: opt.key };
      });
    };

    const refreshBtns = (btnObjs, getActive) => {
      btnObjs.forEach(({ btn, key }) => {
        btn.setStyle({
          color: getActive() === key ? "#ffffff" : "#888888",
          backgroundColor: getActive() === key ? "#3355aa" : "#2a2a3a",
        });
      });
    };

    panelObjs.push(
      this.add.text(400, 280, "游戏模式", {
        fontSize: "18px", color: "#aaaaaa",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0.5)
    );

    const modeBtnObjs = makeBtns(MODE_OPTS, 400, 170, 320, () => pendingMode);
    modeBtnObjs.forEach(({ btn, key }) =>
      btn.on("pointerdown", () => {
        pendingMode = key;
        refreshBtns(modeBtnObjs, () => pendingMode);
      })
    );

    panelObjs.push(
      this.add.text(400, 375, "AI 难度", {
        fontSize: "18px", color: "#aaaaaa",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0.5)
    );

    const difficultyBtnObjs = makeBtns(DIFFICULTY_OPTS, 400, 150, 415, () => pendingDifficulty);
    difficultyBtnObjs.forEach(({ btn, key }) =>
      btn.on("pointerdown", () => {
        pendingDifficulty = key;
        refreshBtns(difficultyBtnObjs, () => pendingDifficulty);
      })
    );

    const closePanel = () => {
      for (const o of panelObjs) o.destroy();
      this.overlayObjects = this.overlayObjects.filter(o => !panelObjs.includes(o));
    };
    backdrop.on("pointerdown", closePanel);

    // Confirm — Task 11.3: apply settings and restart
    const confirmBtn = this.add
      .text(480, 490, "确定", {
        fontSize: "22px", color: "#ffffff",
        backgroundColor: "#336633",
        padding: { x: 26, y: 12 },
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    confirmBtn.on("pointerover", () => confirmBtn.setStyle({ backgroundColor: "#447744" }));
    confirmBtn.on("pointerout",  () => confirmBtn.setStyle({ backgroundColor: "#336633" }));
    confirmBtn.on("pointerdown", () => {
      this.activeMode = pendingMode;
      this.difficulty = pendingDifficulty;
      this.ai.difficulty = pendingDifficulty;
      for (const o of panelObjs) this.overlayObjects.push(o);
      this.resetGame();
    });
    panelObjs.push(confirmBtn);

    const cancelBtn = this.add
      .text(320, 490, "取消", {
        fontSize: "22px", color: "#ffffff",
        backgroundColor: "#663333",
        padding: { x: 26, y: 12 },
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cancelBtn.on("pointerover", () => cancelBtn.setStyle({ backgroundColor: "#774444" }));
    cancelBtn.on("pointerout",  () => cancelBtn.setStyle({ backgroundColor: "#663333" }));
    cancelBtn.on("pointerdown", closePanel);
    panelObjs.push(cancelBtn);

    // Push all panel objects onto overlayObjects to block game board input
    this.overlayObjects.push(...panelObjs);
  }

  update() {}
}

// ─── Phaser Game Config ───────────────────────────────────────────────────────

// Task 4.1: 800×800, dark background, game-container parent
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 800,
  backgroundColor: 0x1a1a2e,
  parent: "game-container",
  scene: GameScene,
  // Snap object positions to whole pixels — the WebGL renderer otherwise
  // linear-filters textures (including text) sitting at fractional pixel
  // coordinates, which reads as blur even at correct texture resolution.
  render: { roundPixels: true },
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) window.__game = game;
