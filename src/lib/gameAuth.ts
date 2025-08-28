/**
 * Game-Specific Authorization System
 * 
 * Provides database-integrated authorization checks for game actions.
 * Works with the token system to verify player permissions.
 */

import { supabase } from './supabaseClient';
import { validatePlayerAccess, validateJudgeAccess, validateHostAccess } from './auth';

export interface AuthorizationResult {
  authorized: boolean;
  playerId?: string;
  error?: string;
  details?: {
    isHost?: boolean;
    isJudge?: boolean;
    isMember?: boolean;
  };
}

/**
 * Validates that the current session player is a member of the specified game
 */
export async function validateGameMembership(gameId: string): Promise<AuthorizationResult> {
  // First check session token
  const tokenValidation = await validatePlayerAccess(gameId);
  if (!tokenValidation.authorized) {
    return {
      authorized: false,
      error: tokenValidation.error || 'Invalid session'
    };
  }

  const playerId = tokenValidation.playerId!;

  // Verify player exists in database for this game
  const { data: playerData, error: playerError } = await supabase
    .from('players')
    .select('id, name, game_id')
    .eq('id', playerId)
    .eq('game_id', gameId)
    .single();

  if (playerError || !playerData) {
    return {
      authorized: false,
      error: 'Player not found in game or database error',
      playerId
    };
  }

  return {
    authorized: true,
    playerId,
    details: { isMember: true }
  };
}

/**
 * Validates that the current session player is the current judge for the specified game
 */
export async function validateCurrentJudge(gameId: string): Promise<AuthorizationResult> {
  // First validate basic membership
  const membershipResult = await validateGameMembership(gameId);
  if (!membershipResult.authorized) {
    return membershipResult;
  }

  const playerId = membershipResult.playerId!;

  // Check if player is the current judge in the game
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameError || !gameData) {
    return {
      authorized: false,
      error: 'Game not found or database error',
      playerId
    };
  }

  if (gameData.current_judge_id !== playerId) {
    return {
      authorized: false,
      error: 'Player is not the current judge',
      playerId
    };
  }

  return {
    authorized: true,
    playerId,
    details: { 
      isMember: true, 
      isJudge: true 
    }
  };
}

/**
 * Validates that the current session player is the host (room creator) of the specified game
 */
export async function validateGameHost(gameId: string): Promise<AuthorizationResult> {
  // First validate basic membership
  const membershipResult = await validateGameMembership(gameId);
  if (!membershipResult.authorized) {
    return membershipResult;
  }

  const playerId = membershipResult.playerId!;

  // Check if player is the room creator (host)
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('created_by_player_id')
    .eq('id', gameId)
    .single();

  if (gameError || !gameData) {
    return {
      authorized: false,
      error: 'Game not found or database error',
      playerId
    };
  }

  if (gameData.created_by_player_id !== playerId) {
    return {
      authorized: false,
      error: 'Player is not the room host',
      playerId
    };
  }

  return {
    authorized: true,
    playerId,
    details: { 
      isMember: true, 
      isHost: true 
    }
  };
}

/**
 * Validates that the current session player can perform judge-only actions
 * This is a composite check for judge status
 */
export async function validateJudgeAction(gameId: string): Promise<AuthorizationResult> {
  // Check both token role and database status
  const tokenValidation = await validateJudgeAccess(gameId);
  if (!tokenValidation.authorized) {
    // If token doesn't have judge role, check database anyway (role might be stale)
    return await validateCurrentJudge(gameId);
  }

  // Token says judge, verify against database
  const dbValidation = await validateCurrentJudge(gameId);
  return dbValidation;
}

/**
 * Validates that the current session player can perform host-only actions
 * This is a composite check for host status
 */
export async function validateHostAction(gameId: string): Promise<AuthorizationResult> {
  // Check both token role and database status
  const tokenValidation = await validateHostAccess(gameId);
  if (!tokenValidation.authorized) {
    // If token doesn't have host role, check database anyway (role might be stale)
    return await validateGameHost(gameId);
  }

  // Token says host, verify against database
  const dbValidation = await validateGameHost(gameId);
  return dbValidation;
}

/**
 * Authorization wrapper for server actions
 * Throws error if not authorized, returns player ID if authorized
 */
export async function requireGameMembership(gameId: string): Promise<string> {
  const result = await validateGameMembership(gameId);
  if (!result.authorized) {
    throw new Error(`Unauthorized: ${result.error || 'Not a member of this game'}`);
  }
  return result.playerId!;
}

/**
 * Authorization wrapper for judge-only server actions
 * Throws error if not authorized, returns player ID if authorized
 */
export async function requireJudgeAccess(gameId: string): Promise<string> {
  const result = await validateJudgeAction(gameId);
  if (!result.authorized) {
    throw new Error(`Unauthorized: ${result.error || 'Not the current judge'}`);
  }
  return result.playerId!;
}

/**
 * Authorization wrapper for host-only server actions
 * Throws error if not authorized, returns player ID if authorized
 */
export async function requireHostAccess(gameId: string): Promise<string> {
  const result = await validateHostAction(gameId);
  if (!result.authorized) {
    throw new Error(`Unauthorized: ${result.error || 'Not the room host'}`);
  }
  return result.playerId!;
}

/**
 * Get current player ID from session (for actions that need it)
 * Throws error if no valid session
 */
export async function getCurrentPlayerId(): Promise<string> {
  const tokenValidation = await validatePlayerAccess(''); // Don't check game ID
  if (!tokenValidation.authorized || !tokenValidation.playerId) {
    throw new Error('No valid player session');
  }
  return tokenValidation.playerId;
}

/**
 * Authorization check for development/testing purposes
 * Allows bypassing auth in development mode with console warning
 */
export async function requireAuthOrDev(gameId: string, authCheck: () => Promise<string>): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    try {
      return await authCheck();
    } catch (error) {
      console.warn(`🟡 AUTH BYPASS (DEV MODE): ${error}`);
      // In dev mode, try to get any valid player ID as fallback
      try {
        const { data: anyPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('game_id', gameId)
          .limit(1)
          .single();
        if (anyPlayer) {
          return anyPlayer.id;
        }
      } catch (devError) {
        // If no fallback available, still throw original error
      }
      throw error;
    }
  }
  
  return await authCheck();
}