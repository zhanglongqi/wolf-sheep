## ADDED Requirements

### Requirement: Board lines rendered for active board type
The system SHALL draw all board edges (lines connecting adjacent nodes) for the active board config using the node pixel coordinates from the config. Grid board draws only horizontal and vertical lines; traditional board draws horizontal, vertical, and diagonal lines as defined by its adjacency map.

#### Scenario: Grid board rendered
- **WHEN** the grid5x5 board is active
- **THEN** 20 horizontal and vertical lines SHALL be drawn connecting all adjacent node pairs

#### Scenario: Traditional board rendered
- **WHEN** the traditional board is active
- **THEN** all edges defined in the traditional adjacency map SHALL be drawn, including diagonal lines within the main 3×3 grid and the diamond connections

### Requirement: Pieces rendered as circles at node pixel positions
Wolf pieces SHALL be rendered as filled red circles (radius 18px). Sheep pieces SHALL be rendered as filled white circles (radius 14px). Each piece SHALL be drawn centered on its node's `{x, y}` coordinates.

#### Scenario: Wolf piece rendered
- **WHEN** a wolf piece exists on the board
- **THEN** a red filled circle (r=18) SHALL be drawn at the wolf's node pixel position

#### Scenario: Sheep piece rendered
- **WHEN** a sheep piece exists on the board
- **THEN** a white filled circle (r=14) SHALL be drawn at the sheep's node pixel position

### Requirement: Selected piece displays a highlight ring
When the player clicks a piece on their turn, that piece SHALL display a white circular outline ring around it until deselected or the action completes.

#### Scenario: Piece selected
- **WHEN** the player clicks their own piece during their turn
- **THEN** a white circle outline SHALL appear around that piece

#### Scenario: Piece deselected
- **WHEN** the player clicks the same piece again or clicks elsewhere that is not a valid target
- **THEN** the white outline ring SHALL be removed

### Requirement: Valid move targets shown as blue hints
After a piece is selected, all valid step targets SHALL be shown as semi-transparent blue circles (alpha 0.5, radius ~12px) at the corresponding node positions.

#### Scenario: Step hints shown after selection
- **WHEN** a piece is selected and has valid step targets
- **THEN** a blue semi-transparent circle SHALL appear at each valid step node

#### Scenario: No hints shown when no valid steps
- **WHEN** a selected piece has no valid steps
- **THEN** no blue circles SHALL appear

### Requirement: Valid capture targets shown as orange hints with victim highlight
After a wolf is selected, all valid capture landing nodes SHALL be shown as semi-transparent orange circles (alpha 0.5, radius ~12px). The sheep that would be captured SHALL additionally display a red outline ring.

#### Scenario: Capture hints shown after wolf selected
- **WHEN** a wolf is selected and has valid captures
- **THEN** an orange semi-transparent circle SHALL appear at each capture landing node
- **AND** each would-be-captured sheep SHALL display a red outline ring

#### Scenario: Hints cleared after action
- **WHEN** any move or capture is executed
- **THEN** all hint circles and outline rings SHALL be removed

### Requirement: Pieces with no legal moves displayed at reduced opacity
Any piece on the active side that has zero legal moves (and zero captures for wolves) SHALL be rendered at 40% opacity and SHALL NOT be selectable.

#### Scenario: Immobile piece dimmed
- **WHEN** a piece on the active side has no legal actions
- **THEN** its circle SHALL be rendered at 40% opacity

#### Scenario: Mobile piece at full opacity
- **WHEN** a piece has at least one legal action
- **THEN** it SHALL be rendered at 100% opacity

### Requirement: Piece movement animated
When a piece steps to a new node, it SHALL smoothly tween from its old pixel position to the new pixel position over 150ms.

#### Scenario: Piece step animation
- **WHEN** a piece moves from node A to node B
- **THEN** the piece's visual position SHALL animate from A's coordinates to B's coordinates over 150ms

### Requirement: Captured sheep fade out
When a sheep is captured (wolf jumps over it), the sheep's circle SHALL fade to alpha 0 over 200ms and then be destroyed.

#### Scenario: Sheep capture animation
- **WHEN** a wolf captures a sheep
- **THEN** the sheep graphic SHALL fade from alpha 1 to alpha 0 over 200ms before being removed

### Requirement: HUD always displays current turn and sheep count
A persistent HUD SHALL display the active side's turn ("请狼走" / "请羊走"), the current on-board sheep count ("羊：N"), and for the traditional board the reserve count ("储备：N") and phase label ("放置阶段" / "移动阶段"). All values SHALL update immediately after each action.

#### Scenario: HUD reflects wolf turn
- **WHEN** it is the wolf's turn
- **THEN** the HUD SHALL display "请狼走"

#### Scenario: HUD reflects sheep turn
- **WHEN** it is the sheep's turn
- **THEN** the HUD SHALL display "请羊走"

#### Scenario: Reserve count shown during placement phase
- **WHEN** the traditional board is active and sheepReserve > 0
- **THEN** the HUD SHALL display the current sheepReserve count and "放置阶段"

#### Scenario: Reserve UI hidden after placement phase ends
- **WHEN** sheepReserve reaches 0
- **THEN** the reserve count and phase label SHALL no longer be displayed

### Requirement: End-game overlay shown on win
When `checkWin()` returns a non-null value, an overlay SHALL appear centered on the canvas displaying "狼方获胜！" or "羊方获胜！" with a "再来一局" (play again) button. The board SHALL be non-interactive while the overlay is shown.

#### Scenario: Wolf wins overlay
- **WHEN** `checkWin()` returns 'wolf'
- **THEN** an overlay with "狼方获胜！" SHALL appear and board input SHALL be disabled

#### Scenario: Sheep wins overlay
- **WHEN** `checkWin()` returns 'sheep'
- **THEN** an overlay with "羊方获胜！" SHALL appear and board input SHALL be disabled

#### Scenario: Play again resets game
- **WHEN** the user clicks "再来一局"
- **THEN** the overlay SHALL close and the board SHALL reset to its initial state for the current board config and mode

### Requirement: Restart button resets the game
A "重新开始" button SHALL be permanently accessible. Clicking it SHALL immediately reset the board to its initial state (all pieces to starting positions, reserves restored, placingPhase reset) without changing the board type or game mode.

#### Scenario: Restart mid-game
- **WHEN** the user clicks "重新开始" at any point
- **THEN** the board SHALL reset to initial state and the turn SHALL return to wolves

### Requirement: Settings panel allows board and mode selection
A settings control SHALL be accessible during play. Opening it SHALL allow the user to change the board type (grid / traditional) and game mode (A / B / C). Confirming the selection SHALL restart the game with the new settings.

#### Scenario: Settings changed
- **WHEN** the user opens settings and selects a different board or mode
- **THEN** the game SHALL restart with the new configuration
