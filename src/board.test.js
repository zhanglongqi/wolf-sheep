import { describe, it, expect } from "vitest";
import { BOARD_CONFIGS, Board, AIPlayer } from "./board.js";

// Small custom configs, independent of BOARD_CONFIGS.grid5x5, so each
// scenario's geometry is easy to read directly off the node coordinates
// rather than having to reason about the full 5x5 grid. Board.eat()'s
// capture logic is coordinate-based (it walks from A through B and looks
// for a node at B's position plus the same offset again), so every config
// below uses real collinear x/y coordinates, not just an adjacency list.

// A 3-node straight line: A—B—C. Used for basic capture legality.
const LINE3 = {
  nodes: { A: { x: 0, y: 0 }, B: { x: 1, y: 0 }, C: { x: 2, y: 0 } },
  adjacency: { A: ["B"], B: ["A", "C"], C: ["B"] },
  wolfStart: [],
  sheepStart: [],
  sheepReserve: 0,
};

// A 2-node line: A—B, with nothing beyond B. Used for the "blocked by the
// edge of the board" case (no landing node exists at all).
const LINE2 = {
  nodes: { A: { x: 0, y: 0 }, B: { x: 1, y: 0 } },
  adjacency: { A: ["B"], B: ["A"] },
  wolfStart: [],
  sheepStart: [],
  sheepReserve: 0,
};

// A 4-node straight line: P1—P2—P3—P4. Used for the medium-AI safety-filter
// test (a sheep at P3 can step to P2, which a wolf at P1 could then capture
// through to the vacated P3, or step to P4, which is out of the wolf's reach).
const LINE4 = {
  nodes: { P1: { x: 0, y: 0 }, P2: { x: 1, y: 0 }, P3: { x: 2, y: 0 }, P4: { x: 3, y: 0 } },
  adjacency: { P1: ["P2"], P2: ["P1", "P3"], P3: ["P2", "P4"], P4: ["P3"] },
  wolfStart: [],
  sheepStart: [],
  sheepReserve: 0,
};

// A wolf at A with a sheep at B, an empty landing at C, and a second empty
// node D also adjacent to A — so the wolf has both a legal capture (to C)
// and a legal plain step (to D) available at the same time. Used for the
// medium-AI forced-capture test and the hard-AI maximization test.
const CAPTURE_OR_STEP = {
  nodes: { A: { x: 0, y: 0 }, B: { x: 1, y: 0 }, C: { x: 2, y: 0 }, D: { x: 0, y: 1 } },
  adjacency: { A: ["B", "D"], B: ["A", "C"], C: ["B"], D: ["A"] },
  wolfStart: [],
  sheepStart: [],
  sheepReserve: 0,
};

function makeBoard(config, { wolfStart = [], sheepStart = [], sheepReserve = 0 } = {}) {
  return new Board({ ...config, wolfStart, sheepStart, sheepReserve });
}

describe("Board — move/capture legality", () => {
  it("getValidMoves returns only empty adjacent nodes, on the real grid5x5 config", () => {
    const board = new Board(BOARD_CONFIGS.grid5x5);
    const wolf = board.wolves.find(w => w.nodeId === "2,0");
    // Row 1 is entirely empty at the start, row 0 has wolves at col 0/2/4.
    expect(board.getValidMoves(wolf).sort()).toEqual(["1,0", "2,1", "3,0"].sort());
  });

  it("getValidEats is empty at the start (no wolf is adjacent to a sheep)", () => {
    const board = new Board(BOARD_CONFIGS.grid5x5);
    for (const wolf of board.wolves) {
      expect(board.getValidEats(wolf)).toEqual([]);
    }
  });

  it("a legal capture requires an empty landing node", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepStart: ["B"] });
    const wolf = board.wolves[0];
    expect(board.getValidEats(wolf)).toEqual([{ landAt: "C", remove: "B" }]);
  });

  it("block-off rule: direction is sealed when the landing node is occupied", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepStart: ["B", "C"] });
    const wolf = board.wolves[0];
    expect(board.getValidMoves(wolf)).toEqual([]); // B is occupied
    expect(board.getValidEats(wolf)).toEqual([]);  // landing C is also occupied
  });

  it("block-off rule: direction is sealed when there is no landing node at all (board edge)", () => {
    const board = makeBoard(LINE2, { wolfStart: ["A"], sheepStart: ["B"] });
    const wolf = board.wolves[0];
    expect(board.getValidMoves(wolf)).toEqual([]); // B is occupied
    expect(board.getValidEats(wolf)).toEqual([]);  // nothing exists beyond B
  });
});

describe("Board — move/eat state transitions", () => {
  it("move() relocates the piece and updates occupancy", () => {
    const board = new Board(BOARD_CONFIGS.grid5x5);
    const wolf = board.wolves.find(w => w.nodeId === "0,0");
    board.move(wolf, "0,1");
    expect(wolf.nodeId).toBe("0,1");
    expect(board.occupancy["0,0"]).toBeNull();
    expect(board.occupancy["0,1"]).toBe(wolf);
  });

  it("eat() removes the captured piece, marks it dead, and relocates the wolf", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepStart: ["B"] });
    const wolf = board.wolves[0];
    const sheep = board.sheep[0];
    const captured = board.eat(wolf, "C");
    expect(captured).toBe(sheep);
    expect(sheep.alive).toBe(false);
    expect(wolf.nodeId).toBe("C");
    expect(board.occupancy["A"]).toBeNull();
    expect(board.occupancy["B"]).toBeNull();
    expect(board.occupancy["C"]).toBe(wolf);
  });
});

describe("Board — placeSheep (placement phase)", () => {
  it("decrements the reserve and adds the piece", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepReserve: 2 });
    expect(board.placingPhase).toBe(true);
    const placed = board.placeSheep("B");
    expect(placed).not.toBeNull();
    expect(board.sheepReserve).toBe(1);
    expect(board.placingPhase).toBe(true); // reserve still > 0
    expect(board.occupancy["B"]).toBe(placed);
  });

  it("flips placingPhase to false exactly when the reserve reaches zero", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepReserve: 1 });
    board.placeSheep("B");
    expect(board.sheepReserve).toBe(0);
    expect(board.placingPhase).toBe(false);
  });

  it("rejects placement on an occupied node", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepReserve: 2 });
    expect(board.placeSheep("A")).toBeNull();
    expect(board.sheepReserve).toBe(2); // unchanged
  });

  it("rejects placement once the reserve is exhausted", () => {
    const board = makeBoard(LINE3, { wolfStart: ["A"], sheepReserve: 0 });
    expect(board.placeSheep("B")).toBeNull();
  });
});

describe("Board — checkWin", () => {
  it("returns null when neither side has won yet", () => {
    const board = new Board(BOARD_CONFIGS.grid5x5);
    expect(board.checkWin()).toBeNull();
  });

  it("wolf wins once every sheep is gone and no reserve remains", () => {
    const board = new Board(BOARD_CONFIGS.grid5x5);
    for (const s of board.sheep) {
      s.alive = false;
      board.occupancy[s.nodeId] = null;
    }
    expect(board.checkWin()).toBe("wolf");
  });

  it("sheep win once every wolf is simultaneously immobile (with sheep still alive elsewhere)", () => {
    // The wolf at A has zero neighbors, so it has no moves and no captures.
    // A live sheep exists on an unrelated, disconnected node B so the
    // "all sheep gone" wolf-win check doesn't short-circuit first.
    const board = makeBoard(
      {
        nodes: { A: { x: 0, y: 0 }, B: { x: 10, y: 10 } },
        adjacency: { A: [], B: [] },
      },
      { wolfStart: ["A"], sheepStart: ["B"] }
    );
    expect(board.checkWin()).toBe("sheep");
  });
});

describe("AIPlayer — legal-action membership across difficulties", () => {
  const DIFFICULTIES = ["easy", "medium", "hard"];

  it.each(DIFFICULTIES)("makeWolfMove (%s) always returns a legal action", (difficulty) => {
    const ai = new AIPlayer(difficulty);
    for (let i = 0; i < 15; i++) {
      const board = new Board(BOARD_CONFIGS.grid5x5);
      const action = ai.makeWolfMove(board);
      expect(action).not.toBeNull();
      if (action.type === "step") {
        expect(board.getValidMoves(action.wolf)).toContain(action.nodeId);
      } else {
        const legal = board.getValidEats(action.wolf);
        expect(legal).toContainEqual({ landAt: action.nodeId, remove: action.removeId });
      }
    }
  });

  it.each(DIFFICULTIES)("makeSheepMove (%s) always returns a legal action", (difficulty) => {
    const ai = new AIPlayer(difficulty);
    for (let i = 0; i < 15; i++) {
      const board = new Board(BOARD_CONFIGS.grid5x5);
      const action = ai.makeSheepMove(board);
      expect(action).not.toBeNull();
      expect(action.type).toBe("step"); // sheepReserve is 0 on grid5x5, never "place"
      expect(board.getValidSheepMoves(action.sheep)).toContain(action.nodeId);
    }
  });
});

describe("AIPlayer — medium difficulty", () => {
  it("wolf always captures when a capture is legal, never takes a plain step instead", () => {
    const ai = new AIPlayer("medium");
    for (let i = 0; i < 20; i++) {
      const board = makeBoard(CAPTURE_OR_STEP, { wolfStart: ["A"], sheepStart: ["B"] });
      const action = ai.makeWolfMove(board);
      expect(action.type).toBe("eat");
      expect(action.nodeId).toBe("C");
      expect(action.removeId).toBe("B");
    }
  });

  it("sheep avoids a move that would let a wolf capture it next turn, when a safe move exists", () => {
    const ai = new AIPlayer("medium");
    for (let i = 0; i < 20; i++) {
      const board = makeBoard(LINE4, { wolfStart: ["P1"], sheepStart: ["P3"] });
      const action = ai.makeSheepMove(board);
      // Stepping to P2 would vacate P3, letting the wolf at P1 jump
      // P1→P2→P3; stepping to P4 is out of the wolf's reach entirely.
      expect(action.nodeId).toBe("P4");
    }
  });
});

describe("AIPlayer — hard difficulty", () => {
  it("wolf always chooses an action whose score matches the best achievable score", () => {
    const ai = new AIPlayer("hard");
    const board = new Board(BOARD_CONFIGS.grid5x5);

    const candidates = [];
    for (const wolf of board.wolves) {
      for (const { landAt, remove } of board.getValidEats(wolf)) {
        candidates.push({ type: "eat", wolf, nodeId: landAt, removeId: remove });
      }
      for (const nodeId of board.getValidMoves(wolf)) {
        candidates.push({ type: "step", wolf, nodeId });
      }
    }
    const bestScore = Math.max(...candidates.map(c => ai._scoreWolfAction(board, c)));

    const chosen = ai.makeWolfMove(board);
    const chosenScore = ai._scoreWolfAction(board, chosen);
    expect(chosenScore).toBe(bestScore);
  });

  it("wolf chooses the capture over the step when both are legal (capture scores strictly higher)", () => {
    const ai = new AIPlayer("hard");
    const board = makeBoard(CAPTURE_OR_STEP, { wolfStart: ["A"], sheepStart: ["B"] });
    const action = ai.makeWolfMove(board);
    expect(action.type).toBe("eat");
  });
});
