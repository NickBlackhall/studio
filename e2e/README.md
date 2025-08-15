# E2E Testing Guide

This directory contains end-to-end tests for the multi-player card game using Playwright.

## Structure

```
e2e/
├── fixtures/         # Test data and configuration
├── helpers/          # Test utilities and base classes
├── tests/           # Actual test files
└── README.md        # This file
```

## Key Features

### Multi-Player Testing
- **Multiple Browser Contexts**: Simulates real users with separate browser sessions
- **Real-Time Coordination**: Tests WebSocket-based game synchronization
- **Database Integration**: Uses isolated Supabase test environment

### Test Categories

1. **Basic Flow Tests** (`basic-flow.spec.ts`)
   - Game creation and joining
   - Main menu functionality
   - Error handling

2. **Reset Flow Tests** (`reset-flow.spec.ts`)
   - Multi-player reset coordination
   - Server-first architecture validation
   - Race condition prevention
   - Disconnection handling

## Running Tests

### Local Development
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug
```

### Test Environment Setup

1. **Local Supabase** (Recommended)
   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli
   
   # Start local Supabase
   supabase start
   
   # Update .env.test with local URLs
   ```

2. **Dedicated Test Project**
   - Create separate Supabase project for testing
   - Update `.env.test` with test project credentials
   - Never use production credentials

## Test Architecture

### Multi-Player Helpers
The `multi-player.ts` helper provides:
- Automatic browser context management
- Player simulation utilities
- Database cleanup
- Common game flow functions

### Server-First Testing
Tests validate the server-first architecture documented in CLAUDE.md:
- Reset coordination happens server-side
- All clients receive synchronized notifications
- Race conditions are prevented
- Disconnections are handled gracefully

### Fixtures and Data
- Isolated test data generation
- Consistent test player names
- Configurable timeouts
- Reusable game scenarios

## Adding New Tests

1. **Single Player Tests**: Use `test-base.ts`
2. **Multi-Player Tests**: Use `multi-player.ts`
3. **Add appropriate data-testid attributes** to components for reliable selection
4. **Include cleanup logic** to prevent test pollution

## CI/CD Integration

Tests run automatically on:
- Push to main/master
- Pull requests
- Uses containerized Supabase for isolation
- Generates HTML reports for failures

## Debugging Tips

1. **Use headed mode** to see browser interactions
2. **Add screenshots** for failing assertions
3. **Check network tab** for API failures
4. **Use page.pause()** for interactive debugging
5. **Monitor database state** with Supabase dashboard

## Known Limitations

- OS compatibility warnings (expected in containerized environments)
- Test isolation requires proper cleanup
- WebSocket testing may need additional retry logic
- Real-time coordination timing can be sensitive

## Related Documentation

- `CLAUDE.md` - Reset button architecture details
- `LOBBY_TRANSITION_FIX_PLAN.md` - Transition state patterns
- `playwright.config.ts` - Test configuration
- `.github/workflows/e2e-tests.yml` - CI setup