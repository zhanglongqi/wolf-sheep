## Purpose

Defines how `GameScene` (Phaser) renders the board, pieces, highlights, HUD, and controls, and how it reflects game state changes visually.

## Requirements

### Requirement: Board lines rendered for the active board
The system SHALL draw all board edges (lines connecting adjacent nodes) for the active board config using the node pixel coordinates from the config. The grid5x5 board's adjacency is horizontal/vertical only, so only horizontal and vertical lines are drawn.

#### Scenario: Grid board rendered
- **WHEN** the grid5x5 board is active
- **THEN** 40 lines (20 horizontal + 20 vertical) SHALL be drawn connecting all adjacent node pairs

### Requirement: Pieces rendered as cartoon wolf/sheep artwork
Wolf pieces SHALL be rendered as cartoon wolf artwork (grey coat, spiky ruff, tall ears, amber eyes, open-mouthed grin) with an effective footprint radius of 27px. Sheep pieces SHALL be rendered as cartoon sheep artwork (white wool puffs, cream face, droopy ears) with an effective footprint radius of 26px. Each piece SHALL be drawn centered on its node's `{x, y}` coordinates. The footprint radius SHALL be used consistently for click hit-testing and for sizing the selection/capture-target rings.

#### Scenario: Wolf piece rendered
- **WHEN** a wolf piece exists on the board
- **THEN** cartoon wolf artwork SHALL be drawn centered at the wolf's node pixel position, clickable within a 27px radius

#### Scenario: Sheep piece rendered
- **WHEN** a sheep piece exists on the board
- **THEN** cartoon sheep artwork SHALL be drawn centered at the sheep's node pixel position, clickable within a 26px radius

### Requirement: Selected piece displays a highlight ring
When the player clicks a piece on their turn, that piece SHALL display a white circular outline ring around it until deselected or the action completes.

#### Scenario: Piece selected
- **WHEN** the player clicks their own piece during their turn
- **THEN** a white circle outline SHALL appear around that piece

#### Scenario: Piece deselected
- **WHEN** the player clicks the same piece again or clicks elsewhere that is not a valid target
- **THEN** the white outline ring SHALL be removed

### Requirement: Valid move targets shown as blue hints
After a piece is selected, all valid step targets SHALL be shown as semi-transparent blue circles (alpha 0.5, radius 12px) at the corresponding node positions.

#### Scenario: Step hints shown after selection
- **WHEN** a piece is selected and has valid step targets
- **THEN** a blue semi-transparent circle SHALL appear at each valid step node

#### Scenario: No hints shown when no valid steps
- **WHEN** a selected piece has no valid steps
- **THEN** no blue circles SHALL appear

### Requirement: Valid capture targets shown as orange hints with victim highlight
After a wolf is selected, all valid capture landing nodes SHALL be shown as semi-transparent orange circles (alpha 0.5, radius 12px). The sheep that would be captured SHALL additionally display a red outline ring.

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
- **THEN** its artwork SHALL be rendered at 40% opacity

#### Scenario: Mobile piece at full opacity
- **WHEN** a piece has at least one legal action
- **THEN** it SHALL be rendered at 100% opacity

### Requirement: Piece movement animated
When a piece steps to a new node, it SHALL smoothly tween from its old pixel position to the new pixel position over 150ms.

#### Scenario: Piece step animation
- **WHEN** a piece moves from node A to node B
- **THEN** the piece's visual position SHALL animate from A's coordinates to B's coordinates over 150ms

### Requirement: Captured sheep play an exit animation
When a sheep is captured (wolf jumps over it), the sheep SHALL play a brief capture animation — a quick squash reaction, then a spin while shrinking and fading out, accompanied by a small burst of wool-colored particles — before its artwork is destroyed.

#### Scenario: Sheep capture animation
- **WHEN** a wolf captures a sheep
- **THEN** the sheep SHALL squash briefly, then spin and shrink to nothing while fading out, with a wool-particle burst at its position, before being removed

### Requirement: The last move is marked persistently on the board
After each completed step, capture, or placement, the board SHALL display a persistent marker for that action until the next action replaces it: an arrow from the origin to the destination for a step or capture, or a ring at the destination for a placement (which has no origin).

#### Scenario: Marker shown after a step or capture
- **WHEN** a piece steps or captures
- **THEN** an arrow SHALL be drawn from the piece's previous position to its new position, replacing any previous marker

#### Scenario: Marker shown after a placement
- **WHEN** a sheep is placed on the board
- **THEN** a ring marker SHALL appear at the placement node, replacing any previous marker

### Requirement: HUD always displays current turn and sheep count
A persistent HUD SHALL display the active side's turn ("请狼走" / "请羊走") and the current on-board sheep count ("羊：N"). Both values SHALL update immediately after each action.

#### Scenario: HUD reflects wolf turn
- **WHEN** it is the wolf's turn
- **THEN** the HUD SHALL display "请狼走"

#### Scenario: HUD reflects sheep turn
- **WHEN** it is the sheep's turn
- **THEN** the HUD SHALL display "请羊走"

### Requirement: End-game overlay shown when the game ends
When the game ends — by win, by draw (5-fold position repetition), or by resignation — an overlay SHALL appear centered on the canvas displaying the result ("狼方获胜！", "羊方获胜！", or "平局！") with a "再来一局" (play again) button. The board SHALL be non-interactive while the overlay is shown.

#### Scenario: Wolf wins overlay
- **WHEN** all sheep are gone (on board and in reserve)
- **THEN** an overlay with "狼方获胜！" SHALL appear and board input SHALL be disabled

#### Scenario: Sheep wins overlay
- **WHEN** every wolf is simultaneously immobile
- **THEN** an overlay with "羊方获胜！" SHALL appear and board input SHALL be disabled

#### Scenario: Draw overlay
- **WHEN** the same position has recurred 5 times
- **THEN** an overlay with "平局！" SHALL appear and board input SHALL be disabled

#### Scenario: Resignation overlay
- **WHEN** a player resigns
- **THEN** an overlay declaring the opposing side the winner SHALL appear and board input SHALL be disabled

#### Scenario: Play again resets game
- **WHEN** the user clicks "再来一局"
- **THEN** the overlay SHALL close and the board SHALL reset to its initial state for the current mode and difficulty

### Requirement: Restart button resets the game
A "重新开始" button SHALL be permanently accessible — in the right sidebar in landscape orientation, or in the top section in portrait orientation. Clicking it SHALL immediately reset the board to its initial state (all pieces to their starting positions, wolves to move first) without changing the active mode or AI difficulty.

#### Scenario: Restart mid-game
- **WHEN** the user clicks "重新开始" at any point
- **THEN** the board SHALL reset to initial state and the turn SHALL return to wolves

### Requirement: Resign button concedes the game immediately
A "认输" button SHALL be permanently accessible next to the restart button — in the right sidebar in landscape orientation, or in the top section in portrait orientation. Clicking it SHALL immediately end the game per the resignation rule and display the end-game overlay.

#### Scenario: Resign button clicked
- **WHEN** the user clicks "认输"
- **THEN** the game SHALL end immediately with the opposing side declared the winner

### Requirement: Left sidebar allows mode and AI difficulty selection
In landscape orientation, a permanent left sidebar SHALL display two stacked groups of option buttons: game mode ("玩家执狼" / "玩家执羊" / "双人对战") and AI difficulty ("简单" / "普通" / "困难"). In portrait orientation, the same two groups SHALL instead appear in the bottom section of the stacked layout. Clicking any option SHALL apply it immediately and restart the game — there is no separate confirm step and no board-type option, since only one board exists.

#### Scenario: Mode changed
- **WHEN** the user clicks a different mode option
- **THEN** the active mode SHALL change and the game SHALL restart immediately

#### Scenario: Difficulty changed
- **WHEN** the user clicks a different AI difficulty option
- **THEN** the active difficulty SHALL change, the AI SHALL use it from the next AI turn onward, and the game SHALL restart immediately

### Requirement: Canvas scales to fit the viewport
The game canvas SHALL scale to fit the browser viewport rather than rendering at a fixed pixel size, so it does not get clipped or force horizontal scrolling on a viewport smaller than the desktop design resolution.

#### Scenario: Narrow viewport
- **WHEN** the browser viewport is narrower than the desktop design width
- **THEN** the canvas SHALL scale down to fit the viewport width without clipping or horizontal scrolling

### Requirement: Orientation determines layout once at load
The system SHALL determine once, when the game loads, whether the viewport is in portrait orientation (width less than height) or landscape orientation (width greater than or equal to height), and SHALL use that determination to select the landscape or portrait layout for the remainder of the session. Resizing the browser window or rotating the device after load SHALL NOT trigger a re-layout.

#### Scenario: Portrait viewport at load
- **WHEN** the viewport width is less than its height at load time
- **THEN** the portrait layout SHALL be used for the session

#### Scenario: Landscape viewport at load
- **WHEN** the viewport width is greater than or equal to its height at load time
- **THEN** the landscape layout SHALL be used for the session

#### Scenario: Orientation change after load
- **WHEN** the browser window is resized or the device is rotated after the game has loaded
- **THEN** the layout already chosen at load time SHALL remain in effect

### Requirement: Portrait layout stacks status, board, and settings vertically
In portrait orientation, the game SHALL present three vertically stacked sections in this order: a top section with the turn indicator, sheep count, and the restart/resign controls; a middle section with the board; and a bottom section with the mode and AI-difficulty controls. The top and middle sections together SHALL always fit within one viewport height on any realistic phone or tablet portrait aspect ratio, so the board and current game status are visible without scrolling immediately after load. The bottom section SHALL be reachable by scrolling down; on a device tall enough relative to its width, it MAY already be visible without scrolling too — this is not treated as a defect, since the top and middle sections being visible without scrolling is the guarantee that matters.

#### Scenario: Board visible without scrolling
- **WHEN** the portrait layout is active
- **THEN** the top and middle sections SHALL both be visible within the viewport without any scrolling

#### Scenario: Settings reachable by scrolling
- **WHEN** the portrait layout is active
- **THEN** the mode and AI-difficulty controls SHALL be reachable by scrolling down, whether or not they happen to already be visible without scrolling on that device

### Requirement: Portrait scrolling uses standard page scrolling
Reaching the bottom section in portrait orientation SHALL use the browser's native page scrolling. The game SHALL NOT implement its own scrollable viewport or camera-based scroll region for this purpose.

#### Scenario: User scrolls to settings
- **WHEN** the user performs a standard scroll gesture (touch drag, mouse wheel, or trackpad) in portrait orientation
- **THEN** the page SHALL scroll using the browser's native scrolling behavior to reveal the bottom section

### Requirement: Tap tolerance is enlarged in portrait orientation
In portrait orientation, tapping at or near a piece or a board node SHALL register successfully across a larger tolerance area than in landscape orientation, to compensate for the smaller on-screen size pieces have after scaling to fit a narrow viewport. This SHALL NOT change the rendered visual size of pieces.

#### Scenario: Near-miss tap registers in portrait
- **WHEN** a user taps within the enlarged tolerance area around a piece or node in portrait orientation, but not exactly centered on it
- **THEN** the tap SHALL register as selecting that piece or targeting that node

#### Scenario: Piece art unaffected
- **WHEN** the portrait layout is active
- **THEN** pieces SHALL render at the same visual size as they do in landscape orientation, scaled only by the overall viewport scale factor

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
