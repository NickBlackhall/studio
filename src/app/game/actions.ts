
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState, PlayerHandCard } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN, MIN_PLAYERS_TO_START } from '@/lib/types';
import { generateUniqueRoomCode } from '@/lib/roomCodes';
import { 
  requireGameMembership, 
  requireJudgeAccess, 
  requireHostAccess,
  requireAuthOrDev 
} from '@/lib/gameAuth';
import { getPlayerSession, clearPlayerSession, setPlayerSession, setRoomCreatorClaim, consumeRoomCreatorClaim } from '@/lib/auth';


export async function findOrCreateGame(): Promise<Tables<'games'>> {
  console.log("🔵 ACTION: findOrCreateGame - Initiated");
  const { data: lobbyGames, error: lobbyError } = await supabase
    .from('games')
    .select('*')
    .eq('game_phase', 'lobby')
    .order('created_at', { ascending: true })
    .limit(1);

  if (lobbyError) {
    console.error("🔴 ACTION: findOrCreateGame - Error fetching lobby games:", JSON.stringify(lobbyError, null, 2));
  }

  if (lobbyGames && lobbyGames.length > 0) {
    console.log("🔵 ACTION: findOrCreateGame - Found existing lobby game:", lobbyGames[0].id);
    return lobbyGames[0];
  }
  // BUGFIX: Previously this fell back to returning ANY existing game — including one
  // mid-play that new visitors could never join. Now, if no lobby exists, we always
  // create a fresh lobby game instead.
  console.log("🔵 ACTION: findOrCreateGame - No lobby game found, creating a new one.");

  // Generate room code for the new game
  const roomCode = await generateUniqueRoomCode();
  console.log("🔵 ACTION: findOrCreateGame - Generated room code:", roomCode);

  const newGameData: TablesInsert<'games'> = {
    game_phase: 'lobby',
    current_round: 0,
    current_judge_id: null,
    current_scenario_id: null,
    ready_player_order: [],
    last_round_winner_player_id: null,
    last_round_winning_card_text: null,
    overall_winner_player_id: null,
    used_scenarios: [],
    used_responses: [],
    updated_at: new Date().toISOString(),
    transition_state: 'idle',
    transition_message: null,
    room_code: roomCode,
    room_name: 'Quick Game',
    is_public: false,
    max_players: 8
  };
  const { data: newGame, error: createError } = await supabase
    .from('games')
    .insert(newGameData)
    .select()
    .single();

  if (createError || !newGame) {
    const errorMessage = createError ? createError.message : "New game data was unexpectedly null after insert operation.";
    console.error("🔴 ACTION: findOrCreateGame - Error creating new game:", errorMessage, JSON.stringify(createError, null, 2));
    if (createError && createError.message.includes('RLS')) {
        throw new Error(`Could not create a new game. Supabase error: ${errorMessage}. Possible RLS issue on 'games' table.`);
    }
    throw new Error(`Could not create a new game. Supabase error: ${errorMessage}`);
  }
  console.log("🔵 ACTION: findOrCreateGame - Successfully created new game:", newGame.id);
  return newGame;
}


export async function getGame(gameIdToFetch?: string): Promise<GameClientState> {
  console.log(`🔵 ACTION: getGame - Initiated. Requested gameId: ${gameIdToFetch || 'None'}`);

  // SECURITY: If gameId specified, verify player has access to that game
  if (gameIdToFetch) {
    const authorizedPlayerId = await requireAuthOrDev(gameIdToFetch, () => requireGameMembership(gameIdToFetch));
    console.log(`🔵 ACTION: getGame - Player authorization passed for: ${authorizedPlayerId}`);
  }

  return getGameStateInternal(gameIdToFetch);
}

// Assembles GameClientState WITHOUT a membership check. For server-internal
// use after the caller has already authorized the operation — e.g.
// removePlayerFromGame must return the updated state to a player whose row
// was just deleted, so re-running the membership check would always fail.
async function getGameStateInternal(gameIdToFetch?: string): Promise<GameClientState> {
  let gameRow: Tables<'games'> | null = null;

  if (gameIdToFetch) {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameIdToFetch).single();
    // BUGFIX: Previously a missing/deleted game fell back to findOrCreateGame(),
    // silently dropping the player into the oldest lobby in the database — a
    // different room they never joined. Now we fail loudly so the client can
    // return the player to the main menu.
    if (error) {
      console.warn(`🟡 ACTION: getGame - Error fetching game ${gameIdToFetch}:`, error.message);
      throw new Error(`Game not found. It may have been closed or deleted.`);
    } else if (!data) {
      console.warn(`🟡 ACTION: getGame - No game data found for ${gameIdToFetch}.`);
      throw new Error(`Game not found. It may have been closed or deleted.`);
    } else {
      console.log(`🔵 ACTION: getGame - Successfully fetched game ${gameIdToFetch}.`);
      gameRow = data;
    }
  } else {
    console.log(`🔵 ACTION: getGame - No gameId provided, finding or creating game.`);
    gameRow = await findOrCreateGame();
  }

  if (!gameRow || !gameRow.id) {
    console.error("🔴 ACTION: getGame - CRITICAL - Failed to find or create a game session.");
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;
  console.log(`🔵 ACTION: getGame - Processing for gameId: ${gameId}. Phase: ${gameRow.game_phase}`);

  // Parallelize all database queries for better performance
  const [
    playersResult,
    categoriesResult,
    scenarioResult,
    submissionsResult
  ] = await Promise.allSettled([
    // Players query
    supabase.from('players').select('*').eq('game_id', gameId),
    
    // Categories query
    supabase.from('scenarios').select('category'),
    
    // Current scenario query (only if needed)
    gameRow.current_scenario_id 
      ? supabase.from('scenarios').select('id, category, text').eq('id', gameRow.current_scenario_id).single()
      : Promise.resolve({ data: null, error: null }),
      
    // Submissions query (only if needed)
    (gameRow.game_phase === 'judging' || gameRow.game_phase === 'player_submission' || gameRow.game_phase === 'judge_approval_pending') && gameRow.current_round > 0
      ? supabase.from('responses').select('*, response_cards(id, text)').eq('game_id', gameId).eq('round_number', gameRow.current_round)
      : Promise.resolve({ data: null, error: null })
  ]);

  // Process players result
  let playersData: Tables<'players'>[] = [];
  if (playersResult.status === 'fulfilled' && !playersResult.value.error) {
    playersData = playersResult.value.data || [];
    console.log(`🔵 ACTION: getGame - Fetched ${playersData.length} players.`);
  } else {
    console.error(`🔴 ACTION: getGame - Error fetching players for game ${gameId}:`, playersResult.status === 'fulfilled' ? playersResult.value.error : playersResult.reason);
  }

  const playerIds = playersData.map(p => p.id);
  
  // Fetch player hands separately (needs playerIds from above)
  type HandDataWithCard = Tables<'player_hands'> & {
    response_cards: Pick<Tables<'response_cards'>, 'id' | 'text'> | null;
  };
  let allHandsData: HandDataWithCard[] = [];

  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('*, response_cards(id, text)')
      .in('player_id', playerIds)
      .eq('game_id', gameId);

    if (handsError) {
      console.error(`🔴 ACTION: getGame - Error fetching player hands for game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = (fetchedHandsData as HandDataWithCard[]) || [];
      console.log(`🔵 ACTION: getGame - Fetched ${allHandsData.length} total hand cards for all players.`);
    }
  }

  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards = allHandsData
      .filter(h => h.player_id === p.id)
      .map(h => {
        if (h.response_cards?.text && h.response_cards?.id) {
          return {
            id: h.response_cards.id,
            text: h.response_cards.text,
            isNew: h.is_new ?? false,
          };
        }
        return null;
      })
      .filter((card): card is { id: string; text: string; isNew: boolean } => card !== null);
      
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar || '',
      score: p.score,
      isJudge: p.id === gameRow.current_judge_id,
      hand: playerHandCards,
      isReady: p.is_ready,
    };
  });

  // Process categories result
  let categories: string[] = ["Default Category"];
  if (categoriesResult.status === 'fulfilled' && !categoriesResult.value.error && categoriesResult.value.data) {
    const distinctCategories = [...new Set(
        categoriesResult.value.data.map(c => c.category)
                      .filter(c => c !== null && typeof c === 'string' && c.trim() !== '' && c.trim() !== "Boondoggles") as string[]
    )];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
      console.log(`🔵 ACTION: getGame - Loaded ${categories.length} distinct categories.`);
    }
  } else {
    console.error('🔴 ACTION: getGame - Error fetching categories:', categoriesResult.status === 'fulfilled' ? categoriesResult.value.error : categoriesResult.reason);
  }

  // Process current scenario result
  let currentScenario: ScenarioClientState | null = null;
  if (scenarioResult.status === 'fulfilled' && !scenarioResult.value.error && scenarioResult.value.data) {
    const scenarioData = scenarioResult.value.data;
    currentScenario = {
      id: scenarioData.id,
      category: scenarioData.category || 'Unknown',
      text: scenarioData.text,
    };
    console.log(`🔵 ACTION: getGame - Loaded current scenario:`, currentScenario);
  } else if (scenarioResult.status === 'rejected' || (scenarioResult.status === 'fulfilled' && scenarioResult.value.error)) {
    console.error('🔴 ACTION: getGame - Error fetching current scenario:', scenarioResult.status === 'fulfilled' ? scenarioResult.value.error : scenarioResult.reason);
  }
  
  // Process submissions result
  type SubmissionWithCard = Tables<'responses'> & {
    response_cards: Pick<Tables<'response_cards'>, 'id' | 'text'> | null;
  };
  let submissions: GameClientState['submissions'] = [];
  if (submissionsResult.status === 'fulfilled' && !submissionsResult.value.error && submissionsResult.value.data) {
    const submissionData = submissionsResult.value.data as SubmissionWithCard[];
    submissions = submissionData.map((s) => {
      const cardText = s.submitted_text || s.response_cards?.text || 'Error: Card text not found';
      const cardId = s.response_card_id || (s.submitted_text ? `custom-${s.player_id}-${gameRow.current_round}` : `error-${s.player_id}`);

      return {
        playerId: s.player_id,
        cardId: cardId,
        cardText: cardText,
      };
    });
    console.log(`🔵 ACTION: getGame - Loaded ${submissions.length} submissions for round ${gameRow.current_round}.`);
  } else if (submissionsResult.status === 'rejected' || (submissionsResult.status === 'fulfilled' && submissionsResult.value.error)) {
    console.error(`🔴 ACTION: getGame - Error fetching submissions for round ${gameRow.current_round}:`, submissionsResult.status === 'fulfilled' ? submissionsResult.value.error : submissionsResult.reason);
  }

  let lastWinnerDetails: GameClientState['lastWinner'] = undefined;
  if (gameRow.last_round_winner_player_id && gameRow.last_round_winning_card_text) {
    const winnerPlayer = players.find(p => p.id === gameRow.last_round_winner_player_id);
    if (winnerPlayer) {
      lastWinnerDetails = {
        player: winnerPlayer,
        cardText: gameRow.last_round_winning_card_text,
      };
    }
  }
  
  const dbReadyPlayerOrder = gameRow.ready_player_order || [];

  const gameClientState: GameClientState = {
    gameId: gameId,
    players: players,
    currentRound: gameRow.current_round,
    currentJudgeId: gameRow.current_judge_id,
    currentScenario: currentScenario,
    gamePhase: gameRow.game_phase as GamePhaseClientState,
    submissions: submissions,
    categories: categories,
    lastWinner: lastWinnerDetails,
    winningPlayerId: gameRow.overall_winner_player_id,
    hostPlayerId: gameRow.created_by_player_id,
    ready_player_order: dbReadyPlayerOrder,
    transitionState: gameRow.transition_state as GameClientState['transitionState'],
    transitionMessage: gameRow.transition_message,
  };
  
  console.log(`🔵 ACTION: getGame - Successfully built gameClientState for game ${gameId}. Returning.`);
  return gameClientState;
}


export async function addPlayer(name: string, avatar: string, targetGameId?: string): Promise<Tables<'players'> | null> {
  console.log(`🔵 ACTION: addPlayer - Initiated for name: "${name}", targetGameId: ${targetGameId || 'none'}`);
  
  let gameRow: Tables<'games'>;
  
  if (targetGameId) {
    // Use specific game ID
    const { data, error } = await supabase.from('games').select('*').eq('id', targetGameId).single();
    if (error || !data) {
      console.error(`🔴 ACTION: addPlayer - Failed to find game ${targetGameId}:`, error?.message);
      throw new Error(`Could not find game with ID: ${targetGameId}`);
    }
    gameRow = data;
  } else {
    // Fallback to find/create game
    gameRow = await findOrCreateGame();
    if (!gameRow || !gameRow.id) {
      console.error('🔴 ACTION: addPlayer - Failed to find or create a game session.');
      throw new Error('Could not find or create game session to add player.');
    }
  }
  
  const gameId = gameRow.id;
  console.log(`🔵 ACTION: addPlayer - Game ID is ${gameId}. Phase: ${gameRow.game_phase}.`);

  if (gameRow.game_phase !== 'lobby') {
    console.warn(`🟡 ACTION: addPlayer - Cannot join game ${gameId}, phase is '${gameRow.game_phase}'.`);
    throw new Error(`Game is already in progress (phase: ${gameRow.game_phase}). Cannot join now.`);
  }

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: no rows found
    console.error('🔴 ACTION: addPlayer - Error checking for existing player:', JSON.stringify(checkError, null, 2));
    throw new Error(`Error checking for existing player: ${checkError.message}`);
  }

  if (existingPlayer) {
    // SECURITY BUGFIX: Previously, joining with an existing player's name returned that
    // player's record — letting anyone hijack another player's identity by typing the
    // same name. Now only allow "reconnect" when the caller's session already owns
    // this player; otherwise the name is taken.
    const session = await getPlayerSession();
    const isReconnect = session.valid && session.token?.playerId === existingPlayer.id && session.token?.gameId === gameId;

    if (!isReconnect) {
      console.warn(`🟡 ACTION: addPlayer - Name "${name}" is already taken in game ${gameId} and caller's session doesn't match.`);
      throw new Error(`The name "${name}" is already taken in this room. Please pick a different name.`);
    }

    console.log(`🔵 ACTION: addPlayer - Player "${name}" reconnecting with valid session. Re-fetching full profile.`);
    const { data: fullExistingPlayer, error: fetchExistingError } = await supabase
        .from('players')
        .select('*')
        .eq('id', existingPlayer.id)
        .single();
    if (fetchExistingError) {
        console.error('🔴 ACTION: addPlayer - Error re-fetching existing player:', JSON.stringify(fetchExistingError, null, 2));
        throw new Error(`Error re-fetching existing player: ${fetchExistingError.message}`);
    }
    return fullExistingPlayer;
  }

  // BUGFIX: Enforce max_players on the server. Previously this was only checked
  // client-side, so races (two players joining the last slot) or direct server-action
  // calls could overfill a room.
  const { count: currentPlayerCount, error: countError } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId);

  if (countError) {
    console.error('🔴 ACTION: addPlayer - Error counting players:', JSON.stringify(countError, null, 2));
    throw new Error(`Error checking room capacity: ${countError.message}`);
  }

  const maxPlayers = gameRow.max_players ?? 8;
  if ((currentPlayerCount ?? 0) >= maxPlayers) {
    console.warn(`🟡 ACTION: addPlayer - Room ${gameId} is full (${currentPlayerCount}/${maxPlayers}).`);
    throw new Error(`This room is full (${currentPlayerCount}/${maxPlayers} players). Cannot join.`);
  }

  console.log(`🔵 ACTION: addPlayer - Creating new player record for "${name}".`);
  const newPlayerData: TablesInsert<'players'> = {
    game_id: gameId,
    name,
    avatar,
    score: 0,
    is_judge: false,
    is_ready: false,
    joined_at: new Date().toISOString(),
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('🔴 ACTION: addPlayer - Error adding new player:', JSON.stringify(insertError, null, 2));
    throw new Error(`Error adding new player: ${insertError.message}`);
  }
  if (!newPlayer) {
    console.error('🔴 ACTION: addPlayer - New player data was null after insert.');
    throw new Error('Failed to add player, server returned no player data.');
  }

  // Host assignment. The room's CREATOR (browser holding the creator-claim
  // cookie) always becomes host, even if another player finished name entry
  // first — host used to go to whoever joined fastest, which let a quicker
  // second player silently steal hosting from the person who made the room.
  // Rooms joined without any claim (quick join, browser) fall back to
  // first-player-becomes-host.
  const isCreator = await consumeRoomCreatorClaim(gameId);

  const { data: allPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId);

  const playerCount = allPlayers?.length || 0;

  if (isCreator) {
    console.log(`🔵 ACTION: addPlayer - Setting ${newPlayer.id} as host (room creator)`);
    await supabase
      .from('games')
      .update({ created_by_player_id: newPlayer.id })
      .eq('id', gameId);
  } else if (playerCount === 1 && !gameRow.created_by_player_id) {
    console.log(`🔵 ACTION: addPlayer - Setting ${newPlayer.id} as host (first player, no creator claim)`);
    await supabase
      .from('games')
      .update({ created_by_player_id: newPlayer.id })
      .eq('id', gameId);
  }

  // Set the session cookie IN THIS ACTION's response. Previously the client
  // called setCurrentPlayerSession as a separate follow-up action, leaving a
  // window where realtime-triggered refetches hit membership-gated actions
  // with no cookie — "Unauthorized: No session token found" in production,
  // where network latency makes the window wide.
  await setPlayerSession(newPlayer.id, gameId, isCreator ? 'host' : 'player');

  console.log(`🔵 ACTION: addPlayer - Successfully added player ${newPlayer.id} ("${name}"). Revalidating paths.`);
  revalidatePath('/');
  revalidatePath('/game');
  return newPlayer;
}

/**
 * Core reset: notify clients, clear all per-game data, return game to lobby.
 * NOT exported — callers are responsible for authorization (host-gated in
 * resetGameForTesting; membership-gated for the post-game_over flow in
 * nextRound, where any player advancing past the final recap resets the
 * room — requiring the HOST there stranded everyone whenever the last
 * round's judge wasn't the host).
 */
async function performGameResetInternal(gameId: string): Promise<void> {
  console.log(`🔵 ACTION: performGameReset - Starting reset for game ${gameId}.`);

  // STEP 1: notify all clients that reset is happening
  const { error: transitionError } = await supabase
    .from('games')
    .update({
      transition_state: 'resetting_game',
      transition_message: 'Game is being reset. You will be redirected to the main menu.',
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId);
  if (transitionError) {
    console.error(`🔴 ACTION: performGameReset - Error setting transition state:`, JSON.stringify(transitionError, null, 2));
  }

  // Give clients a moment to see the reset notification
  await new Promise(resolve => setTimeout(resolve, 1500));

  // STEP 2: clear all game data
  const { error: clearPlayerRefsError } = await supabase
    .from('games')
    .update({ current_judge_id: null, last_round_winner_player_id: null, overall_winner_player_id: null, created_by_player_id: null })
    .eq('id', gameId);
  if (clearPlayerRefsError) console.error(`🔴 ACTION: performGameReset - Error clearing player references in game ${gameId}:`, JSON.stringify(clearPlayerRefsError, null, 2));

  const tablesToClear = ['player_hands', 'responses', 'winners'];
  for (const table of tablesToClear) {
    const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
    if (deleteError) console.error(`🔴 ACTION: performGameReset - Error deleting from ${table}:`, JSON.stringify(deleteError, null, 2));
  }

  const { error: playersDeleteError } = await supabase.from('players').delete().eq('game_id', gameId);
  if (playersDeleteError) console.error(`🔴 ACTION: performGameReset - Error deleting players:`, JSON.stringify(playersDeleteError, null, 2));

  // STEP 3: reset the game to lobby state
  const updateData: TablesUpdate<'games'> = {
    game_phase: 'lobby', current_round: 0, current_judge_id: null, current_scenario_id: null,
    ready_player_order: [], last_round_winner_player_id: null, last_round_winning_card_text: null,
    overall_winner_player_id: null, used_scenarios: [], used_responses: [],
    updated_at: new Date().toISOString(), transition_state: 'idle', transition_message: null,
  };
  const { error: updateError } = await supabase.from('games').update(updateData).eq('id', gameId);
  if (updateError) {
    console.error(`🔴 ACTION: performGameReset - CRITICAL: Failed to update game to lobby phase:`, JSON.stringify(updateError, null, 2));
    throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
  }
  console.log(`✅ ACTION: performGameReset - Game ${gameId} reset to lobby.`);
}

export async function resetGameForTesting(opts?: { clientWillNavigate?: boolean, gameId?: string }) {
  console.warn("🔵 ACTION: resetGameForTesting - INITIATED. THIS IS A DESTRUCTIVE ACTION.");

  try {
    let gameId: string;
    
    if (opts?.gameId) {
      // Target specific game - validate host authorization first
      gameId = opts.gameId;
      console.log(`🔵 ACTION: resetGameForTesting - Targeting specific game: ${gameId}`);
      
      // SECURITY: Only hosts can reset games
      const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireHostAccess(gameId));
      console.log(`🔵 ACTION: resetGameForTesting - Host authorization passed for player: ${authorizedPlayerId}`);
      
      // Verify game exists
      const { data: gameCheck, error: gameCheckError } = await supabase
        .from('games')
        .select('id, game_phase')
        .eq('id', gameId)
        .single();
        
      if (gameCheckError || !gameCheck) {
        console.error(`🔴 ACTION: resetGameForTesting - Target game ${gameId} not found:`, gameCheckError?.message);
        throw new Error(`Target game ${gameId} not found for reset`);
      }
    } else {
      // Legacy behavior: find first game
      console.warn("🟡 ACTION: resetGameForTesting - No specific gameId provided, using legacy behavior (first game)");
      const { data: existingGames, error: fetchError } = await supabase
        .from('games')
        .select('id, game_phase')
        .order('created_at', { ascending: true })
        .limit(1);

      if (fetchError) {
        console.error("🔴 ACTION: resetGameForTesting - Exception during game fetch:", fetchError.message);
        throw new Error(`Exception during game fetch for reset: ${fetchError.message}`);
      }

      if (!existingGames || existingGames.length === 0) {
        console.warn("🟡 ACTION: resetGameForTesting - No game found to reset.");
        revalidatePath('/');
        revalidatePath('/game');
        revalidatePath('/?step=menu');
        
        if (!opts?.clientWillNavigate) {
          redirect('/?step=menu');
        }
        return;
      }

      gameId = existingGames[0].id;
    }
    await performGameResetInternal(gameId);
    console.log(`🔵 ACTION: resetGameForTesting - Reset complete. Revalidating paths BEFORE redirect.`);
    revalidatePath('/');
    revalidatePath('/game');
    revalidatePath('/?step=menu');

  } catch (e: any) {
    console.error('🔴 ACTION: resetGameForTesting - Unexpected exception:', e.message, e.stack);
    // SECURITY: Authorization failures must propagate to the caller.
    // Swallowing them here made a non-host's reset attempt look like a
    // success and redirected them as if the game had been reset.
    if (e instanceof Error && e.message.startsWith('Unauthorized')) {
      throw e;
    }
  }

  revalidatePath('/');
  revalidatePath('/game');
  revalidatePath('/?step=menu');

  if (!opts?.clientWillNavigate) {
    redirect('/?step=menu');
  }
}

export async function getGameByRoomCode(roomCode: string): Promise<GameClientState> {
  console.log(`🔵 ACTION: getGameByRoomCode - Finding game with code: ${roomCode}`);
  
  try {
    const { data: gameData, error } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (error) {
      console.error(`🔴 ACTION: getGameByRoomCode - Error finding game with room code ${roomCode}:`, error.message);
      throw new Error(`Game not found with room code: ${roomCode}`);
    }

    if (!gameData) {
      console.error(`🔴 ACTION: getGameByRoomCode - No game found with room code: ${roomCode}`);
      throw new Error(`Game not found with room code: ${roomCode}`);
    }

    console.log(`🔵 ACTION: getGameByRoomCode - Found game ${gameData.id} for room code ${roomCode}`);

    // Internal (non-auth) fetch: room-code lookup happens BEFORE the player
    // has joined, so they can't have a session for this game yet — the
    // membership-gated getGame would reject every join attempt.
    return await getGameStateInternal(gameData.id);

  } catch (error: any) {
    console.error('🔴 ACTION: getGameByRoomCode - Error:', error.message);
    throw error;
  }
}

/**
 * Sweep abandoned games: rooms untouched for hours still hold their players
 * (nobody "leaves" a closed tab), so the empty-room cleanup never catches
 * them and they pile up as unstartable zombies in the room browser.
 */
async function cleanupStaleGames(): Promise<void> {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3 hours

  // Sweep diagnostic client logs older than 24h (fire and forget)
  // (cast: generated DB types predate the client_logs diagnostics table)
  const logCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  (supabase.from as CallableFunction)('client_logs').delete().lt('created_at', logCutoff)
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) console.warn('client_logs sweep failed:', e.message);
    });

  const { data: staleGames, error } = await supabase
    .from('games')
    .select('id, room_code, updated_at')
    .lt('updated_at', cutoff);
  if (error || !staleGames || staleGames.length === 0) return;

  console.log(`🔵 ACTION: cleanupStaleGames - Sweeping ${staleGames.length} abandoned games`);
  for (const game of staleGames) {
    // Clear player references first (created_by/current_judge FKs block
    // player deletion), then children, players, and finally the game.
    await supabase.from('games').update({ created_by_player_id: null, current_judge_id: null }).eq('id', game.id);
    for (const table of ['player_hands', 'responses', 'winners'] as const) {
      await supabase.from(table).delete().eq('game_id', game.id);
    }
    await supabase.from('players').delete().eq('game_id', game.id);
    const { error: delError } = await supabase.from('games').delete().eq('id', game.id);
    if (delError) {
      console.error(`🔴 ACTION: cleanupStaleGames - Failed to delete ${game.room_code}:`, delError.message);
    } else {
      console.log(`✅ ACTION: cleanupStaleGames - Swept abandoned game ${game.room_code}`);
    }
  }
}

export async function cleanupEmptyRooms(): Promise<void> {
  console.log("🔵 ACTION: cleanupEmptyRooms - Starting cleanup of empty rooms");

  // Also sweep long-abandoned games that still contain players
  await cleanupStaleGames().catch(err =>
    console.error('🔴 ACTION: cleanupStaleGames - Unexpected error:', err?.message)
  );

  try {
    // Find games that are older than 10 minutes and have no players
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Query games and player counts separately: the embedded
    // players:players(count) join is ambiguous — games and players are
    // linked by multiple FKs (players.game_id, games.created_by_player_id,
    // games.current_judge_id) and the FK sets differ between environments,
    // so PostgREST rejects or misresolves the embed.
    const { data: oldGames, error: fetchError } = await supabase
      .from('games')
      .select('id, room_name, room_code, created_at')
      .lt('created_at', tenMinutesAgo);

    if (fetchError) {
      console.error("🔴 ACTION: cleanupEmptyRooms - Error fetching games:", fetchError.message);
      return;
    }

    if (!oldGames || oldGames.length === 0) {
      console.log("🔵 ACTION: cleanupEmptyRooms - No games found older than 10 minutes");
      return;
    }

    const { data: occupiedRows, error: playersError } = await supabase
      .from('players')
      .select('game_id')
      .in('game_id', oldGames.map(g => g.id));

    if (playersError) {
      console.error("🔴 ACTION: cleanupEmptyRooms - Error fetching players:", playersError.message);
      return;
    }

    const occupiedGameIds = new Set((occupiedRows ?? []).map(p => p.game_id));
    const gamesToDelete = oldGames.filter(game => !occupiedGameIds.has(game.id));

    if (gamesToDelete.length === 0) {
      console.log("🔵 ACTION: cleanupEmptyRooms - No empty games found to clean up");
      return;
    }

    console.log(`🔵 ACTION: cleanupEmptyRooms - Found ${gamesToDelete.length} empty games to delete`);

    // Delete each empty game
    for (const game of gamesToDelete) {
      console.log(`🔵 ACTION: cleanupEmptyRooms - Deleting empty game: ${game.room_name} (${game.room_code})`);
      
      // Delete associated data first
      const tablesToClear = ['player_hands', 'responses', 'winners'];
      for (const table of tablesToClear) {
        await supabase.from(table as any).delete().eq('game_id', game.id);
      }

      // Delete the game itself
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('id', game.id);

      if (deleteError) {
        console.error(`🔴 ACTION: cleanupEmptyRooms - Error deleting game ${game.id}:`, deleteError.message);
      } else {
        console.log(`✅ ACTION: cleanupEmptyRooms - Successfully deleted empty game: ${game.room_name}`);
      }
    }

    // Skip revalidatePath calls to avoid server action conflicts
    // The cleanup is meant to be a background operation that doesn't affect UI state
    
    console.log(`🔵 ACTION: cleanupEmptyRooms - Cleanup complete. Deleted ${gamesToDelete.length} empty rooms.`);

  } catch (error: any) {
    console.error('🔴 ACTION: cleanupEmptyRooms - Unexpected error:', error.message);
  }
}

export async function createRoom(roomName: string, isPublic: boolean, maxPlayers: number): Promise<Tables<'games'>> {
  console.log("🔵 ACTION: createRoom - Creating new room:", { roomName, isPublic, maxPlayers });

  try {
    // Clean up empty rooms before creating new one (fire and forget)
    cleanupEmptyRooms().catch(err => console.error('Background cleanup failed:', err));

    // Generate unique room code
    const roomCode = await generateUniqueRoomCode();
    console.log("🔵 ACTION: createRoom - Generated room code:", roomCode);

    // Create new game with room settings
    const newGameData: TablesInsert<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      current_judge_id: null,
      current_scenario_id: null,
      ready_player_order: [],
      last_round_winner_player_id: null,
      last_round_winning_card_text: null,
      overall_winner_player_id: null,
      used_scenarios: [],
      used_responses: [],
      updated_at: new Date().toISOString(),
      transition_state: 'idle',
      transition_message: null,
      room_code: roomCode,
      room_name: roomName.trim() || 'Unnamed Room',
      is_public: isPublic,
      max_players: maxPlayers
    };

    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert(newGameData)
      .select()
      .single();

    if (insertError) {
      console.error("🔴 ACTION: createRoom - Error creating room:", JSON.stringify(insertError, null, 2));
      throw new Error(`Failed to create room: ${insertError.message}`);
    }

    if (!newGame) {
      console.error("🔴 ACTION: createRoom - No game data returned after creation");
      throw new Error('Room creation failed - no game data returned');
    }

    console.log("🔵 ACTION: createRoom - Successfully created room:", newGame.id, "with code:", roomCode);

    // Mark this browser as the room's creator so addPlayer makes them host
    // regardless of who finishes name entry first
    await setRoomCreatorClaim(newGame.id);

    // Revalidate relevant paths
    revalidatePath('/');
    revalidatePath('/?step=setup');
    revalidatePath('/?step=menu');

    return newGame;

  } catch (error: any) {
    console.error('🔴 ACTION: createRoom - Unexpected error:', error.message);
    throw new Error(`Failed to create room: ${error.message}`);
  }
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  // Limited logging in this utility function to reduce noise
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('used_responses')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`🔴 UTIL: dealCards - Error fetching game data for dealing (game ${gameId}):`, gameFetchError);
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }

  const allKnownUsedResponses = [...new Set([...(gameData.used_responses || []), ...existingUsedResponses])];
  
  let query = supabase.from('response_cards').select('id').eq('is_active', true);
  if (allKnownUsedResponses.length > 0) {
    const validUUIDs = allKnownUsedResponses.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
      query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
  }

  // BUGFIX: Previously this used .order('id').limit(count * multiplier) with a
  // hardcoded deck size of 1013. Ordering by id + limiting meant only the
  // lowest-UUID cards were ever candidates, so most of the deck was effectively
  // never dealt. Card ids are small (UUIDs only), so fetch all unused active ids
  // and shuffle in memory — true uniform sampling over the whole deck.
  const { data: availableCards, error: fetchError } = await query;

  const totalAvailable = availableCards?.length ?? 0;
  if (totalAvailable > 0 && totalAvailable < 100) {
    console.warn(`⚠️ UTIL: dealCards - Running low on cards! Only ${totalAvailable} cards remaining for game ${gameId}`);
  }

  if (fetchError) {
    console.error(`🔴 UTIL: dealCards - Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }
  
  if (!availableCards || availableCards.length === 0) {
    console.error(`🔴 UTIL: dealCards - No available cards found for game ${gameId}.`);
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  const shuffled = [...availableCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const cardsToDeal = shuffled.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  const newlyDealtAndUsedInThisOperation = [...new Set([...allKnownUsedResponses, ...dealtCardIds])]; 
  return { dealtCardIds, updatedUsedResponses: newlyDealtAndUsedInThisOperation };
}

export async function startGame(gameId: string, hostPlayerId?: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: startGame - Initiated for gameId: ${gameId}`);
  
  // SECURITY: Validate that only the host player can start the game
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireHostAccess(gameId));
  console.log(`🔵 ACTION: startGame - Host authorization passed for player: ${authorizedPlayerId}`);
  
  // Fetch game data after authorization
  const { data: game, error: gameFetchError } = await supabase
    .from('games').select('*').eq('id', gameId).single();

  if (gameFetchError || !game) {
    console.error(`🔴 ACTION: startGame - Error fetching game:`, JSON.stringify(gameFetchError, null, 2));
    throw new Error(`Failed to fetch game for start: ${gameFetchError?.message || 'Game not found'}`);
  }
  
  await supabase
    .from('games')
    .update({ transition_state: 'starting_game', transition_message: 'Preparing game...' })
    .eq('id', gameId);
  console.log(`🔵 ACTION: startGame - Set transition_state to 'starting_game'.`);
  
  console.log(`🔵 ACTION: startGame - Fetched game. Phase: ${game.game_phase}`);

  if (game.game_phase === 'lobby') {
    const { data: players, error: playersFetchError } = await supabase
      .from('players').select('id, name, is_ready, joined_at').eq('game_id', gameId).order('joined_at', { ascending: true });

    if (playersFetchError || !players) {
      console.error(`🔴 ACTION: startGame - Error fetching players:`, JSON.stringify(playersFetchError, null, 2));
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Error fetching players' }).eq('id', gameId);
      throw new Error(`Failed to fetch players for start: ${playersFetchError?.message || 'No players found'}`);
    }
    console.log(`🔵 ACTION: startGame - Fetched ${players.length} players.`);
    
    if (players.length < MIN_PLAYERS_TO_START) {
      console.error(`🔴 ACTION: startGame - Not enough players. Found ${players.length}, need ${MIN_PLAYERS_TO_START}.`);
      await supabase.from('games').update({ transition_state: 'idle', transition_message: `Not enough players (${players.length})` }).eq('id', gameId);
      throw new Error(`Not enough players to start game (found ${players.length}, need at least ${MIN_PLAYERS_TO_START}).`);
    }

    const allPlayersReady = players.every(p => p.is_ready);
    if (!allPlayersReady) {
      console.error(`🔴 ACTION: startGame - Not all players are ready.`);
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Not all players are ready.' }).eq('id', gameId);
      throw new Error(`Not all players are ready. Cannot start the game yet.`);
    }
    console.log(`🔵 ACTION: startGame - All players are ready.`);

    const readyPlayerOrder = game.ready_player_order; 
    if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
        console.error(`🔴 ACTION: startGame - Cannot start. ready_player_order is empty. Value: ${JSON.stringify(readyPlayerOrder)}`);
        await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Player order not established.' }).eq('id', gameId);
        throw new Error("Critical error: Player order not established.");
    }
    console.log(`🔵 ACTION: startGame - Got ready_player_order: ${JSON.stringify(readyPlayerOrder)}`);

    const actualFirstJudgeId = readyPlayerOrder[0];
    if (!players.find(p => p.id === actualFirstJudgeId)) {
        console.error(`🔴 ACTION: startGame - First player in order (${actualFirstJudgeId}) not found in game players.`);
        await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Host player not found.' }).eq('id', gameId);
        throw new Error("Critical error: Host player in ready order not found.");
    }
    console.log(`🔵 ACTION: startGame - First judge will be ${actualFirstJudgeId}.`);

    await supabase.from('games').update({ transition_message: 'Dealing cards...' }).eq('id', gameId);
    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];
    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    for (const player of players) {
      console.log(`🔵 ACTION: startGame - Dealing cards for player ${player.id}`);
      const { dealtCardIds } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);
      if (dealtCardIds.length > 0) {
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({ game_id: gameId, player_id: player.id, response_card_id: cardId, is_new: false });
        });
        accumulatedUsedResponsesForThisGameStart = [...new Set([...accumulatedUsedResponsesForThisGameStart, ...dealtCardIds])];
      }
    }

    if (playerHandInserts.length > 0) {
      console.log(`🔵 ACTION: startGame - Inserting ${playerHandInserts.length} total cards into player_hands.`);
      const { error: allHandsInsertError } = await supabase.from('player_hands').insert(playerHandInserts);
      if (allHandsInsertError) {
        console.error(`🔴 ACTION: startGame - Critical error inserting player hands:`, JSON.stringify(allHandsInsertError, null, 2));
      }
    }

    await supabase.from('games').update({ transition_message: 'Selecting first judge...' }).eq('id', gameId);
    
    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection', current_judge_id: actualFirstJudgeId, current_round: 1,
      updated_at: new Date().toISOString(), used_responses: accumulatedUsedResponsesForThisGameStart,
      transition_state: 'idle', transition_message: null,
    };
    console.log(`🔵 ACTION: startGame - Updating game to 'category_selection'.`);
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);

    if (updateError) {
      console.error(`🔴 ACTION: startGame - Error updating game state to start:`, JSON.stringify(updateError, null, 2));
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Failed to update game state.' }).eq('id', gameId);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
    console.log(`🔵 ACTION: startGame - Game successfully started. Revalidating paths.`);
  } else {
    console.warn(`🟡 ACTION: startGame - Called but game phase is '${game.game_phase}', not 'lobby'. No action taken.`);
  }
  
  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); 
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: selectCategory - Initiated for game ${gameId}, category "${category}"`);
  
  // SECURITY: Only the current judge can select categories
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireJudgeAccess(gameId));
  console.log(`🔵 ACTION: selectCategory - Judge authorization passed for player: ${authorizedPlayerId}`);
  
  // --- Boondoggle Trigger Logic ---
  const { data: players, error: playersError } = await supabase.from('players').select('id, name').eq('game_id', gameId);
  const { data: gameForJudge, error: gameForJudgeError } = await supabase.from('games').select('current_judge_id, used_scenarios, current_scenario_id').eq('id', gameId).single();
  if (playersError || !players || gameForJudgeError || !gameForJudge) throw new Error("Could not fetch players or game for Boondoggle check.");
  
  // Check if the current scenario (from previous round) is a Boondoggle to prevent back-to-back
  let wasLastRoundBoondoggle = false;
  if (gameForJudge.current_scenario_id) {
    const { data: currentScenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('category')
      .eq('id', gameForJudge.current_scenario_id)
      .single();
    
    if (!scenarioError && currentScenario) {
      wasLastRoundBoondoggle = currentScenario.category === 'Boondoggles';
      console.log(`🔵 ACTION: selectCategory - Previous round was ${wasLastRoundBoondoggle ? 'a Boondoggle' : 'regular'}`);
    }
  }
  
  const nonJudgePlayersCount = players.filter(p => p.id !== gameForJudge.current_judge_id).length;
  const isBoondoggle = Math.random() < 0.40 && nonJudgePlayersCount > 1 && !wasLastRoundBoondoggle;

  if (wasLastRoundBoondoggle) {
    console.log("🔵 ACTION: selectCategory - Skipping Boondoggle check - previous round was already a Boondoggle");
  }

  if (isBoondoggle) {
    console.log("🎲 ACTION: selectCategory - Boondoggle triggered!");
    let boondoggleQuery = supabase.from('scenarios').select('id, text, category').eq('category', 'Boondoggles');
    const usedScenarios = gameForJudge.used_scenarios || [];
    if (usedScenarios.length > 0) {
        const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
        if (validUUIDs.length > 0) boondoggleQuery = boondoggleQuery.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
    const { data: boondoggleScenarios, error: boondoggleError } = await boondoggleQuery;
    if (!boondoggleError && boondoggleScenarios && boondoggleScenarios.length > 0) {
      const scenarioToUse = boondoggleScenarios[Math.floor(Math.random() * boondoggleScenarios.length)];
      console.log("🎲 ACTION: selectCategory - Starting Boondoggle round with scenario:", scenarioToUse.id);
      const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])];
      const gameUpdates: TablesUpdate<'games'> = {
        game_phase: 'judging', current_scenario_id: scenarioToUse.id, last_round_winner_player_id: null,
        last_round_winning_card_text: null, used_scenarios: updatedUsedScenarios, updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
      if (updateError) throw new Error(`Failed to start Boondoggle round: ${updateError.message}`);
      revalidatePath('/game');
      return getGame(gameId);
    }
    console.warn("🟡 ACTION: selectCategory - Boondoggle triggered but no unused Boondoggles found. Proceeding with normal round.");
  }
  
  // --- Original selectCategory Logic ---
  const { data: game, error: gameError } = await supabase.from('games').select('used_scenarios').eq('id', gameId).single();
  if (gameError || !game) {
    console.error(`🔴 ACTION: selectCategory - Error fetching game:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  const usedScenarios = game.used_scenarios || [];
  let query = supabase.from('scenarios').select('id, text, category').eq('category', category);
  if (usedScenarios.length > 0) {
    const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
  }
  const { data: scenarios, error: scenarioFetchError } = await query;
  if (scenarioFetchError) {
    console.error(`🔴 ACTION: selectCategory - Error fetching scenarios:`, JSON.stringify(scenarioFetchError, null, 2));
    throw new Error(`Error fetching scenarios for category ${category}: ${scenarioFetchError.message}`);
  }

  let scenarioToUse: { id: string; text: string; category: string | null } | null = null;
  if (!scenarios || scenarios.length === 0) {
    console.warn(`🟡 ACTION: selectCategory - No unused scenarios in category "${category}". Recycling.`);
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase.from('scenarios').select('id, text, category').eq('category', category); 
    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 ACTION: selectCategory - Critical: No scenarios found for category ${category} at all.`);
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
    const gameUpdates: TablesUpdate<'games'> = { current_scenario_id: scenarioToUse.id, game_phase: 'player_submission', updated_at: new Date().toISOString() };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) throw new Error(`Failed to update game (recycle): ${updateError.message}`);
  } else {
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
    console.log(`🔵 ACTION: selectCategory - Selected scenario ${scenarioToUse.id}.`);
    const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])];
    const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id, game_phase: 'player_submission',
      used_scenarios: updatedUsedScenarios, updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) {
      console.error(`🔴 ACTION: selectCategory - Error updating game:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game: ${updateError.message}`);
    }
  }

  revalidatePath('/game');
  return getGame(gameId);
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number, isCustomSubmission: boolean): Promise<null> {
  console.log(`🔵 ACTION: submitResponse - Player ${playerId} submitted for round ${currentRound}. Custom: ${isCustomSubmission}`);
  
  // SECURITY: Only authenticated players can submit responses for themselves
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
  if (authorizedPlayerId !== playerId) {
    throw new Error(`Authorization failed: Cannot submit responses for other players`);
  }
  console.log(`🔵 ACTION: submitResponse - Player authorization passed for: ${authorizedPlayerId}`);
  
  const { data: gameData, error: gameFetchError } = await supabase.from('games').select('current_judge_id, used_responses, game_phase').eq('id', gameId).single();
  if (gameFetchError || !gameData) {
    console.error(`🔴 ACTION: submitResponse - Error fetching game ${gameId}:`, gameFetchError);
    throw new Error(`Failed to fetch game for submission: ${gameFetchError?.message || 'Game not found'}`);
  }
  if (gameData.game_phase !== 'player_submission') throw new Error(`Submissions not open. Phase: ${gameData.game_phase}.`);
  if (playerId === gameData.current_judge_id) throw new Error("Judges cannot submit cards.");

  const { data: existingSubmission, error: checkSubmissionError } = await supabase.from('responses').select('id').eq('game_id', gameId).eq('player_id', playerId).eq('round_number', currentRound).maybeSingle(); 
  if (checkSubmissionError) throw new Error(`Error verifying submission status: ${checkSubmissionError.message}`);
  if (existingSubmission) throw new Error("You have already submitted a card for this round.");

  let responseCardIdToStore: string | null = null, submittedTextToStore: string | null = null, cardToRemoveFromHandId: string | null = null;
  if (isCustomSubmission) {
    submittedTextToStore = responseCardText;
  } else {
    const { data: handCardEntry, error: handQueryError } = await supabase.from('player_hands').select('response_card_id, response_cards!inner(text)').eq('player_id', playerId).eq('game_id', gameId).eq('response_cards.text', responseCardText).limit(1).single();
    if (handQueryError || !handCardEntry) {
      console.error(`🔴 ACTION: submitResponse - Error finding card with text "${responseCardText}" in hand of player ${playerId}:`, JSON.stringify(handQueryError, null, 2));
      throw new Error(`Could not find card "${responseCardText}" in your hand.`);
    }
    responseCardIdToStore = handCardEntry.response_card_id;
    cardToRemoveFromHandId = handCardEntry.response_card_id; 
  }

  await supabase.from('player_hands').update({ is_new: false }).eq('player_id', playerId).eq('game_id', gameId);
  await supabase.from('responses').insert({ game_id: gameId, player_id: playerId, response_card_id: responseCardIdToStore, submitted_text: submittedTextToStore, round_number: currentRound });
  if (cardToRemoveFromHandId) await supabase.from('player_hands').delete().eq('player_id', playerId).eq('response_card_id', cardToRemoveFromHandId).eq('game_id', gameId);

  let gameUsedResponses = gameData.used_responses || [];
  const usedResponsesBeforeNewDeal = responseCardIdToStore ? [...new Set([...gameUsedResponses, responseCardIdToStore])] : gameUsedResponses;
  const { dealtCardIds: replacementCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, usedResponsesBeforeNewDeal);
  if (replacementCardIds.length > 0) {
    await supabase.from('player_hands').insert({ game_id: gameId, player_id: playerId, response_card_id: replacementCardIds[0], is_new: true });
  }
  await supabase.from('games').update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() }).eq('id', gameId);

  const { data: nonJudgePlayers } = await supabase.from('players').select('id', { count: 'exact' }).eq('game_id', gameId).neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000');
  const totalNonJudgePlayers = nonJudgePlayers?.length || 0;
  const { count: submissionsCount } = await supabase.from('responses').select('player_id', { count: 'exact', head: true }).eq('game_id', gameId).eq('round_number', currentRound);

  if (submissionsCount !== null && totalNonJudgePlayers > 0 && submissionsCount >= totalNonJudgePlayers) {
    console.log(`🔵 ACTION: submitResponse - All players submitted. Updating phase to 'judging'.`);
    await supabase.from('games').update({ game_phase: 'judging', updated_at: new Date().toISOString() }).eq('id', gameId);
  }

  revalidatePath('/game');
  return null;
}


export async function selectWinner(gameId: string, winningCardText: string, boondoggleWinnerId?: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: selectWinner - Initiated for game ${gameId}. Boondoggle winner: ${boondoggleWinnerId || 'N/A'}`);
  
  // SECURITY: Only the current judge can select winners
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireJudgeAccess(gameId));
  console.log(`🔵 ACTION: selectWinner - Judge authorization passed for player: ${authorizedPlayerId}`);
  
  const { data: game, error: gameError } = await supabase.from('games').select('current_round, current_judge_id, current_scenario_id').eq('id', gameId).single();
  if (gameError || !game) throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);

  if (boondoggleWinnerId) {
    console.log(`🎲 ACTION: selectWinner - Processing Boondoggle winner: ${boondoggleWinnerId}`);
    const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', boondoggleWinnerId).single();
    if (!winnerPlayerData) throw new Error("Boondoggle winner player record not found.");
    const { data: scenarioData } = await supabase.from('scenarios').select('text').eq('id', game.current_scenario_id!).single();
    if (!scenarioData) throw new Error("Could not retrieve Boondoggle challenge text.");

    const newScore = winnerPlayerData.score + 1;
    await supabase.from('players').update({ score: newScore }).eq('id', boondoggleWinnerId);
    let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
    let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? boondoggleWinnerId : null;
    console.log(`🎲 ACTION: selectWinner - New score ${newScore}. New phase ${newGamePhase}.`);
    await supabase.from('games').update({ game_phase: newGamePhase, last_round_winner_player_id: boondoggleWinnerId, last_round_winning_card_text: scenarioData.text, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);
    revalidatePath('/game');
    return getGame(gameId);
  }

  console.log(`🔵 ACTION: selectWinner - Processing standard winner for card text: "${winningCardText}"`);
  let winningSubmissionData: (Tables<'responses'> & { response_cards: { text: string | null } | null }) | null = null;
  let isCustomWinningCard = false;

  const { data: customSubmission } = await supabase.from('responses').select('*, response_cards(text)').eq('game_id', gameId).eq('round_number', game.current_round).eq('submitted_text', winningCardText).maybeSingle(); 
  if (customSubmission) { 
    winningSubmissionData = customSubmission;
    isCustomWinningCard = true;
  } else {
    const { data: preDealtSubmission } = await supabase.from('responses').select('*, response_cards!inner(text)').eq('game_id', gameId).eq('round_number', game.current_round).eq('response_cards.text', winningCardText).maybeSingle(); 
    if (preDealtSubmission) winningSubmissionData = preDealtSubmission;
    else throw new Error(`Could not find submission matching card "${winningCardText}".`);
  }
  
  if (!winningSubmissionData) throw new Error(`Critical error: No winning submission found for "${winningCardText}".`);
  const winningPlayerId = winningSubmissionData.player_id;
  console.log(`🔵 ACTION: selectWinner - Winning player is ${winningPlayerId}. Custom card: ${isCustomWinningCard}.`);

  if (isCustomWinningCard) {
    await supabase.from('games').update({ game_phase: 'judge_approval_pending', last_round_winner_player_id: winningPlayerId, last_round_winning_card_text: winningCardText, updated_at: new Date().toISOString() }).eq('id', gameId);
  } else { 
    const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', winningPlayerId).single();
    if (!winnerPlayerData) throw new Error("Winning player record not found or error fetching.");
    const newScore = winnerPlayerData.score + 1;
    await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);
    if (winningSubmissionData.response_card_id) await supabase.from('winners').insert({ game_id: gameId, round_number: game.current_round, winner_player_id: winningPlayerId, winning_response_card_id: winningSubmissionData.response_card_id });
    
    let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
    let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? winningPlayerId : null;
    console.log(`🔵 ACTION: selectWinner - New score ${newScore}. New phase ${newGamePhase}.`);
    await supabase.from('games').update({ game_phase: newGamePhase, last_round_winner_player_id: winningPlayerId, last_round_winning_card_text: winningCardText, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);
  }

  revalidatePath('/game');
  return getGame(gameId);
}

export async function handleJudgeApprovalForCustomCard(gameId: string, addToDeck: boolean): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: handleJudgeApproval - Initiated for game ${gameId}. Add to deck: ${addToDeck}`);
  
  // SECURITY: Only the current judge can approve/reject custom cards
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireJudgeAccess(gameId));
  console.log(`🔵 ACTION: handleJudgeApproval - Judge authorization passed for player: ${authorizedPlayerId}`);
  
  const { data: game } = await supabase.from('games').select('current_round, last_round_winner_player_id, last_round_winning_card_text').eq('id', gameId).single();
  if (!game || !game.last_round_winner_player_id || !game.last_round_winning_card_text) throw new Error(`Failed to fetch game or winner information for approval. Game: ${gameId}`);
  
  const winningPlayerId = game.last_round_winner_player_id;
  const winningCardText = game.last_round_winning_card_text; 

  if (addToDeck) {
    console.log(`🔵 ACTION: handleJudgeApproval - Adding card "${winningCardText}" to deck.`);
    const { data: authorPlayer } = await supabase.from('players').select('name').eq('id', winningPlayerId).single();
    if (!authorPlayer) throw new Error(`Could not find author player ${winningPlayerId}.`);
    const { data: newCard } = await supabase.from('response_cards').insert({ text: winningCardText, author_player_id: winningPlayerId, author_name: authorPlayer.name, is_active: true }).select('id').single();
    if (!newCard) throw new Error("Failed to add custom card to deck.");
    await supabase.from('winners').insert({ game_id: gameId, round_number: game.current_round, winner_player_id: winningPlayerId, winning_response_card_id: newCard.id });
  }

  const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', winningPlayerId).single();
  if (!winnerPlayerData) throw new Error("Winning player record not found or error fetching.");
  const newScore = winnerPlayerData.score + 1;
  await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);

  let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
  let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? winningPlayerId : null;
  console.log(`🔵 ACTION: handleJudgeApproval - New score ${newScore}. New phase ${newGamePhase}.`);
  await supabase.from('games').update({ game_phase: newGamePhase, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);

  revalidatePath('/game');
  return getGame(gameId);
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: nextRound - Initiated for game ${gameId}.`);
  
  // SECURITY: Only authenticated game members can advance to next round (typically judge-initiated)
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
  console.log(`🔵 ACTION: nextRound - Player authorization passed for: ${authorizedPlayerId}`);
  
  const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (!game) throw new Error(`Failed to fetch game for next round: Game not found`);

  if (game.game_phase === 'game_over') {
    console.log(`🔵 ACTION: nextRound - Game is over, resetting to lobby.`);
    try {
      // Membership (validated above) is sufficient here: after game_over the
      // natural next state is the lobby, and the recap auto-advance usually
      // fires from the last judge's client — requiring the HOST stranded
      // every game whose final judge wasn't the host.
      await performGameResetInternal(gameId);
      revalidatePath('/');
      revalidatePath('/game');
      return null;
    } catch (e: any) {
      if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
      throw new Error(`Failed to reset game after game over: ${e.message || 'Unknown error'}`);
    }
  }

  if (game.game_phase !== 'winner_announcement' && game.game_phase !== 'judging') {
    console.warn(`🟡 ACTION: nextRound - Called in wrong phase (${game.game_phase}). No action taken.`);
    revalidatePath('/game'); 
    return getGame(gameId);
  }
  
  const readyPlayerOrder = game.ready_player_order;
  if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
    console.error(`🔴 ACTION: nextRound - Error: ready_player_order is empty for game ${gameId}.`);
    throw new Error(`Critical error: Ready player order missing and cannot determine next judge.`);
  }

  let nextJudgeId: string | null = game.current_judge_id; 
  if (readyPlayerOrder && readyPlayerOrder.length > 0) {
    const currentJudgeIndex = game.current_judge_id ? readyPlayerOrder.findIndex(playerId => playerId === game.current_judge_id) : -1;
    const nextJudgeIndex = (currentJudgeIndex + 1) % readyPlayerOrder.length;
    nextJudgeId = readyPlayerOrder[nextJudgeIndex];
  }
  console.log(`🔵 ACTION: nextRound - Current judge ${game.current_judge_id}, next judge will be ${nextJudgeId}.`);
  
  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection', current_judge_id: nextJudgeId, current_round: game.current_round + 1,
    current_scenario_id: null, last_round_winner_player_id: null, last_round_winning_card_text: null,
    updated_at: new Date().toISOString(),
  };
  await supabase.from('games').update(gameUpdates).eq('id', gameId);
  console.log(`🔵 ACTION: nextRound - Game updated for round ${game.current_round + 1}.`);
  revalidatePath('/game');
  return getGame(gameId);
}

export async function findAvailableRoomForQuickJoin(): Promise<string | null> {
  console.log("🔵 ACTION: findAvailableRoomForQuickJoin - Looking for available public rooms");
  
  try {
    // Clean up empty rooms before searching (fire and forget)
    cleanupEmptyRooms().catch(err => console.error('Background cleanup failed:', err));

    // Find public rooms that are joinable (lobby or early game phases).
    // Player counts fetched separately: the players(count) embed is ambiguous
    // (games/players are linked by multiple FKs) and PostgREST rejects it.
    const { data: availableGames, error } = await supabase
      .from('games')
      .select('id, room_code, room_name, game_phase, max_players, created_at')
      .eq('is_public', true)
      .eq('game_phase', 'lobby') // Only join lobbies for simplicity
      .order('created_at', { ascending: false }); // Newest first

    if (error) {
      console.error("🔴 ACTION: findAvailableRoomForQuickJoin - Error fetching games:", error.message);
      throw new Error(`Failed to find available rooms: ${error.message}`);
    }

    if (!availableGames || availableGames.length === 0) {
      console.log("🔵 ACTION: findAvailableRoomForQuickJoin - No public rooms found");
      return null;
    }

    // Filter to only games with available slots
    const { countPlayersByGame } = await import('@/lib/roomCodes');
    const playerCounts = await countPlayersByGame(availableGames.map(g => g.id));
    const joinableGames = availableGames.filter(game => {
      const currentPlayers = playerCounts.get(game.id) ?? 0;
      const availableSlots = game.max_players - currentPlayers;
      return availableSlots > 0;
    });

    if (joinableGames.length === 0) {
      console.log("🔵 ACTION: findAvailableRoomForQuickJoin - No rooms with available slots");
      return null;
    }

    // Return the room code of the first available game (newest)
    const chosenGame = joinableGames[0];
    console.log(`🔵 ACTION: findAvailableRoomForQuickJoin - Found room: ${chosenGame.room_code} (${chosenGame.room_name})`);
    
    return chosenGame.room_code;

  } catch (error: any) {
    console.error('🔴 ACTION: findAvailableRoomForQuickJoin - Unexpected error:', error.message);
    throw new Error(`Quick join failed: ${error.message}`);
  }
}

export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  console.log(`🔵 ACTION: getCurrentPlayer - Fetching details for player ${playerId} in game ${gameId}`);
  if (!playerId || !gameId) return undefined;
  
  // SECURITY: Only authenticated players can fetch their own player data
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
  if (authorizedPlayerId !== playerId) {
    throw new Error(`Authorization failed: Cannot access other players' data`);
  }
  console.log(`🔵 ACTION: getCurrentPlayer - Player authorization passed for: ${authorizedPlayerId}`);
  
  const { data: playerData } = await supabase.from('players').select('*').eq('id', playerId).eq('game_id', gameId).single();
  if (!playerData) {
      console.warn(`🟡 ACTION: getCurrentPlayer - Player ${playerId} not found in game ${gameId}.`);
      return undefined;
  }
  
  const { data: gameData } = await supabase.from('games').select('current_judge_id').eq('id', gameId).single();
  
  const { data: handData } = await supabase.from('player_hands').select('*, response_cards(id, text)').eq('player_id', playerId).eq('game_id', gameId);
  const handCards: PlayerHandCard[] = (handData as any[])?.reduce((cards: PlayerHandCard[], h) => {
    if (h.response_cards) {
      cards.push({
        id: h.response_cards.id,
        text: h.response_cards.text,
        isNew: h.is_new ?? false
      });
    }
    return cards;
  }, []) || [];

  console.log(`🔵 ACTION: getCurrentPlayer - Found player ${playerData.name} with ${handCards.length} cards.`);
  return {
    id: playerData.id, name: playerData.name, avatar: playerData.avatar || '',
    score: playerData.score, isJudge: gameData ? playerData.id === gameData.current_judge_id : false,
    hand: handCards, isReady: playerData.is_ready,
  };
}

export async function togglePlayerReadyStatus(playerId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: togglePlayerReadyStatus - Initiated for player ${playerId} in game ${gameId}.`);
  
  // SECURITY: Only authenticated players can toggle their own ready status
  const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
  if (authorizedPlayerId !== playerId) {
    throw new Error(`Authorization failed: Cannot toggle ready status for other players`);
  }
  console.log(`🔵 ACTION: togglePlayerReadyStatus - Player authorization passed for: ${authorizedPlayerId}`);
  
  const { data: player, error: playerFetchError } = await supabase
    .from('players').select('is_ready').eq('id', playerId).eq('game_id', gameId).single();
  if (playerFetchError || !player) throw new Error(`Failed to fetch player to toggle ready status: ${playerFetchError?.message || 'Player not found'}`);
  
  const newReadyStatus = !player.is_ready;
  console.log(`🔵 ACTION: togglePlayerReadyStatus - Player ${playerId} toggling ready status to ${newReadyStatus}.`);
  
  const { error: playerUpdateError } = await supabase
    .from('players').update({ is_ready: newReadyStatus }).eq('id', playerId).eq('game_id', gameId);
  if (playerUpdateError) throw new Error(`Failed to update player ready status: ${playerUpdateError.message}`);

  const { data: gameForOrderUpdate } = await supabase.from('games').select('ready_player_order, game_phase').eq('id', gameId).single();
  if (!gameForOrderUpdate) {
    console.error(`🔴 ACTION: togglePlayerReadyStatus - Could not fetch game ${gameId} to update ready order.`);
    return getGame(gameId); 
  }

  let currentReadyOrder = Array.isArray(gameForOrderUpdate.ready_player_order) ? gameForOrderUpdate.ready_player_order : [];
  if (newReadyStatus) {
    if (!currentReadyOrder.includes(playerId)) currentReadyOrder.push(playerId);
  } else {
    currentReadyOrder = currentReadyOrder.filter(id => id !== playerId);
  }
  console.log(`🔵 ACTION: togglePlayerReadyStatus - New ready order: [${currentReadyOrder.join(', ')}]`);

  await supabase.from('games').update({ ready_player_order: currentReadyOrder, updated_at: new Date().toISOString() }).eq('id', gameId);

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); 
}

/**
 * Get current player session information (for client-side identity)
 */
export async function getCurrentPlayerSession(): Promise<{ playerId: string; gameId: string; role: string } | null> {
  console.log('🔵 ACTION: getCurrentPlayerSession - Checking current session');
  
  try {
    const session = await getPlayerSession();
    if (!session.valid || !session.token) {
      console.log('🟡 ACTION: getCurrentPlayerSession - No valid session found');
      return null;
    }
    
    console.log(`🔵 ACTION: getCurrentPlayerSession - Valid session found for player ${session.token.playerId}`);
    return {
      playerId: session.token.playerId,
      gameId: session.token.gameId,
      role: session.token.role
    };
  } catch (error) {
    console.error('🔴 ACTION: getCurrentPlayerSession - Error checking session:', error);
    return null;
  }
}

/**
 * Set player session (for client-side session establishment)
 */
export async function setCurrentPlayerSession(playerId: string, gameId: string, role: 'player' | 'judge' | 'host' = 'player'): Promise<void> {
  console.log(`🔵 ACTION: setCurrentPlayerSession - Setting session for player ${playerId} in game ${gameId} as ${role}`);
  await setPlayerSession(playerId, gameId, role);
}

/**
 * Clear current player session (logout)
 */
export async function clearCurrentPlayerSession(): Promise<void> {
  console.log('🔵 ACTION: clearCurrentPlayerSession - Clearing session');
  await clearPlayerSession();
}

export async function removePlayerFromGame(gameId: string, playerId: string, reason: 'voluntary' | 'kicked' = 'voluntary'): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: removePlayerFromGame - Removing player ${playerId} from game ${gameId}, reason: ${reason}`);
  
  // SECURITY: Validate authorization based on removal reason
  if (reason === 'kicked') {
    // Only hosts can kick other players
    const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireHostAccess(gameId));
    console.log(`🔵 ACTION: removePlayerFromGame - Host authorization for kick passed: ${authorizedPlayerId}`);
    
    // Hosts cannot kick themselves via this action (use voluntary exit instead)
    if (authorizedPlayerId === playerId) {
      throw new Error("Hosts cannot kick themselves. Use voluntary exit instead.");
    }
  } else {
    // For voluntary exits, just verify the player is removing themselves
    const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
    
    // Optional: Only allow players to remove themselves voluntarily
    if (authorizedPlayerId !== playerId) {
      console.warn(`🟡 ACTION: removePlayerFromGame - Player ${authorizedPlayerId} removing different player ${playerId} as voluntary`);
      // This could be allowed for certain admin scenarios, or we could enforce self-removal only
    }
  }
  
  try {
    // Fetch game and player data to understand current state
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('created_by_player_id, current_judge_id, ready_player_order, game_phase, current_round')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error fetching game:`, gameError?.message);
      throw new Error(`Failed to fetch game for player removal: ${gameError?.message || 'Game not found'}`);
    }

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('name, is_ready')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();
    
    if (playerError || !playerData) {
      console.error(`🔴 ACTION: removePlayerFromGame - Player not found:`, playerError?.message);
      throw new Error(`Player not found in game: ${playerError?.message || 'Player not found'}`);
    }

    console.log(`🔵 ACTION: removePlayerFromGame - Removing player "${playerData.name}" from game phase "${game.game_phase}"`);

    // Check remaining player count
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId);
    
    if (playersError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error fetching all players:`, playersError.message);
      throw new Error(`Failed to check player count: ${playersError.message}`);
    }

    const remainingPlayersCount = (allPlayers?.length || 1) - 1;
    console.log(`🔵 ACTION: removePlayerFromGame - ${remainingPlayersCount} players will remain after removal`);

    // Check if host is leaving - if so, close room for everyone
    const isHostLeaving = game.created_by_player_id === playerId;
    if (isHostLeaving) {
      console.log(`🔵 ACTION: removePlayerFromGame - Host is leaving, closing room ${gameId}`);

      // Update the game FIRST: games.created_by_player_id (and possibly
      // current_judge_id) reference the host's players row with a plain FK,
      // so deleting the player before clearing those columns fails with an
      // FK violation — which the deletes below don't surface, silently
      // leaving the host in the game.
      const updatedReadyOrder = (game.ready_player_order || []).filter(id => id !== playerId);
      const { error: closeError } = await supabase
        .from('games')
        .update({
          ready_player_order: updatedReadyOrder,
          current_judge_id: null,
          created_by_player_id: null,
          transition_state: 'resetting_game',
          transition_message: 'Host ended the game',
          updated_at: new Date().toISOString()
        })
        .eq('id', gameId);
      if (closeError) {
        throw new Error(`Failed to close room on host departure: ${closeError.message}`);
      }

      // Now remove the host's data
      await supabase.from('player_hands').delete().eq('player_id', playerId).eq('game_id', gameId);
      await supabase.from('responses').delete().eq('player_id', playerId).eq('game_id', gameId);
      const { error: hostDeleteError } = await supabase.from('players').delete().eq('id', playerId).eq('game_id', gameId);
      if (hostDeleteError) {
        throw new Error(`Failed to remove host: ${hostDeleteError.message}`);
      }
      
      revalidatePath('/');
      revalidatePath('/game');
      return null; // Host departure = room closed, no game state returned
    }

    // Prepare game updates
    let gameUpdates: TablesUpdate<'games'> = { 
      updated_at: new Date().toISOString() 
    };
    
    // Handle judge reassignment if current judge is leaving
    if (game.current_judge_id === playerId) {
      console.log(`🔵 ACTION: removePlayerFromGame - Current judge is leaving, reassigning...`);
      
      if (remainingPlayersCount >= MIN_PLAYERS_TO_START && game.ready_player_order && game.ready_player_order.length > 1) {
        // Find next judge from ready player order
        const remainingPlayers = game.ready_player_order.filter(id => id !== playerId);
        
        if (remainingPlayers.length > 0) {
          const currentJudgeIndex = game.ready_player_order.findIndex(id => id === playerId);
          // Get next player in rotation, wrap around if needed
          const nextJudgeIndex = currentJudgeIndex >= remainingPlayers.length ? 0 : currentJudgeIndex;
          const newJudgeId = remainingPlayers[nextJudgeIndex];
          gameUpdates.current_judge_id = newJudgeId;
          console.log(`🔵 ACTION: removePlayerFromGame - New judge assigned: ${newJudgeId}`);
        }
      } else {
        // Not enough players for game continuation
        gameUpdates.current_judge_id = null;
        console.log(`🔵 ACTION: removePlayerFromGame - No judge assigned (insufficient players)`);
      }
    }

    // Remove the leaving player from ready_player_order atomically in the DB.
    // A read-modify-write here races with concurrent leavers: each writes
    // back its own stale copy of the array and one removal gets undone.
    // (rpc cast: generated DB types predate this function — migration 004)
    const { error: readyOrderError } = await (supabase.rpc as CallableFunction)('remove_player_from_ready_order', {
      p_game_id: gameId,
      p_player_id: playerId,
    }) as { error: { message: string } | null };
    if (readyOrderError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error updating ready order:`, readyOrderError.message);
      throw new Error(`Failed to update ready order: ${readyOrderError.message}`);
    }

    // Reset to lobby if too few players remain and not already in lobby
    if (remainingPlayersCount < MIN_PLAYERS_TO_START && game.game_phase !== 'lobby') {
      console.log(`🔵 ACTION: removePlayerFromGame - Too few players remaining, resetting to lobby`);
      gameUpdates.game_phase = 'lobby';
      gameUpdates.current_round = 0;
      gameUpdates.current_scenario_id = null;
      if (!gameUpdates.current_judge_id) {
        gameUpdates.current_judge_id = null;
      }
    }

    // Remove player's hand cards first (foreign key constraint)
    const { error: handDeleteError } = await supabase
      .from('player_hands')
      .delete()
      .eq('player_id', playerId)
      .eq('game_id', gameId);
    
    if (handDeleteError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error removing player hand:`, handDeleteError.message);
    }

    // Remove player's responses for current round (if any)
    const { error: responsesDeleteError } = await supabase
      .from('responses')
      .delete()
      .eq('player_id', playerId)
      .eq('game_id', gameId);
    
    if (responsesDeleteError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error removing player responses:`, responsesDeleteError.message);
    }

    // Update game state first
    const { error: gameUpdateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);
    
    if (gameUpdateError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error updating game:`, gameUpdateError.message);
      throw new Error(`Failed to update game state: ${gameUpdateError.message}`);
    }

    // Finally, remove the player
    const { error: playerDeleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('game_id', gameId);
    
    if (playerDeleteError) {
      console.error(`🔴 ACTION: removePlayerFromGame - Error removing player:`, playerDeleteError.message);
      throw new Error(`Failed to remove player: ${playerDeleteError.message}`);
    }

    console.log(`🔵 ACTION: removePlayerFromGame - Successfully removed player ${playerId} (${reason}) from game ${gameId}`);
    
    // Revalidate paths to update cached data
    revalidatePath('/');
    revalidatePath('/game');
    
    // Return updated game state for remaining players (null if no players left)
    if (remainingPlayersCount === 0) {
      console.log(`🔵 ACTION: removePlayerFromGame - No players remaining, game will be cleaned up`);
      return null;
    }

    // Internal (non-auth) fetch: the leaving player's row is already gone,
    // so the membership-gated getGame would throw for their session.
    return getGameStateInternal(gameId);

  } catch (error: any) {
    console.error('🔴 ACTION: removePlayerFromGame - Unexpected error:', error.message);
    throw error;
  }
}

    