# GitHub Codespaces Development Environment

This configuration sets up a complete development environment for your multi-player game with E2E testing support.

## What's Included

### Environment
- **Node.js 18** with TypeScript support
- **Playwright browsers** pre-installed with dependencies
- **GitHub CLI** for repo management
- **VS Code extensions** for optimal development experience

### Pre-configured Ports
- **9003**: Next.js development server
- **54321**: Supabase local instance
- **5432**: PostgreSQL database

### VS Code Extensions
- Playwright test runner with UI
- Tailwind CSS IntelliSense
- TypeScript language support
- Auto-formatting with Prettier
- Path IntelliSense for imports

## Getting Started

### 1. Launch Codespace
- Go to your GitHub repo
- Click **Code** → **Codespaces** → **Create codespace**
- Wait ~2-3 minutes for full setup

### 2. Start Development
```bash
# Start Next.js development server
npm run dev

# Run E2E tests with UI (this will work in Codespaces!)
npm run test:e2e:ui

# Run tests in headed mode to see browsers
npm run test:e2e:headed
```

### 3. Set Up Database (Optional)
For full testing with real database:
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Start local Supabase
supabase start
```

## Key Benefits vs Claude Code

✅ **Full browser support** - E2E tests work perfectly
✅ **Persistent workspace** - Your changes stay between sessions  
✅ **Multi-port forwarding** - Access dev server, database, etc.
✅ **VS Code integration** - Native debugging, test running
✅ **Git workflows** - Easy commits, PRs, deployments

## Testing Your Reset Flow

The E2E tests will validate your multi-player reset coordination:

```bash
# Interactive test runner
npm run test:e2e:ui

# Run specific reset flow tests
npx playwright test reset-flow --headed

# Debug failing tests
npm run test:e2e:debug
```

## Cost Considerations

- **60 hours/month free** for personal accounts
- **$0.18/hour** for 2-core machine after free tier
- Codespace auto-sleeps when inactive
- Perfect for focused development sessions

## Tips

1. **Use the Playwright extension** - Right-click test files to run individual tests
2. **Forward ports automatically** - Your dev server will be accessible via web
3. **Install test environment** - Copy `.env.test` values or set up local Supabase
4. **Browser debugging** - Use headed mode to see exactly what tests do

Your multi-player coordination tests will finally run properly and you can debug the exact scenarios from CLAUDE.md!