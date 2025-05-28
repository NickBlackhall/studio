
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState } from '@/lib/types';
import type { Tables, TablesInsert } from '@/lib/database.types';

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
    console.error('Error fetching existing games:', fetchError);
    throw new Error('Could not fetch game data.');
  }

  if (existingGames && existingGames.length > 0) {
    game = existingGames[0];
  } else {
    // No game exists, create a new one
    const newGameData: TablesInsert<'games'> = {
      game_phase: 'lobby',
      current_round: 0,
      // Supabase defaults will handle id, created_at, updated_at
      // Nullable fields like current_judge_id, current_scenario_id will be null
      // Array fields like used_scenarios, used_responses, ready_player_order default to {}
    };
    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert(newGameData)
      .select()
      .single();

    if (insertError || !newGame) {
      console.error('Error creating new game:', insertError);
      throw new Error('Could not create a new game.');
    }
    game = newGame;
  }
  return game;
}


export async function getGame(): Promise<GameClientState> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    throw new Error('Failed to find or create a game session.');
  }
  const gameId = gameRow.id;

  // Fetch players for this game
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error(`Error fetching players for game ${gameId}:`, playersError);
    throw new Error('Could not fetch players.');
  }

  const players: PlayerClientState[] = playersData 
    ? playersData.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isJudge: p.id === gameRow.current_judge_id, // Check against gameRow
        hand: [], // Hand data will come from player_hands, to be implemented
        isReady: p.is_ready,
      }))
    : [];

  // Fetch categories
  const { data: categoriesData, error: categoriesError } = await supabase
    .from('scenarios')
    .select('category');

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError);
    throw new Error('Could not fetch categories.');
  }
  const categories = categoriesData 
    ? [...new Set(categoriesData.map(c => c.category))] 
    : ["Default Category"];


  // Fetch current scenario if ID exists
  let currentScenario: ScenarioClientState | null = null;
  if (gameRow.current_scenario_id) {
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('scenarios')
      .select('id, category, text')
      .eq('id', gameRow.current_scenario_id)
      .single();
    if (scenarioError) {
      console.error('Error fetching current scenario:', scenarioError);
      // Non-fatal, game can proceed without a scenario temporarily
    }
    if (scenarioData) {
      currentScenario = {
        id: scenarioData.id,
        category: scenarioData.category,
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
    gamePhase: gameRow.game_phase as GameClientState['gamePhase'], // Cast for now
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

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: 'single row not found'
    console.error('Error checking for existing player:', checkError);
    return null;
  }
  if (existingPlayer) {
    console.warn(`Player with name ${name} already exists in game ${gameId}.`);
    // Optionally, return the existing player or handle as an error
    return existingPlayer as Tables<'players'>; // Cast as it only has id
  }

  const newPlayerData: TablesInsert<'players'> = {
    game_id: gameId,
    name,
    avatar,
    score: 0,
    is_judge: false,
    is_ready: false,
    // hand will be managed by player_hands table
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('Error adding new player:', insertError);
    return null;
  }

  revalidatePath('/');
  revalidatePath('/game');
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
  if (deletePlayersError) console.error('Error deleting players:', deletePlayersError);

  // Delete player_hands entries for this game
  const { error: deleteHandsError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_id', gameId);
  if (deleteHandsError) console.error('Error deleting player hands:', deleteHandsError);
  
  // Delete responses (submissions) for this game
  const { error: deleteResponsesError } = await supabase
    .from('responses')
    .delete()
    .eq('game_id', gameId);
  if (deleteResponsesError) console.error('Error deleting responses:', deleteResponsesError);

  // Reset the game row state
  const updatedGameData: Partial<Tables<'games'>> = {
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
    // updated_at will be handled by Supabase
  };
  const { error: updateGameError } = await supabase
    .from('games')
    .update(updatedGameData)
    .eq('id', gameId);
  if (updateGameError) console.error('Error resetting game row:', updateGameError);

  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}

// Placeholder for startGame - to be implemented with Supabase logic
export async function startGame(): Promise<GameClientState | null> {
  console.log("startGame action called - Supabase logic to be implemented");
  // 1. Find current game
  // 2. Check if enough players are ready
  // 3. Assign first judge from ready_player_order
  // 4. Update game_phase to 'category_selection' in Supabase games table
  // 5. Deal initial hands to all players (populate player_hands table)
  // 6. Revalidate and return updated GameClientState
  revalidatePath('/game');
  return getGame(); // For now, just refetch state
}

// Placeholder for selectCategory - to be implemented
export async function selectCategory(categoryId: string): Promise<GameClientState | null> {
  console.log(`selectCategory action called with ${categoryId} - Supabase logic to be implemented`);
  // 1. Find current game
  // 2. Draw a random scenario from selected category, not in games.used_scenarios
  // 3. Update games.current_scenario_id and games.used_scenarios
  // 4. Update game_phase to 'player_submission'
  // 5. Revalidate and return updated GameClientState
  revalidatePath('/game');
   return getGame();
}

// Placeholder for submitResponse - to be implemented
export async function submitResponse(playerId: string, responseCardId: string): Promise<GameClientState | null> {
  console.log(`submitResponse action called by ${playerId} with card ${responseCardId} - Supabase logic to be implemented`);
  // 1. Find current game
  // 2. Insert into responses table (player_id, response_card_id, game_id, round_number)
  // 3. Remove submitted card from player_hands
  // 4. Add card to games.used_responses
  // 5. Deal new card to player (add to player_hands) - this is complex, check card uniqueness rules
  // 6. If all non-judge players submitted, update game_phase to 'judging'
  // 7. Revalidate and return updated GameClientState
  revalidatePath('/game');
   return getGame();
}

// Placeholder for selectWinner - to be implemented
export async function selectWinner(winningResponseCardId: string): Promise<GameClientState | null> {
  console.log(`selectWinner action called for card ${winningResponseCardId} - Supabase logic to be implemented`);
  // 1. Find current game and the submission matching winningResponseCardId
  // 2. Identify winning player from the submission
  // 3. Update winning player's score in players table
  // 4. Log winner in winners table
  // 5. Update games table: last_round_winner_player_id, last_round_winning_card_text
  // 6. Check for overall game win (POINTS_TO_WIN)
  //    - If game over, set games.overall_winner_player_id and game_phase to 'game_over'
  //    - Else, set game_phase to 'winner_announcement'
  // 7. Revalidate and return updated GameClientState
  revalidatePath('/game');
   return getGame();
}

// Placeholder for nextRound - to be implemented
export async function nextRound(): Promise<GameClientState | null> {
  console.log("nextRound action called - Supabase logic to be implemented");
  // 1. Find current game
  // 2. If game_phase was 'game_over', redirect to resetGameForTesting or similar.
  // 3. Rotate judge based on games.ready_player_order
  // 4. Update games.current_judge_id
  // 5. Update games.current_round
  // 6. Clear games.current_scenario_id, games.last_round_winner_player_id, etc.
  // 7. Clear submissions from responses table for previous round
  // 8. Update game_phase to 'category_selection'
  // 9. Revalidate and return updated GameClientState
  // 10. If game was over and reset, potentially redirect to /
  const game = await getGame();
  if (game?.gamePhase === 'lobby') { // A simplistic check if reset led to lobby
     redirect('/');
  }
  revalidatePath('/game');
  return game;
}

// Not a server action, but helper possibly used by client
export async function getCurrentPlayer(playerId: string): Promise<PlayerClientState | undefined> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (error || !data) return undefined;
  
  // We need game_id to determine if this player is the current judge
  // For simplicity, this example doesn't fetch game_id or current_judge_id here
  // A more complete version would fetch game state or pass currentJudgeId
  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    score: data.score,
    isJudge: false, // Needs to be determined by comparing with games.current_judge_id
    hand: [], // To be implemented
    isReady: data.is_ready,
  };
}
