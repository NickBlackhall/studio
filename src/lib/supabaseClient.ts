
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Import the newly generated types

const supabaseUrl = 'https://fpntcspwvpmrbbiekqsv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnRjc3B3dnBtcmJiaWVrcXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTk1MTMsImV4cCI6MjA2MzY5NTUxM30.OFddzp3_nHvGdQiRvm6z5MttpqS3YABgCqyHNqLpI5s';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
