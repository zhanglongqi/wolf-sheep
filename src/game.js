import Phaser from "phaser";
import { BOARD_CONFIGS, Board, AIPlayer } from "./board.js";

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

// The board's own node coordinates are authored in a fixed 0-800 local space
// (see BOARD_CONFIGS.grid5x5 in ./board.js). The canvas is wider than that to fit permanent left
// (settings) and right (status/actions) sidebars, so every rendered position
// and every hit-tested pointer must be shifted by this offset. Kept as a
// module constant rather than per-node data so the board config, adjacency
// math, and AI simulation all stay in untouched, offset-free local space.
const BOARD_OFFSET_X = 240;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 800;
const LEFT_SIDEBAR_X = BOARD_OFFSET_X / 2; // horizontal center of the left (settings) sidebar
const RIGHT_SIDEBAR_X = BOARD_OFFSET_X + 800 + (CANVAS_WIDTH - BOARD_OFFSET_X - 800) / 2; // right (status/actions) sidebar

// Orientation is determined once, here at module load — before `Phaser.Game`
// is constructed below — and reused for the rest of the session (layout does
// not react to resize/rotation; see design.md Decision 1 & 5).
const isPortrait = window.innerWidth < window.innerHeight;
document.body.classList.toggle("portrait", isPortrait);

// Portrait canvas: the board's own [100,700] local space (600 square, 100px
// margin either side = 800 wide) needs no horizontal offset in portrait,
// since nothing sits beside it anymore — top/bottom bands stack above and
// below instead. Band heights are approximate starting points, tuned once
// the layout is actually visible (see design.md Decision 2).
const PORTRAIT_CANVAS_WIDTH = 800;
const PORTRAIT_TOP_HEIGHT = 160;
const PORTRAIT_BOTTOM_HEIGHT = 200;
const PORTRAIT_CANVAS_HEIGHT = PORTRAIT_TOP_HEIGHT + 800 + PORTRAIT_BOTTOM_HEIGHT;

// Extra tap-tolerance margin (logical units) applied only in portrait, where
// the smaller on-screen scale makes pieces harder to hit precisely; kept
// well under half the node spacing (150) so adjacent targets never overlap.
// See design.md Decision 4.
const PORTRAIT_HIT_MARGIN = 10;

// ─── Stats persistence ────────────────────────────────────────────────────────

// Task 1.1: storage key + bucket key. ":v1" lets a future incompatible schema
// change move to ":v2" and leave old data orphaned, rather than needing a
// migration — see design.md Decision 4.
const STATS_STORAGE_KEY = "wolf-sheep:stats:v1";

// Two-player mode has no difficulty axis (the AI is never invoked in "2p"),
// so it gets a single shared bucket instead of being split three ways.
function statsBucketKey(mode, difficulty) {
  return mode === "2p" ? "2p" : `${mode}|${difficulty}`;
}

// Task 1.2: read/write/clear helpers. A missing key, unparseable JSON, or a
// thrown access error (e.g. localStorage unavailable) all degrade to "no
// stats" rather than throwing — this is low-stakes local data, not worth
// failing the UI over. See design.md Decision 4.
function readStats() {
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStats(stats) {
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable/full — stats just don't persist this time.
  }
}

function clearStats() {
  try {
    window.localStorage.removeItem(STATS_STORAGE_KEY);
  } catch {
    // Nothing to do if localStorage itself is unavailable.
  }
}

// ─── Cartoon piece artwork ────────────────────────────────────────────────────

// Pieces are drawn from primitives straight onto each piece's own Graphics
// object, centred on (0,0) and already at final pixel size — so the existing
// move tweens (which animate the Graphics position) and the dim-when-stuck
// alpha handling keep working untouched, with no image assets to load.
//
// PIECE_RADIUS is the shared footprint used for click hit-testing and for the
// selection / capture-target rings, so art and interaction stay in sync.
const PIECE_RADIUS = { wolf: 27, sheep: 26 };

// Phaser's fillEllipse can't be rotated, so ovals are emitted as polygons —
// used for heads, muzzles and the sheep's drooping ears.
function fillOval(g, cx, cy, rx, ry, angle = 0, steps = 24) {
  const pts = [];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    pts.push({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos });
  }
  g.fillPoints(pts, true);
}

// Fluffy grey ruff, big pointed ears, amber slanted eyes, long snout and a
// pair of fangs — cartoon proportions (oversized head, oversized eyes) with a
// silhouette deliberately spiky, so it never reads as a cat.
function drawWolfArt(g) {
  const COAT = 0x8b95ad, COAT_DARK = 0x5c6580, BLAZE = 0xa3adc4;
  const MUZZLE = 0xeceff8, INNER_EAR = 0xd08f97, EYE = 0xffcf3d, INK = 0x20222e;

  // Ground shadow — gives the token a little lift off the board lines
  g.fillStyle(0x000000, 0.28);
  fillOval(g, 0, 22, 18, 5);

  // Spiky neck ruff behind the head: a star polygon of alternating radii, so
  // the outline is shaggy fur rather than a smooth disc.
  const ruff = [];
  const spikes = 11;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 25 : 18;
    ruff.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.94 + 1 });
  }
  g.fillStyle(COAT_DARK, 1);
  g.fillPoints(ruff, true);

  // Ears — tall, splayed outward
  g.fillStyle(COAT_DARK, 1);
  g.fillTriangle(-19, -6, -24.5, -28, -4, -17);
  g.fillTriangle(19, -6, 24.5, -28, 4, -17);
  g.fillStyle(INNER_EAR, 1);
  g.fillTriangle(-16.5, -9, -20, -23, -7.5, -16);
  g.fillTriangle(16.5, -9, 20, -23, 7.5, -16);

  // Head + lighter forehead blaze — wider than tall, so the skull reads canine
  g.fillStyle(COAT, 1);
  fillOval(g, 0, -1, 18.5, 14.8);
  g.fillStyle(BLAZE, 1);
  fillOval(g, 0, -8, 7.5, 8);

  // Fur tuft between the ears
  g.fillStyle(COAT_DARK, 1);
  g.fillTriangle(-6, -12, -1, -14, -3.5, -22);
  g.fillTriangle(6, -12, 1, -14, 3.5, -22);

  // Snout: a bridge running up between the eyes plus a rounded muzzle, which
  // is what separates a canine profile from a feline one.
  g.fillStyle(MUZZLE, 1);
  fillOval(g, 0, 1, 6.5, 9);
  fillOval(g, 0, 9.5, 12.5, 8.5);

  // Nose
  g.fillStyle(INK, 1);
  fillOval(g, 0, 3.2, 4.2, 3.0);
  g.fillTriangle(-3.2, 3.5, 3.2, 3.5, 0, 6.8);

  // Open grin: a dark mouth with two fangs hanging into it and a bit of
  // tongue — fangs need the dark backing to be visible on the pale muzzle.
  g.fillStyle(INK, 1);
  fillOval(g, 0, 14, 7.2, 4.6);
  g.fillStyle(0xe0666f, 1);
  fillOval(g, 0, 16.4, 3.4, 2.1);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(-4.7, 10.6, -1.7, 10.6, -3.2, 15.2);
  g.fillTriangle(4.7, 10.6, 1.7, 10.6, 3.2, 15.2);

  // Eyes — slanted outward for a predatory squint
  g.fillStyle(EYE, 1);
  fillOval(g, -8, -3.5, 5.4, 4.4, 0.22);
  fillOval(g, 8, -3.5, 5.4, 4.4, -0.22);
  g.fillStyle(INK, 1);
  fillOval(g, -7.4, -2.8, 2.3, 3.1);
  fillOval(g, 7.4, -2.8, 2.3, 3.1);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(-9.2, -5.0, 1.2);
  g.fillCircle(6.4, -5.0, 1.2);

  // Angled brows
  g.lineStyle(3, COAT_DARK, 1);
  g.lineBetween(-13.5, -11, -4, -7.5);
  g.lineBetween(13.5, -11, 4, -7.5);
}

// A scalloped wool cloud (the opposite silhouette to the wolf's spikes) around
// a cream face with big eyes, blushed cheeks and droopy ears.
function drawSheepArt(g) {
  const WOOL = 0xfbfaf3, WOOL_SHADE = 0xd3d3c6;
  const FACE = 0xf7ddc6, FACE_EDGE = 0xd6ab8c, SNOUT = 0xecc1a6;
  const EAR = 0xe9c6ac, BLUSH = 0xf0928f, INK = 0x2b2118;

  g.fillStyle(0x000000, 0.28);
  fillOval(g, 0, 22, 17, 5);

  // Wool: a ring of puffs (shaded copies first, lighter ones offset up over
  // them) plus a central mass — reads as fluff without needing gradients.
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    puffs.push({ x: Math.cos(a) * 15, y: Math.sin(a) * 14 - 1, r: 9 });
  }
  g.fillStyle(WOOL_SHADE, 1);
  for (const { x, y, r } of puffs) g.fillCircle(x, y + 2.5, r);
  g.fillStyle(WOOL, 1);
  for (const { x, y, r } of puffs) g.fillCircle(x, y, r);
  fillOval(g, 0, -2, 15, 13.5);

  // Droopy ears, tucked behind the face
  g.fillStyle(EAR, 1);
  fillOval(g, -16, 1, 8, 4.3, -0.38);
  fillOval(g, 16, 1, 8, 4.3, 0.38);

  // Face, outlined so the cream reads against the white wool, with a wool
  // fringe overlapping its top edge
  g.fillStyle(FACE_EDGE, 1);
  fillOval(g, 0, 6, 12, 11);
  g.fillStyle(FACE, 1);
  fillOval(g, 0, 6, 11, 10);
  g.fillStyle(WOOL, 1);
  fillOval(g, 0, -4, 11.5, 8);

  // Blushed cheeks
  g.fillStyle(BLUSH, 0.35);
  g.fillCircle(-8, 8.5, 3.2);
  g.fillCircle(8, 8.5, 3.2);

  // Eyes
  g.fillStyle(INK, 1);
  fillOval(g, -5, 4.5, 2.9, 3.4);
  fillOval(g, 5, 4.5, 2.9, 3.4);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(-5.9, 3.3, 1.2);
  g.fillCircle(4.1, 3.3, 1.2);

  // Snout, nostrils, smile
  g.fillStyle(SNOUT, 1);
  fillOval(g, 0, 11.5, 5.6, 3.8);
  g.fillStyle(INK, 1);
  g.fillCircle(-1.9, 10.6, 0.85);
  g.fillCircle(1.9, 10.6, 0.85);
  g.lineStyle(1.4, INK, 1);
  g.lineBetween(-2.8, 13.2, 0, 14.3);
  g.lineBetween(0, 14.3, 2.8, 13.2);
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

    // Determined once at module load (before this Phaser.Game was even
    // constructed) — see the `isPortrait` module constant.
    this.isPortrait = isPortrait;

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
    // Task 2.1: per-game recording/overlay state — see design.md Decisions 1 & 3a.
    this._resultRecorded = false;
    this._resultOverlayWinner = null;
    this.ai = new AIPlayer(this.difficulty);
    this.sfx = new SFX();
    this.hudObjects = {};

    this.board = new Board(this.activeBoardConfig);
    this.drawBoard();
    this.drawPieces();

    // Task 5.1 — register pointer input (handler implemented in task 5)
    this.input.on("pointerdown", this.onPointerDown, this);

    // Task 8.1 — HUD init stub (implemented in task 8)
    if (this.isPortrait) {
      this._initPortraitTopBand();
    } else {
      this._initHUD();
    }

    // Task 4.6 — set initial opacity for active side
    this.updateOpacity();

    if (this.isPortrait) {
      this._initPortraitBottomBand();
    } else {
      this._initLeftSidebar();
      this._initRightSidebarButtons();
    }

    // Schedule AI if the starting side is AI-controlled
    const isAIFirst =
      (this.activeMode === "wolf"  && this.activeSide === "sheep") ||
      (this.activeMode === "sheep" && this.activeSide === "wolf");
    if (isAIFirst) {
      this.time.delayedCall(400, this.executeAITurn, [], this);
    }
  }

  // Board-local node position → screen position. In landscape, shifted right
  // past the left sidebar. In portrait, the board's own [100,700] local span
  // is already centered in the 800-wide portrait canvas, so only a vertical
  // shift past the top band is needed. See design.md Decision 2.
  _screenPos(pos) {
    return this.isPortrait
      ? { x: pos.x, y: pos.y + PORTRAIT_TOP_HEIGHT }
      : { x: pos.x + BOARD_OFFSET_X, y: pos.y };
  }

  // Screen-space pointer → board-local position, for hit-testing against the
  // unshifted coordinates in board.config.nodes.
  _boardPoint(pointer) {
    return this.isPortrait
      ? { x: pointer.x, y: pointer.y - PORTRAIT_TOP_HEIGHT }
      : { x: pointer.x - BOARD_OFFSET_X, y: pointer.y };
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
        const a = this._screenPos(nodes[aId]), b = this._screenPos(nodes[bId]);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    this.boardGraphics = g;
  }

  // Task 4.4: draw all pieces as circles; store Graphics ref on each piece
  drawPieces() {
    for (const piece of [...this.board.wolves, ...this.board.sheep]) {
      if (!piece.alive) continue;
      const pos = this._screenPos(this.board.config.nodes[piece.nodeId]);
      const g = this.add.graphics();
      g.setPosition(pos.x, pos.y);
      this._drawPieceShape(g, piece);
      piece.graphics = g;
    }
  }

  // Shared: clear and redraw a piece's cartoon artwork on its Graphics object
  _drawPieceShape(g, piece) {
    g.clear();
    if (piece.type === "wolf") drawWolfArt(g);
    else drawSheepArt(g);
  }

  // Task 4.5: move Graphics to current node position and redraw shape
  redrawPiece(piece) {
    const pos = this._screenPos(this.board.config.nodes[piece.nodeId]);
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
          const rawPos = this.board.config.nodes[nodeId];
          const pos = this._screenPos(rawPos);
          const g = this.add.graphics();
          g.setPosition(pos.x, pos.y);
          this._drawPieceShape(g, placed);
          placed.graphics = g;
          this.sfx.place();
          this._drawLastMoveMarker(null, rawPos);
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

    // White ring around selected piece, over a dark under-stroke so it stays
    // readable against the sheep's white wool as well as the dark board
    const selPos = this._screenPos(nodes[piece.nodeId]);
    const selRing = this.add.graphics();
    const selRadius = PIECE_RADIUS[piece.type] + 9;
    selRing.lineStyle(7, 0x14141f, 0.85);
    selRing.strokeCircle(selPos.x, selPos.y, selRadius);
    selRing.lineStyle(3, 0xffffff, 1.0);
    selRing.strokeCircle(selPos.x, selPos.y, selRadius);
    this.highlights.push(selRing);

    if (piece.type === "wolf") {
      // Blue dots on valid step targets
      for (const nodeId of this.board.getValidMoves(piece)) {
        const pos = this._screenPos(nodes[nodeId]);
        const g = this.add.graphics();
        g.fillStyle(0x4488ff, 0.5);
        g.fillCircle(pos.x, pos.y, 12);
        this.highlights.push(g);
      }
      // Orange dots on capture landings + red rings on would-be-captured sheep
      for (const { landAt, remove } of this.board.getValidEats(piece)) {
        const landPos = this._screenPos(nodes[landAt]);
        const og = this.add.graphics();
        og.fillStyle(0xff8800, 0.5);
        og.fillCircle(landPos.x, landPos.y, 12);
        this.highlights.push(og);

        const removePos = this._screenPos(nodes[remove]);
        const rg = this.add.graphics();
        rg.lineStyle(7, 0x14141f, 0.85);
        rg.strokeCircle(removePos.x, removePos.y, PIECE_RADIUS.sheep + 9);
        rg.lineStyle(3, 0xff2222, 1.0);
        rg.strokeCircle(removePos.x, removePos.y, PIECE_RADIUS.sheep + 9);
        this.highlights.push(rg);
      }
    } else {
      // Blue dots on valid sheep step targets
      for (const nodeId of this.board.getValidSheepMoves(piece)) {
        const pos = this._screenPos(nodes[nodeId]);
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
  // for a placement, which has no origin to point from. Callers pass
  // board-local positions — the screen conversion happens here.
  _drawLastMoveMarker(fromRawPos, toRawPos) {
    if (this.lastMoveGraphics) { this.lastMoveGraphics.destroy(); this.lastMoveGraphics = null; }
    const g = this.add.graphics();
    const color = 0xffdd33;
    const toPos = this._screenPos(toRawPos);

    if (fromRawPos) {
      const fromPos = this._screenPos(fromRawPos);
      const dx = toPos.x - fromPos.x, dy = toPos.y - fromPos.y;
      const dist = Math.hypot(dx, dy);
      const ux = dx / dist, uy = dy / dist;
      const pad = 32; // keep the line clear of the piece artwork at both ends
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
      g.strokeCircle(toPos.x, toPos.y, PIECE_RADIUS.sheep + 9);
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
    for (const [id, rawPos] of Object.entries(this.board.config.nodes)) {
      if (!this.board.isEmpty(id)) continue;
      const pos = this._screenPos(rawPos);
      const g = this.add.graphics();
      g.fillStyle(0x4488ff, 0.4);
      g.fillCircle(pos.x, pos.y, 12);
      this.highlights.push(g);
    }
  }

  // ─── Task 7.1: smooth move tween (150 ms) ────────────────────────────────

  _animateMove(piece, _oldPos, newRawPos, onComplete) {
    const newPos = this._screenPos(newRawPos);
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

  // ─── Task 7.2: captured sheep exit animation ─────────────────────────────

  // A brief startled squash, then a spinning shrink-and-fade "knocked away"
  // exit, plus a small burst of wool puffs — reads as an actual event rather
  // than a plain fade.
  _animateCapture(piece) {
    if (!piece.graphics) return;
    const g = piece.graphics;
    this._spawnCapturePoof(g.x, g.y);

    this.tweens.add({
      targets: g,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 70,
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => {
        this.tweens.add({
          targets: g,
          scaleX: 0,
          scaleY: 0,
          angle: (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 80),
          alpha: 0,
          duration: 260,
          ease: "Back.easeIn",
          onComplete: () => {
            if (piece.graphics) { piece.graphics.destroy(); piece.graphics = null; }
          },
        });
      },
    });
  }

  // Small burst of wool-colored puffs radiating outward from a capture point,
  // each fading and growing as it flies out. Self-destroys on completion, so
  // it needs no external cleanup bookkeeping.
  _spawnCapturePoof(x, y) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 14 + Math.random() * 6;
      const g = this.add.graphics();
      g.setPosition(x, y);
      g.fillStyle(0xf3f1e8, 0.85);
      g.fillCircle(0, 0, 5 + Math.random() * 2);
      g.setScale(0.4);

      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scale: 1.3,
        alpha: 0,
        duration: 340,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }

  // ─── Hit-test helpers ────────────────────────────────────────────────────

  _hitPiece(pointer) {
    const bp = this._boardPoint(pointer);
    const all = [
      ...this.board.wolves,
      ...this.board.sheep.filter(s => s.alive),
    ];
    // Portrait pieces render much smaller on screen after scaling to fit a
    // narrow viewport (see design.md Decision 4) — the margin is added to
    // hit-testing only, so tap tolerance grows without the art itself doing so.
    const margin = this.isPortrait ? PORTRAIT_HIT_MARGIN : 0;
    for (const piece of all) {
      const pos = this.board.config.nodes[piece.nodeId];
      const r = PIECE_RADIUS[piece.type] + margin;
      const dx = bp.x - pos.x, dy = bp.y - pos.y;
      if (dx * dx + dy * dy <= r * r) return piece;
    }
    return null;
  }

  _hitNode(pointer) {
    const bp = this._boardPoint(pointer);
    // 40 in portrait (30 + PORTRAIT_HIT_MARGIN) stays well under half the
    // node spacing (150/2 = 75), so adjacent nodes never become ambiguous.
    const HIT = 30 + (this.isPortrait ? PORTRAIT_HIT_MARGIN : 0);
    let closest = null, closestDist = HIT;
    for (const [id, pos] of Object.entries(this.board.config.nodes)) {
      const dx = bp.x - pos.x, dy = bp.y - pos.y;
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
        const rawPos = this.board.config.nodes[action.nodeId];
        const pos = this._screenPos(rawPos);
        const g = this.add.graphics();
        g.setPosition(pos.x, pos.y);
        this._drawPieceShape(g, placed);
        placed.graphics = g;
        this.sfx.place();
        this._drawLastMoveMarker(null, rawPos);
        this.clearHighlights();
        this.finishAction();
      }
    }
  }

  // ─── Stubs for tasks 8, 10, 11 ───────────────────────────────────────────

  // Task 2.2: increment the wolf-win/sheep-win/draw count for the current
  // mode+difficulty bucket. Called (once per game — see the guard in
  // showResult) for every ending path: natural win/loss, draw, or resignation.
  _recordResult(winner) {
    const key = statsBucketKey(this.activeMode, this.difficulty);
    const stats = readStats();
    const bucket = stats[key] || { wolfWins: 0, sheepWins: 0, draws: 0 };
    if (winner === "wolf") bucket.wolfWins++;
    else if (winner === "sheep") bucket.sheepWins++;
    else bucket.draws++;
    stats[key] = bucket;
    writeStats(stats);
  }

  // Task 10.1 + 10.2: end-game overlay with "再来一局" button
  //
  // The existing "End-game overlay ... centered on the canvas" requirement
  // (board-ui spec, unchanged by this delta) has to keep holding under the
  // new portrait canvas dimensions too — this wasn't its own numbered task,
  // but the overlay's landscape-hardcoded center/size would otherwise land
  // wrong on the taller portrait canvas, so it's covered here.
  showResult(winner) {
    // Task 2.3: record exactly once per game, no matter how many times this
    // function re-renders (e.g. returning from the stats panel).
    if (!this._resultRecorded) {
      this._resultRecorded = true;
      this._recordResult(winner);
    }

    // Task 3.2: replace whatever's currently in the overlay region (e.g. the
    // stats panel, if this is a "back to result" re-render) rather than
    // stacking a second overlay on top of it.
    this._clearOverlayContent();

    const cx = this.isPortrait ? PORTRAIT_CANVAS_WIDTH / 2 : CANVAS_WIDTH / 2;
    const cy = this.isPortrait ? PORTRAIT_CANVAS_HEIGHT / 2 : CANVAS_HEIGHT / 2;
    const w = this.isPortrait ? PORTRAIT_CANVAS_WIDTH : CANVAS_WIDTH;
    const h = this.isPortrait ? PORTRAIT_CANVAS_HEIGHT : CANVAS_HEIGHT;

    const bg = this.add.rectangle(cx, cy, w, h, 0x000000, 0.75);
    this.overlayObjects.push(bg);

    const resultText =
      winner === "wolf" ? "狼方获胜！" : winner === "sheep" ? "羊方获胜！" : "平局！";
    const resultColor =
      winner === "wolf" ? "#ff6666" : winner === "sheep" ? "#88ccff" : "#cccccc";
    const label = this.add
      .text(cx, cy - 70, resultText, {
        fontSize: "52px",
        color: resultColor,
        fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      })
      .setOrigin(0.5);
    this.overlayObjects.push(label);

    const playAgainBtn = this.add
      .text(cx - 90, cy + 40, "再来一局", {
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

    // Task 5.1: shortcut into the stats panel, checkable without first
    // dismissing the result (which would restart the game).
    const statsBtn = this.add
      .text(cx + 90, cy + 40, "战绩", {
        fontSize: "24px",
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
        padding: { x: 20, y: 10 },
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayObjects.push(statsBtn);
    statsBtn.on("pointerover", () => statsBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    statsBtn.on("pointerout",  () => statsBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    statsBtn.on("pointerdown", () => this._showStatsPanel(this._statsPanelCloseCallback()));

    // Task 3.2: track which result is currently shown so the persistent
    // stats button (Decision 3a) and this overlay's own shortcut both know
    // what to return to.
    this._resultOverlayWinner = winner;
  }

  // Task 3.3/6.2/7.2: the close/back callback for the stats panel depends on
  // whether a result is currently showing (see design.md Decision 3a) — every
  // entry point (the overlay's own shortcut, and both persistent buttons)
  // shares this one computation instead of duplicating the branch.
  _statsPanelCloseCallback() {
    if (this._resultOverlayWinner != null) {
      return () => this.showResult(this._resultOverlayWinner);
    }
    return () => {
      this._clearOverlayContent();
      this._resultOverlayWinner = null;
    };
  }

  // Task 4.1: stats panel — one row per bucket (the two AI-opponent modes at
  // each of the three difficulties, plus the single 2p bucket: 7 rows total,
  // not 3×3 — 2p has no difficulty axis; see design.md Decision 3b), a
  // clear-stats control, and a close/back control wired to whatever the
  // caller decided (see _statsPanelCloseCallback).
  _showStatsPanel(onClose) {
    this._clearOverlayContent();

    const cx = this.isPortrait ? PORTRAIT_CANVAS_WIDTH / 2 : CANVAS_WIDTH / 2;
    const cy = this.isPortrait ? PORTRAIT_CANVAS_HEIGHT / 2 : CANVAS_HEIGHT / 2;
    const w = this.isPortrait ? PORTRAIT_CANVAS_WIDTH : CANVAS_WIDTH;
    const h = this.isPortrait ? PORTRAIT_CANVAS_HEIGHT : CANVAS_HEIGHT;

    const bg = this.add.rectangle(cx, cy, w, h, 0x000000, 0.95);
    this.overlayObjects.push(bg);

    const title = this.add
      .text(cx, cy - 260, "战绩", {
        fontSize: "36px",
        color: "#ffffff",
        fontFamily: '"Microsoft YaHei", sans-serif',
      })
      .setOrigin(0.5);
    this.overlayObjects.push(title);

    const ROWS = [
      { key: "wolf|easy", label: "玩家执狼 · 简单" },
      { key: "wolf|medium", label: "玩家执狼 · 普通" },
      { key: "wolf|hard", label: "玩家执狼 · 困难" },
      { key: "sheep|easy", label: "玩家执羊 · 简单" },
      { key: "sheep|medium", label: "玩家执羊 · 普通" },
      { key: "sheep|hard", label: "玩家执羊 · 困难" },
      { key: "2p", label: "双人对战" },
    ];
    const stats = readStats();

    const headerY = cy - 210;
    const rowHeight = 38;
    const labelX = cx - 260;
    const col1X = cx + 60;  // 狼胜
    const col2X = cx + 160; // 羊胜
    const col3X = cx + 260; // 平局
    const textFont = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
    const headerStyle = { fontSize: "18px", color: "#aaaaaa", fontFamily: textFont };
    const rowStyle = { fontSize: "22px", color: "#ffffff", fontFamily: textFont };

    this.overlayObjects.push(
      this.add.text(labelX, headerY, "模式", headerStyle).setOrigin(0, 0.5),
      this.add.text(col1X, headerY, "狼胜", headerStyle).setOrigin(0.5),
      this.add.text(col2X, headerY, "羊胜", headerStyle).setOrigin(0.5),
      this.add.text(col3X, headerY, "平局", headerStyle).setOrigin(0.5)
    );

    // Zebra striping: rows span a wide horizontal distance (label all the
    // way out to the 平局 column), so a faint alternating background makes
    // it easy to track one row across the columns without losing your place.
    const stripeLeft = labelX - 10;
    const stripeRight = col3X + 40;
    const stripeCenterX = (stripeLeft + stripeRight) / 2;
    const stripeWidth = stripeRight - stripeLeft;

    ROWS.forEach((row, i) => {
      const y = headerY + rowHeight * (i + 1);
      const bucket = stats[row.key] || { wolfWins: 0, sheepWins: 0, draws: 0 };
      if (i % 2 === 1) {
        const stripe = this.add.rectangle(stripeCenterX, y, stripeWidth, rowHeight - 4, 0xffffff, 0.06);
        this.overlayObjects.push(stripe);
      }
      this.overlayObjects.push(
        this.add.text(labelX, y, row.label, rowStyle).setOrigin(0, 0.5),
        this.add.text(col1X, y, String(bucket.wolfWins), rowStyle).setOrigin(0.5),
        this.add.text(col2X, y, String(bucket.sheepWins), rowStyle).setOrigin(0.5),
        this.add.text(col3X, y, String(bucket.draws), rowStyle).setOrigin(0.5)
      );
    });

    const buttonsY = headerY + rowHeight * (ROWS.length + 1) + 40;
    const btnStyle = {
      fontSize: "20px",
      padding: { x: 16, y: 8 },
      fontFamily: '"Microsoft YaHei", sans-serif',
    };

    // Task 4.2: clear stats, then redraw this same panel in place — stays
    // open so the zeroed totals are visible immediately.
    const clearBtn = this.add
      .text(cx - 90, buttonsY, "清空战绩", { ...btnStyle, color: "#cccccc", backgroundColor: "#2a2a3a" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayObjects.push(clearBtn);
    clearBtn.on("pointerover", () => clearBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    clearBtn.on("pointerout",  () => clearBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    clearBtn.on("pointerdown", () => {
      clearStats();
      this._showStatsPanel(onClose);
    });

    // Task 4.3: "返回" when there's a result to return to, "关闭" otherwise.
    const closeLabel = this._resultOverlayWinner != null ? "返回" : "关闭";
    const closeBtn = this.add
      .text(cx + 90, buttonsY, closeLabel, { ...btnStyle, color: "#ffffff", backgroundColor: "#335533" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.overlayObjects.push(closeBtn);
    closeBtn.on("pointerover", () => closeBtn.setStyle({ backgroundColor: "#447744" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ backgroundColor: "#335533" }));
    closeBtn.on("pointerdown", onClose);
  }

  // Task 3.1: destroy every object currently shown in the overlay region and
  // empty the array, without touching board/game state. Used both by
  // resetGame() (as part of a full teardown) and by showResult()/
  // _showStatsPanel() (to swap the overlay's content in place — see
  // design.md Decision 2).
  _clearOverlayContent() {
    for (const o of this.overlayObjects) {
      if (o && typeof o.destroy === "function") o.destroy();
    }
    this.overlayObjects = [];
  }

  // Task 10.3: tear down everything and re-initialise from current config
  resetGame() {
    this._clearOverlayContent();

    for (const piece of [...this.board.wolves, ...this.board.sheep]) {
      if (piece.graphics) { piece.graphics.destroy(); piece.graphics = null; }
    }
    if (this.boardGraphics) { this.boardGraphics.destroy(); this.boardGraphics = null; }
    if (this.lastMoveGraphics) { this.lastMoveGraphics.destroy(); this.lastMoveGraphics = null; }
    this.positionHistory = new Map();
    this._resultRecorded = false;
    this._resultOverlayWinner = null;

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
    const cx = RIGHT_SIDEBAR_X;
    const baseStyle = {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    };
    const smallStyle = { ...baseStyle, fontSize: "16px", color: "#cccccc" };

    // Turn indicator
    this.hudObjects.turnLabel = this.add.text(cx, 40, "", baseStyle).setOrigin(0.5, 0);

    // On-board sheep count
    this.hudObjects.sheepCountLabel = this.add
      .text(cx, 82, "", { ...baseStyle, fontSize: "20px" })
      .setOrigin(0.5, 0);

    // Reserve count — below sheep count (shown during a placement phase)
    this.hudObjects.reserveLabel = this.add
      .text(cx, 114, "", smallStyle)
      .setOrigin(0.5, 0)
      .setVisible(false);

    // Phase label — below reserve count (shown during a placement phase)
    this.hudObjects.phaseLabel = this.add
      .text(cx, 136, "", smallStyle)
      .setOrigin(0.5, 0)
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

  // Landscape layout: a permanent left sidebar for game settings (mode +
  // AI difficulty — no modal, selecting an option applies immediately and
  // restarts) and a permanent right sidebar for status + restart/resign.
  // Replaces the old bottom-bar buttons and popup settings panel.

  _initLeftSidebar() {
    const cx = LEFT_SIDEBAR_X;

    this.add.text(cx, 50, "游戏设置", {
      fontSize: "26px", color: "#ffffff",
      fontFamily: '"Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

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

    // Vertically stacked option buttons, centered in the sidebar column.
    const makeStackedBtns = (opts, y0, ySpacing, getActive, onSelect) => {
      const btnObjs = opts.map((opt, i) => {
        const active = getActive() === opt.key;
        const btn = this.add
          .text(cx, y0 + i * ySpacing, opt.label, {
            fontSize: "18px",
            color: active ? "#ffffff" : "#888888",
            backgroundColor: active ? "#3355aa" : "#2a2a3a",
            padding: { x: 16, y: 9 },
            fontFamily: '"Microsoft YaHei", sans-serif',
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        return { btn, key: opt.key };
      });
      const refresh = () => {
        btnObjs.forEach(({ btn, key }) => {
          btn.setStyle({
            color: getActive() === key ? "#ffffff" : "#888888",
            backgroundColor: getActive() === key ? "#3355aa" : "#2a2a3a",
          });
        });
      };
      btnObjs.forEach(({ btn, key }) => {
        btn.on("pointerdown", () => {
          if (this.animating) return;
          onSelect(key);
          refresh();
        });
      });
      return { btnObjs, refresh };
    };

    this.add.text(cx, 115, "游戏模式", {
      fontSize: "16px", color: "#aaaaaa",
      fontFamily: '"Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    const modeSidebar = makeStackedBtns(
      MODE_OPTS, 155, 52,
      () => this.activeMode,
      (key) => {
        this.activeMode = key;
        this.resetGame();
        difficultySidebar.refresh();
      }
    );

    this.add.text(cx, 345, "AI 难度", {
      fontSize: "16px", color: "#aaaaaa",
      fontFamily: '"Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    const difficultySidebar = makeStackedBtns(
      DIFFICULTY_OPTS, 385, 52,
      () => this.difficulty,
      (key) => {
        this.difficulty = key;
        this.ai.difficulty = key;
        this.resetGame();
        modeSidebar.refresh();
      }
    );
  }

  // Bare glyph-run width for a string in the given font, with no padding or
  // letter spacing — used to work out how much extra letter spacing "认输"
  // needs to span the same width as "重新开始" (see _initRightSidebarButtons).
  _measureTextWidth(text, fontStyle) {
    const t = this.add.text(0, 0, text, fontStyle);
    const w = t.width;
    t.destroy();
    return w;
  }

  _initRightSidebarButtons() {
    const cx = RIGHT_SIDEBAR_X;
    const fontStyle = { fontSize: "20px", fontFamily: '"Microsoft YaHei", sans-serif' };
    const btnFontStyle = { ...fontStyle, padding: { x: 22, y: 10 }, align: "center" };

    // "认输"/"战绩" are only two characters where "重新开始" is four;
    // stretching their one gap so the glyph run spans the same width as
    // "重新开始" (rather than a small fixed gap) makes all three labels line
    // up as a matched set.
    const restartTextWidth = this._measureTextWidth("重新开始", fontStyle);
    const resignTextWidth = this._measureTextWidth("认输", fontStyle);
    const statsTextWidth = this._measureTextWidth("战绩", fontStyle);
    const resignLetterSpacing = restartTextWidth - resignTextWidth;
    const statsLetterSpacing = restartTextWidth - statsTextWidth;

    const restartBtn = this.add
      .text(cx, 620, "重新开始", {
        ...btnFontStyle,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on("pointerover", () => restartBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    restartBtn.on("pointerout",  () => restartBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    restartBtn.on("pointerdown", () => this.resetGame());

    const resignBtn = this.add
      .text(cx, 680, "认输", {
        ...btnFontStyle,
        letterSpacing: resignLetterSpacing,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resignBtn.on("pointerover", () => resignBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    resignBtn.on("pointerout",  () => resignBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    resignBtn.on("pointerdown", () => this.resign());

    // Task 6.1/6.2: third button, same width-matching treatment, below the
    // existing pair. Its close callback depends on whether a result is
    // currently showing — see design.md Decision 3a / _statsPanelCloseCallback.
    const statsBtn = this.add
      .text(cx, 740, "战绩", {
        ...btnFontStyle,
        letterSpacing: statsLetterSpacing,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    statsBtn.on("pointerover", () => statsBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    statsBtn.on("pointerout",  () => statsBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    statsBtn.on("pointerdown", () => this._showStatsPanel(this._statsPanelCloseCallback()));

    // All three labels now occupy matching glyph-run widths, but pin all
    // three to the same pill footprint too so rounding differences can't
    // show through.
    const w = Math.max(restartBtn.width, resignBtn.width, statsBtn.width);
    const h = Math.max(restartBtn.height, resignBtn.height, statsBtn.height);
    restartBtn.setFixedSize(w, h);
    resignBtn.setFixedSize(w, h);
    statsBtn.setFixedSize(w, h);
  }

  // ─── Portrait layout (see design.md Decision 1: two independent layout
  // builders rather than one shared, parameterized layout) ─────────────────

  // Top band: turn/status text + restart/resign buttons, laid out in
  // horizontal rows — the landscape right sidebar's content, rotated to fit
  // the width now available instead of a narrow vertical column.
  _initPortraitTopBand() {
    const cx = PORTRAIT_CANVAS_WIDTH / 2;
    const leftX = cx - 140;
    const rightX = cx + 140;
    const baseStyle = {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    };
    const smallStyle = { ...baseStyle, fontSize: "16px", color: "#cccccc" };

    this.hudObjects.turnLabel = this.add.text(leftX, 16, "", baseStyle).setOrigin(0.5, 0);
    this.hudObjects.sheepCountLabel = this.add
      .text(rightX, 16, "", { ...baseStyle, fontSize: "20px" })
      .setOrigin(0.5, 0);
    this.hudObjects.reserveLabel = this.add
      .text(leftX, 48, "", smallStyle)
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.hudObjects.phaseLabel = this.add
      .text(rightX, 48, "", smallStyle)
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.updateHUD();

    // Task 7.1: three buttons — 战绩 / 重新开始 / 认输 — in one row instead of
    // the previous two, all width-matched to the widest label. Kept at the
    // same y=100 so PORTRAIT_TOP_HEIGHT doesn't need to change.
    const statsX = cx - 220, midX = cx, resignX = cx + 220;
    const fontStyle = { fontSize: "20px", fontFamily: '"Microsoft YaHei", sans-serif' };
    const btnFontStyle = { ...fontStyle, padding: { x: 22, y: 10 }, align: "center" };
    const restartTextWidth = this._measureTextWidth("重新开始", fontStyle);
    const resignTextWidth = this._measureTextWidth("认输", fontStyle);
    const statsTextWidth = this._measureTextWidth("战绩", fontStyle);
    const resignLetterSpacing = restartTextWidth - resignTextWidth;
    const statsLetterSpacing = restartTextWidth - statsTextWidth;

    const statsBtn = this.add
      .text(statsX, 100, "战绩", {
        ...btnFontStyle,
        letterSpacing: statsLetterSpacing,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    statsBtn.on("pointerover", () => statsBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    statsBtn.on("pointerout",  () => statsBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    statsBtn.on("pointerdown", () => this._showStatsPanel(this._statsPanelCloseCallback()));

    const restartBtn = this.add
      .text(midX, 100, "重新开始", { ...btnFontStyle, color: "#cccccc", backgroundColor: "#2a2a3a" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on("pointerover", () => restartBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    restartBtn.on("pointerout",  () => restartBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    restartBtn.on("pointerdown", () => this.resetGame());

    const resignBtn = this.add
      .text(resignX, 100, "认输", {
        ...btnFontStyle,
        letterSpacing: resignLetterSpacing,
        color: "#cccccc",
        backgroundColor: "#2a2a3a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resignBtn.on("pointerover", () => resignBtn.setStyle({ backgroundColor: "#3a3a4e", color: "#ffffff" }));
    resignBtn.on("pointerout",  () => resignBtn.setStyle({ backgroundColor: "#2a2a3a", color: "#cccccc" }));
    resignBtn.on("pointerdown", () => this.resign());

    const w = Math.max(restartBtn.width, resignBtn.width, statsBtn.width);
    const h = Math.max(restartBtn.height, resignBtn.height, statsBtn.height);
    restartBtn.setFixedSize(w, h);
    resignBtn.setFixedSize(w, h);
    statsBtn.setFixedSize(w, h);
  }

  // Bottom band: mode + AI-difficulty selection, each a horizontal row of
  // buttons — the landscape left sidebar's content, rotated the same way.
  _initPortraitBottomBand() {
    const cx = PORTRAIT_CANVAS_WIDTH / 2;
    const baseY = PORTRAIT_TOP_HEIGHT + 800;
    const xs = [cx - 267, cx, cx + 267];

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

    // Horizontally spread option buttons — mirrors landscape's
    // `makeStackedBtns` closure, but varies x at a fixed y instead of y at a
    // fixed x. Not shared with it; see design.md Decision 1.
    const makeRowBtns = (opts, y, getActive, onSelect) => {
      const btnObjs = opts.map((opt, i) => {
        const active = getActive() === opt.key;
        const btn = this.add
          .text(xs[i], y, opt.label, {
            fontSize: "18px",
            color: active ? "#ffffff" : "#888888",
            backgroundColor: active ? "#3355aa" : "#2a2a3a",
            padding: { x: 16, y: 9 },
            fontFamily: '"Microsoft YaHei", sans-serif',
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        return { btn, key: opt.key };
      });
      const refresh = () => {
        btnObjs.forEach(({ btn, key }) => {
          btn.setStyle({
            color: getActive() === key ? "#ffffff" : "#888888",
            backgroundColor: getActive() === key ? "#3355aa" : "#2a2a3a",
          });
        });
      };
      btnObjs.forEach(({ btn, key }) => {
        btn.on("pointerdown", () => {
          if (this.animating) return;
          onSelect(key);
          refresh();
        });
      });
      return { btnObjs, refresh };
    };

    this.add.text(cx, baseY + 15, "游戏模式", {
      fontSize: "16px", color: "#aaaaaa",
      fontFamily: '"Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    const modeRow = makeRowBtns(
      MODE_OPTS, baseY + 50,
      () => this.activeMode,
      (key) => {
        this.activeMode = key;
        this.resetGame();
        difficultyRow.refresh();
      }
    );

    this.add.text(cx, baseY + 95, "AI 难度", {
      fontSize: "16px", color: "#aaaaaa",
      fontFamily: '"Microsoft YaHei", sans-serif',
    }).setOrigin(0.5);

    const difficultyRow = makeRowBtns(
      DIFFICULTY_OPTS, baseY + 130,
      () => this.difficulty,
      (key) => {
        this.difficulty = key;
        this.ai.difficulty = key;
        this.resetGame();
        modeRow.refresh();
      }
    );
  }

  update() {}
}

// ─── Phaser Game Config ───────────────────────────────────────────────────────

// Task 4.1: landscape canvas (board + left/right sidebars), dark background
const config = {
  type: Phaser.AUTO,
  width: isPortrait ? PORTRAIT_CANVAS_WIDTH : CANVAS_WIDTH,
  height: isPortrait ? PORTRAIT_CANVAS_HEIGHT : CANVAS_HEIGHT,
  backgroundColor: 0x1a1a2e,
  parent: "game-container",
  scene: GameScene,
  // Landscape: FIT scales both dimensions down to fit inside the viewport —
  // nothing should overflow. Portrait: the logical canvas is deliberately
  // taller than one viewport (top+board+bottom bands), so WIDTH_CONTROLS_HEIGHT
  // scales to the viewport's width and lets the excess height overflow —
  // that overflow is the scroll-to-reveal bottom settings band. See
  // design.md Decision 3.
  scale: {
    mode: isPortrait ? Phaser.Scale.WIDTH_CONTROLS_HEIGHT : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  // Snap object positions to whole pixels — the WebGL renderer otherwise
  // linear-filters textures (including text) sitting at fractional pixel
  // coordinates, which reads as blur even at correct texture resolution.
  render: { roundPixels: true },
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) window.__game = game;
