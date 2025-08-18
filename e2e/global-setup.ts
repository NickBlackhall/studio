import { FullConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

async function globalSetup(config: FullConfig) {
  // For CI, use environment variables directly (passed from GitHub workflow)
  // For local development, try test environment first, then fallback to .env.local
  if (!process.env.CI) {
    // Local development: try test environment first
    try {
      loadEnv({ path: '.env.test' });
      console.log('🧪 Playwright global setup: Loaded test environment from .env.test');
    } catch (error) {
      // Fallback to .env.local for local development
      loadEnv({ path: '.env.local' });
      console.log('🧪 Playwright global setup: Loaded development environment from .env.local');
      console.log('⚠️  WARNING: Using production database for tests! Consider setting up .env.test');
    }
  }
  
  // Set environment variable to indicate we're in Playwright test mode
  process.env.PLAYWRIGHT_TEST = 'true';
  
  console.log('🧪 Playwright global setup: Set PLAYWRIGHT_TEST=true');
  
  // Verify Supabase environment is loaded
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log(`🔍 Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
  console.log(`🔍 Supabase Key: ${supabaseKey ? 'Present' : 'Missing'}`);
  console.log(`🔍 CI Environment: ${process.env.CI ? 'Yes' : 'No'}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables for testing');
    console.error('Expected either:');
    console.error('- CI: Environment variables from GitHub workflow');
    console.error('- Local: .env.test with local Supabase or .env.local as fallback');
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // Warn if using production database
  if (supabaseUrl.includes('supabase.co')) {
    console.log('⚠️  WARNING: Tests are using production Supabase database!');
    console.log('💡 Consider using local Supabase for testing: supabase start');
  } else {
    console.log('✅ Using local/test Supabase database');
  }
}

export default globalSetup;