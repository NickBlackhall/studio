
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

// Simplified findOrCreateGame: Always looks for the oldest game, or creates a new one in 'lobby' state.
export async function findOrCreateGame(): Promise<Tables<'games'>> {
  console.log("🔴 GAME (Server): findOrCreateGame called. Looking for existing game...");

  // Find the oldest game of any phase
  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error("🔴 GAME (Server): Error fetching existing games:", JSON.stringify(fetchError, null, 2));
    throw new Error(`Could not fetch existing games. Supabase error: ${fetchError.message}`);
  }
  
  if (existingGames && existingGames.length > 0) {
    console.log(`🔴 GAME (Server): Found existing game in '${existingGames[0].game_phase}' phase: ${existingGames[0].id}. Using this one.`);
    return existingGames[0];
  }
  console.log("🔴 GAME (Server): No existing games found in any phase.");

  // Create new game if none exist
  console.log("🔴 GAME (Server): Creating new game (simplified)...");
  const newGameData: TablesInsert<'games'> = {
    game_phase: 'lobby',
    current_round: 0, 
    ready_player_order: [],
    used_scenarios: [],
    used_responses: [],
    // current_judge_id, current_scenario_id, etc., will be null by default in DB
  };
  const { data: newGame, error: createError } = await supabase
    .from('games')
    .insert(newGameData)
    .select()
    .single();

  if (createError || !newGame) {
    console.error("🔴 GAME (Server): Error creating new game:", JSON.stringify(createError, null, 2));
    const supabaseErrorMessage = createError ? createError.message : "New game data was unexpectedly null after insert operation.";
    throw new Error(`Could not create a new game. Supabase error: ${supabaseErrorMessage}`);
  }
  console.log(`🔴 GAME (Server): Created new game with ID: ${newGame.id}`);
  return newGame;
}


export async function getGame(): Promise<GameClientState> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    // This should ideally not happen if findOrCreateGame throws on failure
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;
  console.log("DEBUG: getGame - Operating with gameId:", gameId);

  let playersData: Tables<'players'>[] = [];
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    // Log specific errors but try to continue if possible, e.g., if players.game_id doesn't exist
    if (playersError.message.includes("column players.game_id does not exist")) {
        console.error("CRITICAL SCHEMA ISSUE: The 'players' table is missing the 'game_id' column. Please add it in Supabase. Proceeding with empty player list for now.");
        playersData = []; // Ensure playersData is an empty array
    } else {
        console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
        // Depending on the error, you might still want to proceed with an empty player list
        // or rethrow if it's critical. For now, proceed with empty.
        playersData = [];
    }
  } else {
    playersData = fetchedPlayersData || [];
  }
   console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}:`, JSON.stringify(playersData.map(p=>p.name)));


  const players: PlayerClientState[] = playersData.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isJudge: p.id === gameRow.current_judge_id,
        hand: [], // Hand data will be fetched separately if using player_hands table
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
    : ["Default Category"]; // Provide a fallback

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

  let submissions: GameClientState['submissions'] = [];
  if (gameRow.game_phase === 'judging' && gameRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses') // Assuming 'responses' is your submissions table
      .select('player_id, response_card_id, response_cards(text)') // Adjust if response_card_id links to card text elsewhere
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      // Assuming submissionData is an array of objects with player_id and card text.
      // If response_cards(text) isn't a direct join, you'll need to fetch card text separately.
      // This is a placeholder structure.
      submissions = submissionData.map((s: any) => {
        // This needs to correctly get the card text, might involve another query or different join
        const cardText = s.response_cards?.text || 'Error: Card text not found';
        return {
          playerId: s.player_id,
          cardText: cardText,
        };
      });
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
    console.error('🔴 PLAYER (Server): Failed to find or create a game session for adding player.');
    return null;
  }
  const gameId = gameRow.id;
  console.log(`🔴 PLAYER (Server): addPlayer called for game ID: ${gameId}, player: ${name}`);

  // Check if player with this name already exists in this game
  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
    console.error('🔴 PLAYER (Server): Error checking for existing player:', JSON.stringify(checkError, null, 2));
    return null;
  }
  if (existingPlayer) {
    // Player already exists, perhaps re-fetch their data or return them
    // For now, let's just log and return the existing player if found,
    // or prevent adding if strict uniqueness per game is desired.
    // Let's assume we re-fetch and return if they exist.
    console.warn(`🔴 PLAYER (Server): Player with name ${name} already exists in game ${gameId}. Re-fetching.`);
    const { data: fullExistingPlayer, error: fetchExistingError } = await supabase
        .from('players')
        .select('*')
        .eq('id', existingPlayer.id)
        .single();
    if (fetchExistingError) {
        console.error('🔴 PLAYER (Server): Error re-fetching existing player:', JSON.stringify(fetchExistingError, null, 2));
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
    // `id` and `created_at` will be auto-generated by Supabase
    // `joined_at` default is now() in DB
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('🔴 PLAYER (Server): Error adding new player:', JSON.stringify(insertError, null, 2));
    return null;
  }
  console.log(`🔴 PLAYER (Server): Player ${name} added with ID ${newPlayer?.id} to game ${gameId}`);

  revalidatePath('/');
  revalidatePath('/game'); // Also revalidate game page if player list is shown there
  return newPlayer;
}

// SIMPLIFIED Reset: Focuses on setting the main game row to 'lobby'.
// Does NOT delete related player/hand/response/winner data to reduce complexity and potential failure points.
export async function resetGameForTesting(): Promise<void> {
  console.log("🔴 RESET (Server): Simplified resetGameForTesting action called");
  
  let gameToReset: Tables<'games'> | null = null;
  try {
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase') 
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('🔴 RESET (Server): Error fetching game to reset:', JSON.stringify(fetchError, null, 2));
      // Don't throw, try to redirect
      redirect('/?step=setup'); 
      return;
    }
    if (existingGames && existingGames.length > 0) {
      gameToReset = existingGames[0];
      console.log(`🔴 RESET (Server): Found game to reset with ID: ${gameToReset.id}, current phase: ${gameToReset.game_phase}`);
    } else {
      console.log('🔴 RESET (Server): No existing game found to reset. One will be created on next load if needed.');
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
  console.log(`🔴 RESET (Server): Attempting to reset game ${gameId} to lobby phase (simplified).`);

  // Simplified reset: ONLY update the games table.
  // We are deliberately NOT deleting players, hands, etc., to reduce failure points for now.
  // The game logic in getGame() should then fetch an empty player list for a 'lobby' phase game if players are not explicitly cleaned.
  // Or, ideally, we add player cleanup back once this core reset of game_phase works.
  
  // For a more complete reset, you would uncomment and ensure these delete operations work:
  // console.log(`🔴 RESET (Server): Deleting from player_hands for game ${gameId}...`);
  // const { error: deleteHandsError } = await supabase.from('player_hands').delete().eq('game_id', gameId);
  // if (deleteHandsError) console.error('🔴 RESET (Server): Error deleting player_hands:', JSON.stringify(deleteHandsError, null, 2));
  // else console.log(`🔴 RESET (Server): player_hands deleted for game ${gameId}.`);

  // console.log(`🔴 RESET (Server): Deleting responses (submissions) for game ${gameId}...`);
  // const { error: deleteResponsesError } = await supabase.from('responses').delete().eq('game_id', gameId);
  // if (deleteResponsesError) console.error('🔴 RESET (Server): Error deleting responses:', JSON.stringify(deleteResponsesError, null, 2));
  // else console.log(`🔴 RESET (Server): responses (submissions) deleted for game ${gameId}.`);
  
  // console.log(`🔴 RESET (Server): Deleting winners for game ${gameId}...`);
  // const { error: deleteWinnersError } = await supabase.from('winners').delete().eq('game_id', gameId);
  // if (deleteWinnersError) console.error('🔴 RESET (Server): Error deleting winners:', JSON.stringify(deleteWinnersError, null, 2));
  // else console.log(`🔴 RESET (Server): winners deleted for game ${gameId}.`);

  // console.log(`🔴 RESET (Server): Deleting players for game ${gameId}...`);
  // const { error: deletePlayersError } = await supabase.from('players').delete().eq('game_id', gameId);
  // if (deletePlayersError) console.error('🔴 RESET (Server): Error deleting players:', JSON.stringify(deletePlayersError, null, 2));
  // else console.log(`🔴 RESET (Server): Players deleted for game ${gameId}.`);

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
    updated_at: new Date().toISOString(), // Force update timestamp
  };

  const { data: updatedGameRow, error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId)
    .select()
    .single();

  if (updateGameError) {
    console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to update game to lobby phase during reset for game ID ${gameId}:`, JSON.stringify(updateGameError, null, 2));
  } else {
    console.log(`🔴 RESET (Server): Game ${gameId} successfully updated to lobby phase after reset operations. Updated row:`, JSON.stringify(updatedGameRow, null, 2));
  }
  
  // Verification
  const { data: verifyGame, error: verifyError } = await supabase
    .from('games')
    .select('game_phase, current_round, current_judge_id')
    .eq('id', gameId)
    .single();

  if (verifyError) {
    console.error("🔴 RESET (Server): Error verifying reset:", JSON.stringify(verifyError, null, 2));
  } else if (verifyGame) {
    console.log(`🔴 RESET (Server): Verification - Game phase is now: ${verifyGame.game_phase}, Round: ${verifyGame.current_round}, Judge: ${verifyGame.current_judge_id}`);
  } else {
    console.warn("🔴 RESET (Server): Verification - Game not found after reset attempt. This might be okay if no game existed.");
  }

  console.log('🔴 RESET (Server): Game reset operations complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}


// Placeholder actions for now, to be implemented with Supabase
export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: startGame action called for game ${gameId}`);
  // TODO: Implement with Supabase
  // 1. Fetch players for the game
  // 2. Check if enough players (e.g., >= 2)
  // 3. Determine the first judge (e.g., first player in ready_player_order or just first player)
  // 4. Update 'games' table: game_phase to 'category_selection', current_judge_id, current_round to 1
  // 5. Deal initial hands to players (fetch N cards from 'response_cards', insert into 'player_hands')
  // 6. Revalidate paths
  // 7. Return updated game state or null to trigger client-side re-fetch

  // Temporary: Fetch current game state and revalidate
  const { data: game, error: gameFetchError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !game) {
    console.error(`Error fetching game ${gameId} for startGame: ${JSON.stringify(gameFetchError, null, 2)}`);
    return getGame(); // Fallback to fetching the current state
  }

  // Basic: move to category_selection and assign first player as judge if in lobby
  if (game.game_phase === 'lobby') {
    const { data: players, error: playersFetchError } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true }); // Or use ready_player_order later

    if (playersFetchError || !players || players.length < 2) { // Need at least 2 players
      console.error(`Error fetching players or not enough players (need at least 2) for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
      return getGame(); // Not enough players, return current state
    }

    const firstJudgeId = players[0].id;
    console.log(`DEBUG: Assigning player ${firstJudgeId} as the first judge for game ${gameId}`);

    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: firstJudgeId,
      current_round: 1, // Start round 1
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      return getGame(); // Fallback
    }
     console.log(`DEBUG: Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1`);
  } else {
     console.warn(`DEBUG: startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return null; // Client will re-fetch or use real-time updates
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectCategory action called for game ${gameId} with category ${category}`);
  // TODO: Implement with Supabase
  // 1. Fetch a random scenario from 'scenarios' table WHERE category = selectedCategory AND NOT IN used_scenarios
  // 2. Update 'games' table: current_scenario_id, game_phase to 'player_submission', add scenario_id to used_scenarios
  // 3. Revalidate paths
  revalidatePath('/game');
   return getGame(); // Temporary: just refetch
}


export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`DEBUG: submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound}`);
  // TODO: Implement with Supabase
  // 1. Insert into 'responses' table: player_id, response_card_id, game_id, round_number
  // 2. Remove submitted card from 'player_hands' for that player
  // 3. Deal a new card to that player (add to 'player_hands'), ensuring it's not used or in another hand
  // 4. Check if all players have submitted. If yes, update 'games' table: game_phase to 'judging'
  // 5. Revalidate paths
  revalidatePath('/game');
   return getGame(); // Temporary: just refetch
}


export async function selectWinner(winningCardText: string, gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectWinner action for card text "${winningCardText}" in game ${gameId}`);
  // TODO: Implement with Supabase
  // 1. Find the player_id and response_card_id for the winningCardText from 'responses' table for current round.
  // 2. Update winning player's score in 'players' table.
  // 3. Insert into 'winners' table: game_id, round_number, winner_player_id, winning_response_card_id.
  // 4. Update 'games' table: last_round_winner_player_id, last_round_winning_card_text, game_phase to 'winner_announcement'.
  // 5. Check for overall game winner (if score >= POINTS_TO_WIN). If so, update game_phase to 'game_over', set overall_winner_player_id.
  // 6. Revalidate paths
  revalidatePath('/game');
  return getGame(); // Temporary: just refetch
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: nextRound action called for game ${gameId}`);
  // TODO: Implement with Supabase
  // 1. Determine next judge based on ready_player_order.
  // 2. Update 'games' table: current_judge_id, current_round increment, current_scenario_id to null, game_phase to 'category_selection'.
  // 3. Clear 'responses' table for the previous round for this game_id.
  // 4. Revalidate paths
  revalidatePath('/game');
  return getGame(); // Temporary: just refetch
}


// Fetches current player details, including their hand from player_hands
export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  console.log(`DEBUG: getCurrentPlayer called for player ${playerId}, game ${gameId}`);
  const { data: playerData, error: playerFetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId)
    .single();

  if (playerFetchError || !playerData) {
    console.error(`Error fetching player ${playerId} for game ${gameId}:`, JSON.stringify(playerFetchError, null, 2));
    return undefined;
  }

  // Get game data to check if this player is the current judge
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`Error fetching game data for judge check (player ${playerId}, game ${gameId}):`, JSON.stringify(gameFetchError, null, 2));
    // Proceed but player might not be correctly identified as judge
  }
  
  // Fetch player's hand: Join player_hands with response_cards to get card text
  let handCards: string[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select(`
      response_card_id,
      response_cards ( text )
    `)
    .eq('player_id', playerId)
    .eq('game_id', gameId); // Ensure hand is for the correct game

  if (handError) {
    console.error(`Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    // handData will be an array of objects like: { response_card_id: 'uuid', response_cards: { text: 'Card text' } }
    // or { response_card_id: 'uuid', response_cards: null } if the join failed or card was deleted
    handCards = handData
      .map((h: any) => h.response_cards?.text) // Safely access nested text
      .filter(text => text !== null && text !== undefined) as string[];
  }

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
    
 