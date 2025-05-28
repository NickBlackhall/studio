
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
    .order('created_at', { ascending: true }) // Fetch oldest first
    .limit(1);

  if (fetchError) {
    console.error('Error fetching existing games:', JSON.stringify(fetchError, null, 2));
    throw new Error(`Could not fetch game data. Supabase error: ${fetchError.message}`);
  }

  if (existingGames && existingGames.length > 0) {
    game = existingGames[0];
    console.log(`DEBUG: Found oldest existing game with ID: ${game.id}`);
  } else {
    console.log('DEBUG: No existing game found, creating a new one.');
    // No game exists, create a new one
    const newGameData: TablesInsert<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      ready_player_order: [], // Explicitly provide empty arrays
      used_scenarios: [],
      used_responses: [],
    };
    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert(newGameData)
      .select()
      .single();

    if (insertError || !newGame) {
      console.error('Error creating new game:', JSON.stringify(insertError, null, 2));
      const supabaseErrorMessage = insertError ? insertError.message : "New game data was unexpectedly null after insert operation.";
      throw new Error(`Could not create a new game. Supabase error: ${supabaseErrorMessage}`);
    }
    game = newGame;
    console.log(`DEBUG: Created new game with ID: ${game.id}`);
  }
  if (!game) { // Should be practically impossible if the above logic is correct
    throw new Error('CRITICAL: findOrCreateGame failed to return a game object.');
  }
  return game;
}


export async function getGame(): Promise<GameClientState> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    // This case should ideally not be reached if findOrCreateGame is robust
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
    console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    // Removed specific error for 'column players.game_id does not exist' as schema should be fixed.
    // If it happens again, it's a critical schema issue.
    throw new Error(`Could not fetch players. Supabase error: ${playersError.message}`);
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
        // Hand data will now come from player_hands table
        hand: [], // Placeholder, will be populated by fetching from player_hands
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
    : ["Default Category"];

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
        category: scenarioData.category || 'Unknown',
        text: scenarioData.text,
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
    submissions: [], // Placeholder, will be populated by fetching from responses table
    categories: categories,
    readyPlayerOrder: gameRow.ready_player_order || [],
    lastWinner: undefined, // Placeholder
    winningPlayerId: gameRow.overall_winner_player_id,
  };
  console.log(`DEBUG: getGame - Returning GameClientState for gameId ${gameId}`);
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

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means " esattamente una riga" - exactly one row, no rows found is fine
    console.error('Error checking for existing player:', JSON.stringify(checkError, null, 2));
    return null;
  }
  if (existingPlayer) {
    console.warn(`Player with name ${name} already exists in game ${gameId}. Re-fetching the player.`);
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
    // 'hand' column removed from players table, managed by player_hands
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
  console.log('DEBUG: resetGameForTesting called');
  const gameRow = await findOrCreateGame(); // This will now find the "oldest" game
  if (!gameRow || !gameRow.id) {
    console.error('Failed to find or create a game session for reset.');
    return;
  }
  const gameId = gameRow.id;
  console.log(`DEBUG: Resetting game with ID: ${gameId}`);

  // Delete players associated with this game
  const { error: deletePlayersError } = await supabase
    .from('players')
    .delete()
    .eq('game_id', gameId);
  if (deletePlayersError) console.error('Error deleting players:', JSON.stringify(deletePlayersError, null, 2));

  // Delete player hands associated with this game
  const { error: deleteHandsError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_id', gameId);
  if (deleteHandsError) console.error('Error deleting player hands:', JSON.stringify(deleteHandsError, null, 2));

  // Delete responses/submissions associated with this game
  const { error: deleteResponsesError } = await supabase
    .from('responses')
    .delete()
    .eq('game_id', gameId);
  if (deleteResponsesError) console.error('Error deleting responses:', JSON.stringify(deleteResponsesError, null, 2));

  // Optionally, delete winner logs for this game if you want a full reset
  // const { error: deleteWinnersError } = await supabase.from('winners').delete().eq('game_id', gameId);
  // if (deleteWinnersError) console.error('Error deleting winners:', deleteWinnersError);

  // Reset the game row itself
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
    // We don't change created_at, but updated_at should ideally auto-update
  };
  const { error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId);
  if (updateGameError) console.error('Error resetting game row:', JSON.stringify(updateGameError, null, 2));

  console.log('DEBUG: Game reset complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}

// Placeholder for startGame - to be implemented with Supabase logic
export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: startGame action called for game ${gameId}`);
  // Logic to update game_phase to 'category_selection' in Supabase, assign first judge, etc.
  // Deal hands:
  //  - Fetch all players for gameId
  //  - For each player:
  //    - Deal CARDS_PER_HAND unique response_cards (not in games.used_responses, not in any current player_hands for this game)
  //    - Insert into player_hands table
  const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (error || !game) {
    console.error(`Error fetching game ${gameId} for startGame: ${JSON.stringify(error, null, 2)}`);
    return getGame(); // Fallback to refetch
  }

  // Simplistic: set game phase and revalidate
  await supabase.from('games').update({ game_phase: 'category_selection' }).eq('id', gameId);


  revalidatePath('/game');
  return getGame(); // For now, just refetch state
}

// Placeholder for selectCategory - to be implemented
export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectCategory action called for game ${gameId} with category ${category}`);
  // Logic to draw a scenario, update games table (current_scenario_id, used_scenarios, game_phase 'player_submission')
  revalidatePath('/game');
   return getGame();
}

// Placeholder for submitResponse - to be implemented
export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`DEBUG: submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound}`);
  // Insert into responses, remove from player_hands, add to games.used_responses, deal new card to player
  revalidatePath('/game');
   return getGame();
}

// Placeholder for selectWinner - to be implemented
export async function selectWinner(winningResponseId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectWinner action for response ${winningResponseId} in game ${gameId}`);
  // Update player score, update games table (last_round_winner, game_phase), check for overall winner
  revalidatePath('/game');
   return getGame();
}

// Placeholder for nextRound - to be implemented
export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: nextRound action called for game ${gameId}`);
  // Rotate judge, increment round, clear round-specific game state, set game_phase 'category_selection'
  const game = await getGame();
  if (game?.gamePhase === 'lobby') { // Changed from welcome to lobby
     redirect('/?step=setup'); // Redirect to setup if in lobby
  }
  revalidatePath('/game');
  return game;
}

// This function might not be needed if player data is part of GameClientState from getGame()
// and hand data is fetched more directly or passed around.
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

  // Fetch player's hand from player_hands and join with response_cards
  // This requires a specific join or multiple queries. For now, keeping it simple.
  // Actual hand data population is complex and should be part of getGame or a dedicated hand-fetching function.
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards(text)') // Assumes 'response_cards' is the related table name
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
    hand: handCards, // This hand data is still simplified
    isReady: data.is_ready,
  };
}


    