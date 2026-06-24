## ADDED Requirements

### Requirement: Three game modes are selectable
The system SHALL support three modes selectable before or between games: Mode A (player controls wolves, sheep is AI), Mode B (player controls sheep, wolf is AI), Mode C (two-player, both sides controlled by humans on the same device).

#### Scenario: Mode selected before game start
- **WHEN** the user selects a mode from the settings screen
- **THEN** the game SHALL initialize with that mode active for the current session

#### Scenario: Mode persists until changed
- **WHEN** the game is restarted without changing mode
- **THEN** the same mode SHALL remain active

### Requirement: AI controls the inactive side in Modes A and B
In Mode A, the sheep side SHALL be controlled by AI. In Mode B, the wolf side SHALL be controlled by AI. The AI SHALL act automatically after a short delay (≥300ms) following the human's move.

#### Scenario: AI acts after human move in Mode A
- **WHEN** the human completes a wolf move in Mode A
- **THEN** after ≥300ms the sheep AI SHALL execute a legal move automatically without human input

#### Scenario: AI acts after human move in Mode B
- **WHEN** the human completes a sheep action in Mode B
- **THEN** after ≥300ms the wolf AI SHALL execute a legal move automatically

#### Scenario: AI does not act on human's turn
- **WHEN** it is the human's turn in Mode A or B
- **THEN** the AI SHALL NOT act until the human completes their action

### Requirement: Wolf AI prefers captures over steps
The wolf AI SHALL scan all wolves for legal captures. If any wolf has a valid capture, the AI SHALL execute one of them (chosen randomly among all available captures across all wolves). If no capture exists, the AI SHALL pick any random legal step from any wolf.

#### Scenario: Capture available
- **WHEN** at least one wolf has a valid capture
- **THEN** the wolf AI SHALL execute a capture (not a plain step)

#### Scenario: No capture available
- **WHEN** no wolf has a valid capture but at least one wolf has a valid step
- **THEN** the wolf AI SHALL execute a random step

#### Scenario: No legal moves
- **WHEN** all wolves have no legal moves or captures
- **THEN** the wolf AI SHALL skip its turn (sheep-wins condition will be detected by `checkWin`)

### Requirement: Sheep AI performs a random legal action
The sheep AI SHALL collect all legal actions for the sheep side (placements during the placement phase, or steps during the move phase) and execute one chosen uniformly at random.

#### Scenario: Placement phase active
- **WHEN** the board is in the placement phase (sheepReserve > 0)
- **THEN** the sheep AI SHALL choose a random empty node and call `placeSheep`

#### Scenario: Move phase active
- **WHEN** the board is in the move phase (sheepReserve = 0)
- **THEN** the sheep AI SHALL pick a random sheep with valid moves and execute a random valid step

#### Scenario: No legal action for sheep
- **WHEN** all sheep have no valid moves and placement phase is inactive
- **THEN** the sheep AI SHALL skip its turn

### Requirement: Two-player mode routes both sides to human input
In Mode C, both wolf turns and sheep turns SHALL wait for human pointer input. No AI action SHALL occur automatically.

#### Scenario: Wolf turn in Mode C
- **WHEN** it is the wolf's turn in Mode C
- **THEN** the game SHALL wait for the human player to click a wolf and then a destination

#### Scenario: Sheep turn in Mode C
- **WHEN** it is the sheep's turn in Mode C
- **THEN** the game SHALL wait for the human player to interact (click placement target or click sheep and destination)

### Requirement: Turn alternates after each completed action
After any move, capture, or placement completes (including animations), the active side SHALL switch. Wolves move first at game start.

#### Scenario: Wolf completes move
- **WHEN** a wolf step or capture finishes
- **THEN** the active turn SHALL switch to the sheep side

#### Scenario: Sheep completes action
- **WHEN** a sheep step or placement finishes
- **THEN** the active turn SHALL switch to the wolf side

#### Scenario: Win check before turn switch
- **WHEN** any action completes
- **THEN** the system SHALL call `checkWin()` before switching turns
- **AND** if a winner is detected the game SHALL end instead of switching turns
