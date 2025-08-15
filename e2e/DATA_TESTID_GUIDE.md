# Data-TestId Implementation Guide

This guide shows which `data-testid` attributes need to be added to your React components for reliable E2E testing.

## Critical Components Requiring Test IDs

### Main Menu (`/src/app/page.tsx`)
```tsx
// Main interface
<div data-testid="main-menu">

// Player name input
<input data-testid="player-name-input" />

// Game code input  
<input data-testid="game-code-input" />

// Action buttons
<button data-testid="create-game-button">Create Game</button>
<button data-testid="join-game-button">Join Game</button>
<button data-testid="quick-join-button">Quick Join</button>

// Error messages
<div data-testid="error-message">
```

### Lobby Interface
```tsx
// Lobby container
<div data-testid="lobby-interface">

// Player list
<div data-testid="player-list">
  <div data-testid={`player-item-${player.name}`}>
    <span data-testid={`player-ready-${player.name}`}>Ready</span>
  </div>
</div>

// Ready controls
<button data-testid="ready-toggle">Ready</button>
<div data-testid="ready-status-true">✓ Ready</div>
<div data-testid="ready-status-false">Not Ready</div>
<div data-testid="all-players-ready">All Players Ready!</div>

// Game controls
<button data-testid="start-game-button">Start Game</button>

// Room code display
<div data-testid="room-code-display">{gameCode}</div>
```

### Game Interface (`/src/app/game/page.tsx`)
```tsx
// Game container
<div data-testid="game-interface">

// Game phases
<div data-testid={`game-phase-${gameState.gamePhase}`}>

// Judge indicator
<div data-testid="judge-indicator">👑 Judge</div>

// Current scenario
<div data-testid="current-scenario">
  <p data-testid="scenario-text">{scenario.text}</p>
</div>

// Category selection (judge only)
<div data-testid="category-selector">
  <button data-testid="category-option">{category}</button>
</div>

// Player hand
<div data-testid="player-hand">
  <div data-testid="hand-card">{card.text}</div>
</div>

// Card submission
<button data-testid="submit-card-button">Submit Card</button>

// Custom card creation
<button data-testid="create-custom-card-button">Create Custom</button>
<input data-testid="custom-card-input" />
<button data-testid="submit-custom-card-button">Submit Custom</button>

// Judge approval (for custom cards)
<div data-testid="custom-card-approval">
  <p data-testid="custom-card-text">{customCardText}</p>
  <button data-testid="approve-custom-card-button">Approve</button>
  <button data-testid="reject-custom-card-button">Reject</button>
</div>

// Submission cards (judge view)
<div data-testid="submission-cards">
  <div data-testid="submission-card">{submission.cardText}</div>
</div>

// Winner selection
<button data-testid="select-winner-button">Select Winner</button>

// Round results
<div data-testid="round-winner">{winner.name} wins!</div>

// Game over
<div data-testid="game-over-display">
  <div data-testid="final-scores">
    <div data-testid={`player-score-${player.name}`}>
      {player.name}: {player.score}
    </div>
  </div>
</div>

// Reset button
<button data-testid="reset-game-button">Reset Game</button>
```

### Shared Components

#### Loading & Error States
```tsx
// Loading indicators
<div data-testid="loading-indicator">Loading...</div>
<div data-testid="global-loading">Global Loading</div>

// Connection states
<div data-testid="connection-error">Connection Error</div>
<button data-testid="retry-button">Retry</button>

// Host disconnection
<div data-testid="host-disconnected-message">Host disconnected</div>
<div data-testid="judge-disconnected-message">Judge disconnected</div>
```

#### Transition Overlays
```tsx
// Reset notification (from UnifiedTransitionOverlay)
<div data-testid="reset-notification">
  Resetting game... You will be redirected to the main menu.
</div>

// Other transitions
<div data-testid={`transition-${transitionState}`}>
  {transitionMessage}
</div>
```

## Implementation Priority

### High Priority (Required for existing tests)
1. ✅ **Main Menu**: player-name-input, game-code-input, create/join buttons
2. ✅ **Lobby**: lobby-interface, player-list, ready-toggle, start-game-button  
3. ✅ **Game Phases**: game-phase-* attributes for each phase
4. ✅ **Reset Flow**: reset-game-button, reset notification message
5. ✅ **Error Handling**: error-message, connection-error

### Medium Priority (Enhance test reliability)
1. **Judge Flow**: judge-indicator, category-selector, submission-cards
2. **Player Actions**: player-hand, hand-card, submit-card-button
3. **Game State**: current-scenario, scenario-text, round-winner
4. **Custom Cards**: custom card creation and approval flow

### Low Priority (Nice to have)
1. **Detailed Scoring**: individual player scores, final-scores
2. **Room Management**: room-code-display, player-ready-status
3. **Audio Controls**: volume toggles, music controls

## Adding Test IDs to Components

### Example Implementation
```tsx
// Before
<button onClick={handleReady} className="btn-primary">
  {isReady ? 'Not Ready' : 'Ready'}
</button>

// After  
<button 
  data-testid="ready-toggle"
  onClick={handleReady} 
  className="btn-primary"
>
  {isReady ? 'Not Ready' : 'Ready'}
</button>

// Dynamic test IDs
<div data-testid={`game-phase-${gamePhase}`}>
  {/* Phase-specific content */}
</div>
```

### Best Practices
1. **Use kebab-case**: `data-testid="player-name-input"`
2. **Be descriptive**: `data-testid="submit-card-button"` not `data-testid="button1"`
3. **Include dynamic values**: `data-testid={`player-ready-${playerName}`}`
4. **Group related elements**: `player-list` contains `player-item-*`
5. **Match test expectations**: Use the exact IDs referenced in test files

## Validation
After adding test IDs, verify they work:
```bash
# Run tests to check for missing selectors
npm run test:e2e

# Check specific test files
npx playwright test lobby-transitions.spec.ts
npx playwright test reset-flow.spec.ts
```

## Testing Without Full Implementation
Tests are designed to gracefully handle missing test IDs by:
- Using timeouts and fallbacks
- Testing visible elements even without IDs
- Checking for error states when elements aren't found

This allows incremental implementation while maintaining test functionality.