## ADDED Requirements

### Requirement: Wolf valid moves computed correctly
`Board.getValidMoves(wolf)` SHALL return a list of node IDs that the wolf can step to: all neighbors of the wolf's current node that are empty.

#### Scenario: Wolf with open neighbors
- **WHEN** `getValidMoves` is called on a wolf with at least one empty neighboring node
- **THEN** the result SHALL contain exactly those empty neighboring node IDs

#### Scenario: Wolf with no open neighbors
- **WHEN** all neighboring nodes of a wolf are occupied by pieces
- **THEN** `getValidMoves` SHALL return an empty array

### Requirement: Wolf valid captures computed correctly
`Board.getValidEats(wolf)` SHALL return a list of `{landAt, remove}` objects where `landAt` is the node the wolf would jump to and `remove` is the ID of the sheep being captured. A capture is valid when: (1) the wolf's current node A, the sheep's node B, and the target node C are all in the adjacency chain (B is a neighbor of A, C is a neighbor of B, and A-B-C are collinear — i.e., C is the node "past B" along the same edge direction), (2) node B contains a sheep, and (3) node C is empty.

#### Scenario: Wolf can capture a sheep
- **WHEN** a wolf is at A, a sheep is at adjacent B, and C (neighbor of B, collinear beyond B from A) is empty
- **THEN** `getValidEats` SHALL include `{landAt: C, remove: B}`

#### Scenario: Capture blocked at landing node
- **WHEN** a wolf is at A, a sheep is at adjacent B, but node C is occupied
- **THEN** `getValidEats` SHALL NOT include a capture through B

#### Scenario: No sheep to capture
- **WHEN** no neighbor of the wolf contains a sheep
- **THEN** `getValidEats` SHALL return an empty array

### Requirement: Blocking rule prevents wolf action in sealed directions
A direction is sealed for a wolf when a neighboring node B contains a sheep AND the node C directly beyond B (collinear, neighbor of B, not A) is either out of bounds (not adjacent to B in that direction) or occupied by another piece. In a sealed direction, the wolf CANNOT step to B and CANNOT capture through B.

#### Scenario: Blocked direction excluded from valid moves
- **WHEN** neighbor B has a sheep and no empty node exists collinearly beyond B
- **THEN** B SHALL NOT appear in `getValidMoves(wolf)` results

#### Scenario: Blocked direction excluded from captures
- **WHEN** neighbor B has a sheep and the node beyond B is occupied
- **THEN** B SHALL NOT appear as a capture target in `getValidEats(wolf)` results

### Requirement: Sheep valid moves computed correctly
`Board.getValidSheepMoves(sheep)` SHALL return all neighboring node IDs that are empty.

#### Scenario: Sheep with open neighbors
- **WHEN** `getValidSheepMoves` is called on a sheep with empty neighboring nodes
- **THEN** the result SHALL contain exactly those empty neighbor IDs

#### Scenario: Sheep fully surrounded
- **WHEN** all neighbors of a sheep are occupied
- **THEN** `getValidSheepMoves` SHALL return an empty array

### Requirement: Sheep placement phase for traditional board
When `Board.placingPhase` is `true` (traditional board, `sheepReserve > 0`), the sheep's turn action SHALL be to call `Board.placeSheep(nodeId)`. This places a new sheep at the given node, decrements `sheepReserve`, and switches `placingPhase` to `false` when `sheepReserve` reaches 0.

#### Scenario: Valid placement
- **WHEN** `placeSheep` is called with an empty nodeId and `sheepReserve > 0`
- **THEN** a new sheep piece SHALL appear at that node
- **AND** `sheepReserve` SHALL decrement by 1

#### Scenario: Placement exhausts reserve
- **WHEN** `placeSheep` is called and `sheepReserve` drops to 0
- **THEN** `placingPhase` SHALL become false
- **AND** subsequent sheep turns SHALL use move actions instead

#### Scenario: Placement rejected on occupied node
- **WHEN** `placeSheep` is called with a node that is already occupied
- **THEN** the placement SHALL be rejected (no state change)

#### Scenario: Grid board has no placement phase
- **WHEN** the grid5x5 board is initialized
- **THEN** `placingPhase` SHALL be false and SHALL remain false for the entire game

### Requirement: Win condition — wolf wins when all sheep are gone
`Board.checkWin()` SHALL return `'wolf'` when the count of alive sheep pieces on the board (not counting reserve) equals zero.

#### Scenario: All sheep eaten
- **WHEN** the last sheep piece is captured
- **THEN** `checkWin()` SHALL return 'wolf'

#### Scenario: Sheep still remain
- **WHEN** at least one sheep is alive on the board or in reserve
- **THEN** `checkWin()` SHALL NOT return 'wolf'

### Requirement: Win condition — sheep wins when all wolves are simultaneously immobile
`Board.checkWin()` SHALL return `'sheep'` only when EVERY wolf piece has zero valid moves AND zero valid captures simultaneously. If any one wolf has at least one legal action, `'sheep'` SHALL NOT be returned.

#### Scenario: All wolves blocked
- **WHEN** every wolf has empty `getValidMoves` and empty `getValidEats` results
- **THEN** `checkWin()` SHALL return 'sheep'

#### Scenario: One wolf still mobile
- **WHEN** at least one wolf has at least one valid move or capture
- **THEN** `checkWin()` SHALL return null

#### Scenario: No winner yet
- **WHEN** neither win condition is satisfied
- **THEN** `checkWin()` SHALL return null
