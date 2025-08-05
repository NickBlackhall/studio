/**
 * Room Code Generation and Validation Utilities
 * 
 * Room codes are 6-character alphanumeric strings that:
 * - Use uppercase letters A-Z and numbers 2-9
 * - Exclude confusing characters: 0, O, 1, I
 * - Are guaranteed to be unique across all active games
 */

import { supabase } from './supabaseClient';

// Character set excluding confusing characters (0, O, 1, I)
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 100;

/**
 * Generates a random 6-character room code
 */
function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[randomIndex];
  }
  return code;
}

/**
 * Checks if a room code is already in use
 */
async function isRoomCodeInUse(roomCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('games')
    .select('room_code')
    .eq('room_code', roomCode)
    .limit(1);

  if (error) {
    console.error('Error checking room code availability:', error);
    throw new Error('Failed to check room code availability');
  }

  return data && data.length > 0;
}

/**
 * Generates a unique room code that doesn't exist in the database
 */
export async function generateUniqueRoomCode(): Promise<string> {
  let attempts = 0;
  
  while (attempts < MAX_GENERATION_ATTEMPTS) {
    const roomCode = generateRandomCode();
    
    try {
      const isInUse = await isRoomCodeInUse(roomCode);
      
      if (!isInUse) {
        console.log(`Generated unique room code: ${roomCode} (attempt ${attempts + 1})`);
        return roomCode;
      }
      
      attempts++;
    } catch (error) {
      console.error(`Error during room code generation attempt ${attempts + 1}:`, error);
      attempts++;
    }
  }
  
  throw new Error(`Failed to generate unique room code after ${MAX_GENERATION_ATTEMPTS} attempts`);
}

/**
 * Validates room code format
 */
export function isValidRoomCodeFormat(roomCode: string): boolean {
  if (!roomCode || typeof roomCode !== 'string') {
    return false;
  }
  
  // Must be exactly 6 characters
  if (roomCode.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  
  // Must be uppercase alphanumeric with allowed characters only
  const validPattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
  return validPattern.test(roomCode);
}

/**
 * Finds a game by room code
 */
export async function findGameByRoomCode(roomCode: string) {
  if (!isValidRoomCodeFormat(roomCode)) {
    throw new Error('Invalid room code format');
  }

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .limit(1);

  if (error) {
    console.error('Error finding game by room code:', error);
    throw new Error('Failed to find game');
  }

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Finds a game by room code with player count for validation
 */
export async function findGameByRoomCodeWithPlayers(roomCode: string) {
  if (!isValidRoomCodeFormat(roomCode)) {
    throw new Error('Invalid room code format');
  }

  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      players:players(count)
    `)
    .eq('room_code', roomCode.toUpperCase())
    .limit(1);

  if (error) {
    console.error('Error finding game by room code with players:', error);
    throw new Error('Failed to find game');
  }

  if (!data || data.length === 0) {
    return null;
  }

  const game = data[0];
  return {
    ...game,
    currentPlayers: (game.players as any)?.[0]?.count || 0,
    availableSlots: game.max_players - ((game.players as any)?.[0]?.count || 0)
  };
}

/**
 * Gets all public games for room browser
 */
export async function getPublicGames() {
  // Trigger cleanup of empty rooms when browsing (fire and forget)
  try {
    const { cleanupEmptyRooms } = await import('@/app/game/actions');
    cleanupEmptyRooms().catch(err => console.error('Background cleanup failed:', err));
  } catch (e) {
    // Ignore import errors in case of build issues
  }

  const { data, error } = await supabase
    .from('games')
    .select(`
      id,
      room_code,
      room_name,
      game_phase,
      max_players,
      created_at,
      players:players(count)
    `)
    .eq('is_public', true)
    .in('game_phase', ['lobby', 'category_selection', 'player_submission', 'judging', 'winner_announcement'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching public games:', error);
    throw new Error('Failed to fetch public games');
  }

  // Calculate available slots for each game
  return (data || []).map(game => ({
    ...game,
    currentPlayers: (game.players as any)?.[0]?.count || 0,
    availableSlots: game.max_players - ((game.players as any)?.[0]?.count || 0)
  })).filter(game => game.availableSlots > 0); // Only show games with space
}

/**
 * Normalizes room code input (uppercase, trim whitespace)
 */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Creates a shareable room code URL
 */
export function createRoomUrl(roomCode: string): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'https://make-it-terrible.netlify.app';
  
  return `${baseUrl}/?room=${roomCode}`;
}

/**
 * Room code display formatting (adds visual separators)
 */
export function formatRoomCodeDisplay(roomCode: string): string {
  if (roomCode.length !== 6) return roomCode;
  return `${roomCode.slice(0, 3)}-${roomCode.slice(3)}`;
}