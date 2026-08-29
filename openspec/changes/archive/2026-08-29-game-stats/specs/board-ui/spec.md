## ADDED Requirements

### Requirement: Game results are recorded locally
The system SHALL persist a count of wolf wins, sheep wins, and draws across sessions, grouped into buckets by game mode and — for the two single-player modes — AI difficulty. Two-player mode SHALL use a single bucket with no difficulty grouping, since AI difficulty has no effect on a two-player game. Exactly one result SHALL be recorded per completed game, at the moment the game ends (by win, by draw, or by resignation) — a game abandoned mid-play by switching mode, difficulty, or restarting SHALL NOT be recorded.

#### Scenario: Wolf win recorded
- **WHEN** the wolf side wins a game
- **THEN** the wolf-win count for that game's mode-and-difficulty bucket SHALL increase by one

#### Scenario: Sheep win recorded
- **WHEN** the sheep side wins a game
- **THEN** the sheep-win count for that game's mode-and-difficulty bucket SHALL increase by one

#### Scenario: Draw recorded
- **WHEN** a game ends in a draw (5-fold position repetition)
- **THEN** the draw count for that game's mode-and-difficulty bucket SHALL increase by one

#### Scenario: Resignation recorded as a result for the winning side
- **WHEN** a player resigns
- **THEN** the win count for the opposing side, in that game's mode-and-difficulty bucket, SHALL increase by one

#### Scenario: Two-player games share one bucket regardless of difficulty
- **WHEN** a game is played in two-player mode
- **THEN** its result SHALL be recorded into a bucket shared by all two-player games, independent of the AI difficulty setting

#### Scenario: Abandoned game not recorded
- **WHEN** the player changes mode, changes AI difficulty, or clicks restart before a game has ended
- **THEN** no result SHALL be recorded for the abandoned game

### Requirement: A stats entry point is always accessible alongside restart and resign
A "战绩" (stats) control SHALL be permanently accessible next to the restart and resign controls, in both landscape and portrait orientation, and SHALL open the stats panel when activated.

#### Scenario: Stats control present in landscape
- **WHEN** the landscape layout is active
- **THEN** a "战绩" control SHALL be visible alongside the restart and resign controls in the right sidebar

#### Scenario: Stats control present in portrait
- **WHEN** the portrait layout is active
- **THEN** a "战绩" control SHALL be visible alongside the restart and resign controls in the top section

#### Scenario: Opening the stats panel
- **WHEN** the player activates the stats control
- **THEN** the stats panel SHALL open, showing the currently recorded totals

### Requirement: Stats panel displays totals for every mode-and-difficulty bucket
The stats panel SHALL display wolf-win, sheep-win, and draw counts for every bucket described in the recording requirement: each of the two single-player modes at each of the three AI difficulties, plus the single two-player bucket.

#### Scenario: All buckets shown together
- **WHEN** the stats panel is open
- **THEN** it SHALL display one row of totals for each single-player mode-and-difficulty combination and one row for two-player games, with no filtering or pagination required to see all of them

### Requirement: Stats can be cleared
The stats panel SHALL provide a control that resets every bucket's counts to zero and immediately reflects the reset in the panel without requiring it to be reopened.

#### Scenario: Clearing stats
- **WHEN** the player activates the clear-stats control
- **THEN** every bucket's wolf-win, sheep-win, and draw counts SHALL become zero
- **AND** the stats panel SHALL immediately display the zeroed totals

### Requirement: The end-game overlay provides a shortcut to the stats panel
When the end-game overlay is shown (win, draw, or resignation), it SHALL include a control that opens the stats panel without requiring the player to first dismiss the result. Returning from the stats panel in this case SHALL redisplay the same end-game result the player left, not a blank or reset board state.

#### Scenario: Opening stats from the end-game overlay
- **WHEN** the end-game overlay is showing and the player activates its stats control
- **THEN** the stats panel SHALL open in place of the end-game overlay's content

#### Scenario: Returning to the result after viewing stats
- **WHEN** the player closes the stats panel that was opened from the end-game overlay
- **THEN** the same end-game result SHALL be displayed again, with the game still ended and not reset

### Requirement: The stats panel never appears stacked on top of another overlay
Opening the stats panel, from either entry point, SHALL replace whatever overlay content is currently shown rather than displaying a second overlay layer on top of it.

#### Scenario: Opening stats while the end-game overlay is showing, from the persistent control
- **WHEN** the end-game overlay is showing and the player activates the persistent stats control (not the overlay's own shortcut)
- **THEN** the stats panel SHALL replace the end-game overlay's content
- **AND** closing the stats panel SHALL redisplay the same end-game result, consistent with activating it from the overlay's own shortcut

#### Scenario: Opening stats with no overlay currently showing
- **WHEN** no overlay is currently shown and the player activates the persistent stats control
- **THEN** the stats panel SHALL open over the board
- **AND** closing the stats panel SHALL return to the interactive board with no overlay remaining
