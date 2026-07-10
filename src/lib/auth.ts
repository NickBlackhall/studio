/**
 * Secure Player Authentication System
 * 
 * Provides cryptographic token-based authentication for game sessions.
 * Replaces localStorage-based identity with server-verified tokens.
 */

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

// Token configuration
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-fallback-secret-key');
const TOKEN_EXPIRY = '24h'; // 24 hour token lifetime
const COOKIE_NAME = 'game-session';

export interface PlayerToken extends Record<string, any> {
  playerId: string;
  gameId: string;
  role: 'player' | 'judge' | 'host';
  exp?: number;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: PlayerToken;
  error?: string;
}

/**
 * Creates a signed JWT token for a player in a specific game
 */
export async function createPlayerToken(
  playerId: string, 
  gameId: string, 
  role: 'player' | 'judge' | 'host' = 'player'
): Promise<string> {
  const payload: PlayerToken = {
    playerId,
    gameId,
    role,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verifies and decodes a JWT token
 */
export async function verifyPlayerToken(token: string): Promise<TokenValidationResult> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      valid: true,
      token: payload as unknown as PlayerToken
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid token'
    };
  }
}

/**
 * Sets the player session token as an HTTP-only cookie
 */
export async function setPlayerSession(
  playerId: string, 
  gameId: string, 
  role: 'player' | 'judge' | 'host' = 'player'
): Promise<void> {
  const token = await createPlayerToken(playerId, gameId, role);
  
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });
}

const CREATOR_CLAIM_COOKIE = 'room-creator-claim';

/**
 * Marks this browser as the creator of a room. addPlayer consumes the claim
 * so the creator becomes host regardless of join order — without it, host
 * went to whoever finished name entry first, so a faster second player
 * (e.g. on a phone) silently stole hosting from the room's creator.
 */
export async function setRoomCreatorClaim(gameId: string): Promise<void> {
  const token = await new SignJWT({ gameId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
  (await cookies()).set(CREATOR_CLAIM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour — claims only matter while joining
    path: '/',
  });
}

/** Returns true (and clears the claim) if this browser created the game. */
export async function consumeRoomCreatorClaim(gameId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(CREATOR_CLAIM_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.gameId === gameId) {
      store.delete(CREATOR_CLAIM_COOKIE);
      return true;
    }
  } catch {
    // expired or invalid claim — ignore
  }
  return false;
}

/**
 * Gets the current player session from cookies
 */
export async function getPlayerSession(): Promise<TokenValidationResult> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  
  if (!token) {
    return {
      valid: false,
      error: 'No session token found'
    };
  }
  
  return await verifyPlayerToken(token);
}

/**
 * Clears the player session cookie
 */
export async function clearPlayerSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/**
 * Updates player role in existing session (for judge/host transitions)
 */
export async function updatePlayerRole(
  playerId: string, 
  gameId: string, 
  newRole: 'player' | 'judge' | 'host'
): Promise<void> {
  const currentSession = await getPlayerSession();
  
  if (!currentSession.valid || !currentSession.token) {
    throw new Error('No valid session to update');
  }
  
  if (currentSession.token.playerId !== playerId || currentSession.token.gameId !== gameId) {
    throw new Error('Session mismatch - cannot update role');
  }
  
  // Create new token with updated role
  await setPlayerSession(playerId, gameId, newRole);
}

/**
 * Authorization helper - validates player has access to a specific game
 */
export async function validatePlayerAccess(requiredGameId: string): Promise<{
  authorized: boolean;
  playerId?: string;
  gameId?: string;
  role?: string;
  error?: string;
}> {
  const session = await getPlayerSession();
  
  if (!session.valid || !session.token) {
    return {
      authorized: false,
      error: session.error || 'No valid session'
    };
  }
  
  if (session.token.gameId !== requiredGameId) {
    return {
      authorized: false,
      error: 'Session is for different game'
    };
  }
  
  return {
    authorized: true,
    playerId: session.token.playerId,
    gameId: session.token.gameId,
    role: session.token.role
  };
}

/**
 * Authorization helper - validates player is current judge
 */
export async function validateJudgeAccess(requiredGameId: string): Promise<{
  authorized: boolean;
  playerId?: string;
  error?: string;
}> {
  const playerAccess = await validatePlayerAccess(requiredGameId);
  
  if (!playerAccess.authorized) {
    return {
      authorized: false,
      error: playerAccess.error
    };
  }
  
  if (playerAccess.role !== 'judge') {
    return {
      authorized: false,
      error: 'Player is not the current judge'
    };
  }
  
  return {
    authorized: true,
    playerId: playerAccess.playerId
  };
}

/**
 * Authorization helper - validates player is the room host
 */
export async function validateHostAccess(requiredGameId: string): Promise<{
  authorized: boolean;
  playerId?: string;
  error?: string;
}> {
  const playerAccess = await validatePlayerAccess(requiredGameId);
  
  if (!playerAccess.authorized) {
    return {
      authorized: false,
      error: playerAccess.error
    };
  }
  
  if (playerAccess.role !== 'host') {
    return {
      authorized: false,
      error: 'Player is not the room host'
    };
  }
  
  return {
    authorized: true,
    playerId: playerAccess.playerId
  };
}