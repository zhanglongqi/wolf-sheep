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

export const BOARD_CONFIGS = {
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
export function assertAdjacencySymmetry(config, name) {
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
export class Piece {
  constructor(type, nodeId) {
    this.type = type;       // 'wolf' | 'sheep'
    this.nodeId = nodeId;
    this.alive = true;
    this.graphics = null;   // Phaser Graphics reference, set by GameScene
  }
}

// ─── Board Engine ─────────────────────────────────────────────────────────────

export class Board {
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
export class AIPlayer {
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
