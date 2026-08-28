## 1. Board Config Data

- [x] 1.1 Write `BOARD_CONFIGS.grid5x5` with all 25 node pixel positions and horizontal/vertical adjacency map
- [x] 1.2 Write `BOARD_CONFIGS.traditional` with all 19 node pixel positions (main 3×3, two necks, two diamonds)
- [x] 1.3 Add all traditional board adjacency entries: main grid horizontal + vertical + diagonal, neck-to-row and neck-to-diamond connections
- [x] 1.4 Add wolfStart, sheepStart, sheepReserve fields to both configs
- [x] 1.5 Add startup assertion that verifies adjacency map symmetry for both configs

## 2. Board Engine (class Board)

- [x] 2.1 Implement `Board` constructor: populate `occupancy` map from config wolfStart/sheepStart, create `Piece` objects, set `placingPhase`
- [x] 2.2 Implement `Board.isEmpty(nodeId)` and `Board.pieceAt(nodeId)`
- [x] 2.3 Implement `Board.getValidMoves(wolf)`: return empty neighbors (respecting the blocking rule — sealed directions excluded)
- [x] 2.4 Implement collinear node lookup helper: given A, B (neighbor of A), return the node C that is the neighbor of B collinear beyond B from A
- [x] 2.5 Implement `Board.getValidEats(wolf)`: for each neighbor B with a sheep, look up collinear C; if C is empty, add `{landAt: C, remove: B}`
- [x] 2.6 Implement `Board.getValidSheepMoves(sheep)`: return empty neighbors
- [x] 2.7 Implement `Board.move(piece, nodeId)`: update occupancy, update piece.nodeId
- [x] 2.8 Implement `Board.eat(wolf, landId)`: move wolf to landId, set capturedSheep.alive=false, remove from occupancy
- [x] 2.9 Implement `Board.placeSheep(nodeId)`: create new sheep at node, decrement sheepReserve, update placingPhase
- [x] 2.10 Implement `Board.checkWin()`: return 'wolf' if alive sheep count = 0; return 'sheep' if all wolves have empty valid moves AND empty valid eats; return null otherwise

## 3. AI Player (class AIPlayer)

- [x] 3.1 Implement `AIPlayer.makeWolfMove(board)`: collect all valid captures across all wolves; if any exist pick one randomly, else pick a random valid step; return `{type, wolf, nodeId, removeId}`
- [x] 3.2 Implement `AIPlayer.makeSheepMove(board)`: if placingPhase pick random empty node; else pick random sheep with valid moves and a random step; return `{type, sheep, nodeId}`

## 4. Phaser Scene — Board Rendering (class GameScene)

- [x] 4.1 Set up Phaser config: 800×800, parent "game-container", backgroundColor 0x1a1a2e (dark), scene: GameScene
- [x] 4.2 Implement `GameScene.create()`: initialize board from active config, call `drawBoard()` and `drawPieces()`
- [x] 4.3 Implement `drawBoard()`: iterate all adjacency pairs (each edge drawn once), draw lines with `this.add.graphics()`
- [x] 4.4 Implement `drawPieces()`: for each wolf/sheep create a `this.add.graphics()` circle at node pixel position; store reference on piece object
- [x] 4.5 Implement `redrawPiece(piece)`: clear and redraw piece circle at current node position (used after move)
- [x] 4.6 Implement opacity update: after computing legal moves for active side, set 0.4 alpha on pieces with no legal actions, 1.0 on others

## 5. Phaser Scene — Interaction

- [x] 5.1 Register `this.input.on('pointerdown', this.onPointerDown, this)` in `create()`
- [x] 5.2 Implement `onPointerDown(pointer)`: if animating, return; hit-test pointer against all pieces at their node positions; route to `selectPiece` or `executeAction`
- [x] 5.3 Implement `selectPiece(piece)`: set `this.selected = piece`, call `drawHighlights()`
- [x] 5.4 Implement `drawHighlights()`: draw white ring on selected piece; blue circles on valid step targets; for wolf selection also draw orange circles on capture landings and red rings on would-be-captured sheep
- [x] 5.5 Implement `clearHighlights()`: destroy all highlight graphics objects
- [x] 5.6 Implement `executeAction(targetNodeId)`: determine if target is a step or capture, call `board.move` or `board.eat`, trigger animation, then call `finishAction()`

## 6. Phaser Scene — Sheep Placement Interaction

- [x] 6.1 During sheep's turn in placement phase, treat pointer clicks on empty nodes as `board.placeSheep(nodeId)` calls
- [x] 6.2 Visually indicate valid placement targets (blue circles on all empty nodes) when it is the sheep player's placement turn

## 7. Phaser Scene — Animations

- [x] 7.1 Implement move tween: `this.tweens.add` on piece graphics x/y from old to new position over 150ms; set `this.animating = true` at start, `false` on complete
- [x] 7.2 Implement capture fade-out: `this.tweens.add` on captured sheep graphics alpha from 1 to 0 over 200ms; destroy graphics object on complete

## 8. Phaser Scene — HUD

- [x] 8.1 Create Phaser Text objects for turn label ("请狼走"/"请羊走"), sheep count label, reserve count label, phase label
- [x] 8.2 Implement `updateHUD()`: set text values from current board state; hide reserve/phase labels when not on traditional board or placingPhase is false
- [x] 8.3 Call `updateHUD()` at end of every `finishAction()`

## 9. Phaser Scene — Turn Flow and Win Check

- [x] 9.1 Implement `finishAction()`: call `board.checkWin()`; if winner call `showResult(winner)`; else call `nextTurn()`
- [x] 9.2 Implement `nextTurn()`: toggle `activeSide`; call `updateHUD()`; if AI's turn schedule `this.time.delayedCall(400, executeAITurn)`
- [x] 9.3 Implement `executeAITurn()`: call AIPlayer method for active side; apply action to board; animate; call `finishAction()`

## 10. Phaser Scene — End-Game Overlay

- [x] 10.1 Implement `showResult(winner)`: draw semi-transparent dark rectangle covering board; add text "狼方获胜！" or "羊方获胜！"; add "再来一局" button
- [x] 10.2 Wire "再来一局" button to `resetGame()`
- [x] 10.3 Implement `resetGame()`: destroy all pieces and highlights, destroy overlay, re-initialize board from config, redraw

## 11. Settings and Restart

- [x] 11.1 Add "重新开始" Phaser Text/button to the scene; wire to `resetGame()`
- [x] 11.2 Implement settings panel (Phaser overlay graphics + text buttons): two options for board type, three for game mode
- [x] 11.3 Wire settings confirm to update `activeBoardConfig` and `activeMode`, then call `resetGame()`

## 12. Verification

- [x] 12.1 Test grid board: 3 wolves start at row 0, 15 sheep at rows 2–4, normal click-to-move works
- [x] 12.2 Test traditional board: 2 wolves at necks, 8 sheep in middle ring, reserve sheep enter one per turn
- [x] 12.3 Test wolf jump-capture: wolf lands correctly, sheep disappears
- [x] 12.4 Test blocking rule: wolf adjacent to sheep with no exit cannot move or capture in that direction
- [x] 12.5 Test sheep-wins: arrange all wolves to be surrounded and verify overlay appears
- [x] 12.6 Test wolf-wins: eat all sheep and verify overlay appears
- [x] 12.7 Test all three game modes in both boards
- [x] 12.8 Test "重新开始" mid-game correctly resets all state
