
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/lib/database.types';
import { CARDS_PER_HAND } from '@/lib/types';

// Helper function to get a specified number of random, unique, unused cards
async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  console.log(`🔴 CARDS (Server): Dealing ${count} cards for game ${gameId}. Current used_responses: ${existingUsedResponses.length}`);

  const { data: availableCards, error: fetchError } = await supabase
    .from('response_cards')
    .select('id')
    .eq('is_active', true)
    .not('id', 'in', `(${existingUsedResponses.map(id => `'${id}'`).join(',') || "''"})`); // Exclude already used cards

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }

  if (!availableCards || availableCards.length === 0) {
    console.warn(`🔴 CARDS (Server): No available response cards to deal for game ${gameId}.`);
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }

  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  const updatedUsedResponses = [...new Set([...existingUsedResponses, ...dealtCardIds])];

  console.log(`🔴 CARDS (Server): Dealt ${dealtCardIds.length} cards for game ${gameId}. New used_responses count: ${updatedUsedResponses.length}`);
  return { dealtCardIds, updatedUsedResponses };
}


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
    console.error(`Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    // Don't throw, proceed with empty player list for resilience
  } else {
    playersData = fetchedPlayersData || [];
  }
   console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}:`, JSON.stringify(playersData.map(p=>p.name)));

  // Fetch hands for all players in this game
  const playerIds = playersData.map(p => p.id);
  let allHandsData: { player_id: string, response_card_id: string, response_cards: { text: string | null } | null }[] = [];
  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('player_id, response_card_id, response_cards (text)')
      .in('player_id', playerIds)
      .eq('game_id', gameId);

    if (handsError) {
      console.error(`Error fetching hands for players in game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = fetchedHandsData || [];
    }
  }

  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards = allHandsData
      .filter(h => h.player_id === p.id && h.response_cards?.text)
      .map(h => h.response_cards!.text as string); // Assert text is not null due to filter
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
    .select('category', { count: 'exact', head: false }); // Optimization to only fetch distinct categories

  let categories: string[] = ["Default Category"]; // Default in case of error or no categories
  if (categoriesError) {
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  } else if (categoriesData) {
    const distinctCategories = [...new Set(categoriesData.map(c => c.category).filter(c => c !== null) as string[])];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
    }
  }
  console.log(`DEBUG: getGame - Categories for game ${gameId}:`, categories);


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
      .from('responses') 
      .select('player_id, response_card_id, response_cards(text)') 
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error('Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      submissions = submissionData.map((s: any) => {
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
  console.log(`DEBUG: getGame - Returning GameClientState for gameId ${gameId} with phase: ${gameClientState.gamePhase} and ${gameClientState.players.length} players.`);
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

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { 
    console.error('🔴 PLAYER (Server): Error checking for existing player:', JSON.stringify(checkError, null, 2));
    return null;
  }
  if (existingPlayer) {
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
    joined_at: new Date().toISOString(), // Explicitly set joined_at
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
  revalidatePath('/game'); 
  return newPlayer;
}


export async function resetGameForTesting() {
  console.log("🔴 RESET (Server): resetGameForTesting action called");

  let gameToReset: Tables<'games'> | null = null;
  try {
    console.log("🔴 RESET (Server): Finding the oldest existing game...");
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase') 
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 RESET (Server): Error fetching game to reset:", JSON.stringify(fetchError, null, 2));
      // Don't redirect yet, try to recover or allow deletion of non-existent game
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
    console.error('🔴 RESET (Server): CRITICAL - Could not identify a game to reset after fetch logic. Attempting to create one on redirect.');
    revalidatePath('/'); 
    revalidatePath('/game');
    redirect('/?step=setup');
    return;
  }
  
  const gameId = gameToReset.id;
  console.log(`🔴 RESET (Server): Proceeding to reset game ID: ${gameId}`);

  const deletionOrder: { name: string; table: keyof Database['public']['Tables'] }[] = [
    { name: 'player_hands', table: 'player_hands' },
    { name: 'responses (submissions)', table: 'responses' },
    { name: 'winners', table: 'winners' },
    { name: 'players', table: 'players' },
  ];

  for (const item of deletionOrder) {
    console.log(`🔴 RESET (Server): Deleting from ${item.name} for game ${gameId}...`);
    const { error: deleteError } = await supabase.from(item.table).delete().eq('game_id', gameId);
    if (deleteError) {
      console.error(`🔴 RESET (Server): Error deleting ${item.name} for game ${gameId}:`, JSON.stringify(deleteError, null, 2));
    } else {
      console.log(`🔴 RESET (Server): Successfully deleted ${item.name} for game ${gameId}.`);
    }
  }

  console.log(`🔴 RESET (Server): Attempting to DELETE game row ${gameId} from 'games' table.`);
  const { error: deleteGameError } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId);

  if (deleteGameError) {
    console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to DELETE game row ${gameId}:`, JSON.stringify(deleteGameError, null, 2));
  } else {
    console.log(`🔴 RESET (Server): Game row ${gameId} successfully DELETED.`);
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
    return getGame(); 
  }

  if (game.game_phase === 'lobby') {
    const { data: players, error: playersFetchError } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true }); 

    if (playersFetchError || !players || players.length < 2) { 
      console.error(`Error fetching players or not enough players (need at least 2) for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
      return getGame(); 
    }

    const firstJudgeId = players[0].id;
    console.log(`DEBUG: Assigning player ${firstJudgeId} as the first judge for game ${gameId}`);

    // Deal cards to non-judge players
    let currentUsedResponses = game.used_responses || [];
    for (const player of players) {
      if (player.id !== firstJudgeId) { // Don't deal to judge
        const { dealtCardIds, updatedUsedResponses } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, currentUsedResponses);
        currentUsedResponses = updatedUsedResponses;

        if (dealtCardIds.length > 0) {
          const handInserts = dealtCardIds.map(cardId => ({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
            is_new: true, // Mark as new for potential UI highlights
          }));
          const { error: handInsertError } = await supabase.from('player_hands').insert(handInserts);
          if (handInsertError) {
            console.error(`🔴 CARDS (Server): Error inserting hand for player ${player.id}:`, JSON.stringify(handInsertError, null, 2));
          } else {
            console.log(`🔴 CARDS (Server): Successfully dealt ${dealtCardIds.length} cards to player ${player.id}`);
          }
        }
      }
    }

    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: firstJudgeId,
      current_round: 1, 
      updated_at: new Date().toISOString(),
      used_responses: currentUsedResponses, // Save updated list of used response cards
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      return getGame(); 
    }
     console.log(`DEBUG: Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1`);
  } else {
     console.warn(`DEBUG: startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return null; 
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`DEBUG: selectCategory action called for game ${gameId} with category ${category}`);
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('used_scenarios')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`Error fetching game ${gameId} for category selection:`, JSON.stringify(gameError, null, 2));
    return getGame();
  }

  const usedScenarios = game.used_scenarios || [];

  // Fetch a random scenario from the selected category that hasn't been used
  // This logic might need adjustment if too many scenarios get used up quickly
  const { data: scenarios, error: scenarioFetchError } = await supabase
    .from('scenarios')
    .select('id')
    .eq('category', category)
    .not('id', 'in', `(${usedScenarios.map(id => `'${id}'`).join(',') || "''"})`); // Exclude already used scenarios

  if (scenarioFetchError) {
    console.error(`Error fetching scenarios for category ${category} in game ${gameId}:`, JSON.stringify(scenarioFetchError, null, 2));
    return getGame();
  }

  if (!scenarios || scenarios.length === 0) {
    console.warn(`No unused scenarios found for category ${category} in game ${gameId}. Consider adding more or resetting used_scenarios.`);
    // Potentially pick from any category if this one is exhausted, or end game
    // For now, just return current state
    return getGame(); 
  }

  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  const newScenarioId = randomScenario.id;

  const updatedUsedScenarios = [...new Set([...usedScenarios, newScenarioId])];

  const gameUpdates: TablesUpdate<'games'> = {
    current_scenario_id: newScenarioId,
    game_phase: 'player_submission',
    used_scenarios: updatedUsedScenarios,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('games')
    .update(gameUpdates)
    .eq('id', gameId);

  if (updateError) {
    console.error(`Error updating game ${gameId} after category selection:`, JSON.stringify(updateError, null, 2));
  } else {
    console.log(`DEBUG: Game ${gameId} moved to player_submission with scenario ${newScenarioId}`);
  }

  revalidatePath('/game');
  return getGame(); 
}


export async function submitResponse(playerId: string, responseCardId: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`DEBUG: submitResponse action by ${playerId} with card ${responseCardId} for game ${gameId} round ${currentRound}`);
  
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id, used_responses')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`Error fetching game data for submitResponse (game ${gameId}):`, gameFetchError);
    return getGame();
  }

  // 1. Insert into 'responses' table
  const { error: insertError } = await supabase
    .from('responses')
    .insert({
      game_id: gameId,
      player_id: playerId,
      response_card_id: responseCardId,
      round_number: currentRound,
    });

  if (insertError) {
    console.error(`Error inserting submission for player ${playerId} in game ${gameId}:`, JSON.stringify(insertError, null, 2));
    return getGame();
  }

  // 2. Remove submitted card from 'player_hands' for that player
  const { error: deleteHandError } = await supabase
    .from('player_hands')
    .delete()
    .eq('player_id', playerId)
    .eq('response_card_id', responseCardId)
    .eq('game_id', gameId);

  if (deleteHandError) {
    console.error(`Error deleting card ${responseCardId} from hand of player ${playerId}:`, JSON.stringify(deleteHandError, null, 2));
    // Continue, as submission is already recorded
  }

  // 3. Deal a new card to that player
  let currentUsedResponses = gameData.used_responses || [];
  const { dealtCardIds, updatedUsedResponses } = await dealCardsFromSupabase(gameId, 1, currentUsedResponses);
  currentUsedResponses = updatedUsedResponses;

  if (dealtCardIds.length > 0) {
    const { error: newCardInsertError } = await supabase
      .from('player_hands')
      .insert({
        game_id: gameId,
        player_id: playerId,
        response_card_id: dealtCardIds[0],
        is_new: true,
      });
    if (newCardInsertError) {
      console.error(`Error dealing new card to player ${playerId}:`, JSON.stringify(newCardInsertError, null, 2));
    }
    // Update used_responses in games table
    const { error: gameUpdateError } = await supabase
        .from('games')
        .update({ used_responses: currentUsedResponses, updated_at: new Date().toISOString() })
        .eq('id', gameId);
    if (gameUpdateError) {
        console.error(`Error updating used_responses for game ${gameId} after dealing new card:`, JSON.stringify(gameUpdateError, null, 2));
    }

  } else {
    console.warn(`Could not deal a new card to player ${playerId}, no cards available.`);
  }

  // 4. Check if all non-judge players have submitted
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000'); // Exclude judge

  if (playersError) {
    console.error('Error fetching players to check submissions:', JSON.stringify(playersError, null, 2));
    return getGame();
  }

  const nonJudgePlayerIds = players?.map(p => p.id) || [];

  const { data: submissions, error: submissionsError } = await supabase
    .from('responses')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('round_number', currentRound);
  
  if (submissionsError) {
    console.error('Error fetching submissions to check count:', JSON.stringify(submissionsError, null, 2));
    return getGame();
  }
  
  const submittedPlayerIds = submissions?.map(s => s.player_id) || [];
  const allNonJudgesSubmitted = nonJudgePlayerIds.every(id => submittedPlayerIds.includes(id));

  if (allNonJudgesSubmitted && nonJudgePlayerIds.length > 0) {
    console.log(`All ${nonJudgePlayerIds.length} non-judge players have submitted for round ${currentRound}. Moving to judging.`);
    const { error: phaseUpdateError } = await supabase
      .from('games')
      .update({ game_phase: 'judging', updated_at: new Date().toISOString() })
      .eq('id', gameId);
    if (phaseUpdateError) {
      console.error('Error updating game phase to judging:', JSON.stringify(phaseUpdateError, null, 2));
    }
  } else {
     console.log(`Waiting for more submissions. ${submittedPlayerIds.length}/${nonJudgePlayerIds.length} submitted.`);
  }

  revalidatePath('/game');
  return getGame(); 
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
  return getGame(); 
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`DEBUG: nextRound action called for game ${gameId}`);
  // TODO: Implement with Supabase
  // 1. Determine next judge based on ready_player_order.
  // 2. Update 'games' table: current_judge_id, current_round increment, current_scenario_id to null, game_phase to 'category_selection'.
  // 3. Clear 'responses' table for the previous round for this game_id.
  // 4. Revalidate paths
  revalidatePath('/game');
  return getGame(); 
}


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

  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`Error fetching game data for judge check (player ${playerId}, game ${gameId}):`, JSON.stringify(gameFetchError, null, 2));
    // Continue, but isJudge might be inaccurate if gameData is missing
  }
  
  let handCards: string[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards ( text )')
    .eq('player_id', playerId)
    .eq('game_id', gameId); 

  if (handError) {
    console.error(`Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    handCards = handData
      .map((h: any) => h.response_cards?.text) 
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
    
 
  
