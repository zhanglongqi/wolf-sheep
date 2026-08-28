## Purpose

Defines the selectable game modes (who controls each side) and the AI player's behavior across its difficulty tiers.

## Requirements

### Requirement: Three game modes are selectable
The system SHALL support three modes, selectable at any time from the permanent left sidebar: player-as-wolf ("玩家执狼", sheep is AI-controlled), player-as-sheep ("玩家执羊", wolf is AI-controlled), and two-player ("双人对战", both sides human-controlled on the same device).

#### Scenario: Mode selected from the sidebar
- **WHEN** the user selects a mode from the left sidebar
- **THEN** the game SHALL restart immediately with that mode active

#### Scenario: Mode persists until changed
- **WHEN** the game is restarted (e.g. via the restart button) without changing mode
- **THEN** the same mode SHALL remain active

### Requirement: AI controls the inactive side in single-human modes
In player-as-wolf mode, the sheep side SHALL be controlled by AI. In player-as-sheep mode, the wolf side SHALL be controlled by AI. The AI SHALL act automatically after a fixed 400ms delay following the human's move.

#### Scenario: AI acts after human move in player-as-wolf mode
- **WHEN** the human completes a wolf move in player-as-wolf mode
- **THEN** after 400ms the sheep AI SHALL execute a legal move automatically without human input

#### Scenario: AI acts after human move in player-as-sheep mode
- **WHEN** the human completes a sheep action in player-as-sheep mode
- **THEN** after 400ms the wolf AI SHALL execute a legal move automatically

#### Scenario: AI does not act on human's turn
- **WHEN** it is the human's turn in a single-human mode
- **THEN** the AI SHALL NOT act until the human completes their action

### Requirement: AI difficulty has three tiers, selectable independently of mode
The system SHALL support three AI difficulty tiers — easy, medium, hard — selectable from the left sidebar and applied to whichever side(s) the AI controls. Selecting a difficulty SHALL apply immediately (including mid-restart) to all subsequent AI turns.

#### Scenario: Difficulty selected
- **WHEN** the user selects a difficulty tier from the left sidebar
- **THEN** the AI SHALL use that tier's behavior starting from its next turn

### Requirement: Wolf AI behavior depends on difficulty
On easy, the wolf AI SHALL pick a uniformly random legal action (step or capture), with no preference for captures. On medium, the wolf AI SHALL always execute a capture when at least one is available (chosen randomly among all available captures across all wolves), otherwise a random legal step. On hard, the wolf AI SHALL simulate every candidate action one ply deep, score each by a heuristic (captures scored highest, then future capture/step options, then fewer surviving sheep), and play the best-scoring action (ties broken at random).

#### Scenario: Easy tier ignores captures
- **WHEN** difficulty is easy and a wolf has both a capture and a plain step available
- **THEN** the wolf AI MAY choose either, with no bias toward the capture

#### Scenario: Medium tier prefers captures
- **WHEN** difficulty is medium and at least one wolf has a valid capture
- **THEN** the wolf AI SHALL execute a capture, not a plain step

#### Scenario: Medium tier steps when no capture exists
- **WHEN** difficulty is medium, no wolf has a valid capture, but at least one wolf has a valid step
- **THEN** the wolf AI SHALL execute a random step

#### Scenario: Hard tier picks the best-scoring action
- **WHEN** difficulty is hard
- **THEN** the wolf AI SHALL simulate all candidate actions and play one with the highest heuristic score

#### Scenario: No legal moves
- **WHEN** all wolves have no legal moves or captures
- **THEN** the wolf AI SHALL skip its turn (the sheep-wins condition will be detected by `checkWin`)

### Requirement: Sheep AI behavior depends on difficulty
On easy, the sheep AI SHALL pick a uniformly random legal action (step or placement), with no self-preservation logic. On medium, the sheep AI SHALL pick randomly among legal actions that do not hand a wolf an immediate capture next turn, falling back to any legal action if none are safe. On hard, the sheep AI SHALL simulate every candidate action one ply deep, score each (penalizing moves that reduce wolf mobility less, and heavily penalizing landing where a wolf could capture next turn), and play the best-scoring action (ties broken at random).

#### Scenario: Easy tier ignores danger
- **WHEN** difficulty is easy and a candidate move would let a wolf capture that sheep next turn
- **THEN** the sheep AI MAY still choose that move

#### Scenario: Medium tier avoids danger when possible
- **WHEN** difficulty is medium and at least one candidate action does not expose the sheep to an immediate capture
- **THEN** the sheep AI SHALL choose only among the safe candidates

#### Scenario: Medium tier falls back when no safe option exists
- **WHEN** difficulty is medium and every candidate action exposes the sheep to an immediate capture
- **THEN** the sheep AI SHALL choose randomly among all candidates

#### Scenario: Hard tier picks the best-scoring action
- **WHEN** difficulty is hard
- **THEN** the sheep AI SHALL simulate all candidate actions and play one with the highest heuristic score

#### Scenario: No legal action for sheep
- **WHEN** all sheep have no valid moves
- **THEN** the sheep AI SHALL skip its turn

### Requirement: Two-player mode routes both sides to human input
In two-player mode, both wolf turns and sheep turns SHALL wait for human pointer input. No AI action SHALL occur automatically.

#### Scenario: Wolf turn in two-player mode
- **WHEN** it is the wolf's turn in two-player mode
- **THEN** the game SHALL wait for the human player to click a wolf and then a destination

#### Scenario: Sheep turn in two-player mode
- **WHEN** it is the sheep's turn in two-player mode
- **THEN** the game SHALL wait for the human player to interact (click a sheep and then a destination)

### Requirement: Turn alternates after each completed action
After any move, capture, or placement completes (including animations), the active side SHALL switch. Wolves move first at game start.

#### Scenario: Wolf completes move
- **WHEN** a wolf step or capture finishes
- **THEN** the active turn SHALL switch to the sheep side

#### Scenario: Sheep completes action
- **WHEN** a sheep step or placement finishes
- **THEN** the active turn SHALL switch to the wolf side

#### Scenario: Game-ending check before turn switch
- **WHEN** any action completes
- **THEN** the system SHALL call `checkWin()` before switching turns
- **AND** if a winner is detected the game SHALL end instead of switching turns
- **AND** if no winner is detected but the resulting position has now recurred 5 times, the game SHALL end in a draw instead of switching turns
