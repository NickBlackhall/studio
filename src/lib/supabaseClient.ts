
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Import the newly generated types

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fpntcspwvpmrbbiekqsv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnRjc3B3dnBtcmJiaWVrcXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTk1MTMsImV4cCI6MjA2MzY5NTUxM30.OFddzp3_nHvGdQiRvm6z5MttpqS3YABgCqyHNqLpI5s';

// Log the URL being used for initialization
console.log("Supabase Client Initializing. URL:", supabaseUrl);
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log("Using Supabase URL from environment variable.");
} else {
  console.warn("Using fallback Supabase URL. Ensure this is correct for your project if environment variable is not set.");
}


if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL_HERE' || !supabaseUrl.startsWith('https')) {
  const errorMsg = `CRITICAL: Supabase URL is not configured or invalid. URL attempted: '${supabaseUrl}'. Please update src/lib/supabaseClient.ts or set NEXT_PUBLIC_SUPABASE_URL environment variable.`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}
if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY_HERE' || supabaseAnonKey.length < 100) { // Basic check for anon key format
  const errorMsg = "CRITICAL: Supabase anon key is not configured, appears to be a placeholder, or is too short. Please update src/lib/supabaseClient.ts or set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.";
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
