
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';


export async function findOrCreateGame(): Promise<Tables<'games'>> {
  console.log("🔴 GAME (Server): findOrCreateGame called. Looking for existing game...");

  // Priority 1: Find the oldest game in 'lobby' phase
  const { data: lobbyGames, error: lobbyError } = await supabase
    .from('games')
    .select('*')
    .eq('game_phase', 'lobby')
    .order('created_at', { ascending: true })
    .limit(1);

  if (lobbyError) {
    console.error("🔴 GAME (Server): Error fetching lobby games:", JSON.stringify(lobbyError, null, 2));
    // Don't throw, try next priority
  }

  if (lobbyGames && lobbyGames.length > 0) {
    console.log(`🔴 GAME (Server): Found existing game in 'lobby' phase: ${lobbyGames[0].id}. Using this one.`);
    return lobbyGames[0];
  }
  console.log("🔴 GAME (Server): No existing games found in 'lobby' phase. Looking for any game...");

  // Priority 2: Find the oldest game of any phase if no lobby game found
  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error("🔴 GAME (Server): Error fetching any existing games:", JSON.stringify(fetchError, null, 2));
    // If this fails, we'll proceed to create, but this is not ideal
  }
  
  if (existingGames && existingGames.length > 0) {
    console.log(`🔴 GAME (Server): Found existing game in '${existingGames[0].game_phase}' phase: ${existingGames[0].id}. Using this one (as no lobby game was found).`);
    return existingGames[0];
  }
  console.log("🔴 GAME (Server): No existing games found in any phase.");

  // Create new game if none exist
  console.log("🔴 GAME (Server): Creating new game...");
  const newGameData: TablesInsert<'games'> = {
    game_phase: 'lobby',
    current_round: 0, // Start at round 0 for lobby
    ready_player_order: [], 
    used_scenarios: [],   
    used_responses: [],   
    updated_at: new Date().toISOString(),
  };
  const { data: newGame, error: createError } = await supabase
    .from('games')
    .insert(newGameData)
    .select()
    .single();

  if (createError || !newGame) {
    const errorMessage = createError ? createError.message : "New game data was unexpectedly null after insert operation.";
    console.error("🔴 GAME (Server): Error creating new game:", errorMessage, JSON.stringify(createError, null, 2));
    if (createError && createError.message.includes('RLS')) { // Be more specific if possible
        throw new Error(`Could not create a new game. Supabase error: ${errorMessage}. Possible RLS issue on 'games' table.`);
    }
    throw new Error(`Could not create a new game. Supabase error: ${errorMessage}`);
  }
  console.log(`🔴 GAME (Server): Created new game with ID: ${newGame.id}`);
  return newGame;
}


export async function getGame(gameIdToFetch?: string): Promise<GameClientState> {
  let gameRow: Tables<'games'> | null = null;

  if (gameIdToFetch) {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameIdToFetch).single();
    if (error) {
      console.error(`🔴 GAME (Server): Error fetching specific game ${gameIdToFetch}:`, JSON.stringify(error, null, 2));
      // If specific game fetch fails, maybe fall back to findOrCreateGame or throw error
      // For now, let's attempt findOrCreate to ensure a game context for the client
      gameRow = await findOrCreateGame();
    } else if (!data) {
        console.warn(`🔴 GAME (Server): Game ${gameIdToFetch} not found. Falling back to findOrCreateGame.`);
        gameRow = await findOrCreateGame();
    }
     else {
      gameRow = data;
    }
  } else {
    gameRow = await findOrCreateGame();
  }
  
  if (!gameRow || !gameRow.id) {
    // This should ideally not happen if findOrCreateGame is robust
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;
  console.log("DEBUG: getGame - Operating with gameId:", gameId);

  // Fetch players for this game
  let playersData: Tables<'players'>[] = [];
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error(`DEBUG: getGame - Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    if (playersError.message.includes('column players.game_id does not exist')) {
        console.error("🔴 CRITICAL SCHEMA ERROR: The 'players' table is missing the 'game_id' column. Please add it in your Supabase dashboard.");
        // Return a minimal state or throw, for now, proceed with empty players
    }
    // Don't throw here, allow page to load with empty player list if players can't be fetched
  } else {
    playersData = fetchedPlayersData || [];
  }
   console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}:`, JSON.stringify(playersData.map(p=>p.name)));

  // Fetch all hands for the players in this game
  const playerIds = playersData.map(p => p.id);
  let allHandsData: { player_id: string, response_card_id: string, response_cards: { text: string | null } | null }[] = [];
  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('player_id, response_card_id, response_cards (text)') // Assumes foreign key from player_hands.response_card_id to response_cards.id
      .in('player_id', playerIds)
      .eq('game_id', gameId); // Ensure hands are for the current game

    if (handsError) {
      console.error(`DEBUG: getGame - Error fetching hands for players in game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = fetchedHandsData || [];
      console.log(`DEBUG: getGame - Raw allHandsData for game ${gameId}:`, JSON.stringify(allHandsData, null, 2));
    }
  }

  // Construct PlayerClientState array
  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards = allHandsData
      .filter(h => h.player_id === p.id && h.response_cards?.text)
      .map(h => h.response_cards!.text as string); // Assert text is not null if response_cards itself is not null
      console.log(`DEBUG: getGame - Player ${p.name} (ID: ${p.id}) constructed hand:`, playerHandCards);
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isJudge: p.id === gameRow.current_judge_id,
      hand: playerHandCards,
      isReady: p.is_ready, // Assuming is_ready is a column on your players table
    };
  });

  // Fetch categories
  const { data: categoriesData, error: categoriesError } = await supabase
    .from('scenarios')
    .select('category'); // Select only the category column

  let categories: string[] = ["Default Category"]; // Fallback
  if (categoriesError) {
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  } else if (categoriesData) {
    const distinctCategories = [...new Set(categoriesData.map(c => c.category).filter(c => c !== null) as string[])];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
    }
  }
  console.log(`DEBUG: getGame - Categories for game ${gameId}:`, categories);

  // Fetch current scenario if one is set
  let currentScenario: ScenarioClientState | null = null;
  if (gameRow.current_scenario_id) {
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('scenarios')
      .select('id, category, text')
      .eq('id', gameRow.current_scenario_id)
      .single();
    if (scenarioError) {
      console.error('Error fetching current scenario:', JSON.stringify(scenarioError, null, 2));
    }
    if (scenarioData) {
      currentScenario = {
        id: scenarioData.id,
        category: scenarioData.category || 'Unknown', // Ensure category is a string
        text: scenarioData.text,
      };
    }
  }

  // Fetch submissions if in judging phase
  let submissions: GameClientState['submissions'] = [];
  if (gameRow.game_phase === 'judging' && gameRow.current_round > 0) {
    console.log(`DEBUG: getGame - Fetching submissions for game ${gameId}, round ${gameRow.current_round}`);
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses') // This is your submissions table
      .select('player_id, response_card_id, response_cards(text)') // Join with response_cards to get text
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('DEBUG: getGame - Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      console.log('DEBUG: getGame - Raw submissionData from Supabase:', JSON.stringify(submissionData, null, 2));
      submissions = submissionData.map((s: any) => { // Use 'any' carefully or define a more specific type
        const cardText = s.response_cards?.text || 'Error: Card text not found';
        if (!s.response_cards?.text) {
            console.warn(`DEBUG: getGame - Submission from player ${s.player_id} missing card text. Raw submission item:`, JSON.stringify(s));
        }
        return {
          playerId: s.player_id,
          cardText: cardText,
        };
      });
      console.log('DEBUG: getGame - Processed submissions:', JSON.stringify(submissions, null, 2));
    } else {
        console.log('DEBUG: getGame - No submission data returned from Supabase.');
    }
  }
  
  // Construct last winner details
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

  // Construct the final GameClientState
  const gameClientState: GameClientState = {
    gameId: gameId,
    players: players,
    currentRound: gameRow.current_round,
    currentJudgeId: gameRow.current_judge_id,
    currentScenario: currentScenario,
    gamePhase: gameRow.game_phase as GamePhaseClientState,
    submissions: submissions, 
    categories: categories,
    readyPlayerOrder: gameRow.ready_player_order || [],
    lastWinner: lastWinnerDetails,
    winningPlayerId: gameRow.overall_winner_player_id,
  };
  console.log(`DEBUG: getGame - Returning GameClientState for gameId ${gameId} with phase: ${gameClientState.gamePhase}, ${gameClientState.players.length} players, and ${gameClientState.submissions.length} submissions.`);
  return gameClientState;
}

export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  console.log(`🔴 PLAYER (Server): addPlayer called for player: ${name}`);
  const gameRow = await findOrCreateGame(); 
  if (!gameRow || !gameRow.id) {
    console.error('🔴 PLAYER (Server): Failed to find or create a game session for adding player.');
    throw new Error('Could not find or create game session to add player.');
  }
  const gameId = gameRow.id;
  console.log(`🔴 PLAYER (Server): Operating with game ID: ${gameId} for player ${name}`);

  // Check if player with the same name already exists in this game
  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
    console.error('🔴 PLAYER (Server): Error checking for existing player:', JSON.stringify(checkError, null, 2));
    throw new Error(`Error checking for existing player: ${checkError.message}`);
  }

  if (existingPlayer) {
    console.warn(`🔴 PLAYER (Server): Player with name ${name} already exists in game ${gameId}. Re-fetching full details.`);
    // If player exists, just return their data, don't re-add or error.
    // This helps if a user refreshes and tries to rejoin.
    const { data: fullExistingPlayer, error: fetchExistingError } = await supabase
        .from('players')
        .select('*')
        .eq('id', existingPlayer.id)
        .single();
    if (fetchExistingError) {
        console.error('🔴 PLAYER (Server): Error re-fetching existing player:', JSON.stringify(fetchExistingError, null, 2));
        throw new Error(`Error re-fetching existing player: ${fetchExistingError.message}`);
    }
    return fullExistingPlayer;
  }

  const newPlayerData: TablesInsert<'players'> = {
    game_id: gameId,
    name,
    avatar,
    score: 0,
    is_judge: false, // Default to false
    is_ready: false, // Default to false
    joined_at: new Date().toISOString(),
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('🔴 PLAYER (Server): Error adding new player:', JSON.stringify(insertError, null, 2));
    throw new Error(`Error adding new player: ${insertError.message}`);
  }
  if (!newPlayer) {
    // This case should ideally not be reached if insertError is null
    console.error('🔴 PLAYER (Server): New player data was null after insert, this should not happen.');
    throw new Error('Failed to add player, server returned no player data.');
  }
  console.log(`🔴 PLAYER (Server): Player ${name} added with ID ${newPlayer.id} to game ${gameId}`);

  revalidatePath('/'); // For the lobby page
  revalidatePath('/game'); // For the main game page
  return newPlayer;
}


export async function resetGameForTesting() {
  console.log("🔴 RESET (Server): resetGameForTesting action called");
  let gameToReset: Tables<'games'> | null = null;

  try {
    console.log("🔴 RESET (Server): Finding the oldest game to reset...");
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase') // Only select necessary fields
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 RESET (Server): Exception during game fetch for reset:", fetchError.message, JSON.stringify(fetchError, null, 2));
       // If the error is a NEXT_REDIRECT, re-throw it to let Next.js handle it.
      if (typeof fetchError.message === 'string' && fetchError.message.includes('NEXT_REDIRECT')) {
          throw fetchError; 
      }
      throw new Error(`Exception during game fetch for reset: ${fetchError.message}`);
    }
    
    if (!existingGames || existingGames.length === 0) {
      console.log('🔴 RESET (Server): No existing game found to reset. A new game will be created on next load if needed.');
      revalidatePath('/');
      revalidatePath('/game');
      redirect('/?step=setup'); // Redirect to setup for a fresh start.
      return; // Important to exit after redirect.
    }
    
    gameToReset = existingGames[0];
    const gameId = gameToReset.id;
    console.log(`🔴 RESET (Server): Found game to reset: ID ${gameId}, Current Phase: ${gameToReset.game_phase}`);
    
    // Comprehensive reset data for the games table
    const updateData: TablesUpdate<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      current_judge_id: null,
      current_scenario_id: null,
      ready_player_order: [],
      last_round_winner_player_id: null,
      last_round_winning_card_text: null,
      overall_winner_player_id: null,
      used_scenarios: [], // Ensure these are reset
      used_responses: [],
      updated_at: new Date().toISOString(),
    };
    console.log(`🔴 RESET (Server): Updating game ${gameId} with data:`, JSON.stringify(updateData, null, 2));

    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to update game ${gameId} to lobby phase:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
    } else {
      console.log(`🔴 RESET (Server): Game ${gameId} successfully updated to lobby phase.`);
      console.log("🔴 RESET (Server): Updated game details:", JSON.stringify(updatedGame, null, 2));
    }

    // Deleting related data
    console.log(`🔴 RESET (Server): Deleting related data for game ${gameId}...`);
    const tablesToClear = ['player_hands', 'responses', 'winners', 'players'];
    for (const table of tablesToClear) {
      console.log(`🔴 RESET (Server): Deleting from ${table} for game_id ${gameId}...`);
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) {
        console.error(`🔴 RESET (Server): Error deleting from ${table} for game_id ${gameId}:`, JSON.stringify(deleteError, null, 2));
        // Consider if you should throw an error here or just log and continue
      } else {
        console.log(`🔴 RESET (Server): Successfully deleted from ${table} for game_id ${gameId}.`);
      }
    }
    
    // Verification step (optional, but good for debugging)
    const { data: verifiedGame, error: verifyError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (verifyError) {
      console.error(`🔴 RESET (Server): Error verifying reset for game ${gameId}:`, JSON.stringify(verifyError, null, 2));
    } else if (verifiedGame) {
      console.log(`🔴 RESET (Server): Verification - Game ${gameId} phase is now: ${verifiedGame.game_phase}`);
      console.log(`🔴 RESET (Server): Verification - Current round: ${verifiedGame.current_round}`);
      console.log(`🔴 RESET (Server): Verification - Judge ID: ${verifiedGame.current_judge_id}`);
    } else {
      console.warn(`🔴 RESET (Server): Verification - Game ${gameId} not found after update attempt. This is unexpected if update succeeded.`);
    }


  } catch (e: any) {
    console.error('🔴 RESET (Server): Unexpected exception during reset process:', e.message, e.stack);
    // If the error is a NEXT_REDIRECT, re-throw it to let Next.js handle it.
    if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e; 
    }
    // For other errors, you might want to throw a new error or handle differently.
    // Avoid re-throwing generic errors if a redirect was the cause but wasn't caught by digest check.
    if (!(typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT'))) {
        throw new Error(`Unexpected error during reset: ${e.message || 'Unknown error'}`);
    }
  }

  console.log('🔴 RESET (Server): Reset process complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup'); // Redirect to setup for a fresh start.
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  console.log(`🔴 CARDS (Server): Dealing ${count} cards for game ${gameId}. Current used_responses for this dealing op: ${existingUsedResponses.length}`);

  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('used_responses')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`🔴 CARDS (Server): Error fetching game data for dealing cards (game ${gameId}):`, gameFetchError);
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }
  
  const currentUsedResponsesInGame = gameData.used_responses || [];
  // Combine the master list from the game row with what's already been used in this specific dealing operation.
  const allKnownUsedResponses = [...new Set([...currentUsedResponsesInGame, ...existingUsedResponses])];
  console.log(`🔴 CARDS (Server): Total known used cards (DB master list + current operation) for game ${gameId}: ${allKnownUsedResponses.length}`);

  let query = supabase
    .from('response_cards')
    .select('id')
    .eq('is_active', true);
  
  if (allKnownUsedResponses.length > 0) {
    // Ensure allKnownUsedResponses only contains valid UUIDs and is not an empty array causing issues
    const validUUIDs = allKnownUsedResponses.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
        query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    } else {
        console.log(`🔴 CARDS (Server): No valid UUIDs in allKnownUsedResponses to filter by for game ${gameId}. Fetching any active card.`);
    }
  }

  // Fetch more cards than needed to allow for some randomness even if many are used up
  const { data: availableCards, error: fetchError } = await query.limit(count + 50); 

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses }; // Return all known, as nothing new was dealt
  }

  if (!availableCards || availableCards.length === 0) {
    console.warn(`🔴 CARDS (Server): No available response cards to deal for game ${gameId} after filtering. Total known used: ${allKnownUsedResponses.length}. Attempted to deal ${count}.`);
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  console.log(`🔴 CARDS (Server): Found ${availableCards.length} potentially available cards for game ${gameId} before shuffling (need ${count}).`);
  // Shuffle the available cards to pick randomly
  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  
  // This function now returns the list of cards that were actually used in this specific dealing operation,
  // combined with what was passed in. The caller (`startGame` or `submitResponse`) will be responsible
  // for merging this with the game's master `used_responses` list.
  const newlyDealtAndUsedInThisOperation = [...new Set([...existingUsedResponses, ...dealtCardIds])];

  console.log(`🔴 CARDS (Server): Dealt ${dealtCardIds.length} cards for game ${gameId}: ${JSON.stringify(dealtCardIds)}. New total used_responses count FOR THIS OPERATION: ${newlyDealtAndUsedInThisOperation.length}`);
  return { dealtCardIds, updatedUsedResponses: newlyDealtAndUsedInThisOperation };
}

export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 START (Server): startGame action called for game ${gameId}`);
  
  const { data: game, error: gameFetchError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !game) {
    console.error(`🔴 START (Server): Error fetching game ${gameId} for startGame: ${JSON.stringify(gameFetchError, null, 2)}`);
    throw new Error(`Failed to fetch game for start: ${gameFetchError?.message || 'Game not found'}`);
  }

  if (game.game_phase === 'lobby') {
    const { data: players, error: playersFetchError } = await supabase
      .from('players')
      .select('id, name') // Only fetch necessary fields
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true }); // Ensure consistent order for judge selection

    if (playersFetchError || !players || players.length < 2) { // Ensure at least 2 players
      console.error(`🔴 START (Server): Error fetching players or not enough players (need at least 2) for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
      throw new Error(`Not enough players to start game (found ${players?.length || 0}, need at least 2). Or ${playersFetchError?.message}`);
    }

    const firstJudgeId = players[0].id;
    console.log(`🔴 START (Server): Assigning player ${players[0].name} (ID: ${firstJudgeId}) as the first judge for game ${gameId}`);

    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];
    console.log(`🔴 START (Server) CARDS: Initial master used_responses for game ${gameId} before dealing: ${accumulatedUsedResponsesForThisGameStart.length}`);

    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    // Deal cards to ALL players, including the judge
    for (const player of players) {
      console.log(`🔴 START (Server) CARDS: Attempting to deal ${CARDS_PER_HAND} cards to player ${player.name} (ID: ${player.id})`);
      const { dealtCardIds, updatedUsedResponses: tempUsedAfterThisPlayer } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);
      
      console.log(`🔴 START (Server) CARDS: For player ${player.name}, dealCardsFromSupabase returned ${dealtCardIds.length} cards. IDs: ${JSON.stringify(dealtCardIds)}`);

      if (dealtCardIds.length > 0) {
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
            is_new: true, // Or remove if not used
          });
        });
        // Update the accumulated list *after each player* to ensure subsequent players don't get the same cards
        accumulatedUsedResponsesForThisGameStart = [...new Set([...accumulatedUsedResponsesForThisGameStart, ...dealtCardIds])];
        console.log(`🔴 START (Server) CARDS: Player ${player.name} dealt ${dealtCardIds.length} cards. accumulatedUsedResponses count is now: ${accumulatedUsedResponsesForThisGameStart.length}`);
      } else {
         console.warn(`🔴 START (Server) CARDS: No cards dealt to player ${player.name} (ID: ${player.id}). dealCardsFromSupabase might have run out or errored.`);
      }
    }

    if (playerHandInserts.length > 0) {
      console.log(`🔴 START (Server) CARDS: Attempting to batch insert ${playerHandInserts.length} cards into player_hands.`);
      const { error: allHandsInsertError } = await supabase.from('player_hands').insert(playerHandInserts);
      if (allHandsInsertError) {
        console.error(`🔴 START (Server) CARDS: Critical error inserting player hands:`, JSON.stringify(allHandsInsertError, null, 2));
        // Decide if to throw an error here or try to continue
      } else {
        console.log(`🔴 START (Server) CARDS: Successfully batch inserted ${playerHandInserts.length} cards into player_hands.`);
      }
    } else {
      console.warn(`🔴 START (Server) CARDS: No cards to insert into player_hands for any player.`);
    }

    // Update game state
    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: firstJudgeId,
      current_round: 1, // Start with round 1
      updated_at: new Date().toISOString(),
      used_responses: accumulatedUsedResponsesForThisGameStart, // Persist the final list of used cards for this game start
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`🔴 START (Server): Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
     console.log(`🔴 START (Server): Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1. Final used_responses count in DB: ${accumulatedUsedResponsesForThisGameStart.length}`);
  } else {
     console.warn(`🔴 START (Server): startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); // Return the updated game state
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔴 CATEGORY (Server): selectCategory action for game ${gameId}, category ${category}`);
  
  // Fetch current game state, specifically used_scenarios and current_judge_id
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('used_scenarios, current_judge_id') // Only select needed columns
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 CATEGORY (Server): Error fetching game ${gameId} for category selection:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  const usedScenarios = game.used_scenarios || [];
  
  // Query for scenarios in the selected category, excluding used ones
  let query = supabase
    .from('scenarios')
    .select('id, text, category') // Ensure all needed fields are selected
    .eq('category', category);
  
  if (usedScenarios.length > 0) {
    // Ensure usedScenarios contains valid UUIDs
    const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
        query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
  }

  const { data: scenarios, error: scenarioFetchError } = await query;

  if (scenarioFetchError) {
    console.error(`🔴 CATEGORY (Server): Error fetching scenarios for category ${category}:`, JSON.stringify(scenarioFetchError, null, 2));
    throw new Error(`Error fetching scenarios for category ${category}: ${scenarioFetchError.message}`);
  }

  let scenarioToUse: { id: string; text: string; category: string | null } | null = null;

  if (!scenarios || scenarios.length === 0) {
    console.warn(`🔴 CATEGORY (Server): No unused scenarios for category ${category}. Attempting to fetch ANY scenario from this category (recycling).`);
    // Fallback: if no unused scenarios, pick any from the category (allowing reuse)
    // Or, if truly out, you might want to reset used_scenarios for that category or error.
    // For now, let's try to pick any from the category.
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase
      .from('scenarios')
      .select('id, text, category')
      .eq('category', category);

    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 CATEGORY (Server): Critical - No scenarios found for category ${category} at all, even for recycling.`, JSON.stringify(anyCategoryError, null, 2));
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    console.warn(`🔴 CATEGORY (Server): Re-using scenarios for category ${category} as all were marked used for this game session.`);
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
    // When recycling, we don't add to used_scenarios again, as it would eventually filter out all if not careful.
    // Or, we could clear used_scenarios for this category if ALL are used, but that adds complexity.
    // For now, just use it without re-adding to used_scenarios if it's a recycled pick.
     const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      updated_at: new Date().toISOString(),
      // Do NOT update used_scenarios here if recycling to prevent full depletion.
      // If we want to allow re-use of all cards after a full cycle, used_scenarios should be reset then.
    };
     const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
     if (updateError) throw new Error(`Failed to update game after category selection (recycle): ${updateError.message}`);
     console.log(`🔴 CATEGORY (Server): Game ${gameId} moved to player_submission with RECYCLED scenario ${scenarioToUse.id}`);
     revalidatePath('/game');
     return getGame(gameId);
  } else {
    // Select a random scenario from the available ones
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  // Update game state with the selected scenario
  const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])]; // Add new scenario to used list

  const gameUpdates: TablesUpdate<'games'> = {
    current_scenario_id: scenarioToUse.id,
    game_phase: 'player_submission',
    used_scenarios: updatedUsedScenarios,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (updateError) {
    console.error(`🔴 CATEGORY (Server): Error updating game after category selection:`, JSON.stringify(updateError, null, 2));
    throw new Error(`Failed to update game after category selection: ${updateError.message}`);
  }
  console.log(`🔴 CATEGORY (Server): Game ${gameId} moved to player_submission with scenario ${scenarioToUse.id}`);
  
  revalidatePath('/game');
  return getGame(gameId); // Return updated game state
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`🔴 SUBMIT (Server): Player ${playerId} trying to submit card text "${responseCardText}" for game ${gameId} round ${currentRound}`);
  
  // Fetch current game state to check phase and judge
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id, used_responses, game_phase')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`🔴 SUBMIT (Server): Error fetching game data (game ${gameId}):`, gameFetchError);
    throw new Error(`Failed to fetch game for submission: ${gameFetchError?.message || 'Game not found'}`);
  }

  if (gameData.game_phase !== 'player_submission') {
    console.warn(`🔴 SUBMIT (Server): Submission attempt by ${playerId} but game ${gameId} is in phase ${gameData.game_phase}, not 'player_submission'.`);
    throw new Error(`Submissions are not open. Current game phase: ${gameData.game_phase}.`);
  }

  if (playerId === gameData.current_judge_id) {
    console.warn(`🔴 SUBMIT (Server): Judge ${playerId} attempted to submit a card. This is not allowed.`);
    throw new Error("Judges cannot submit response cards.");
  }

  // Find the response_card_id from player_hands based on player_id and card_text
  // This assumes the responseCardText is unique enough to identify the card in the player's hand.
  // A more robust approach would be to pass the response_card_id from the client if available.
  const { data: handCardEntry, error: handQueryError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards!inner(text)') // Ensure the join syntax is correct for your setup
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .eq('response_cards.text', responseCardText) 
    .limit(1) // Should be unique for a player's hand
    .single();

  if (handQueryError || !handCardEntry) {
    console.error(`🔴 SUBMIT (Server): Error finding card with text "${responseCardText}" in hand of player ${playerId} for game ${gameId}:`, JSON.stringify(handQueryError, null, 2));
    // Add more specific error message if the card text might not be found
    throw new Error(`Could not find card "${responseCardText}" in your hand. It might have already been played or there was an issue fetching your hand.`);
  }
  const responseCardId = handCardEntry.response_card_id;
  console.log(`🔴 SUBMIT (Server): Player ${playerId} submitted card ID ${responseCardId} (text: "${responseCardText}")`);


  // Check if player has already submitted for this round
  const { data: existingSubmission, error: checkSubmissionError } = await supabase
    .from('responses')
    .select('id')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('round_number', currentRound)
    .maybeSingle(); // Use maybeSingle to not error if no row found

  if (checkSubmissionError) {
    console.error(`🔴 SUBMIT (Server): Error checking for existing submission for player ${playerId}:`, JSON.stringify(checkSubmissionError, null, 2));
    throw new Error(`Error verifying submission status: ${checkSubmissionError.message}`);
  }
  if (existingSubmission) {
    console.warn(`🔴 SUBMIT (Server): Player ${playerId} has already submitted a card for round ${currentRound}.`);
    throw new Error("You have already submitted a card for this round.");
  }


  // Insert the submission
  const { error: insertError } = await supabase
    .from('responses')
    .insert({
      game_id: gameId,
      player_id: playerId,
      response_card_id: responseCardId, // Store the ID of the card
      round_number: currentRound,
    });

  if (insertError) {
    console.error(`🔴 SUBMIT (Server): Error inserting submission for player ${playerId}:`, JSON.stringify(insertError, null, 2));
    throw new Error(`Failed to insert submission: ${insertError.message}`);
  }

  // Remove the card from player's hand
  console.log(`🔴 SUBMIT (Server): Deleting card ${responseCardId} from hand of ${playerId} (game ${gameId}).`);
  const { error: deleteHandError } = await supabase
    .from('player_hands')
    .delete()
    .eq('player_id', playerId)
    .eq('response_card_id', responseCardId)
    .eq('game_id', gameId);

  if (deleteHandError) {
    console.error(`🔴 SUBMIT (Server): Error deleting card ${responseCardId} from hand of ${playerId}:`, JSON.stringify(deleteHandError, null, 2));
    // Not throwing here, as submission was successful. Card draw might fail.
  } else {
    console.log(`🔴 SUBMIT (Server): Successfully deleted card ${responseCardId} from hand of ${playerId}.`);
  }

  // Deal a new card to the player
  let gameUsedResponses = gameData.used_responses || [];
  console.log(`🔴 SUBMIT (Server) CARDS: Player ${playerId} played card ${responseCardId}. Initial game.used_responses length: ${gameUsedResponses.length}`);
  
  // The card played (responseCardId) should definitely be added to used_responses for the game.
  // Then, when dealing a new card, dealCardsFromSupabase will use this updated list.
  const usedResponsesAfterPlay = [...new Set([...gameUsedResponses, responseCardId])];

  const { dealtCardIds: replacementCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, usedResponsesAfterPlay);
  
  if (replacementCardIds.length > 0) {
    const newCardId = replacementCardIds[0];
    console.log(`🔴 SUBMIT (Server) CARDS: Dealing new card ${newCardId} to player ${playerId}.`);
    const { error: newCardInsertError } = await supabase
      .from('player_hands')
      .insert({
        game_id: gameId,
        player_id: playerId,
        response_card_id: newCardId,
        is_new: true,
      });
    if (newCardInsertError) {
      console.error(`🔴 SUBMIT (Server) CARDS: Error dealing new card to player ${playerId}:`, JSON.stringify(newCardInsertError, null, 2));
    } else {
      console.log(`🔴 SUBMIT (Server) CARDS: Successfully dealt new card ${newCardId} to player ${playerId}.`);
    }
  } else {
    console.warn(`🔴 SUBMIT (Server) CARDS: Could not deal new card to player ${playerId}, no cards available or error in dealCardsFromSupabase.`);
  }
  
  // Update the game's master list of used responses with all cards used in this operation
  console.log(`🔴 SUBMIT (Server) CARDS: Updating game.used_responses. Previous length: ${gameUsedResponses.length}, New length after play & deal: ${finalUsedResponsesAfterPlayAndDeal.length}`);
  const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() })
      .eq('id', gameId);
  if (gameUpdateError) {
      console.error(`🔴 SUBMIT (Server): Error updating game.used_responses:`, JSON.stringify(gameUpdateError, null, 2));
  } else {
    console.log(`🔴 SUBMIT (Server): Successfully updated game.used_responses.`);
  }

  // Check if all non-judge players have submitted
  const { data: nonJudgePlayers, error: playersError } = await supabase
    .from('players')
    .select('id', { count: 'exact' })
    .eq('game_id', gameId)
    .neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000'); // Ensure current_judge_id is not null

  if (playersError || !nonJudgePlayers) {
    console.error('🔴 SUBMIT (Server): Error fetching non-judge players count:', JSON.stringify(playersError, null, 2));
    throw new Error(`Failed to fetch players for submission check: ${playersError?.message || 'No non-judge players found'}`);
  }
  const totalNonJudgePlayers = nonJudgePlayers.length;


  // Fetch current number of submissions for this round
  const { count: submissionsCount, error: submissionsError } = await supabase
    .from('responses')
    .select('player_id', { count: 'exact', head: true }) // Use head:true for performance
    .eq('game_id', gameId)
    .eq('round_number', currentRound);
  
  if (submissionsError) {
    console.error('🔴 SUBMIT (Server): Error fetching submissions count:', JSON.stringify(submissionsError, null, 2));
    throw new Error(`Failed to fetch submissions count: ${submissionsError.message}`);
  }
  
  console.log(`🔴 SUBMIT (Server): Submission check: ${submissionsCount} submitted / ${totalNonJudgePlayers} non-judge players.`);
  if (submissionsCount !== null && totalNonJudgePlayers > 0 && submissionsCount >= totalNonJudgePlayers) {
    console.log(`🔴 SUBMIT (Server): All ${totalNonJudgePlayers} non-judge players submitted for round ${currentRound}. Moving to judging.`);
    const { error: phaseUpdateError } = await supabase
      .from('games')
      .update({ game_phase: 'judging', updated_at: new Date().toISOString() })
      .eq('id', gameId);
    if (phaseUpdateError) {
      console.error('🔴 SUBMIT (Server): Error updating game phase to judging:', JSON.stringify(phaseUpdateError, null, 2));
      // Consider if to throw or just log
    } else {
      console.log(`🔴 SUBMIT (Server): Game phase updated to 'judging'.`);
    }
  } else {
     console.log(`🔴 SUBMIT (Server): Waiting for more submissions. ${submissionsCount}/${totalNonJudgePlayers} submitted for round ${currentRound}.`);
  }

  revalidatePath('/game');
  return getGame(gameId); // Return updated game state
}


export async function selectWinner(winningCardText: string, gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 WINNER (Server): Judge selecting winner with card text "${winningCardText}" for game ${gameId}`);
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_round, current_judge_id') // Select only necessary fields
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 WINNER (Server): Error fetching game ${gameId}:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);
  }
  
  // Find the winning submission by card text
  const { data: winningSubmissionData, error: submissionError } = await supabase
    .from('responses')
    .select('player_id, response_card_id, response_cards!inner(text)')
    .eq('game_id', gameId)
    .eq('round_number', game.current_round)
    .eq('response_cards.text', winningCardText) // Ensure text matches
    .single();

  if (submissionError || !winningSubmissionData) {
    console.error(`🔴 WINNER (Server): Error finding winning submission for card text "${winningCardText}" in round ${game.current_round}:`, JSON.stringify(submissionError, null, 2));
    throw new Error(`Could not find submission matching card "${winningCardText}".`);
  }

  const winningPlayerId = winningSubmissionData.player_id;
  const winningResponseCardId = winningSubmissionData.response_card_id;

  // Increment winner's score
  const { data: winnerPlayerData, error: winnerPlayerFetchError } = await supabase
    .from('players')
    .select('score')
    .eq('id', winningPlayerId)
    .single();

  if (winnerPlayerFetchError || !winnerPlayerData) {
    console.error(`🔴 WINNER (Server): Error fetching winning player ${winningPlayerId} data:`, JSON.stringify(winnerPlayerFetchError, null, 2));
    throw new Error("Winning player record not found or error fetching.");
  }
  const newScore = winnerPlayerData.score + 1;

  const { error: scoreUpdateError } = await supabase
    .from('players')
    .update({ score: newScore })
    .eq('id', winningPlayerId);

  if (scoreUpdateError) {
    console.error(`🔴 WINNER (Server): Error updating score for player ${winningPlayerId}:`, JSON.stringify(scoreUpdateError, null, 2));
    // Consider whether to throw, but the game should probably proceed
  } else {
    console.log(`🔴 WINNER (Server): Player ${winningPlayerId} score updated to ${newScore}.`);
  }

  // Record the winner in the 'winners' table
  const { error: winnerInsertError } = await supabase
    .from('winners')
    .insert({
      game_id: gameId,
      round_number: game.current_round,
      winner_player_id: winningPlayerId,
      winning_response_card_id: winningResponseCardId, // Store the card ID
    });

  if (winnerInsertError) {
    console.error(`🔴 WINNER (Server): Error inserting round winner into 'winners' table:`, JSON.stringify(winnerInsertError, null, 2));
  }

  // Determine if game is over
  let newGamePhase: GamePhaseClientState = 'winner_announcement';
  let overallWinnerPlayerId: string | null = null;

  if (newScore >= POINTS_TO_WIN) {
    newGamePhase = 'game_over';
    overallWinnerPlayerId = winningPlayerId;
    console.log(`🔴 WINNER (Server): Player ${winningPlayerId} has reached ${newScore} points and won the game!`);
  }

  // Update game state
  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: newGamePhase,
    last_round_winner_player_id: winningPlayerId,
    last_round_winning_card_text: winningCardText, // Storing text for easy display
    overall_winner_player_id: overallWinnerPlayerId,
    updated_at: new Date().toISOString(),
  };

  const { error: gameUpdateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (gameUpdateError) {
    console.error(`🔴 WINNER (Server): Error updating game state for winner announcement:`, JSON.stringify(gameUpdateError, null, 2));
    throw new Error(`Failed to update game state after winner selection: ${gameUpdateError.message}`);
  }
  console.log(`🔴 WINNER (Server): Game ${gameId} moved to ${newGamePhase}. Winner of round ${game.current_round} is ${winningPlayerId}.`);

  revalidatePath('/game');
  return getGame(gameId); // Return updated game state
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 NEXT ROUND (Server): nextRound action called for game ${gameId}`);

  // Fetch current game state
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*') // Fetch all game fields
    .eq('id', gameId)
    .single();
  
  if (gameError || !game) {
    console.error(`🔴 NEXT ROUND (Server): Error fetching game ${gameId} for next round:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for next round: ${gameError?.message || 'Game not found'}`);
  }

  // If game is over, reset the game fully and redirect to lobby/setup
  if (game.game_phase === 'game_over') {
    console.log(`🔴 NEXT ROUND (Server): Game ${gameId} is over. Resetting to lobby.`);
    // This can call the more comprehensive resetGameForTesting or replicate its logic
    // For simplicity, we'll update the current game record to 'lobby' and clear related data.
    // A more complete reset might delete the game row and force creation of a new one.
    
    const updateData: TablesUpdate<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      current_judge_id: null,
      current_scenario_id: null,
      ready_player_order: [],
      last_round_winner_player_id: null,
      last_round_winning_card_text: null,
      overall_winner_player_id: null,
      used_scenarios: [], // Reset used cards/scenarios
      used_responses: [], // Reset used cards/scenarios
      updated_at: new Date().toISOString(),
    };
    const { error: resetToLobbyError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId);

    if (resetToLobbyError) {
      console.error(`🔴 NEXT ROUND (Server): Error resetting game ${gameId} to lobby after game_over:`, JSON.stringify(resetToLobbyError, null, 2));
      // Potentially throw, or try to proceed with client-side redirect
    }
    
    // Clear player-specific game data
    console.log(`🔴 NEXT ROUND (Server): Deleting related data for game ${gameId} (soft reset)...`);
    const tablesToClearForSoftReset = ['player_hands', 'responses', 'winners'];
    for (const table of tablesToClearForSoftReset) {
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) console.error(`🔴 NEXT ROUND (Server): Error deleting from ${table} for game_id ${gameId}: ${deleteError.message}`);
    }
    
    // Reset player scores and ready status for this game
    const { error: resetScoresError } = await supabase.from('players').update({ score: 0, is_ready: false, is_judge: false }).eq('game_id', gameId);
    if (resetScoresError) console.error(`🔴 NEXT ROUND (Server): Error resetting player scores for game ${gameId}: ${resetScoresError.message}`);

    revalidatePath('/');
    revalidatePath('/game');
    redirect('/?step=setup'); // Redirect to the main setup page
    return null; // Return null as we are redirecting
  }
  
  // If not game over, proceed to the next round
  if (game.game_phase !== 'winner_announcement') {
    console.warn(`🔴 NEXT ROUND (Server): nextRound called but game ${gameId} is in phase ${game.game_phase}, not 'winner_announcement'.`);
    // This might happen if called prematurely. Decide if to throw error or proceed.
    // For now, we'll allow it to proceed if it's not 'lobby' already.
    if (game.game_phase === 'lobby') {
         throw new Error("Cannot start next round from lobby. Game needs to be started first.");
    }
  }

  // Fetch players to determine next judge, ordered by when they joined for predictable rotation
  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id, joined_at, name') // Select only necessary fields
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true }); // Order by joined_at for consistent judge rotation

  if (playersFetchError || !players || players.length < 1) { // Need at least 1 player to continue (though typically 2 for a game)
    console.error(`🔴 NEXT ROUND (Server): Error fetching players or not enough players for game ${gameId}:`, JSON.stringify(playersFetchError, null, 2));
    throw new Error(`Not enough players for next round (found ${players?.length || 0}). Or ${playersFetchError?.message}`);
  }

  let nextJudgeId = game.current_judge_id;
  if (players.length > 0) { // Ensure there are players to pick from
    if (game.current_judge_id) {
      const currentJudgeIndex = players.findIndex(p => p.id === game.current_judge_id);
      if (currentJudgeIndex !== -1) {
        nextJudgeId = players[(currentJudgeIndex + 1) % players.length].id;
      } else {
        // Current judge not in the list (e.g., left game), assign first player
        nextJudgeId = players[0].id; 
        console.warn(`🔴 NEXT ROUND (Server): Current judge ${game.current_judge_id} not found or not in active players. Assigning first player ${players[0].name} (ID: ${nextJudgeId}).`);
      }
    } else {
      // No current judge (e.g., first round after lobby if judge wasn't set immediately)
      nextJudgeId = players[0].id; 
      console.warn(`🔴 NEXT ROUND (Server): No current judge assigned. Assigning first player ${players[0].name} (ID: ${nextJudgeId}).`);
    }
  } else if (nextJudgeId === null) { // Should not happen if players check above is robust
      console.error(`🔴 NEXT ROUND (Server): CRITICAL - No players and no current judge to assign from for game ${gameId}.`);
      throw new Error("No players available to assign a judge.");
  }
  
  const nextJudgePlayer = players.find(p => p.id === nextJudgeId);
  console.log(`🔴 NEXT ROUND (Server): Assigning player ${nextJudgePlayer?.name} (ID: ${nextJudgeId}) as the next judge for game ${gameId}.`);

  // The player who was judge previously doesn't need a new hand dealt here.
  // Their existing hand becomes active as they didn't play a card.
  // Players who submitted a card already received a replacement in submitResponse.

  // Update game state for the next round
  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: nextJudgeId,
    current_round: game.current_round + 1,
    current_scenario_id: null, // Clear scenario for new round
    last_round_winner_player_id: null, // Clear last winner details
    last_round_winning_card_text: null,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (updateError) {
    console.error(`🔴 NEXT ROUND (Server): Error updating game ${gameId} for next round: ${JSON.stringify(updateError, null, 2)}`);
    throw new Error(`Failed to update game state for next round: ${updateError.message}`);
  }
  console.log(`🔴 NEXT ROUND (Server): Game ${gameId} advanced to round ${game.current_round + 1}. Judge: ${nextJudgeId}, Phase: category_selection.`);

  revalidatePath('/game');
  return getGame(gameId); // Return the updated game state
}

export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  console.log(`DEBUG: getCurrentPlayer called for player ${playerId}, game ${gameId}`);
  const { data: playerData, error: playerFetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId) // Ensure player is part of the specified game
    .single();

  if (playerFetchError || !playerData) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching player ${playerId} for game ${gameId}:`, JSON.stringify(playerFetchError, null, 2));
    return undefined;
  }

  // Fetch game data to determine if this player is the current judge
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching game data for judge check (player ${playerId}, game ${gameId}):`, JSON.stringify(gameFetchError, null, 2));
    // Don't return undefined here; proceed with isJudge as false if gameData fetch fails
  }
  
  // Fetching cards for this player's hand
  let handCards: string[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_cards (text)') // Fetches { response_cards: { text: 'Card text' } } or { response_cards: null }
    .eq('player_id', playerId)
    .eq('game_id', gameId); // Ensure we only get hands for the current game

  if (handError) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    console.log(`DEBUG: getCurrentPlayer - Player ${playerId} Raw handData for game ${gameId}:`, JSON.stringify(handData, null, 2));
    handCards = handData
      .map((h: any) => h.response_cards?.text) // Safely access text
      .filter(text => text !== null && text !== undefined) as string[]; // Ensure only valid strings
  }
  console.log(`DEBUG: getCurrentPlayer - Player ${playerId} final hand for game ${gameId}: ${handCards.length} cards: ${JSON.stringify(handCards)}.`);

  return {
    id: playerData.id,
    name: playerData.name,
    avatar: playerData.avatar,
    score: playerData.score,
    isJudge: gameData ? playerData.id === gameData.current_judge_id : false,
    hand: handCards,
    isReady: playerData.is_ready,
  };
}
    

