## MODIFIED Requirements

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

## ADDED Requirements

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
