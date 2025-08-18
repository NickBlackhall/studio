import { FullConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

async function globalSetup(config: FullConfig) {
  // Load environment variables from .env.local
  loadEnv({ path: '.env.local' });
  
  // Set environment variable to indicate we're in Playwright test mode
  process.env.PLAYWRIGHT_TEST = 'true';
  
  console.log('🧪 Playwright global setup: Set PLAYWRIGHT_TEST=true');
  console.log('🔧 Playwright global setup: Loaded environment variables from .env.local');
  
  // Verify Supabase environment is loaded
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log(`🔍 Supabase URL loaded: ${hasSupabaseUrl}`);
  console.log(`🔍 Supabase Key loaded: ${hasSupabaseKey}`);
  
  if (!hasSupabaseUrl || !hasSupabaseKey) {
    console.error('❌ Missing Supabase environment variables for testing');
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

export default globalSetup;