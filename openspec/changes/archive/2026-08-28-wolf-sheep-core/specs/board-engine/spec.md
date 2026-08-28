## ADDED Requirements

### Requirement: Board config defines node positions and adjacency
The system SHALL define two board configurations as plain data objects. Each config SHALL include a `nodes` map of node IDs to `{x, y}` pixel coordinates, an `adjacency` map of node IDs to arrays of neighbor IDs (bidirectional), `wolfStart` (initial wolf node IDs), `sheepStart` (initial on-board sheep node IDs), and `sheepReserve` (count of sheep entering via placement).

#### Scenario: Grid board config loaded
- **WHEN** the grid5x5 board config is loaded
- **THEN** it SHALL contain exactly 25 node IDs in the format "col,row" where col and row are integers 0–4
- **AND** each node SHALL have exactly 2 to 4 neighbors (edges have fewer) reflecting only horizontal and vertical adjacency (no diagonals)
- **AND** wolfStart SHALL be ["0,0", "2,0", "4,0"]
- **AND** sheepStart SHALL be the 15 nodes in rows 2–4
- **AND** sheepReserve SHALL be 0

#### Scenario: Traditional board config loaded
- **WHEN** the traditional board config is loaded
- **THEN** it SHALL contain exactly 19 node IDs
- **AND** wolfStart SHALL be ["neck_t", "neck_b"]
- **AND** sheepStart SHALL be ["TL","TC","TR","ML","MR","BL","BC","BR"] (8 nodes)
- **AND** sheepReserve SHALL be 22

### Requirement: Adjacency map is symmetric
The system SHALL enforce that the adjacency map is symmetric: if node A lists B as a neighbor, B SHALL list A as a neighbor.

#### Scenario: Symmetry check at startup
- **WHEN** the game initializes a board config
- **THEN** every neighbor relationship SHALL be bidirectional

### Requirement: Board tracks piece occupancy
The `Board` class SHALL maintain a map from node ID to the `Piece` occupying that node (or `null` if empty). This map SHALL be updated atomically whenever a piece moves, is placed, or is removed.

#### Scenario: Occupancy reflects initial placement
- **WHEN** a board is initialized
- **THEN** every wolfStart node SHALL map to a wolf piece
- **AND** every sheepStart node SHALL map to a sheep piece
- **AND** all other nodes SHALL map to null

#### Scenario: Occupancy updated after move
- **WHEN** a piece moves from node A to node B
- **THEN** occupancy[A] SHALL be null
- **AND** occupancy[B] SHALL be the moved piece

#### Scenario: Occupancy updated after capture
- **WHEN** a wolf captures a sheep at node B by jumping to node C
- **THEN** occupancy[B] SHALL be null (sheep removed)
- **AND** occupancy[A] SHALL be null (wolf left)
- **AND** occupancy[C] SHALL be the wolf piece

### Requirement: Board exposes empty-node query
The system SHALL provide a method `Board.isEmpty(nodeId)` that returns `true` if and only if the occupancy map has `null` for that node ID.

#### Scenario: Empty node query
- **WHEN** `isEmpty` is called on a node with no piece
- **THEN** it SHALL return true

#### Scenario: Occupied node query
- **WHEN** `isEmpty` is called on a node containing any piece
- **THEN** it SHALL return false

### Requirement: Board exposes piece-at-node query
The system SHALL provide `Board.pieceAt(nodeId)` returning the `Piece` at that node or `null`.

#### Scenario: Piece found at node
- **WHEN** `pieceAt` is called on a node occupied by a piece
- **THEN** it SHALL return that piece object

#### Scenario: No piece at node
- **WHEN** `pieceAt` is called on an empty node
- **THEN** it SHALL return null
