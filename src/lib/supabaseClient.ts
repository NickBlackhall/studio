
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('🚨 SUPABASE ERROR: NEXT_PUBLIC_SUPABASE_URL is not set');
  console.log('Expected: https://your-project.supabase.co');
  console.log('Current NODE_ENV:', process.env.NODE_ENV);
}

if (!supabaseAnonKey) {
  console.error('🚨 SUPABASE ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  console.log('This should be your Supabase anon/public key');
}

// Create client with fallback values to prevent crashes
export const supabase = createClient<Database>(
  supabaseUrl || 'https://missing-url.supabase.co',
  supabaseAnonKey || 'missing-key',
  {
    auth: {
      persistSession: false, // Disable session persistence to avoid storage issues
    },
  }
);

// Export a function to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Add debugging info (client-side only)
if (typeof window !== 'undefined') {
  // Delay to ensure this runs after hydration
  setTimeout(() => {
    console.log('🔍 SUPABASE CLIENT DEBUG:');
    console.log('- URL configured:', !!supabaseUrl);
    console.log('- Key configured:', !!supabaseAnonKey);
    console.log('- Environment:', process.env.NODE_ENV);
  }, 100);
}
