
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

// Helper function to find or create a game session
async function findOrCreateGame(): Promise<Tables<'games'>> {
  let game: Tables<'games'> | null = null;

  // Try to find the most recent game
  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('Error fetching existing games:', JSON.stringify(fetchError, null, 2));
    throw new Error(`Could not fetch game data. Supabase error: ${fetchError.message}`);
  }

  if (existingGames && existingGames.length > 0) {
    game = existingGames[0];
  } else {
    // No game exists, create a new one
    const newGameData: TablesInsert<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      // Explicitly provide empty arrays for non-nullable array columns
      // even if DB has a default, to be absolutely sure.
      ready_player_order: [],
      used_scenarios: [],
      used_responses: [],
      // Nullable fields like current_judge_id, current_scenario_id, 
      // last_round_winner_player_id, overall_winner_player_id
      // will be null by default if not provided and are nullable.
    };
    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert(newGameData)
      .select() // select all columns of the inserted row
      .single(); // expect a single row to be returned

    if (insertError || !newGame) {
      // Log the full error object from Supabase if it exists
      console.error('Error creating new game:', JSON.stringify(insertError, null, 2));
      // Prepare a more detailed error message for the client
      const supabaseErrorMessage = insertError ? insertError.message : "New game data was unexpectedly null after insert operation.";
      throw new Error(`Could not create a new game. Supabase error: ${supabaseErrorMessage}`);
    }
    game = newGame;
  }
  return game;
}


export async function getGame(): Promise<GameClientState> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    // This case should ideally be handled by findOrCreateGame throwing an error
    throw new Error('Failed to find or create a game session.');
  }
  const gameId = gameRow.id;

  let playersData: Tables<'players'>[] = [];
  // Fetch players for this game
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    // Check for specific "column does not exist" error for players.game_id
    if (playersError.message.includes("column players.game_id does not exist")) {
        const specificErrorMessage = "CRITICAL: The 'players' table is missing the 'game_id' column, or it's named incorrectly. Please ensure the 'players' table has a 'game_id' column of type UUID. The page will load without players for now.";
        console.error(specificErrorMessage);
        // Allow the game to proceed without players if this specific error occurs, to aid debugging.
        playersData = []; // Set to empty array to allow page to load
    } else {
        throw new Error(`Could not fetch players. Supabase error: ${playersError.message}`);
    }
  } else {
    playersData = fetchedPlayersData || [];
  }


  const players: PlayerClientState[] = playersData.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isJudge: p.id === gameRow.current_judge_id,
        hand: [], // Hand data will come from player_hands, to be implemented
        isReady: p.is_ready,
      }));


  // Fetch categories
  const { data: categoriesData, error: categoriesError } = await supabase
    .from('scenarios')
    .select('category');

  if (categoriesError) {
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
    // Non-fatal, game can proceed with default or empty categories
  }
  const categories = categoriesData && categoriesData.length > 0
    ? [...new Set(categoriesData.map(c => c.category).filter(c => c !== null) as string[])]
    : ["Default Category"]; // Provide a fallback


  // Fetch current scenario if ID exists
  let currentScenario: ScenarioClientState | null = null;
  if (gameRow.current_scenario_id) {
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('scenarios')
      .select('id, category, text')
      .eq('id', gameRow.current_scenario_id)
      .single();
    if (scenarioError) {
      console.error('Error fetching current scenario:', JSON.stringify(scenarioError, null, 2));
      // Non-fatal, game can proceed without a scenario temporarily
    }
    if (scenarioData) {
      currentScenario = {
        id: scenarioData.id,
        category: scenarioData.category || 'Unknown', // Ensure category is not null
        text: scenarioData.text,
      };
    }
  }

  // Assemble GameClientState
  const gameClientState: GameClientState = {
    gameId: gameId,
    players: players,
    currentRound: gameRow.current_round,
    currentJudgeId: gameRow.current_judge_id,
    currentScenario: currentScenario,
    gamePhase: gameRow.game_phase as GameClientState['gamePhase'],
    submissions: [], // Submissions will be fetched/managed later
    categories: categories,
    readyPlayerOrder: gameRow.ready_player_order || [],
    lastWinner: undefined, // To be implemented
    winningPlayerId: gameRow.overall_winner_player_id,
  };

  return gameClientState;
}

export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    console.error('Failed to find or create a game session for adding player.');
    return null;
  }
  const gameId = gameRow.id;

  // Check if player with the same name already exists in this game
  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: 'single row not found' (means player doesn't exist, which is good)
    console.error('Error checking for existing player:', JSON.stringify(checkError, null, 2));
    // Potentially throw or return an error object to inform the client
    return null;
  }
  if (existingPlayer) {
    console.warn(`Player with name ${name} already exists in game ${gameId}. Re-fetching the player.`);
    // Fetch the full player data if they exist
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
    is_judge: false,
    is_ready: false,
    // created_at, joined_at, id will be handled by Supabase defaults
    // hand should not be set here directly if using player_hands table
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('Error adding new player:', JSON.stringify(insertError, null, 2));
    // Potentially throw or return an error object
    return null;
  }

  revalidatePath('/');
  revalidatePath('/game'); // Also revalidate game page if player list is shown there
  return newPlayer;
}

export async function resetGameForTesting(): Promise<void> {
  const gameRow = await findOrCreateGame(); // Ensures a game record exists
  if (!gameRow || !gameRow.id) {
    console.error('Failed to find or create a game session for reset.');
    return;
  }
  const gameId = gameRow.id;

  // Delete players associated with this game
  const { error: deletePlayersError } = await supabase
    .from('players')
    .delete()
    .eq('game_id', gameId);

  if (deletePlayersError) {
    console.error('Error deleting players:', JSON.stringify(deletePlayersError, null, 2));
  }


  // Delete player_hands entries for this game
  const { error: deleteHandsError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_id', gameId);
  if (deleteHandsError) console.error('Error deleting player hands:', JSON.stringify(deleteHandsError, null, 2));

  // Delete responses (submissions) for this game
  const { error: deleteResponsesError } = await supabase
    .from('responses')
    .delete()
    .eq('game_id', gameId);
  if (deleteResponsesError) console.error('Error deleting responses:', JSON.stringify(deleteResponsesError, null, 2));

  // Reset the game row state
  // For array columns, Supabase expects {} for empty array default.
  const updatedGameData: Partial<TablesUpdate<'games'>> = { // Use Partial for updates
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
    // updated_at will be handled by Supabase by default or a trigger
  };
  const { error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId);
  if (updateGameError) console.error('Error resetting game row:', JSON.stringify(updateGameError, null, 2));

  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}

// Placeholder for startGame - to be implemented with Supabase logic
export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`startGame action called for game ${gameId} - Supabase logic to be implemented`);
  // 1. Fetch current game from Supabase using gameId
  // 2. Check if enough players are ready (fetch players, check their is_ready status and game_id)
  // 3. Assign first judge from games.ready_player_order
  // 4. Update game_phase to 'category_selection' in Supabase games table
  // 5. Deal initial hands to all players (populate player_hands table from response_cards, ensuring uniqueness rules)
  // 6. Revalidate and return updated GameClientState by calling getGame()
  revalidatePath('/game');
  return getGame(); // For now, just refetch state
}

// Placeholder for selectCategory - to be implemented
export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`selectCategory action called for game ${gameId} with category ${category} - Supabase logic to be implemented`);
  // 1. Fetch current game from Supabase
  // 2. Draw a random scenario from selected category, not in games.used_scenarios
  // 3. Update games.current_scenario_id and games.used_scenarios
  // 4. Update game_phase to 'player_submission'
  // 5. Revalidate and return updated GameClientState by calling getGame()
  revalidatePath('/game');
   return getGame();
}

// Placeholder for submitResponse - to be implemented
export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound} - Supabase logic to be implemented`);
  // 1. Fetch current game
  // 2. Insert into responses table (player_id, response_card_id, game_id, round_number)
  // 3. Remove submitted card from player_hands (delete row)
  // 4. Add submitted card's ID to games.used_responses
  // 5. Deal new card to player (add to player_hands) - this is complex, check card uniqueness rules (not in player_hands for this game, not in games.used_responses for this game)
  // 6. If all non-judge players submitted, update game_phase to 'judging'
  // 7. Revalidate and return updated GameClientState by calling getGame()
  revalidatePath('/game');
   return getGame();
}

// Placeholder for selectWinner - to be implemented
export async function selectWinner(winningResponseId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`selectWinner action for response ${winningResponseId} in game ${gameId} - Supabase logic to be implemented`);
  // 1. Fetch current game and the submission (from 'responses' table) matching winningResponseId
  // 2. Identify winning player_id from the submission
  // 3. Fetch winning response_card_id and then its text from response_cards.
  // 4. Update winning player's score in players table (increment score)
  // 5. Optionally log winner in winners table
  // 6. Update games table: last_round_winner_player_id, last_round_winning_card_text
  // 7. Check for overall game win (POINTS_TO_WIN from types.ts)
  //    - If game over, set games.overall_winner_player_id and game_phase to 'game_over'
  //    - Else, set game_phase to 'winner_announcement'
  // 8. Revalidate and return updated GameClientState by calling getGame()
  revalidatePath('/game');
   return getGame();
}

// Placeholder for nextRound - to be implemented
export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`nextRound action called for game ${gameId} - Supabase logic to be implemented`);
  // 1. Fetch current game
  // 2. If game_phase was 'game_over', it means we are starting a new game.
  //    Instead of redirecting to resetGameForTesting (which resets everything), we might want a
  //    function like 'prepareNewGameFromOld' that keeps players but resets rounds, scores (or not?), judge, etc.
  //    For now, if game over, simply calling resetGameForTesting might be too drastic if players want to play again quickly.
  //    Let's assume for now that if it's game_over, UI might offer a 'Play Again' that calls 'resetGameForTesting' or similar.
  //    This 'nextRound' action assumes we are continuing the *same* game.
  // 3. Rotate judge based on games.ready_player_order. Update games.current_judge_id.
  // 4. Increment games.current_round.
  // 5. Clear games.current_scenario_id, games.last_round_winner_player_id, etc.
  // 6. Clear submissions from responses table for the current game_id and *previous* round_number.
  // 7. Update game_phase to 'category_selection'.
  // 8. Revalidate and return updated GameClientState by calling getGame().
  const game = await getGame();
  if (game?.gamePhase === 'lobby') { // A simplistic check if reset led to lobby
     redirect('/');
  }
  revalidatePath('/game');
  return game;
}


// This function might not be needed if player data is part of GameClientState from getGame()
export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId) // Ensure player belongs to the correct game
    .single();

  if (error || !data) {
    console.error(`Error fetching player ${playerId} for game ${gameId}:`, JSON.stringify(error, null, 2));
    return undefined;
  }

  // To determine if this player is a judge, we'd need game context
  const { data: gameData } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  // Fetch player's hand
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_cards(text)') // Assumes a relationship is set up or join equivalent
    .eq('player_id', playerId)
    .eq('game_id', gameId);

  if (handError) {
    console.error(`Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  }

  const handCards = handData?.map((h: any) => h.response_cards?.text).filter(text => text !== null && text !== undefined) || [];


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


