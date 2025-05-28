
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

// Helper function to find or create a game session
async function findOrCreateGame(): Promise<Tables<'games'>> {
  let game: Tables<'games'> | null = null;
  console.log('DEBUG: findOrCreateGame called');

  // Try to find the OLDEST existing game
  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error('DEBUG: Error fetching existing games:', JSON.stringify(fetchError, null, 2));
    throw new Error(`Could not fetch game data. Supabase error: ${fetchError.message}`);
  }

  if (existingGames && existingGames.length > 0) {
    game = existingGames[0];
    console.log(`DEBUG: Found oldest existing game with ID: ${game.id}`);
  } else {
    console.log('DEBUG: No existing game found, creating a new one.');
    const newGameData: TablesInsert<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      ready_player_order: [],
      used_scenarios: [],
      used_responses: [],
      // Ensure all non-nullable fields without a DB-level default are covered
      // or ensure DB defaults are robust (e.g., for created_at, updated_at if not auto by Supabase)
    };
    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert(newGameData)
      .select()
      .single();

    if (insertError || !newGame) {
      console.error('DEBUG: Error creating new game:', JSON.stringify(insertError, null, 2));
      const supabaseErrorMessage = insertError ? insertError.message : "New game data was unexpectedly null after insert operation.";
      throw new Error(`Could not create a new game. Supabase error: ${supabaseErrorMessage}`);
    }
    game = newGame;
    console.log(`DEBUG: Created new game with ID: ${game.id}`);
  }
  if (!game) { 
    throw new Error('CRITICAL: findOrCreateGame failed to return a game object.');
  }
  return game;
}


export async function getGame(): Promise<GameClientState> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
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
    if (playersError.message.includes("column players.game_id does not exist")) {
        console.error("CRITICAL SCHEMA ISSUE: The 'players' table is missing the 'game_id' column. Please add it in Supabase. Proceeding with empty player list for now.");
        playersData = []; // Proceed with empty players to allow UI to load
    } else {
        console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
        throw new Error(`Could not fetch players. Supabase error: ${playersError.message}`);
    }
  } else {
    playersData = fetchedPlayersData || [];
    console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}:`, JSON.stringify(playersData.map(p=>p.name)));
  }

  const players: PlayerClientState[] = playersData.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isJudge: p.id === gameRow.current_judge_id,
        hand: [], // Hand will be populated by getCurrentPlayer or a dedicated hand-dealing function
        isReady: p.is_ready,
      }));

  const { data: categoriesData, error: categoriesError } = await supabase
    .from('scenarios')
    .select('category');

  if (categoriesError) {
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  }
  const categories = categoriesData && categoriesData.length > 0
    ? [...new Set(categoriesData.map(c => c.category).filter(c => c !== null) as string[])]
    : ["Default Category"]; // Provide a default if categories fail to load

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
        category: scenarioData.category || 'Unknown', // Handle null category gracefully
        text: scenarioData.text,
      };
    }
  }

  let submissions: GameClientState['submissions'] = [];
  if (gameRow.game_phase === 'judging' && gameRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses')
      .select('player_id, response_cards(text)') // Assuming responses table has a FK to response_cards
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      submissions = submissionData.map((s: any) => ({ // Adjust 'any' based on actual joined structure
        playerId: s.player_id,
        cardText: s.response_cards?.text || 'Error: Card text not found',
      }));
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
    gamePhase: gameRow.game_phase as GameClientState['gamePhase'],
    submissions: submissions, 
    categories: categories,
    readyPlayerOrder: gameRow.ready_player_order || [],
    lastWinner: lastWinnerDetails,
    winningPlayerId: gameRow.overall_winner_player_id,
  };
  console.log(`DEBUG: getGame - Returning GameClientState for gameId ${gameId} with phase: ${gameClientState.gamePhase}`);
  return gameClientState;
}

export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    console.error('Failed to find or create a game session for adding player.');
    return null;
  }
  const gameId = gameRow.id;
  console.log(`DEBUG: addPlayer called for game ID: ${gameId}, player: ${name}`);

  // Check if player with the same name already exists in this game
  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: " esattamente una riga prevista, ma ne sono state trovate 0" (exactly one row expected, but 0 found)
    console.error('Error checking for existing player:', JSON.stringify(checkError, null, 2));
    return null;
  }
  if (existingPlayer) {
    console.warn(`Player with name ${name} already exists in game ${gameId}. Re-fetching the player.`);
    // If player exists, just return their data instead of creating a new one
    // This prevents duplicate players if multiple join attempts happen.
    const { data: fullExistingPlayer, error: fetchExistingError } = await supabase
        .from('players')
        .select('*')
        .eq('id', existingPlayer.id)
        .single();
    if (fetchExistingError) {
        console.error('Error re-fetching existing player:', JSON.stringify(fetchExistingError, null, 2));
        return null;
    }
    return fullExistingPlayer;
  }

  const newPlayerData: TablesInsert<'players'> = {
    game_id: gameId,
    name,
    avatar,
    score: 0,
    is_judge: false, // Default value
    is_ready: false, // Default value
    // joined_at will be set by default in DB
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('Error adding new player:', JSON.stringify(insertError, null, 2));
    return null;
  }
  console.log(`DEBUG: Player ${name} added with ID ${newPlayer?.id} to game ${gameId}`);

  revalidatePath('/');
  revalidatePath('/game');
  return newPlayer;
}

export async function resetGameForTesting(): Promise<void> {
  console.log('🔴 RESET (Server): resetGameForTesting action called');
  
  // Step 1: Find the oldest existing game to reset
  let gameToReset: Tables<'games'> | null = null;
  try {
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id') // Only select id, we don't need full row yet
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('🔴 RESET (Server): Error fetching game to reset:', JSON.stringify(fetchError, null, 2));
      // Don't throw, try to redirect to allow user to retry or see a potentially fixed state
      redirect('/?step=setup');
      return;
    }
    if (existingGames && existingGames.length > 0) {
      gameToReset = existingGames[0];
      console.log(`🔴 RESET (Server): Found game to reset with ID: ${gameToReset.id}`);
    } else {
      console.log('🔴 RESET (Server): No existing game found to reset. Game might already be clean.');
      // If no game exists, there's nothing to reset. Redirect to setup.
      revalidatePath('/'); 
      revalidatePath('/game');
      redirect('/?step=setup');
      return;
    }
  } catch (e: any) {
    console.error('🔴 RESET (Server): Exception during game fetch for reset:', e.message);
    redirect('/?step=setup');
    return;
  }

  if (!gameToReset || !gameToReset.id) {
    console.error('🔴 RESET (Server): CRITICAL - Could not identify a game to reset after fetch logic.');
    redirect('/?step=setup');
    return;
  }
  
  const gameId = gameToReset.id;
  console.log(`🔴 RESET (Server): Resetting game with ID: ${gameId}`);

  // Step 2: Delete related data
  try {
    console.log(`🔴 RESET (Server): Deleting players for game ${gameId}...`);
    const { error: deletePlayersError } = await supabase.from('players').delete().eq('game_id', gameId);
    if (deletePlayersError) console.error('🔴 RESET (Server): Error deleting players:', JSON.stringify(deletePlayersError, null, 2));
    else console.log(`🔴 RESET (Server): Players deleted for game ${gameId}.`);

    console.log(`🔴 RESET (Server): Deleting player hands for game ${gameId}...`);
    const { error: deleteHandsError } = await supabase.from('player_hands').delete().eq('game_id', gameId);
    if (deleteHandsError) console.error('🔴 RESET (Server): Error deleting player hands:', JSON.stringify(deleteHandsError, null, 2));
    else console.log(`🔴 RESET (Server): Player hands deleted for game ${gameId}.`);

    console.log(`🔴 RESET (Server): Deleting responses for game ${gameId}...`);
    const { error: deleteResponsesError } = await supabase.from('responses').delete().eq('game_id', gameId);
    if (deleteResponsesError) console.error('🔴 RESET (Server): Error deleting responses:', JSON.stringify(deleteResponsesError, null, 2));
    else console.log(`🔴 RESET (Server): Responses deleted for game ${gameId}.`);
    
    console.log(`🔴 RESET (Server): Deleting winners for game ${gameId}...`);
    const { error: deleteWinnersError } = await supabase.from('winners').delete().eq('game_id', gameId);
    if (deleteWinnersError) console.error('🔴 RESET (Server): Error deleting winners:', JSON.stringify(deleteWinnersError, null, 2));
    else console.log(`🔴 RESET (Server): Winners deleted for game ${gameId}.`);

  } catch (e: any) {
    console.error('🔴 RESET (Server): Exception during data deletion:', e.message);
    // Continue to game update attempt
  }

  // Step 3: Update the game row itself
  const updatedGameData: TablesUpdate<'games'> = {
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
    updated_at: new Date().toISOString(), // Explicitly set updated_at
  };

  console.log(`🔴 RESET (Server): Attempting to update game ${gameId} to lobby phase.`);
  const { error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId);

  if (updateGameError) {
    console.error('🔴 RESET (Server): CRITICAL ERROR: Failed to update game to lobby phase during reset:', JSON.stringify(updateGameError, null, 2));
  } else {
    console.log(`🔴 RESET (Server): Game ${gameId} successfully updated to lobby phase after reset operations.`);
  }

  console.log('🔴 RESET (Server): Game reset operations complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}


export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: startGame action called for game ${gameId}`);

  const { data: game, error: gameFetchError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !game) {
    console.error(`Error fetching game ${gameId} for startGame: ${JSON.stringify(gameFetchError, null, 2)}`);
    return getGame(); // Fallback to fetching current game state
  }

  if (game.game_phase !== 'lobby') {
    console.warn(`DEBUG: startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
    return getGame(); // Game already started or in a different phase
  }

  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true }); // Or use 'joined_at' if more appropriate

  if (playersFetchError || !players || players.length < 2) { // Assuming min 2 players
    console.error(`Error fetching players or not enough players for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
    // Potentially notify user on client-side if this is the issue
    return getGame();
  }

  // Simple judge assignment: first player in the list
  const firstJudgeId = players[0].id;
  console.log(`DEBUG: Assigning player ${firstJudgeId} as the first judge for game ${gameId}`);

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: firstJudgeId,
    current_round: 1, // Start round 1
    updated_at: new Date().toISOString(),
    // ready_player_order: players.map(p => p.id), // If using ready_player_order, populate it here
  };

  const { error: updateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (updateError) {
    console.error(`Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
    return getGame(); // Return current (likely unchanged) state
  }

  // TODO: Deal initial hands to players here from Supabase 'response_cards' table
  // and update 'player_hands' table. This is a complex step.

  console.log(`DEBUG: Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1`);
  revalidatePath('/');
  revalidatePath('/game');
  return getGame(); // Fetch the updated game state
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectCategory action called for game ${gameId} with category ${category}`);
  // TODO: 
  // 1. Validate it's the current judge making the request.
  // 2. Fetch a random, unused scenario from 'scenarios' table for this category and gameId.
  // 3. Update 'games' table: current_scenario_id, game_phase to 'player_submission', used_scenarios.
  // 4. Revalidate paths.
  revalidatePath('/game');
   return getGame();
}


export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`DEBUG: submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound}`);
  // TODO:
  // 1. Validate player is part of the game and not the judge.
  // 2. Validate card is in player's hand (remove from 'player_hands').
  // 3. Insert submission into 'responses' table (player_id, response_card_id, game_id, round_number).
  // 4. Check if all non-judge players have submitted. If so, update 'games.game_phase' to 'judging'.
  // 5. Deal a new card to the player (add to 'player_hands', mark old card in 'games.used_responses').
  // 6. Revalidate paths.
  revalidatePath('/game');
   return getGame();
}


export async function selectWinner(winningResponseId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectWinner action for response ${winningResponseId} in game ${gameId}`);
  // TODO:
  // 1. Validate it's the current judge.
  // 2. Find the submission in 'responses' table based on winningResponseId (this needs to be the response_card_id).
  // 3. Get the winning player_id and response_card_id.
  // 4. Update winning player's score in 'players' table.
  // 5. Log winner in 'winners' table.
  // 6. Update 'games' table: last_round_winner_player_id, last_round_winning_card_text, game_phase to 'winner_announcement'.
  // 7. Check for overall game winner (if score >= POINTS_TO_WIN). If so, update 'games.overall_winner_player_id' and 'games.game_phase' to 'game_over'.
  // 8. Revalidate paths.
  revalidatePath('/game');
   return getGame();
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: nextRound action called for game ${gameId}`);
  const game = await getGame(); // Get current state to determine next judge etc.
  if (!game || !game.players.length) return game;

  // TODO:
  // 1. Determine next judge based on 'ready_player_order' or simple rotation.
  // 2. Update 'games' table: current_judge_id, current_round++, current_scenario_id=null, game_phase='category_selection'.
  // 3. Clear previous round submissions? (Or filter by round_number).
  // 4. Revalidate paths.
  revalidatePath('/game');
  return game; // This should eventually call getGame() again after updates
}


export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  console.log(`DEBUG: getCurrentPlayer called for player ${playerId}, game ${gameId}`);
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId)
    .single();

  if (error || !data) {
    console.error(`Error fetching player ${playerId} for game ${gameId}:`, JSON.stringify(error, null, 2));
    return undefined;
  }

  const { data: gameData } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  let handCards: string[] = [];
  // Fetch hand from 'player_hands' and join with 'response_cards' for text
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_cards(text)') // Assumes a relationship 'response_cards' exists or direct join
    .eq('player_id', playerId)
    .eq('game_id', gameId); // Ensure hand is for the current game

  if (handError) {
    console.error(`Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    // handData will be an array of objects like { response_cards: { text: "Card text" } }
    // or { text: "Card text" } if you select directly from response_cards via player_hands
    handCards = handData
      .map((h: any) => h.response_cards?.text) // Adjust based on actual returned structure
      .filter(text => text !== null && text !== undefined) as string[];
  }

  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    score: data.score,
    isJudge: gameData ? data.id === gameData.current_judge_id : false,
    hand: handCards,
    isReady: data.is_ready,
  };
}
    
