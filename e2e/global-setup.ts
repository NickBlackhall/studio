import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Set environment variable to indicate we're in Playwright test mode
  process.env.PLAYWRIGHT_TEST = 'true';
  
  console.log('🧪 Playwright global setup: Set PLAYWRIGHT_TEST=true');
}

export default globalSetup;