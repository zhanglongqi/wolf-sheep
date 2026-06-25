import Phaser from "phaser";

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

// Task 1.2 & 1.3 & 1.4: traditional — 19 nodes with pixel positions,
// main 3×3 8-way adjacency, neck-to-row, neck-to-diamond connections
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

  // Task 1.2 & 1.3 & 1.4
  traditional: {
    nodes: {
      // Main 3×3 grid (gridSize=100, centered at 400,400)
      TL: { x: 300, y: 300 }, TC: { x: 400, y: 300 }, TR: { x: 500, y: 300 },
      ML: { x: 300, y: 400 }, MC: { x: 400, y: 400 }, MR: { x: 500, y: 400 },
      BL: { x: 300, y: 500 }, BC: { x: 400, y: 500 }, BR: { x: 500, y: 500 },
      // Necks (connect main grid to diamonds)
      neck_t: { x: 400, y: 200 },
      neck_b: { x: 400, y: 600 },
      // Upper diamond (above neck_t)
      apex_t:  { x: 400, y: 100 },
      left_t:  { x: 350, y: 150 },
      ctr_t:   { x: 400, y: 150 },
      right_t: { x: 450, y: 150 },
      // Lower diamond (below neck_b)
      apex_b:  { x: 400, y: 700 },
      left_b:  { x: 350, y: 650 },
      ctr_b:   { x: 400, y: 650 },
      right_b: { x: 450, y: 650 },
    },
    adjacency: {
      // Main 3×3: horizontal + vertical + diagonal (8-way), plus neck connections
      TL: ["TC", "ML", "MC", "neck_t"],
      TC: ["TL", "TR", "ML", "MC", "MR", "neck_t"],
      TR: ["TC", "MC", "MR", "neck_t"],
      ML: ["TL", "TC", "MC", "BL", "BC"],
      MC: ["TL", "TC", "TR", "ML", "MR", "BL", "BC", "BR"],
      MR: ["TR", "TC", "MC", "BR", "BC"],
      BL: ["ML", "MC", "BC", "neck_b"],
      BC: ["BL", "BR", "ML", "MC", "MR", "neck_b"],
      BR: ["BC", "MC", "MR", "neck_b"],
      // Necks: connect to top/bottom row and to their diamond
      neck_t: ["TL", "TC", "TR", "left_t", "ctr_t", "right_t"],
      neck_b: ["BL", "BC", "BR", "left_b", "ctr_b", "right_b"],
      // Upper diamond
      apex_t:  ["left_t", "ctr_t", "right_t"],
      left_t:  ["apex_t", "ctr_t", "neck_t"],
      ctr_t:   ["apex_t", "left_t", "right_t", "neck_t"],
      right_t: ["apex_t", "ctr_t", "neck_t"],
      // Lower diamond
      apex_b:  ["left_b", "ctr_b", "right_b"],
      left_b:  ["apex_b", "ctr_b", "neck_b"],
      ctr_b:   ["apex_b", "left_b", "right_b", "neck_b"],
      right_b: ["apex_b", "ctr_b", "neck_b"],
    },
    wolfStart: ["neck_t", "neck_b"],
    sheepStart: ["TL", "TC", "TR", "ML", "MR", "BL", "BC", "BR"],
    sheepReserve: 22,
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
assertAdjacencySymmetry(BOARD_CONFIGS.traditional, "traditional");

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

class AIPlayer {
  // Task 3.1: wolf AI — prefers captures; falls back to random step
  // Returns {type:'eat'|'step', wolf, nodeId, removeId?} or null if no legal move.
  makeWolfMove(board) {
    const allCaptures = [];
    for (const wolf of board.wolves) {
      for (const { landAt, remove } of board.getValidEats(wolf)) {
        allCaptures.push({ wolf, nodeId: landAt, removeId: remove });
      }
    }
    if (allCaptures.length > 0) {
      return { type: "eat", ...allCaptures[Math.floor(Math.random() * allCaptures.length)] };
    }

    const allSteps = [];
    for (const wolf of board.wolves) {
      for (const nodeId of board.getValidMoves(wolf)) {
        allSteps.push({ wolf, nodeId });
      }
    }
    if (allSteps.length === 0) return null;
    return { type: "step", ...allSteps[Math.floor(Math.random() * allSteps.length)] };
  }

  // Task 3.2: sheep AI — random placement during placing phase, random step otherwise
  // Returns {type:'place'|'step', sheep, nodeId} or null if no legal move.
  makeSheepMove(board) {
    if (board.placingPhase) {
      const empty = Object.keys(board.config.nodes).filter(id => board.isEmpty(id));
      if (empty.length === 0) return null;
      return { type: "place", sheep: null, nodeId: empty[Math.floor(Math.random() * empty.length)] };
    }

    const movable = board.sheep
      .filter(s => s.alive)
      .map(s => ({ sheep: s, moves: board.getValidSheepMoves(s) }))
      .filter(({ moves }) => moves.length > 0);

    if (movable.length === 0) return null;
    const { sheep, moves } = movable[Math.floor(Math.random() * movable.length)];
    return { type: "step", sheep, nodeId: moves[Math.floor(Math.random() * moves.length)] };
  }
}

// ─── Phaser Scene ─────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  // Task 4.2: initialize board and kick off rendering
  create() {
    this.activeBoardConfig = BOARD_CONFIGS.grid5x5;
    this.activeMode = "wolf";   // 'wolf' | 'sheep' | '2p'
    // Grid board: sheep move first; traditional board: wolves move first
    this.activeSide = this.activeBoardConfig === BOARD_CONFIGS.grid5x5 ? "sheep" : "wolf";
    this.animating = false;
    this.selected = null;
    this.highlights = [];
    this.overlayObjects = [];
    this.ai = new AIPlayer();
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
      // Click on another own piece → reselect
      if (clickedPiece && clickedPiece.type === this.activeSide) {
        this.selectPiece(clickedPiece);
        return;
      }
      // Anything else → deselect
      this.clearHighlights();
      this.selected = null;
      return;
    }

    // No selection yet — select a piece that has legal actions
    if (clickedPiece && clickedPiece.type === this.activeSide) {
      const hasAction =
        this.activeSide === "wolf"
          ? this.board.getValidMoves(clickedPiece).length > 0 ||
            this.board.getValidEats(clickedPiece).length > 0
          : this.board.getValidSheepMoves(clickedPiece).length > 0;
      if (hasAction) this.selectPiece(clickedPiece);
    }
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
        this._animateCapture(captured);
        this._animateMove(piece, oldPos, newPos, () => this.finishAction());
      } else {
        const oldPos = this.board.config.nodes[piece.nodeId];
        this.board.move(piece, targetNodeId);
        const newPos = this.board.config.nodes[piece.nodeId];
        this._animateMove(piece, oldPos, newPos, () => this.finishAction());
      }
    } else {
      const oldPos = this.board.config.nodes[piece.nodeId];
      this.board.move(piece, targetNodeId);
      const newPos = this.board.config.nodes[piece.nodeId];
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
    } else {
      this.nextTurn();
    }
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
      this._animateCapture(captured);
      this._animateMove(action.wolf, oldPos, newPos, () => this.finishAction());
    } else if (action.type === "step") {
      const piece = action.wolf ?? action.sheep;
      const oldPos = this.board.config.nodes[piece.nodeId];
      this.board.move(piece, action.nodeId);
      const newPos = this.board.config.nodes[piece.nodeId];
      this._animateMove(piece, oldPos, newPos, () => this.finishAction());
    } else if (action.type === "place") {
      const placed = this.board.placeSheep(action.nodeId);
      if (placed) {
        const pos = this.board.config.nodes[action.nodeId];
        const g = this.add.graphics();
        g.setPosition(pos.x, pos.y);
        this._drawPieceShape(g, placed);
        placed.graphics = g;
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

    const resultText = winner === "wolf" ? "狼方获胜！" : "羊方获胜！";
    const resultColor = winner === "wolf" ? "#ff6666" : "#88ccff";
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

    this.clearHighlights();
    this.selected = null;
    this.animating = false;
    this.activeSide = this.activeBoardConfig === BOARD_CONFIGS.grid5x5 ? "sheep" : "wolf";

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

    // Reserve count — below sheep count (traditional board only)
    this.hudObjects.reserveLabel = this.add
      .text(784, 44, "", smallStyle)
      .setOrigin(1, 0)
      .setVisible(false);

    // Phase label — below reserve count (traditional board only)
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

    // Reserve/phase labels only appear on traditional board while placing
    const isTraditional = this.activeBoardConfig === BOARD_CONFIGS.traditional;
    const showReserve = isTraditional && this.board.placingPhase;
    hud.reserveLabel.setVisible(showReserve);
    hud.phaseLabel.setVisible(showReserve);
    if (showReserve) {
      hud.reserveLabel.setText(`储备：${this.board.sheepReserve}`);
      hud.phaseLabel.setText("放置阶段");
    }
  }

  // Task 11.1: persistent restart + settings buttons at bottom of canvas
  _initRestartButton() {
    const btnStyle = {
      fontSize: "17px",
      color: "#999999",
      fontFamily: '"Microsoft YaHei", sans-serif',
    };
    const restartBtn = this.add
      .text(320, 766, "重新开始", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on("pointerover", () => restartBtn.setStyle({ color: "#ffffff" }));
    restartBtn.on("pointerout",  () => restartBtn.setStyle({ color: "#999999" }));
    restartBtn.on("pointerdown", () => this.resetGame());

    const settingsBtn = this.add
      .text(500, 766, "设置", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerover", () => settingsBtn.setStyle({ color: "#ffffff" }));
    settingsBtn.on("pointerout",  () => settingsBtn.setStyle({ color: "#999999" }));
    settingsBtn.on("pointerdown", () => this._showSettingsPanel());
  }

  // Task 11.2 + 11.3: settings panel overlay — board type + game mode
  _showSettingsPanel() {
    if (this.animating || this.overlayObjects.length > 0) return;

    const panelObjs = [];

    const backdrop = this.add
      .rectangle(400, 400, 800, 800, 0x000000, 0.55)
      .setInteractive();
    panelObjs.push(backdrop);

    const card = this.add.rectangle(400, 390, 460, 310, 0x1e2840, 1);
    card.setStrokeStyle(1, 0x4466aa, 1);
    panelObjs.push(card);

    panelObjs.push(
      this.add.text(400, 260, "游戏设置", {
        fontSize: "22px", color: "#ffffff",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0.5)
    );

    let pendingBoard =
      this.activeBoardConfig === BOARD_CONFIGS.grid5x5 ? "grid5x5" : "traditional";
    let pendingMode = this.activeMode;

    const BOARD_OPTS = [
      { key: "grid5x5",     label: "5×5方格" },
      { key: "traditional", label: "传统棋盘" },
    ];
    const MODE_OPTS = [
      { key: "wolf",  label: "玩家执狼" },
      { key: "sheep", label: "玩家执羊" },
      { key: "2p",    label: "双人对战" },
    ];

    panelObjs.push(
      this.add.text(185, 318, "棋盘：", {
        fontSize: "16px", color: "#aaaaaa",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0, 0.5)
    );

    const makeBtns = (opts, xStart, xStep, y, getActive) => {
      return opts.map((opt, i) => {
        const active = getActive() === opt.key;
        const btn = this.add
          .text(xStart + i * xStep, y, opt.label, {
            fontSize: "15px",
            color: active ? "#ffffff" : "#777777",
            backgroundColor: active ? "#3355aa" : "#2a2a3a",
            padding: { x: 9, y: 5 },
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
          color: getActive() === key ? "#ffffff" : "#777777",
          backgroundColor: getActive() === key ? "#3355aa" : "#2a2a3a",
        });
      });
    };

    const boardBtnObjs = makeBtns(BOARD_OPTS, 295, 130, 353, () => pendingBoard);
    boardBtnObjs.forEach(({ btn, key }) =>
      btn.on("pointerdown", () => {
        pendingBoard = key;
        refreshBtns(boardBtnObjs, () => pendingBoard);
      })
    );

    panelObjs.push(
      this.add.text(185, 423, "模式：", {
        fontSize: "16px", color: "#aaaaaa",
        fontFamily: '"Microsoft YaHei", sans-serif',
      }).setOrigin(0, 0.5)
    );

    const modeBtnObjs = makeBtns(MODE_OPTS, 253, 120, 423, () => pendingMode);
    modeBtnObjs.forEach(({ btn, key }) =>
      btn.on("pointerdown", () => {
        pendingMode = key;
        refreshBtns(modeBtnObjs, () => pendingMode);
      })
    );

    const closePanel = () => {
      for (const o of panelObjs) o.destroy();
      this.overlayObjects = this.overlayObjects.filter(o => !panelObjs.includes(o));
    };
    backdrop.on("pointerdown", closePanel);

    // Confirm — Task 11.3: apply settings and restart
    const confirmBtn = this.add
      .text(460, 495, "确定", {
        fontSize: "18px", color: "#ffffff",
        backgroundColor: "#336633",
        padding: { x: 18, y: 8 },
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    confirmBtn.on("pointerover", () => confirmBtn.setStyle({ backgroundColor: "#447744" }));
    confirmBtn.on("pointerout",  () => confirmBtn.setStyle({ backgroundColor: "#336633" }));
    confirmBtn.on("pointerdown", () => {
      this.activeBoardConfig =
        pendingBoard === "grid5x5" ? BOARD_CONFIGS.grid5x5 : BOARD_CONFIGS.traditional;
      this.activeMode = pendingMode;
      for (const o of panelObjs) this.overlayObjects.push(o);
      this.resetGame();
    });
    panelObjs.push(confirmBtn);

    const cancelBtn = this.add
      .text(340, 495, "取消", {
        fontSize: "18px", color: "#ffffff",
        backgroundColor: "#663333",
        padding: { x: 18, y: 8 },
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
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) window.__game = game;
