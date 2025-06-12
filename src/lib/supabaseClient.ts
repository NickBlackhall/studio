
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Import the newly generated types

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fpntcspwvpmrbbiekqsv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnRjc3B3dnBtcmJiaWVrcXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTk1MTMsImV4cCI6MjA2MzY5NTUxM30.OFddzp3_nHvGdQiRvm6z5MttpqS3YABgCqyHNqLpI5s';

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL_HERE') {
  // This condition should ideally not be met if NEXT_PUBLIC_SUPABASE_URL is set or hardcoded correctly
  throw new Error('Supabase URL is not configured. Please update src/lib/supabaseClient.ts or set NEXT_PUBLIC_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  // This condition should ideally not be met if NEXT_PUBLIC_SUPABASE_ANON_KEY is set or hardcoded correctly
  throw new Error('Supabase anon key is not configured or is incorrect. Please update src/lib/supabaseClient.ts or set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
