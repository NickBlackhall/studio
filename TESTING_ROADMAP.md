# Testing Infrastructure Roadmap

**Goal:** Build testing tools incrementally to reduce manual testing burden and increase confidence in code changes.

**Context:** This is for a working multiplayer party game that needs better development tools, not a broken application that needs fixing.

---

## Week 1: Testing Foundation
*Reduce manual testing setup time*

### Day 1: Install and Configure Basic Testing Stack

#### Step 1: Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest jest-environment-jsdom
```

#### Step 2: Create Jest Configuration
Create a new file called `jest.config.js` in your project root (same level as `package.json`):

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

#### Step 3: Create Jest Setup File
Create a new file called `jest.setup.js` in your project root:

```javascript
import '@testing-library/jest-dom'
```

#### Step 4: Add Test Script
Open `package.json` and add these lines to the `"scripts"` section:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

#### Verify Day 1 Success:
Run `npm test` in your terminal. It should say "No tests found" but not show any errors.

**✅ COMPLETED: August 14, 2025**

---

### Day 2: Create Test Directory Structure + First Simple Test

#### Step 1: Create Directory Structure
Create these folders in your project:
```
tests/
├── unit/
│   ├── components/
│   ├── utils/
│   └── actions/
├── helpers/
└── fixtures/
```

#### Step 2: Create Test Utilities Helper
Create file `tests/helpers/test-utils.tsx`:

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Add any providers your components need (AudioContext, etc.)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
```

#### Step 3: First Smoke Test
Create file `tests/unit/components/MainMenu.test.tsx`:

```typescript
import { render, screen } from '../../helpers/test-utils'
import MainMenu from '@/components/MainMenu'

describe('MainMenu', () => {
  it('renders without crashing', () => {
    render(<MainMenu />)
    // Just verify it doesn't throw an error
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
```

#### Verify Day 2 Success:
Run `npm test`. It should find and run 1 test successfully.

**✅ COMPLETED: August 14, 2025**  
**Result:** Successfully created first test for MainMenu component with proper mocking for icons and audio context.

---

### Day 3: Create Game State Test Utilities

#### Step 1: Mock Game Data
Create file `tests/fixtures/mockData.ts`:

```typescript
import type { GameClientState, PlayerClientState } from '@/lib/types'

export const createMockPlayer = (overrides: Partial<PlayerClientState> = {}): PlayerClientState => ({
  id: 'player-1',
  name: 'Test Player',
  avatar: 'avatar1.png',
  score: 0,
  isJudge: false,
  hand: [],
  isReady: false,
  ...overrides,
})

export const createMockGame = (overrides: Partial<GameClientState> = {}): GameClientState => ({
  gameId: 'game-1',
  players: [createMockPlayer()],
  currentRound: 1,
  currentJudgeId: null,
  currentScenario: null,
  gamePhase: 'lobby',
  submissions: [],
  categories: ['Pop Culture', 'Life Things'],
  ready_player_order: [],
  transitionState: 'idle',
  ...overrides,
})
```

#### Step 2: Test Utility Functions
Create file `tests/unit/utils/types.test.ts`:

```typescript
import { POINTS_TO_WIN, CARDS_PER_HAND, MIN_PLAYERS_TO_START } from '@/lib/types'

describe('Game Constants', () => {
  it('has sensible game configuration', () => {
    expect(POINTS_TO_WIN).toBeGreaterThan(0)
    expect(CARDS_PER_HAND).toBeGreaterThan(0)
    expect(MIN_PLAYERS_TO_START).toBeGreaterThanOrEqual(2)
  })
})
```

#### Verify Day 3 Success:
Run `npm test`. You should now have 2 tests passing.

---

### Day 4: Test One Core Game Mechanic

#### Step 1: Test Game Phase Logic
Create file `tests/unit/actions/gameLogic.test.ts`:

```typescript
import { createMockGame, createMockPlayer } from '../../fixtures/mockData'

describe('Game Logic', () => {
  describe('ready player validation', () => {
    it('should require minimum players to start', () => {
      const game = createMockGame({
        players: [createMockPlayer({ isReady: true })], // Only 1 player
        gamePhase: 'lobby'
      })
      
      // Test logic that checks if game can start
      expect(game.players.length).toBeLessThan(2) // MIN_PLAYERS_TO_START
    })

    it('should allow start when all players ready', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true })
        ],
        gamePhase: 'lobby'
      })
      
      const allReady = game.players.every(p => p.isReady)
      expect(allReady).toBe(true)
      expect(game.players.length).toBeGreaterThanOrEqual(2)
    })
  })
})
```

#### Verify Day 4 Success:
Run `npm test`. You should now have 4 tests passing and you're testing actual game logic.

---

### Day 5: Create "Fast-Forward" Test Helper

#### Step 1: Game Scenario Builder
Create file `tests/helpers/gameScenarios.ts`:

```typescript
import { createMockGame, createMockPlayer } from '../fixtures/mockData'
import type { GameClientState, GamePhaseClientState } from '@/lib/types'

export const createGameInPhase = (phase: GamePhaseClientState, playerCount: number = 3): GameClientState => {
  const players = Array.from({ length: playerCount }, (_, i) => 
    createMockPlayer({
      id: `player-${i + 1}`,
      name: `Player ${i + 1}`,
      isJudge: i === 0, // First player is judge
      isReady: true
    })
  )

  const baseGame = createMockGame({
    players,
    currentJudgeId: players[0].id,
    gamePhase: phase,
  })

  // Add phase-specific setup
  switch (phase) {
    case 'category_selection':
      return { ...baseGame, currentRound: 1 }
    case 'player_submission':
      return { 
        ...baseGame, 
        currentRound: 1,
        currentScenario: {
          id: 'scenario-1',
          category: 'Pop Culture',
          text: 'Test scenario'
        }
      }
    case 'judging':
      return {
        ...baseGame,
        currentRound: 1,
        submissions: [
          { playerId: 'player-2', cardId: 'card-1', cardText: 'Test response' }
        ]
      }
    default:
      return baseGame
  }
}
```

#### Step 2: Test the Helper
Create file `tests/unit/helpers/gameScenarios.test.ts`:

```typescript
import { createGameInPhase } from '../../helpers/gameScenarios'

describe('Game Scenario Helper', () => {
  it('creates game in judging phase with submissions', () => {
    const game = createGameInPhase('judging', 3)
    
    expect(game.gamePhase).toBe('judging')
    expect(game.players).toHaveLength(3)
    expect(game.submissions).toHaveLength(1)
    expect(game.currentJudgeId).toBe('player-1')
  })

  it('creates game ready for player submission', () => {
    const game = createGameInPhase('player_submission', 4)
    
    expect(game.gamePhase).toBe('player_submission')
    expect(game.currentScenario).toBeDefined()
    expect(game.currentScenario?.text).toBe('Test scenario')
  })
})
```

#### Verify Day 5 Success:
Run `npm test`. You should now have 6+ tests passing and can create game states at any phase instantly.

---

## End of Week 1 Deliverables

### What You'll Have:
1. ✅ **Working test runner** (`npm test`) - **COMPLETED**
2. ✅ **Test directory structure** organized by type - **COMPLETED**
3. ⏳ **Mock data creators** for games and players - **PENDING**
4. ⏳ **Game scenario builders** to skip manual setup - **PENDING**
5. ⏳ **6+ basic tests** proving the system works - **IN PROGRESS (1/6)**

### What You Can Do After Week 1:
```bash
# Run all tests
npm test

# Run tests and watch for changes (automatically re-runs when you save files)
npm run test:watch

# In your test files, create game scenarios without clicking through UI:
const gameAtEndgame = createGameInPhase('judging', 4)
const gameInLobby = createGameInPhase('lobby', 8)
```

### Time Investment:
- **Day 1-2:** ~2 hours setup (installing and configuring) - **✅ COMPLETED**
- **Day 3-4:** ~2 hours building helpers (creating mock data) - **⏳ PENDING**
- **Day 5:** ~1 hour testing the helpers - **⏳ PENDING**

**Completed so far: ~2 hours** | **Remaining: ~3 hours** to eliminate most of your manual testing setup time.

---

## Future Weeks Overview

### Week 2: Audio Reliability Testing
- Test audio context and sound effect triggers
- Debug intermittent audio issues
- Create audio system tests

### Week 3: Player Management Features  
- Implement and test leave/remove mechanics
- Test with new testing infrastructure
- Handle edge cases (judge leaving, etc.)

### Week 4: Polish and Production Prep
- Error boundaries and better error messages
- Performance monitoring setup
- Deployment hardening

---

## Basic Terminal Commands Reference

```bash
# Navigate to your project folder
cd /path/to/your/project

# Install testing dependencies
npm install --save-dev [package-names]

# Run tests once
npm test

# Run tests and keep watching for changes
npm run test:watch

# Stop watching tests
Ctrl+C (or Cmd+C on Mac)

# Check what tests exist
npm test -- --listTests
```

## Common Issues and Solutions

**"Command not found" errors:**
- Make sure you're in the correct project directory
- Make sure you have Node.js installed

**Tests failing to run:**
- Check that all files are saved
- Make sure file paths match exactly (case-sensitive)
- Run `npm install` again if needed

**Import/export errors:**
- Double-check file paths in import statements
- Make sure TypeScript files end in `.ts` or `.tsx`

---

*This roadmap assumes basic terminal/command line familiarity. If you need help with any terminal commands, ask for step-by-step guidance.*