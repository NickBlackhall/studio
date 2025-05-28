
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
      ready_player_order: [],
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
    // Don't throw if the column is missing during setup, just log and return empty players
    if (playersError.message.includes("column players.game_id does not exist")) {
        console.error("CRITICAL SCHEMA ISSUE: The 'players' table is missing the 'game_id' column. Please add it in Supabase. Proceeding with empty player list for now.");
        playersData = [];
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

  // Fetch submissions for the current round if applicable
  let submissions: GameClientState['submissions'] = [];
  if (gameRow.game_phase === 'judging' && gameRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses')
      .select('player_id, response_cards(text)') // Join with response_cards to get text
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      submissions = submissionData.map((s: any) => ({ // Explicitly type s as any for now
        playerId: s.player_id,
        cardText: s.response_cards?.text || 'Error: Card text not found',
      }));
    }
  }
  
  // Fetch last winner details if applicable
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

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
    console.error('Error checking for existing player:', JSON.stringify(checkError, null, 2));
    return null;
  }
  if (existingPlayer) {
    console.warn(`Player with name ${name} already exists in game ${gameId}. Re-fetching the player.`);
    // If player exists, just return their current data instead of erroring or re-adding
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
    is_judge: false, // Default, might be changed by startGame
    is_ready: false, // Default
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
  const gameRow = await findOrCreateGame(); 
  if (!gameRow || !gameRow.id) {
    console.error('Failed to find or create a game session for reset.');
    // If no game is found, we can't reset much, but we should still try to redirect
    // to a clean state to avoid getting stuck.
    revalidatePath('/');
    revalidatePath('/game');
    redirect('/?step=setup');
    return;
  }
  const gameId = gameRow.id;
  console.log(`DEBUG: Resetting game with ID: ${gameId}`);

  // Delete related data first
  const { error: deletePlayersError } = await supabase
    .from('players')
    .delete()
    .eq('game_id', gameId);
  if (deletePlayersError) console.error('Error deleting players:', JSON.stringify(deletePlayersError, null, 2));

  const { error: deleteHandsError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_id', gameId);
  if (deleteHandsError) console.error('Error deleting player hands:', JSON.stringify(deleteHandsError, null, 2));

  const { error: deleteResponsesError } = await supabase
    .from('responses')
    .delete()
    .eq('game_id', gameId);
  if (deleteResponsesError) console.error('Error deleting responses:', JSON.stringify(deleteResponsesError, null, 2));
  
  const { error: deleteWinnersError } = await supabase
    .from('winners')
    .delete()
    .eq('game_id', gameId);
  if (deleteWinnersError) console.error('Error deleting winners:', JSON.stringify(deleteWinnersError, null, 2));

  // Then reset the game row itself
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
  };
  const { error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId);

  if (updateGameError) {
    console.error('CRITICAL ERROR: Failed to update game to lobby phase during reset:', JSON.stringify(updateGameError, null, 2));
    // Not throwing here to allow redirect to still happen, so user isn't stuck on an error page
    // but the console will show the critical failure.
  } else {
    console.log(`DEBUG: Game ${gameId} successfully updated to lobby phase after reset operations.`);
  }

  console.log('DEBUG: Game reset complete, revalidating paths and redirecting.');
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
    return getGame(); // Fallback to refetch current state
  }

  if (game.game_phase !== 'lobby') {
    console.warn(`DEBUG: startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
    return getGame(); // Game already started or in an advanced phase
  }

  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true }); // Fetch players in join order

  if (playersFetchError || !players || players.length < 2) {
    console.error(`Error fetching players or not enough players for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
    return getGame();
  }

  // Assign the first player in the list as the judge (simplistic for now)
  const firstJudgeId = players[0].id;
  console.log(`DEBUG: Assigning player ${firstJudgeId} as the first judge for game ${gameId}`);

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: firstJudgeId,
    current_round: 1, // Start round 1
    // TODO: Deal cards
  };

  const { error: updateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (updateError) {
    console.error(`Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
    return getGame(); // Fallback
  }

  // TODO: Implement card dealing logic here
  // - Fetch all players for gameId
  // - For each player:
  //   - Deal CARDS_PER_HAND unique response_cards (not in games.used_responses, not in any current player_hands for this game)
  //   - Insert into player_hands table

  console.log(`DEBUG: Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1`);
  revalidatePath('/');
  revalidatePath('/game');
  return getGame(); // Return the updated game state
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectCategory action called for game ${gameId} with category ${category}`);
  // Logic to draw a scenario, update games table (current_scenario_id, used_scenarios, game_phase 'player_submission')
  revalidatePath('/game');
   return getGame();
}


export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`DEBUG: submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound}`);
  // Insert into responses, remove from player_hands, add to games.used_responses, deal new card to player
  revalidatePath('/game');
   return getGame();
}


export async function selectWinner(winningResponseId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectWinner action for response ${winningResponseId} in game ${gameId}`);
  // Update player score, update games table (last_round_winner, game_phase), check for overall winner
  revalidatePath('/game');
   return getGame();
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: nextRound action called for game ${gameId}`);
  // Rotate judge, increment round, clear round-specific game state, set game_phase 'category_selection'
  const game = await getGame();
  revalidatePath('/game');
  return game;
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

  // Fetch player's hand from player_hands and join with response_cards
  let handCards: string[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_cards(text)') // Joins with response_cards table using the FK
    .eq('player_id', playerId)
    .eq('game_id', gameId); // Ensure hand is for the correct game

  if (handError) {
    console.error(`Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    // Ensure handData is an array and response_cards is not null
    handCards = handData
      .map((h: any) => h.response_cards?.text)
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

    
