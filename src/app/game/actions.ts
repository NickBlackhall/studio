
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
      used_scenarios: [],
      used_responses: [],
      ready_player_order: [],
      // Supabase defaults will handle id, created_at, updated_at
      // Nullable fields like current_judge_id, current_scenario_id will be null
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
    // This case should ideally be handled by findOrCreateGame throwing an error
    throw new Error('Failed to find or create a game session.');
  }
  const gameId = gameRow.id;

  let playersData: Tables<'players'>[] | null = [];
  // Fetch players for this game
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    const specificErrorMessage = 'column players.game_id does not exist';
    if (playersError.message.includes(specificErrorMessage)) {
      console.error(`CRITICAL DATABASE SCHEMA ISSUE: The 'players' table in your Supabase database is missing the 'game_id' column (type: uuid, nullable: false). Please add or correct this column in your 'players' table in Supabase. The app will continue but no players will be loaded.`);
      // playersData will remain null or empty, leading to an empty player list
    } else {
      console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
      throw new Error(`Could not fetch players. Supabase error: ${playersError.message}`);
    }
  } else {
    playersData = fetchedPlayersData;
  }


  const players: PlayerClientState[] = playersData
    ? playersData.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isJudge: p.id === gameRow.current_judge_id,
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
    // Non-fatal, game can proceed with default or empty categories
    // throw new Error('Could not fetch categories.');
  }
  const categories = categoriesData
    ? [...new Set(categoriesData.map(c => c.category))]
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

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: 'single row not found'
    console.error('Error checking for existing player:', checkError);
    // Potentially check if the error is "column players.game_id does not exist"
    if (checkError.message.includes('column players.game_id does not exist')) {
        console.error(`CRITICAL DATABASE SCHEMA ISSUE: The 'players' table is missing the 'game_id' column. Cannot add player.`);
    }
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
        console.error('Error re-fetching existing player:', fetchExistingError);
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
    // joined_at will be handled by Supabase default
    // hand is managed by player_hands table, or not used if PlayerClientState.hand is directly populated
  };

  const { data: newPlayer, error: insertError } = await supabase
    .from('players')
    .insert(newPlayerData)
    .select()
    .single();

  if (insertError) {
    console.error('Error adding new player:', insertError);
     if (insertError.message.includes('null value in column "game_id" violates not-null constraint') || insertError.message.includes("players_game_id_fkey")) {
        console.error(`DATABASE SCHEMA ISSUE: Problem with 'game_id' in 'players' table. It might be missing, not allowing nulls correctly, or have a foreign key constraint issue. Please check its definition in Supabase.`);
    } else if (insertError.message.includes('column "game_id" of relation "players" does not exist')) {
         console.error(`CRITICAL DATABASE SCHEMA ISSUE: The 'players' table is missing the 'game_id' column. Cannot add player.`);
    }
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
    if (deletePlayersError.message.includes('column players.game_id does not exist')) {
      console.error(`CRITICAL DATABASE SCHEMA ISSUE during reset: The 'players' table is missing the 'game_id' column. Cannot delete players effectively.`);
    } else {
      console.error('Error deleting players:', deletePlayersError);
    }
  }


  // Delete player_hands entries for this game
  const { error: deleteHandsError } = await supabase
    .from('player_hands')
    .delete()
    .eq('game_id', gameId); // Assumes player_hands has game_id
  if (deleteHandsError) console.error('Error deleting player hands:', deleteHandsError);

  // Delete responses (submissions) for this game
  const { error: deleteResponsesError } = await supabase
    .from('responses')
    .delete()
    .eq('game_id', gameId); // Assumes responses has game_id
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
    // updated_at will be handled by Supabase by default or a trigger
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
// This function might not be needed if player data is part of GameClientState
export async function getCurrentPlayer(playerId: string): Promise<PlayerClientState | undefined> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (error || !data) {
    console.error(`Error fetching player ${playerId}:`, error);
    return undefined;
  }

  // To determine if this player is a judge, we'd ideally have game context
  // For now, this simplified version can't reliably set isJudge
  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    score: data.score,
    isJudge: false, // Placeholder: This needs context from the game's current_judge_id
    hand: [], // Placeholder: Hand data requires joining with player_hands and response_cards
    isReady: data.is_ready,
  };
}
