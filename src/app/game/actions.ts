
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN, MIN_PLAYERS_TO_START } from '@/lib/types';


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
    // Don't throw, try to find any game or create one
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
    // Don't throw, try to create one
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
    current_round: 0,
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
    if (createError && createError.message.includes('RLS')) { 
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
      // Fallback to findOrCreateGame, but log that the specific fetch failed
      gameRow = await findOrCreateGame();
    } else if (!data) {
        console.warn(`🔴 GAME (Server): Game ${gameIdToFetch} not found. Falling back to findOrCreateGame.`);
        gameRow = await findOrCreateGame();
    } else {
      gameRow = data;
    }
  } else {
    gameRow = await findOrCreateGame();
  }
  
  if (!gameRow || !gameRow.id) {
    // This should ideally not happen if findOrCreateGame works
    console.error("🔴 GAME (Server): CRITICAL - Failed to find or create a game session in getGame.");
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;
  console.log(`DEBUG: getGame - Operating with gameId: ${gameId}`);


  let playersData: Tables<'players'>[] = [];
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error(`DEBUG: getGame - Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    if (playersError.message.includes('column players.game_id does not exist')) {
        console.error("🔴 CRITICAL SCHEMA ERROR: The 'players' table is missing the 'game_id' column. Please add it in your Supabase dashboard.");
    }
    // Don't throw, return empty players list if fetch fails
    playersData = []; 
  } else {
    playersData = fetchedPlayersData || [];
  }
  console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}: ${JSON.stringify(playersData.map(p => p.name))}`);


  const playerIds = playersData.map(p => p.id);
  let allHandsData: { player_id: string, response_card_id: string, response_cards: { text: string | null } | null }[] = [];
  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('player_id, response_card_id, response_cards (text)')
      .in('player_id', playerIds)
      .eq('game_id', gameId); 

    if (handsError) {
      console.error(`DEBUG: getGame - Error fetching hands for players in game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = fetchedHandsData || [];
      console.log(`DEBUG: getGame - Raw allHandsData for game ${gameId} (first 2 of ${allHandsData.length}):`, JSON.stringify(allHandsData.slice(0,2), null, 2));
    }
  }

  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards = allHandsData
      .filter(h => h.player_id === p.id && h.response_cards?.text)
      .map(h => h.response_cards!.text as string); 
    console.log(`DEBUG: getGame - Player ${p.name} (ID: ${p.id}) constructed hand: ${JSON.stringify(playerHandCards)}`);
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isJudge: p.id === gameRow.current_judge_id,
      hand: playerHandCards,
      isReady: p.is_ready,
    };
  });

  const { data: categoriesData, error: categoriesError } = await supabase
    .from('scenarios')
    .select('category'); 

  let categories: string[] = ["Default Category"]; // Fallback
  if (categoriesError) {
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  } else if (categoriesData) {
    const distinctCategories = [...new Set(categoriesData.map(c => c.category).filter(c => c !== null) as string[])];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
    }
  }

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
        category: scenarioData.category || 'Unknown', // Handle null category
        text: scenarioData.text,
      };
    }
  }

  let submissions: GameClientState['submissions'] = [];
  if (gameRow.game_phase === 'judging' && gameRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses') // This is the submissions table
      .select('player_id, response_card_id, response_cards(text)') // Assuming relation to response_cards
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('DEBUG: getGame - Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      console.log('DEBUG: getGame - Raw submissionData from Supabase (first 2):', JSON.stringify(submissionData.slice(0,2), null, 2)); 
      submissions = submissionData.map((s: any) => { // Use 'any' for now if exact type is complex
        const cardText = s.response_cards?.text || 'Error: Card text not found';
        if (!s.response_cards?.text) {
            console.warn(`DEBUG: getGame - Submission from player ${s.player_id} missing card text.`);
        }
        return {
          playerId: s.player_id,
          cardText: cardText,
        };
      });
      console.log('DEBUG: getGame - Processed submissions (first 2):', JSON.stringify(submissions.slice(0,2), null, 2));
    }
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
  console.log(`DEBUG: getGame - Returning GameClientState for gameId ${gameId} with phase: ${gameClientState.gamePhase}, ${gameClientState.players.length} players (${gameClientState.players.map(p => p.name).join(', ')}), and ${gameClientState.submissions.length} submissions.`);
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

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means "single row not found" which is okay
    console.error('🔴 PLAYER (Server): Error checking for existing player:', JSON.stringify(checkError, null, 2));
    throw new Error(`Error checking for existing player: ${checkError.message}`);
  }

  if (existingPlayer) {
    console.warn(`🔴 PLAYER (Server): Player with name ${name} already exists in game ${gameId}. Re-fetching full details.`);
    // Return the existing player's full details
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
    is_judge: false, // New players are not judges initially
    is_ready: false, // New players are not ready initially
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
    console.error('🔴 PLAYER (Server): New player data was null after insert, this should not happen.');
    throw new Error('Failed to add player, server returned no player data.');
  }
  console.log(`🔴 PLAYER (Server): Player ${name} added with ID ${newPlayer.id} to game ${gameId}`);

  revalidatePath('/'); 
  revalidatePath('/game'); 
  return newPlayer;
}


export async function resetGameForTesting() {
  console.log("🔴 RESET (Server): resetGameForTesting action called");
  let gameToReset: Tables<'games'> | null = null;

  try {
    console.log("🔴 RESET (Server): Finding the oldest game to reset...");
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase') // Select only necessary fields
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 RESET (Server): Exception during game fetch for reset:", fetchError.message, JSON.stringify(fetchError, null, 2));
      if (typeof fetchError.message === 'string' && fetchError.message.includes('NEXT_REDIRECT')) {
          // This is a special case for Next.js redirects, re-throw it.
          throw fetchError;
      }
      // For other errors, throw a new error or handle as appropriate for your app.
      throw new Error(`Exception during game fetch for reset: ${fetchError.message}`);
    }
    
    if (!existingGames || existingGames.length === 0) {
      console.log('🔴 RESET (Server): No existing game found to reset. A new game will be created on next load if needed.');
      revalidatePath('/');
      revalidatePath('/game');
      redirect('/?step=setup'); // Redirect to setup if no game to reset
      return; // Important to return to prevent further execution
    }
    
    gameToReset = existingGames[0];
    const gameId = gameToReset.id;
    console.log(`🔴 RESET (Server): Found game to reset: ID ${gameId}, Current Phase: ${gameToReset.game_phase}`);
    
    // Step 1: Clear foreign key references from 'games' to 'players'
    // This is crucial if players are deleted before the game row is updated, to avoid FK violations
    console.log(`🔴 RESET (Server): Clearing player references in game ${gameId}...`);
    const { error: clearPlayerRefsError } = await supabase
      .from('games')
      .update({
        current_judge_id: null,
        last_round_winner_player_id: null,
        overall_winner_player_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (clearPlayerRefsError) {
      console.error(`🔴 RESET (Server): Error clearing player references in game ${gameId}:`, JSON.stringify(clearPlayerRefsError, null, 2));
      // Potentially throw or handle, but for reset, we might want to proceed cautiously
    } else {
      console.log(`🔴 RESET (Server): Successfully cleared player references in game ${gameId}.`);
    }

    // Step 2: Delete related data
    console.log(`🔴 RESET (Server): Deleting related data for game ${gameId}...`);
    const tablesToClear = ['player_hands', 'responses', 'winners'];
    for (const table of tablesToClear) {
      console.log(`🔴 RESET (Server): Deleting from ${table} for game_id ${gameId}...`);
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) {
        console.error(`🔴 RESET (Server): Error deleting from ${table} for game_id ${gameId}:`, JSON.stringify(deleteError, null, 2));
        // Consider if failure here should stop the whole reset
      } else {
        console.log(`🔴 RESET (Server): Successfully deleted from ${table} for game_id ${gameId}.`);
      }
    }

    // Step 3: Delete players associated with this game
    console.log(`🔴 RESET (Server): Deleting players for game_id ${gameId}...`);
    const { error: playersDeleteError } = await supabase
      .from('players')
      .delete()
      .eq('game_id', gameId);

    if (playersDeleteError) {
      console.error(`🔴 RESET (Server): Error deleting players for game_id ${gameId}:`, JSON.stringify(playersDeleteError, null, 2));
      // Handle error: maybe throw, maybe log and continue if partial reset is acceptable
    } else {
      console.log(`🔴 RESET (Server): Successfully deleted players for game_id ${gameId}.`);
    }

    // For diagnostics: Check if players are actually gone
    const { data: remainingPlayers, error: checkPlayersError } = await supabase
      .from('players')
      .select('id, name')
      .eq('game_id', gameId);

    if (checkPlayersError) {
      console.error(`🔴 RESET (Server): Error checking remaining players for game_id ${gameId} after delete:`, JSON.stringify(checkPlayersError, null, 2));
    } else {
      console.log(`🔴 RESET (Server): Remaining players for game_id ${gameId} after delete attempt:`, JSON.stringify(remainingPlayers));
    }


    // Step 4: Reset the main game row to lobby state
    const updateData: TablesUpdate<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      current_scenario_id: null,
      // current_judge_id: null, // Already nulled above, but being explicit is fine
      ready_player_order: [],
      // last_round_winner_player_id: null, // Already nulled
      last_round_winning_card_text: null,
      // overall_winner_player_id: null, // Already nulled
      used_scenarios: [], 
      used_responses: [],
      updated_at: new Date().toISOString(),
       // Ensure these are explicitly nulled again after player deletion
      current_judge_id: null,
      last_round_winner_player_id: null,
      overall_winner_player_id: null,
    };
    console.log(`🔴 RESET (Server): Attempting to update game ${gameId} to lobby phase with data:`, JSON.stringify(updateData, null, 2));

    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to update game ${gameId} to lobby phase:`, JSON.stringify(updateError, null, 2));
      // This is a critical failure; the game might be in an inconsistent state.
      throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
    } else {
      console.log(`🔴 RESET (Server): Game ${gameId} successfully updated to lobby phase.`);
      console.log("🔴 RESET (Server): Updated game details:", JSON.stringify(updatedGame, null, 2));
    }
    
    // Verification step
    const { data: verifiedGame, error: verifyError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (verifyError) {
      console.error(`🔴 RESET (Server): Error verifying reset for game ${gameId}:`, JSON.stringify(verifyError, null, 2));
    } else if (verifiedGame) {
      console.log(`🔴 RESET (Server): Verification - Game ${gameId} phase is now: ${verifiedGame.game_phase}`);
      const { data: finalPlayersCheck, error: finalPlayersError } = await supabase.from('players').select('id').eq('game_id', gameId);
      console.log(`🔴 RESET (Server): Verification - Players for game ${gameId} after full reset: ${finalPlayersCheck?.length || 0}`);
      if (finalPlayersError) console.error(`🔴 RESET (Server): Verification - Error fetching final players: ${JSON.stringify(finalPlayersError)}`);

    } else {
      // This case means the game might have been deleted if logic changed.
      console.warn(`🔴 RESET (Server): Verification - Game ${gameId} not found after update attempt. This implies it might have been deleted if logic changed.`);
    }

  } catch (e: any) {
    // Catch any unexpected errors during the process
    console.error('🔴 RESET (Server): Unexpected exception during reset process:', e.message, e.stack);
    // If it's a NEXT_REDIRECT, re-throw it.
    if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e; // This re-throws the special redirect error.
    }
    // Avoid throwing a new generic error if it's already a redirect
    if (!(typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT'))) { 
        throw new Error(`Unexpected error during reset: ${e.message || 'Unknown error'}`);
    }
  }

  // If we reach here, the reset (or attempt) is done.
  console.log('🔴 RESET (Server): Reset process complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup'); // Redirect to the setup page
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  console.log(`🔴 CARDS (Server): Dealing ${count} cards for game ${gameId}. Current existingUsedResponses count: ${existingUsedResponses.length}`);

  // Fetch the game's current used_responses to ensure we have the most up-to-date list.
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('used_responses')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`🔴 CARDS (Server): Error fetching game data for dealing cards (game ${gameId}):`, gameFetchError);
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }
  
  // Combine the game's master list of used responses with any used in this specific dealing operation so far.
  const currentUsedResponsesInGame = gameData.used_responses || [];
  const allKnownUsedResponses = [...new Set([...currentUsedResponsesInGame, ...existingUsedResponses])];
  console.log(`🔴 CARDS (Server): Total known used cards (DB master list + this operation's existing) for game ${gameId}: ${allKnownUsedResponses.length}`);

  let query = supabase
    .from('response_cards')
    .select('id')
    .eq('is_active', true);
  
  if (allKnownUsedResponses.length > 0) {
    // Ensure all IDs passed to .not('id', 'in', ...) are valid UUIDs.
    // Supabase/Postgres might error if non-UUIDs are in the list.
    const validUUIDs = allKnownUsedResponses.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
        query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    } else {
        console.log(`🔴 CARDS (Server): No valid UUIDs in allKnownUsedResponses to filter by for game ${gameId}. Fetching any active card.`);
    }
  } else {
    console.log(`🔴 CARDS (Server): No known used responses for game ${gameId}. Fetching any active card.`);
  }


  // Fetch more cards than needed to allow for random selection if count is low,
  // or if many cards are coincidentally returned in a non-random order by DB.
  const { data: availableCards, error: fetchError } = await query.limit(count + 50); // Fetch a buffer

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  if (!availableCards || availableCards.length === 0) {
    console.warn(`🔴 CARDS (Server): No available response cards to deal for game ${gameId} after filtering. Total known used: ${allKnownUsedResponses.length}. Attempted to deal ${count}.`);
    // This might happen if all cards are used up.
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }
  console.log(`🔴 CARDS (Server): Found ${availableCards.length} potentially available cards for game ${gameId} before shuffling (need ${count}).`);
  
  // Shuffle the fetched available cards to ensure randomness if limit was low or DB order was not random.
  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  
  // Update the list of responses used *within this dealing operation* to include newly dealt cards.
  const newlyDealtAndUsedInThisOperation = [...new Set([...existingUsedResponses, ...dealtCardIds])];

  console.log(`🔴 CARDS (Server): Dealt ${dealtCardIds.length} cards for game ${gameId}: ${JSON.stringify(dealtCardIds)}. New total used_responses count for this operation (passed in + newly dealt): ${newlyDealtAndUsedInThisOperation.length}`);
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
      .select('id, name, is_ready, joined_at') // ensure joined_at is fetched for ordering
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true }); // Order by joined_at to get the first player

    if (playersFetchError || !players) {
      console.error(`🔴 START (Server): Error fetching players for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)}`);
      throw new Error(`Failed to fetch players for start: ${playersFetchError?.message || 'No players found'}`);
    }
    if (players.length < MIN_PLAYERS_TO_START) {
      console.warn(`🔴 START (Server): Not enough players to start game ${gameId}. Found ${players.length}, need ${MIN_PLAYERS_TO_START}.`);
      throw new Error(`Not enough players to start game (found ${players.length}, need at least ${MIN_PLAYERS_TO_START}).`);
    }
    
    const firstJudgeId = players[0].id; // First player who joined becomes the first judge
    console.log(`🔴 START (Server): Assigning player ${players[0].name} (ID: ${firstJudgeId}) as the first judge for game ${gameId}`);

    // Initialize a list to accumulate all cards used *during this game start operation*.
    // Start with cards already marked as used in the game, if any (e.g., from a previous aborted start).
    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];
    console.log(`🔴 START (Server) CARDS: Initial master used_responses for game ${gameId} before dealing: ${accumulatedUsedResponsesForThisGameStart.length}`);

    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    for (const player of players) {
      // Deal cards to ALL players, including the judge. Judge's hand is conceptually hidden.
      console.log(`🔴 START (Server) CARDS: Attempting to deal ${CARDS_PER_HAND} cards to player ${player.name} (ID: ${player.id})`);
      const { dealtCardIds, updatedUsedResponses: tempUsedAfterThisPlayer } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);
      
      console.log(`🔴 START (Server) CARDS: For player ${player.name}, dealCardsFromSupabase returned ${dealtCardIds.length} cards. IDs: ${JSON.stringify(dealtCardIds)}`);

      if (dealtCardIds.length > 0) {
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
          });
        });
        // Update the master list of cards used *in this game start operation* with the cards just dealt.
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
        // Depending on desired robustness, might throw error or try to rollback/cleanup
      } else {
        console.log(`🔴 START (Server) CARDS: Successfully batch inserted ${playerHandInserts.length} cards into player_hands.`);
      }
    } else {
      console.warn(`🔴 START (Server) CARDS: No cards to insert into player_hands for any player.`);
    }

    // Update the game state to start.
    // The `used_responses` in the game table is updated with ALL cards dealt in this operation.
    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: firstJudgeId,
      current_round: 1, // Starting round 1
      updated_at: new Date().toISOString(),
      used_responses: accumulatedUsedResponsesForThisGameStart, // Persist all cards used in this deal
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
     // Game is not in lobby, perhaps already started or in another state.
     console.warn(`🔴 START (Server): startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); // Return the updated game state
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔴 CATEGORY (Server): selectCategory action for game ${gameId}, category ${category}`);
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('used_scenarios, current_judge_id') // Fetch current judge to ensure action is valid
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 CATEGORY (Server): Error fetching game ${gameId} for category selection:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  // TODO: Add a check to ensure the player calling this action is the current_judge_id

  const usedScenarios = game.used_scenarios || [];
  
  let query = supabase
    .from('scenarios')
    .select('id, text, category'); // Fetch all necessary fields
  
  query = query.eq('category', category);

  if (usedScenarios.length > 0) {
    // Ensure usedScenarios are valid UUIDs before using in query
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
    // No unused scenarios in this category, try to fetch ANY scenario from this category (recycling)
    console.warn(`🔴 CATEGORY (Server): No unused scenarios for category ${category}. Attempting to fetch ANY scenario from this category (recycling).`);
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase
      .from('scenarios')
      .select('id, text, category')
      .eq('category', category);

    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 CATEGORY (Server): Critical - No scenarios found for category ${category} at all, even for recycling.`, JSON.stringify(anyCategoryError, null, 2));
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    // Pick a random one from all available in the category
    console.warn(`🔴 CATEGORY (Server): Re-using scenarios for category ${category} as all were marked used or none found initially.`);
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
     // When recycling, we don't add to used_scenarios, or we'd quickly run out again if list is small.
     // Or, clear used_scenarios for this category if we want to start "fresh" for this category.
     // For now, just use it without updating used_scenarios.
     const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      updated_at: new Date().toISOString(),
    };
     const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
     if (updateError) throw new Error(`Failed to update game after category selection (recycle): ${updateError.message}`);
     console.log(`🔴 CATEGORY (Server): Game ${gameId} moved to player_submission with RECYCLED scenario ${scenarioToUse.id}`);
  } else {
    // We have unused scenarios, pick one randomly
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
    const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])]; // Add new scenario to used list
    const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      used_scenarios: updatedUsedScenarios,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) {
      console.error(`🔴 CATEGORY (Server): Error updating game after category selection:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game after category selection: ${updateError.message}`);
    }
    console.log(`🔴 CATEGORY (Server): Game ${gameId} moved to player_submission with scenario ${scenarioToUse.id}`);
  }
  
  revalidatePath('/game');
  return getGame(gameId); // Return the updated game state
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`🔴 SUBMIT (Server): Player ${playerId} submitting card text "${responseCardText}" for game ${gameId} round ${currentRound}`);
  
  // Fetch game data to check phase and current judge
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

  // Prevent judge from submitting
  if (playerId === gameData.current_judge_id) {
    console.warn(`🔴 SUBMIT (Server): Judge ${playerId} attempted to submit a card. This is not allowed.`);
    throw new Error("Judges cannot submit response cards.");
  }

  // Find the response_card_id from player's hand based on text
  const { data: handCardEntry, error: handQueryError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards!inner(text)') // Ensure 'response_cards' is the correct related table name if using shorthand
    .eq('player_id', playerId)
    .eq('game_id', gameId) // Also filter by game_id for safety
    .eq('response_cards.text', responseCardText) // Filter by text
    .limit(1) // Should only be one such card if hands are unique
    .single();

  if (handQueryError || !handCardEntry) {
    console.error(`🔴 SUBMIT (Server): Error finding card with text "${responseCardText}" in hand of player ${playerId} for game ${gameId}:`, JSON.stringify(handQueryError, null, 2));
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
    .maybeSingle(); // Use maybeSingle to not error if no submission found

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

  // Remove card from player's hand
  console.log(`🔴 SUBMIT (Server): Deleting card ${responseCardId} from hand of ${playerId} (game ${gameId}).`);
  const { error: deleteHandError } = await supabase
    .from('player_hands')
    .delete()
    .eq('player_id', playerId)
    .eq('response_card_id', responseCardId)
    .eq('game_id', gameId); // Important: ensure game_id is part of the condition

  if (deleteHandError) {
    console.error(`🔴 SUBMIT (Server): Error deleting card ${responseCardId} from hand of ${playerId}:`, JSON.stringify(deleteHandError, null, 2));
    // Non-critical for submission itself, but needs monitoring
  } else {
    console.log(`🔴 SUBMIT (Server): Successfully deleted card ${responseCardId} from hand of ${playerId}.`);
  }

  // Deal a new card to the player
  let gameUsedResponses = gameData.used_responses || [];
  console.log(`🔴 SUBMIT (Server) CARDS: Player ${playerId} played card ${responseCardId}. Initial game.used_responses length: ${gameUsedResponses.length}`);
  
  // The card played is now "used" for the game, preventing it from being dealt again.
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
      });
    if (newCardInsertError) {
      console.error(`🔴 SUBMIT (Server) CARDS: Error dealing new card to player ${playerId}:`, JSON.stringify(newCardInsertError, null, 2));
    } else {
      console.log(`🔴 SUBMIT (Server) CARDS: Successfully dealt new card ${newCardId} to player ${playerId}.`);
    }
  } else {
    console.warn(`🔴 SUBMIT (Server) CARDS: Could not deal new card to player ${playerId}, no cards available or error in dealCardsFromSupabase.`);
  }
  
  // Update the game's master list of used response cards
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
    .neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000'); // Exclude current judge

  if (playersError || !nonJudgePlayers) {
    console.error('🔴 SUBMIT (Server): Error fetching non-judge players count:', JSON.stringify(playersError, null, 2));
    throw new Error(`Failed to fetch players for submission check: ${playersError?.message || 'No non-judge players found'}`);
  }
  const totalNonJudgePlayers = nonJudgePlayers.length;


  const { count: submissionsCount, error: submissionsError } = await supabase
    .from('responses')
    .select('player_id', { count: 'exact', head: true }) // Use head:true for count-only
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
      // Potentially throw, or let client re-fetch and see current state
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
    .select('current_round, current_judge_id') // Fetch necessary fields
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 WINNER (Server): Error fetching game ${gameId}:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);
  }
  
  // Find the submission that matches the winning card text for the current round
  const { data: winningSubmissionData, error: submissionError } = await supabase
    .from('responses')
    .select('player_id, response_card_id, response_cards!inner(text)') // Assuming relation and text column
    .eq('game_id', gameId)
    .eq('round_number', game.current_round)
    .eq('response_cards.text', winningCardText) // Filter by text
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
    // Non-critical for game flow to stop, but needs logging
  } else {
    console.log(`🔴 WINNER (Server): Player ${winningPlayerId} score updated to ${newScore}.`);
  }

  // Record the round winner in the 'winners' table
  const { error: winnerInsertError } = await supabase
    .from('winners')
    .insert({
      game_id: gameId,
      round_number: game.current_round,
      winner_player_id: winningPlayerId,
      winning_response_card_id: winningResponseCardId, // Store the ID
    });

  if (winnerInsertError) {
    console.error(`🔴 WINNER (Server): Error inserting round winner into 'winners' table:`, JSON.stringify(winnerInsertError, null, 2));
    // Log and continue
  }

  // Update game state for winner announcement / game over
  let newGamePhase: GamePhaseClientState = 'winner_announcement';
  let overallWinnerPlayerId: string | null = null;

  if (newScore >= POINTS_TO_WIN) {
    newGamePhase = 'game_over';
    overallWinnerPlayerId = winningPlayerId;
    console.log(`🔴 WINNER (Server): Player ${winningPlayerId} has reached ${newScore} points and won the game!`);
  }

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: newGamePhase,
    last_round_winner_player_id: winningPlayerId,
    last_round_winning_card_text: winningCardText, // Store text for display
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

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*') // Fetch all game data to make decisions
    .eq('id', gameId)
    .single();
  
  if (gameError || !game) {
    console.error(`🔴 NEXT ROUND (Server): Error fetching game ${gameId} for next round:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for next round: ${gameError?.message || 'Game not found'}`);
  }

  // If game is over, resetGameForTesting will handle redirect to lobby
  if (game.game_phase === 'game_over') {
    console.log(`🔴 NEXT ROUND (Server): Game ${gameId} is over. Calling resetGameForTesting to prepare for new game.`);
    try {
      await resetGameForTesting(); // This action includes a redirect
      // resetGameForTesting handles the redirect, so this return might not be reached if redirect occurs.
      // However, returning null is safe as the client should handle navigation based on the redirect.
      return null; 
    } catch (e: any) {
      // If resetGameForTesting throws (including a NEXT_REDIRECT), re-throw it.
      console.error(`🔴 NEXT ROUND (Server): Error during resetGameForTesting call:`, e);
      throw e; // This will propagate the error (or redirect signal)
    }
  }
  
  // Ensure we're in the correct phase to proceed to the next round
  if (game.game_phase !== 'winner_announcement') {
    console.warn(`🔴 NEXT ROUND (Server): nextRound called but game ${gameId} is in phase ${game.game_phase}, not 'winner_announcement'. Re-fetching state.`);
    revalidatePath('/game');
    return getGame(gameId); // Just return current state
  }

  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id, joined_at, name') // Fetch name for logging
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true }); // Order by joined_at for judge rotation

  if (playersFetchError || !players || players.length < 1) { // Need at least one player to continue
    console.error(`🔴 NEXT ROUND (Server): Error fetching players or not enough players for game ${gameId}:`, JSON.stringify(playersFetchError, null, 2));
    throw new Error(`Not enough players for next round (found ${players?.length || 0}). Or ${playersFetchError?.message}`);
  }

  // Determine next judge
  let nextJudgeId: string | null = game.current_judge_id; // Start with current judge
  const previousJudgeId: string | null = game.current_judge_id;

  if (players.length > 0) { // Should always be true if we got this far
    if (game.current_judge_id) {
      const currentJudgeIndex = players.findIndex(p => p.id === game.current_judge_id);
      if (currentJudgeIndex !== -1) {
        nextJudgeId = players[(currentJudgeIndex + 1) % players.length].id;
      } else {
        // Current judge not found in list (e.g., if they left), assign first player
        nextJudgeId = players[0].id; 
        console.warn(`🔴 NEXT ROUND (Server): Current judge ${game.current_judge_id} not found in active players list. Assigning first player ${players[0].name} (ID: ${nextJudgeId}).`);
      }
    } else {
      // No current judge assigned (shouldn't happen in normal flow after first round)
      nextJudgeId = players[0].id; 
      console.warn(`🔴 NEXT ROUND (Server): No current judge assigned. Assigning first player ${players[0].name} (ID: ${nextJudgeId}).`);
    }
  } else if (nextJudgeId === null) { // Should be caught by players.length < 1 already
      console.error(`🔴 NEXT ROUND (Server): CRITICAL - No players and no current judge to assign from for game ${gameId}.`);
      throw new Error("No players available to assign a judge.");
  }
  
  const nextJudgePlayer = players.find(p => p.id === nextJudgeId);
  console.log(`🔴 NEXT ROUND (Server): Assigning player ${nextJudgePlayer?.name} (ID: ${nextJudgeId}) as the next judge for game ${gameId}.`);

  // Previous judge (who is now a player) already has a full hand from the initial deal
  // and did not play a card. No new card dealing needed for them here.

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: nextJudgeId,
    current_round: game.current_round + 1,
    current_scenario_id: null, // Clear scenario for new round
    last_round_winner_player_id: null, // Clear last round winner details
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
  return getGame(gameId); // Return the new state
}

export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  const { data: playerData, error: playerFetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId) // Ensure player is part of this game
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

  if (gameFetchError) { // Log error but don't necessarily fail if game data fetch has issues
    console.error(`DEBUG: getCurrentPlayer - Error fetching game data for judge check (player ${playerId}, game ${gameId}):`, JSON.stringify(gameFetchError, null, 2));
  }
  
  // Fetch player's hand
  let handCards: string[] = [];
  console.log(`DEBUG: getCurrentPlayer - Fetching hand for player ${playerId} game ${gameId}.`);
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_cards (text)') // Joins with response_cards to get text
    .eq('player_id', playerId)
    .eq('game_id', gameId); // Ensure hand is for current game

  if (handError) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    console.log(`DEBUG: getCurrentPlayer - Player ${playerId} Raw handData for game ${gameId} (first 2 of ${handData.length}):`, JSON.stringify(handData.slice(0,2), null, 2)); 
    handCards = handData
      .map((h: any) => h.response_cards?.text) // Safely access text
      .filter(text => text !== null && text !== undefined) as string[]; // Filter out nulls/undefineds
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

export async function togglePlayerReadyStatus(playerId: string, gameId: string): Promise<GameClientState | null> {
  // Fetch the current player's ready status first
  const { data: player, error: playerFetchError } = await supabase
    .from('players')
    .select('is_ready')
    .eq('id', playerId)
    .eq('game_id', gameId) // ensure we're acting on the player in the correct game
    .single();

  if (playerFetchError || !player) {
    console.error(`🔴 READY (Server): Error fetching player ${playerId} to toggle ready status:`, JSON.stringify(playerFetchError, null, 2));
    throw new Error(`Failed to fetch player to toggle ready status: ${playerFetchError?.message || 'Player not found'}`);
  }
  const currentIsReady = player.is_ready;
  const newReadyStatus = !currentIsReady;
  console.log(`🔴 READY (Server): Player ${playerId} in game ${gameId} toggling ready status from ${currentIsReady} to ${newReadyStatus}`);

  // Update player's ready status
  const { data: updatedPlayer, error: playerUpdateError } = await supabase
    .from('players')
    .update({ is_ready: newReadyStatus })
    .eq('id', playerId)
    .eq('game_id', gameId)
    .select('id, is_ready') // Select only what's needed for confirmation
    .single();

  if (playerUpdateError || !updatedPlayer) {
    console.error(`🔴 READY (Server): Error updating player ${playerId} ready status:`, JSON.stringify(playerUpdateError, null, 2));
    throw new Error(`Failed to update player ready status: ${playerUpdateError?.message || 'Player not found or error during update'}`);
  }
  console.log(`🔴 READY (Server): Player ${playerId} status updated to is_ready: ${updatedPlayer.is_ready}`);


  // Update ready_player_order in games table
  const { data: game, error: gameFetchError } = await supabase
    .from('games')
    .select('ready_player_order, game_phase')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !game) {
    console.error(`🔴 READY (Server): Error fetching game ${gameId} to update ready_player_order:`, JSON.stringify(gameFetchError, null, 2));
    // Don't throw, but log error. The player status is updated, but order might be affected.
  } else {
    let currentReadyOrder = game.ready_player_order || [];
    if (newReadyStatus) {
      // Add player to ready_player_order if not already present
      if (!currentReadyOrder.includes(playerId)) {
        currentReadyOrder.push(playerId);
      }
    } else {
      // Remove player from ready_player_order
      currentReadyOrder = currentReadyOrder.filter(id => id !== playerId);
    }
    const { error: gameOrderUpdateError } = await supabase
      .from('games')
      .update({ ready_player_order: currentReadyOrder, updated_at: new Date().toISOString() })
      .eq('id', gameId);

    if (gameOrderUpdateError) {
      console.error(`🔴 READY (Server): Error updating ready_player_order for game ${gameId}:`, JSON.stringify(gameOrderUpdateError, null, 2));
    } else {
      console.log(`🔴 READY (Server): Game ${gameId} ready_player_order updated to:`, currentReadyOrder);

      // Check if game should start automatically
      if (game.game_phase === 'lobby' && newReadyStatus) { // only try to auto-start if player became ready
        const { data: allPlayers, error: allPlayersError } = await supabase
          .from('players')
          .select('id, is_ready')
          .eq('game_id', gameId);

        if (allPlayersError) {
          console.error(`🔴 READY (Server): Error fetching all players for auto-start check:`, JSON.stringify(allPlayersError, null, 2));
        } else if (allPlayers && allPlayers.length >= MIN_PLAYERS_TO_START) {
          const allActuallyReady = allPlayers.every(p => p.is_ready);
          if (allActuallyReady) {
            console.log(`🔴 READY (Server): All ${allPlayers.length} players are ready. Automatically starting game ${gameId}.`);
            try {
              // Directly call startGame without awaiting its full client state return if not needed immediately.
              // The revalidatePath in startGame should trigger client updates.
              await startGame(gameId); // This will also revalidate and return the new game state if needed elsewhere
              console.log(`🔴 READY (Server): Game ${gameId} auto-started successfully by togglePlayerReadyStatus.`);
            } catch (startError: any) {
              console.error(`🔴 READY (Server): Error auto-starting game ${gameId}:`, startError.message, JSON.stringify(startError, null, 2));
              // Potentially revert player's ready status or notify client if auto-start fails
            }
          } else {
            console.log(`🔴 READY (Server): Not all players are ready for game ${gameId}. Waiting for more. (${allPlayers.filter(p=>p.is_ready).length}/${allPlayers.length})`);
          }
        } else {
          console.log(`🔴 READY (Server): Not enough players to start game ${gameId} (${allPlayers?.length || 0}/${MIN_PLAYERS_TO_START}).`);
        }
      }
    }
  }
  
  revalidatePath('/'); 
  revalidatePath('/game'); 
  
  // Return the full game state to update the client
  return getGame(gameId);
}
    

    
