
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND } from '@/lib/types';


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
    // Continue to try other methods, don't throw yet
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
    // If this also fails, we must try to create
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
    console.error("🔴 GAME (Server): Error creating new game:", JSON.stringify(createError, null, 2));
    const supabaseErrorMessage = createError ? createError.message : "New game data was unexpectedly null after insert operation.";
    if (createError && createError.message.includes('violates RLS policy')) {
        throw new Error(`Could not create a new game. Supabase error: INSERT on "games" violates RLS policy. Please check RLS settings for the 'games' table in your Supabase project.`);
    }
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
    if (playersError.message.includes('column players.game_id does not exist')) {
        console.error("🔴 CRITICAL SCHEMA ERROR: The 'players' table is missing the 'game_id' column. Please add it in your Supabase dashboard.");
    }
    // Don't throw, allow page to potentially load with empty player list if it's a non-critical fetch error
  } else {
    playersData = fetchedPlayersData || [];
  }
   console.log(`DEBUG: getGame - Fetched ${playersData.length} players for gameId ${gameId}:`, JSON.stringify(playersData.map(p=>p.name)));

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
      .map(h => h.response_cards!.text as string);
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

  let categories: string[] = ["Default Category"];
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
    gamePhase: gameRow.game_phase as GamePhaseClientState,
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
    throw new Error('Could not find or create game session to add player.');
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
    throw new Error(`Error checking for existing player: ${checkError.message}`);
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
        throw new Error(`Error re-fetching existing player: ${fetchExistingError.message}`);
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
  console.log("🔴 RESET (Server): Minimal reset - Attempting to set oldest game to lobby.");

  let gameToReset: Tables<'games'> | null = null;
  try {
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase') // Only select what's needed for update
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 RESET (Server): Minimal reset - Error fetching game to reset:", JSON.stringify(fetchError, null, 2));
      redirect('/?step=setup'); // Still redirect, client will handle new game creation if this fails
      return;
    }

    if (existingGames && existingGames.length > 0) {
      gameToReset = existingGames[0];
      console.log(`🔴 RESET (Server): Minimal reset - Found game ${gameToReset.id} in phase ${gameToReset.game_phase}. Attempting update to lobby.`);
      
      const updatedGameData: TablesUpdate<'games'> = {
        game_phase: 'lobby',
        current_round: 0,
        current_judge_id: null,
        current_scenario_id: null,
        ready_player_order: [],
        last_round_winner_player_id: null,
        last_round_winning_card_text: null,
        overall_winner_player_id: null,
        used_scenarios: [], // Clear used scenarios
        used_responses: [], // Clear used responses
        updated_at: new Date().toISOString(),
      };
      
      const { error: updateError } = await supabase
        .from('games')
        .update(updatedGameData)
        .eq('id', gameToReset.id);

      if (updateError) {
        console.error(`🔴 RESET (Server): Minimal reset - FAILED to update game ${gameToReset.id} to lobby:`, JSON.stringify(updateError, null, 2));
      } else {
        console.log(`🔴 RESET (Server): Minimal reset - SUCCESSFULLY updated game ${gameToReset.id} to lobby.`);
        // Also, clear related tables for this game ID for a cleaner state
        const relatedTables = ['player_hands', 'responses', 'winners', 'players'];
        for (const table of relatedTables) {
          console.log(`🔴 RESET (Server): Minimal reset - Clearing ${table} for game ${gameToReset.id}`);
          const { error: deleteError } = await supabase.from(table).delete().eq('game_id', gameToReset.id);
          if (deleteError) {
            console.error(`🔴 RESET (Server): Minimal reset - Error clearing ${table} for game ${gameToReset.id}:`, JSON.stringify(deleteError, null, 2));
          }
        }
      }
    } else {
      console.log('🔴 RESET (Server): Minimal reset - No existing game found to reset. A new game will be created if needed on next load.');
    }
  } catch (e: any) {
    if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e; 
    }
    console.error('🔴 RESET (Server): Minimal reset - Unexpected error:', e.message);
    // Attempt to redirect even if an unexpected error occurs to avoid a stuck state
  }

  console.log('🔴 RESET (Server): Minimal reset process complete, revalidating paths and redirecting.');
  revalidatePath('/');
  revalidatePath('/game');
  redirect('/?step=setup');
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  console.log(`🔴 CARDS (Server): Dealing ${count} cards for game ${gameId}. Current used_responses: ${existingUsedResponses.length}`);

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
  
  // Combine with any cards just used in this transaction but not yet committed to games.used_responses
  const allKnownUsedResponses = [...new Set([...currentUsedResponsesInGame, ...existingUsedResponses])];

  const notInFilterValue = allKnownUsedResponses.length > 0 
    ? `(${allKnownUsedResponses.map(id => `'${id}'`).join(',')})` 
    : `('')`; // Handle empty array case for NOT IN

  const { data: availableCards, error: fetchError } = await supabase
    .from('response_cards')
    .select('id')
    .eq('is_active', true)
    .not('id', 'in', notInFilterValue);

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  if (!availableCards || availableCards.length === 0) {
    console.warn(`🔴 CARDS (Server): No available response cards to deal for game ${gameId}. Total known used: ${allKnownUsedResponses.length}`);
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  
  // The updatedUsedResponses returned here will be the new comprehensive list
  // to be stored back in the 'games' table by the calling function.
  const finalUsedResponses = [...new Set([...allKnownUsedResponses, ...dealtCardIds])];

  console.log(`🔴 CARDS (Server): Dealt ${dealtCardIds.length} cards for game ${gameId}. New total used_responses count for game update: ${finalUsedResponses.length}`);
  return { dealtCardIds, updatedUsedResponses: finalUsedResponses };
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
      .select('id')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true }); 

    if (playersFetchError || !players || players.length < 2) { 
      console.error(`🔴 START (Server): Error fetching players or not enough players (need at least 2) for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)} Players found: ${players?.length}`);
      throw new Error(`Not enough players to start game (found ${players?.length || 0}, need at least 2). Or ${playersFetchError?.message}`);
    }

    const firstJudgeId = players[0].id;
    console.log(`🔴 START (Server): Assigning player ${firstJudgeId} as the first judge for game ${gameId}`);

    let currentUsedResponses = game.used_responses || [];
    for (const player of players) {
      if (player.id !== firstJudgeId) { 
        const { dealtCardIds, updatedUsedResponses } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, currentUsedResponses);
        // Note: dealCardsFromSupabase now returns the *final* list of used responses for the game update.
        // For intermediate calls within this loop, 'currentUsedResponses' for the *next* call to dealCardsFromSupabase
        // should technically be this 'updatedUsedResponses'.
        // However, dealCardsFromSupabase itself now re-fetches from games.used_responses, making it more robust.
        // The final 'updatedUsedResponses' from the last player dealt to is what we'll store in the game update.
        currentUsedResponses = updatedUsedResponses; // Accumulate used responses for the final game update.


        if (dealtCardIds.length > 0) {
          const handInserts = dealtCardIds.map(cardId => ({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
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
      used_responses: currentUsedResponses, // Store the comprehensively updated list
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`🔴 START (Server): Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
     console.log(`🔴 START (Server): Game ${gameId} started. Judge: ${firstJudgeId}, Phase: category_selection, Round: 1`);
  } else {
     console.warn(`🔴 START (Server): startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return null; 
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔴 CATEGORY (Server): selectCategory action for game ${gameId}, category ${category}`);
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('used_scenarios, current_judge_id') // Also fetch judge to ensure only judge can do this (optional check here)
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 CATEGORY (Server): Error fetching game ${gameId} for category selection:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  // Optional: Add a check here if the calling user is the current_judge_id if you pass userId to this action.

  const usedScenarios = game.used_scenarios || [];
  // Ensure the notInFilterValue correctly handles empty arrays for Supabase
  const notInScenarioFilterValue = usedScenarios.length > 0 
    ? `(${usedScenarios.map(id => `'${id}'`).join(',')})` 
    : `('')`; // Important: Supabase .not('id', 'in', '()') might behave unexpectedly. '' might also be tricky.
               // The safest is to conditionally apply .not() if usedScenarios.length > 0.

  let query = supabase
    .from('scenarios')
    .select('id')
    .eq('category', category)
    .eq('is_active', true);
  
  if (usedScenarios.length > 0) {
    query = query.not('id', 'in', notInScenarioFilterValue);
  }

  const { data: scenarios, error: scenarioFetchError } = await query;

  if (scenarioFetchError) {
    console.error(`🔴 CATEGORY (Server): Error fetching scenarios for category ${category}:`, JSON.stringify(scenarioFetchError, null, 2));
    throw new Error(`Error fetching scenarios for category ${category}: ${scenarioFetchError.message}`);
  }

  if (!scenarios || scenarios.length === 0) {
    console.warn(`🔴 CATEGORY (Server): No unused scenarios for category ${category}. Consider resetting used_scenarios or adding more.`);
    // Potentially reset used_scenarios for this category if all are used up, or return a specific message.
    // For now, throw an error to indicate to the user.
    throw new Error(`No new scenarios available in category "${category}". The Judge might need to pick another!`);
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
    console.error(`🔴 CATEGORY (Server): Error updating game after category selection:`, JSON.stringify(updateError, null, 2));
    throw new Error(`Failed to update game after category selection: ${updateError.message}`);
  }
  console.log(`🔴 CATEGORY (Server): Game ${gameId} moved to player_submission with scenario ${newScenarioId}`);
  
  revalidatePath('/game');
  return getGame(); // Fetch and return the full game state
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number): Promise<GameClientState | null> {
  console.log(`🔴 SUBMIT (Server): Player ${playerId} trying to submit card text "${responseCardText}" for game ${gameId} round ${currentRound}`);
  
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

  // Find the response_card_id based on the text from player's hand
  const { data: handCardData, error: handCardError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards!inner(text)')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .eq('response_cards.text', responseCardText)
    .single();

  if (handCardError || !handCardData) {
    console.error(`🔴 SUBMIT (Server): Error finding card with text "${responseCardText}" in hand of player ${playerId} for game ${gameId}:`, JSON.stringify(handCardError, null, 2));
    throw new Error(`Could not find card "${responseCardText}" in your hand.`);
  }
  const responseCardId = handCardData.response_card_id;
  console.log(`🔴 SUBMIT (Server): Player ${playerId} submitted card ID ${responseCardId} (text: "${responseCardText}")`);


  // Check if player has already submitted for this round
  const { data: existingSubmission, error: checkSubmissionError } = await supabase
    .from('responses')
    .select('id')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('round_number', currentRound)
    .maybeSingle(); // Use maybeSingle to handle 0 or 1 row

  if (checkSubmissionError) {
    console.error(`🔴 SUBMIT (Server): Error checking for existing submission for player ${playerId}:`, JSON.stringify(checkSubmissionError, null, 2));
    throw new Error(`Error verifying submission status: ${checkSubmissionError.message}`);
  }
  if (existingSubmission) {
    console.warn(`🔴 SUBMIT (Server): Player ${playerId} has already submitted a card for round ${currentRound}.`);
    throw new Error("You have already submitted a card for this round.");
  }


  const { error: insertError } = await supabase
    .from('responses')
    .insert({
      game_id: gameId,
      player_id: playerId,
      response_card_id: responseCardId, 
      round_number: currentRound,
    });

  if (insertError) {
    console.error(`🔴 SUBMIT (Server): Error inserting submission for player ${playerId}:`, JSON.stringify(insertError, null, 2));
    throw new Error(`Failed to insert submission: ${insertError.message}`);
  }

  // Delete played card from hand
  const { error: deleteHandError } = await supabase
    .from('player_hands')
    .delete()
    .eq('player_id', playerId)
    .eq('response_card_id', responseCardId)
    .eq('game_id', gameId);

  if (deleteHandError) {
    console.error(`🔴 SUBMIT (Server): Error deleting card ${responseCardId} from hand of ${playerId}:`, JSON.stringify(deleteHandError, null, 2));
    // Not throwing, but logging. Card is submitted.
  }

  // Mark this response card ID as used for the game and deal a new card
  let gameUsedResponses = gameData.used_responses || [];
  const { dealtCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, [...gameUsedResponses, responseCardId]);
  
  if (dealtCardIds.length > 0) {
    const { error: newCardInsertError } = await supabase
      .from('player_hands')
      .insert({
        game_id: gameId,
        player_id: playerId,
        response_card_id: dealtCardIds[0],
      });
    if (newCardInsertError) {
      console.error(`🔴 SUBMIT (Server): Error dealing new card to player ${playerId}:`, JSON.stringify(newCardInsertError, null, 2));
    }
  } else {
    console.warn(`🔴 SUBMIT (Server): Could not deal new card to player ${playerId}, no cards available.`);
  }
  
  // Update the game's used_responses list
  const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() })
      .eq('id', gameId);
  if (gameUpdateError) {
      console.error(`🔴 SUBMIT (Server): Error updating game.used_responses:`, JSON.stringify(gameUpdateError, null, 2));
  }


  // Check if all non-judge players have submitted
  const { data: nonJudgePlayers, error: playersError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000'); 

  if (playersError) {
    console.error('🔴 SUBMIT (Server): Error fetching players to check submissions:', JSON.stringify(playersError, null, 2));
    throw new Error(`Failed to fetch players for submission check: ${playersError.message}`);
  }

  const nonJudgePlayerIds = nonJudgePlayers?.map(p => p.id) || [];

  const { data: submissions, error: submissionsError } = await supabase
    .from('responses')
    .select('player_id', { count: 'exact' }) // Request count for optimization
    .eq('game_id', gameId)
    .eq('round_number', currentRound);
  
  if (submissionsError) {
    console.error('🔴 SUBMIT (Server): Error fetching submissions count:', JSON.stringify(submissionsError, null, 2));
    throw new Error(`Failed to fetch submissions count: ${submissionsError.message}`);
  }
  
  const submittedPlayerIds = submissions?.map(s => s.player_id) || [];
  const allNonJudgesSubmitted = nonJudgePlayerIds.every(id => submittedPlayerIds.includes(id));

  if (allNonJudgesSubmitted && nonJudgePlayerIds.length > 0) {
    console.log(`🔴 SUBMIT (Server): All ${nonJudgePlayerIds.length} non-judge players submitted for round ${currentRound}. Moving to judging.`);
    const { error: phaseUpdateError } = await supabase
      .from('games')
      .update({ game_phase: 'judging', updated_at: new Date().toISOString() })
      .eq('id', gameId);
    if (phaseUpdateError) {
      console.error('🔴 SUBMIT (Server): Error updating game phase to judging:', JSON.stringify(phaseUpdateError, null, 2));
      // Not throwing, but logging error.
    }
  } else {
     console.log(`🔴 SUBMIT (Server): Waiting for more submissions. ${submittedPlayerIds.length}/${nonJudgePlayerIds.length} submitted for round ${currentRound}.`);
  }

  revalidatePath('/game');
  return getGame(); // Return the full game state
}


export async function selectWinner(winningCardText: string, gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 WINNER (Server): Judge selecting winner with card text "${winningCardText}" for game ${gameId}`);
  
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_round, current_judge_id, players!inner(id, score)') // Fetch players to update score
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 WINNER (Server): Error fetching game ${gameId}:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);
  }
  
  // Find the submission that matches the winning card text for the current round
  const { data: winningSubmissionData, error: submissionError } = await supabase
    .from('responses')
    .select('player_id, response_card_id, response_cards!inner(text)')
    .eq('game_id', gameId)
    .eq('round_number', game.current_round)
    .eq('response_cards.text', winningCardText)
    .single();

  if (submissionError || !winningSubmissionData) {
    console.error(`🔴 WINNER (Server): Error finding winning submission for card text "${winningCardText}" in round ${game.current_round}:`, JSON.stringify(submissionError, null, 2));
    throw new Error(`Could not find submission matching card "${winningCardText}".`);
  }

  const winningPlayerId = winningSubmissionData.player_id;
  const winningResponseCardId = winningSubmissionData.response_card_id;

  // Increment winner's score
  const winnerPlayerRecord = game.players.find(p => p.id === winningPlayerId);
  if (!winnerPlayerRecord) {
    console.error(`🔴 WINNER (Server): Winning player ${winningPlayerId} not found in game players list.`);
    throw new Error("Winning player record not found.");
  }
  const newScore = winnerPlayerRecord.score + 1;
  const { error: scoreUpdateError } = await supabase
    .from('players')
    .update({ score: newScore })
    .eq('id', winningPlayerId);

  if (scoreUpdateError) {
    console.error(`🔴 WINNER (Server): Error updating score for player ${winningPlayerId}:`, JSON.stringify(scoreUpdateError, null, 2));
    // Not throwing, but logging. Game state will reflect score based on what's in DB.
  } else {
    console.log(`🔴 WINNER (Server): Player ${winningPlayerId} score updated to ${newScore}.`);
  }

  // Record the winner for the round in the 'winners' table
  const { error: winnerInsertError } = await supabase
    .from('winners')
    .insert({
      game_id: gameId,
      round_number: game.current_round,
      winner_player_id: winningPlayerId,
      winning_response_card_id: winningResponseCardId,
    });

  if (winnerInsertError) {
    console.error(`🔴 WINNER (Server): Error inserting round winner into 'winners' table:`, JSON.stringify(winnerInsertError, null, 2));
  }

  // Update game state for winner announcement
  // Check if this win ends the game
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
    last_round_winning_card_text: winningCardText, // Store text for easy display
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
  return getGame(); // Return the full game state
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 NEXT ROUND (Server): nextRound action called for game ${gameId}`);

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*') // Fetch all game data to determine next judge, etc.
    .eq('id', gameId)
    .single();
  
  if (gameError || !game) {
    console.error(`🔴 NEXT ROUND (Server): Error fetching game ${gameId} for next round:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for next round: ${gameError?.message || 'Game not found'}`);
  }

  if (game.game_phase === 'game_over') {
    console.log(`🔴 NEXT ROUND (Server): Game ${gameId} is over. Resetting to lobby.`);
    // This should ideally call resetGameForTesting or a similar full reset.
    // For now, let's just set it to lobby. A more robust reset would clear players etc.
    // A "Play Again" button should perhaps call resetGameForTesting.
    const { error: resetToLobbyError } = await supabase
      .from('games')
      .update({ 
        game_phase: 'lobby', 
        current_round: 0, 
        current_judge_id: null, 
        current_scenario_id: null,
        ready_player_order: [], // Reset ready order
        last_round_winner_player_id: null,
        last_round_winning_card_text: null,
        overall_winner_player_id: null,
        // It's important to also clear used_scenarios and used_responses if truly starting a new game
        // or players will run out of cards/scenarios quickly.
        // This simple reset to lobby assumes cards/scenarios are plentiful or managed elsewhere.
        // For a full "play again", players might need to be re-dealt cards too.
        // This indicates a need for a more comprehensive resetGame vs. just nextRound.
        updated_at: new Date().toISOString(),
       })
      .eq('id', gameId);
    if (resetToLobbyError) {
      console.error(`🔴 NEXT ROUND (Server): Error resetting game ${gameId} to lobby after game_over:`, JSON.stringify(resetToLobbyError, null, 2));
    }
    revalidatePath('/');
    revalidatePath('/game');
    redirect('/?step=setup'); // Send players back to lobby
    return null; 
  }
  
  if (game.game_phase !== 'winner_announcement') {
    console.warn(`🔴 NEXT ROUND (Server): nextRound called but game ${gameId} is in phase ${game.game_phase}, not 'winner_announcement'.`);
    throw new Error("Cannot start next round, current round not finished.");
  }

  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id, joined_at') // Fetch joined_at for stable ordering if ready_player_order is empty
    .eq('game_id', gameId)
    // Ideally, order by ready_player_order if that system is in place
    // For now, use joined_at as a fallback for consistent ordering
    .order('joined_at', { ascending: true });

  if (playersFetchError || !players || players.length < 2) {
    console.error(`🔴 NEXT ROUND (Server): Error fetching players or not enough players for game ${gameId}:`, JSON.stringify(playersFetchError, null, 2));
    throw new Error(`Not enough players for next round (need at least 2). Or ${playersFetchError?.message}`);
  }

  // Determine next judge
  let nextJudgeId = game.current_judge_id;
  if (game.current_judge_id) {
    const currentJudgeIndex = players.findIndex(p => p.id === game.current_judge_id);
    if (currentJudgeIndex !== -1) {
      nextJudgeId = players[(currentJudgeIndex + 1) % players.length].id;
    } else {
      // Current judge not found in player list (should not happen), pick first player
      nextJudgeId = players[0].id;
      console.warn(`🔴 NEXT ROUND (Server): Current judge ${game.current_judge_id} not found in players list. Assigning first player ${nextJudgeId} as next judge.`);
    }
  } else {
    // No current judge (should not happen if game was started), pick first player
    nextJudgeId = players[0].id;
    console.warn(`🔴 NEXT ROUND (Server): No current judge assigned. Assigning first player ${nextJudgeId} as next judge.`);
  }
  console.log(`🔴 NEXT ROUND (Server): Assigning player ${nextJudgeId} as the next judge for game ${gameId}.`);

  // Prepare game updates for the new round
  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: nextJudgeId,
    current_round: game.current_round + 1,
    current_scenario_id: null, // Clear current scenario
    // last_round_winner fields are kept for display until the next winner is chosen
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
  return getGame(); // Return the full game state
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
    // Proceed with playerData, judge status might be default false
  }
  
  let handCards: string[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_card_id, response_cards (text)')
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
