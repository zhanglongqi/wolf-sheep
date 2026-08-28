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
A direction is sealed for a wolf when a neighboring node B contains a sheep AND the node C directly beyond B (collinear, neighbor of B, not A) is either out of bounds (not adjacent to B in that direction) or occupied by another piece. In a sealed direction, the wolf SHALL NOT step to B and SHALL NOT capture through B.

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

### Requirement: Win condition — wolf wins when all sheep are gone
`Board.checkWin()` SHALL return `'wolf'` when there are no alive sheep pieces on the board AND `sheepReserve` is 0.

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

### Requirement: Draw when a position repeats five times
`GameScene` SHALL track a signature of each position reached — the full board occupancy layout, `sheepReserve`, and which side is next to move — after every completed action. When the same signature has occurred 5 times, the game SHALL end in a draw instead of continuing, even though `Board.checkWin()` reports no winner.

#### Scenario: Position recurs a fifth time
- **WHEN** the exact same board layout, reserve count, and side-to-move combination has now occurred for the 5th time
- **THEN** the game SHALL end with a draw result

#### Scenario: Position has not repeated enough
- **WHEN** a position signature has occurred fewer than 5 times
- **THEN** the game SHALL continue to the next turn normally

### Requirement: A side can resign to end the game immediately
Triggering `GameScene.resign()` SHALL immediately end the game with the opposing side declared the winner. In a single-human game mode (`activeMode` is `'wolf'` or `'sheep'`), resigning always concedes the human-controlled side regardless of whose turn it currently is. In two-player mode (`activeMode` is `'2p'`), resigning concedes whichever side currently has the turn (`activeSide`).

#### Scenario: Resign in a single-human mode
- **WHEN** `activeMode` is `'wolf'` (or `'sheep'`) and the player triggers resign
- **THEN** wolf (or sheep) SHALL lose regardless of `activeSide`
- **AND** the opposing side SHALL be declared the winner

#### Scenario: Resign in two-player mode
- **WHEN** `activeMode` is `'2p'` and the side currently to move triggers resign
- **THEN** that side SHALL lose
- **AND** the other side SHALL be declared the winner
