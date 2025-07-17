
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState, PlayerHandCard } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN, MIN_PLAYERS_TO_START } from '@/lib/types';


export async function findOrCreateGame(): Promise<Tables<'games'>> {
  console.log("🔵 ACTION: findOrCreateGame - Initiated");
  const { data: lobbyGames, error: lobbyError } = await supabase
    .from('games')
    .select('*')
    .eq('game_phase', 'lobby')
    .order('created_at', { ascending: true })
    .limit(1);

  if (lobbyError) {
    console.error("🔴 ACTION: findOrCreateGame - Error fetching lobby games:", JSON.stringify(lobbyError, null, 2));
  }

  if (lobbyGames && lobbyGames.length > 0) {
    console.log("🔵 ACTION: findOrCreateGame - Found existing lobby game:", lobbyGames[0].id);
    return lobbyGames[0];
  }
  console.log("🔵 ACTION: findOrCreateGame - No lobby game found, checking for any existing game.");

  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error("🔴 ACTION: findOrCreateGame - Error fetching any existing games:", JSON.stringify(fetchError, null, 2));
  }

  if (existingGames && existingGames.length > 0) {
    console.log("🔵 ACTION: findOrCreateGame - Found existing game (not in lobby):", existingGames[0].id);
    return existingGames[0];
  }
  console.log("🔵 ACTION: findOrCreateGame - No games found, creating a new one.");

  const newGameData: TablesInsert<'games'> = {
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
    updated_at: new Date().toISOString(),
    transition_state: 'idle',
    transition_message: null,
  };
  const { data: newGame, error: createError } = await supabase
    .from('games')
    .insert(newGameData)
    .select()
    .single();

  if (createError || !newGame) {
    const errorMessage = createError ? createError.message : "New game data was unexpectedly null after insert operation.";
    console.error("🔴 ACTION: findOrCreateGame - Error creating new game:", errorMessage, JSON.stringify(createError, null, 2));
    if (createError && createError.message.includes('RLS')) {
        throw new Error(`Could not create a new game. Supabase error: ${errorMessage}. Possible RLS issue on 'games' table.`);
    }
    throw new Error(`Could not create a new game. Supabase error: ${errorMessage}`);
  }
  console.log("🔵 ACTION: findOrCreateGame - Successfully created new game:", newGame.id);
  return newGame;
}


export async function getGame(gameIdToFetch?: string): Promise<GameClientState> {
  console.log(`🔵 ACTION: getGame - Initiated. Requested gameId: ${gameIdToFetch || 'None'}`);
  let gameRow: Tables<'games'> | null = null;

  if (gameIdToFetch) {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameIdToFetch).single();
    if (error) {
      console.warn(`🟡 ACTION: getGame - Error fetching game ${gameIdToFetch}, will find/create new.`, error.message);
      gameRow = await findOrCreateGame();
    } else if (!data) {
      console.warn(`🟡 ACTION: getGame - No game data found for ${gameIdToFetch}, will find/create new.`);
      gameRow = await findOrCreateGame();
    } else {
      console.log(`🔵 ACTION: getGame - Successfully fetched game ${gameIdToFetch}.`);
      gameRow = data;
    }
  } else {
    console.log(`🔵 ACTION: getGame - No gameId provided, finding or creating game.`);
    gameRow = await findOrCreateGame();
  }

  if (!gameRow || !gameRow.id) {
    console.error("🔴 ACTION: getGame - CRITICAL - Failed to find or create a game session.");
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;
  console.log(`🔵 ACTION: getGame - Processing for gameId: ${gameId}. Phase: ${gameRow.game_phase}`);

  let playersData: Tables<'players'>[] = [];
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    console.error(`🔴 ACTION: getGame - Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    playersData = [];
  } else {
    playersData = fetchedPlayersData || [];
    console.log(`🔵 ACTION: getGame - Fetched ${playersData.length} players.`);
  }

  const playerIds = playersData.map(p => p.id);
  
  type HandDataWithCard = Tables<'player_hands'> & {
    response_cards: Pick<Tables<'response_cards'>, 'id' | 'text'> | null;
  };
  let allHandsData: HandDataWithCard[] = [];

  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('*, response_cards(id, text)')
      .in('player_id', playerIds)
      .eq('game_id', gameId);

    if (handsError) {
      console.error(`🔴 ACTION: getGame - Error fetching player hands for game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = (fetchedHandsData as HandDataWithCard[]) || [];
      console.log(`🔵 ACTION: getGame - Fetched ${allHandsData.length} total hand cards for all players.`);
    }
  }

  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards = allHandsData
      .filter(h => h.player_id === p.id)
      .map(h => {
        if (h.response_cards?.text && h.response_cards?.id) {
          return {
            id: h.response_cards.id,
            text: h.response_cards.text,
            isNew: h.is_new ?? false,
          };
        }
        return null;
      })
      .filter((card): card is PlayerHandCard => card !== null);
      
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar || '',
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
    console.error('🔴 ACTION: getGame - Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  } else if (categoriesData) {
    const distinctCategories = [...new Set(
        categoriesData.map(c => c.category)
                      .filter(c => c !== null && typeof c === 'string' && c.trim() !== '' && c.trim() !== "Boondoggles") as string[]
    )];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
      console.log(`🔵 ACTION: getGame - Loaded ${categories.length} distinct categories.`);
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
      console.error('🔴 ACTION: getGame - Error fetching current scenario:', JSON.stringify(scenarioError, null, 2));
    }
    if (scenarioData) {
      currentScenario = {
        id: scenarioData.id,
        category: scenarioData.category || 'Unknown',
        text: scenarioData.text,
      };
      console.log(`🔵 ACTION: getGame - Loaded current scenario:`, currentScenario);
    }
  }
  
  type SubmissionWithCard = Tables<'responses'> & {
    response_cards: Pick<Tables<'response_cards'>, 'id' | 'text'> | null;
  };
  let submissions: GameClientState['submissions'] = [];
  if ((gameRow.game_phase === 'judging' || gameRow.game_phase === 'player_submission' || gameRow.game_phase === 'judge_approval_pending') && gameRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses')
      .select('*, response_cards(id, text)')
      .eq('game_id', gameId)
      .eq('round_number', gameRow.current_round);

    if (submissionError) {
      console.error(`🔴 ACTION: getGame - Error fetching submissions for round ${gameRow.current_round}:`, JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      submissions = (submissionData as SubmissionWithCard[]).map((s) => {
        const cardText = s.submitted_text || s.response_cards?.text || 'Error: Card text not found';
        const cardId = s.response_card_id || (s.submitted_text ? `custom-${s.player_id}-${gameRow.current_round}` : `error-${s.player_id}`);

        return {
          playerId: s.player_id,
          cardId: cardId,
          cardText: cardText,
        };
      });
      console.log(`🔵 ACTION: getGame - Loaded ${submissions.length} submissions for round ${gameRow.current_round}.`);
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
  
  const dbReadyPlayerOrder = gameRow.ready_player_order || [];

  const gameClientState: GameClientState = {
    gameId: gameId,
    players: players,
    currentRound: gameRow.current_round,
    currentJudgeId: gameRow.current_judge_id,
    currentScenario: currentScenario,
    gamePhase: gameRow.game_phase as GamePhaseClientState,
    submissions: submissions,
    categories: categories,
    lastWinner: lastWinnerDetails,
    winningPlayerId: gameRow.overall_winner_player_id,
    ready_player_order: dbReadyPlayerOrder,
    transitionState: gameRow.transition_state as GameClientState['transitionState'],
    transitionMessage: gameRow.transition_message,
  };
  
  console.log(`🔵 ACTION: getGame - Successfully built gameClientState for game ${gameId}. Returning.`);
  // console.log("State details:", JSON.stringify(gameClientState, null, 2)); // UNCOMMENT FOR EXTREME DETAIL
  return gameClientState;
}


export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  console.log(`🔵 ACTION: addPlayer - Initiated for name: "${name}"`);
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    console.error('🔴 ACTION: addPlayer - Failed to find or create a game session.');
    throw new Error('Could not find or create game session to add player.');
  }
  const gameId = gameRow.id;
  console.log(`🔵 ACTION: addPlayer - Game ID is ${gameId}. Phase: ${gameRow.game_phase}.`);

  if (gameRow.game_phase !== 'lobby') {
    console.warn(`🟡 ACTION: addPlayer - Cannot join game ${gameId}, phase is '${gameRow.game_phase}'.`);
    throw new Error(`Game is already in progress (phase: ${gameRow.game_phase}). Cannot join now.`);
  }

  const { data: existingPlayer, error: checkError } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', name)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116: no rows found
    console.error('🔴 ACTION: addPlayer - Error checking for existing player:', JSON.stringify(checkError, null, 2));
    throw new Error(`Error checking for existing player: ${checkError.message}`);
  }

  if (existingPlayer) {
    console.log(`🔵 ACTION: addPlayer - Player "${name}" already exists in game. Re-fetching full profile.`);
    const { data: fullExistingPlayer, error: fetchExistingError } = await supabase
        .from('players')
        .select('*')
        .eq('id', existingPlayer.id)
        .single();
    if (fetchExistingError) {
        console.error('🔴 ACTION: addPlayer - Error re-fetching existing player:', JSON.stringify(fetchExistingError, null, 2));
        throw new Error(`Error re-fetching existing player: ${fetchExistingError.message}`);
    }
    return fullExistingPlayer;
  }

  console.log(`🔵 ACTION: addPlayer - Creating new player record for "${name}".`);
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
    console.error('🔴 ACTION: addPlayer - Error adding new player:', JSON.stringify(insertError, null, 2));
    throw new Error(`Error adding new player: ${insertError.message}`);
  }
  if (!newPlayer) {
    console.error('🔴 ACTION: addPlayer - New player data was null after insert.');
    throw new Error('Failed to add player, server returned no player data.');
  }

  console.log(`🔵 ACTION: addPlayer - Successfully added player ${newPlayer.id} ("${name}"). Revalidating paths.`);
  revalidatePath('/');
  revalidatePath('/game');
  return newPlayer;
}

export async function resetGameForTesting() {
  console.warn("🔵 ACTION: resetGameForTesting - INITIATED. THIS IS A DESTRUCTIVE ACTION.");

  try {
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 ACTION: resetGameForTesting - Exception during game fetch:", fetchError.message);
      throw new Error(`Exception during game fetch for reset: ${fetchError.message}`);
    }

    if (!existingGames || existingGames.length === 0) {
      console.warn("🟡 ACTION: resetGameForTesting - No game found to reset. Redirecting to setup.");
      revalidatePath('/');
      revalidatePath('/game');
      revalidatePath('/?step=setup');
      redirect('/?step=setup');
      return;
    }

    const gameToReset = existingGames[0];
    const gameId = gameToReset.id;
    console.log(`🔵 ACTION: resetGameForTesting - Starting reset for game ${gameId}.`);

    const { error: clearPlayerRefsError } = await supabase
      .from('games')
      .update({ current_judge_id: null, last_round_winner_player_id: null, overall_winner_player_id: null })
      .eq('id', gameId);
    if (clearPlayerRefsError) console.error(`🔴 ACTION: resetGameForTesting - Error clearing player references in game ${gameId}:`, JSON.stringify(clearPlayerRefsError, null, 2));

    const tablesToClear = ['player_hands', 'responses', 'winners'];
    for (const table of tablesToClear) {
      console.log(`🔵 ACTION: resetGameForTesting - Clearing table: ${table}`);
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) console.error(`🔴 ACTION: resetGameForTesting - Error deleting from ${table}:`, JSON.stringify(deleteError, null, 2));
    }

    console.log(`🔵 ACTION: resetGameForTesting - Clearing players table.`);
    const { error: playersDeleteError } = await supabase.from('players').delete().eq('game_id', gameId);
    if (playersDeleteError) console.error(`🔴 ACTION: resetGameForTesting - Error deleting players:`, JSON.stringify(playersDeleteError, null, 2));
    
    const updateData: TablesUpdate<'games'> = {
      game_phase: 'lobby', current_round: 0, current_judge_id: null, current_scenario_id: null,
      ready_player_order: [], last_round_winner_player_id: null, last_round_winning_card_text: null,
      overall_winner_player_id: null, used_scenarios: [], used_responses: [],
      updated_at: new Date().toISOString(), transition_state: 'idle', transition_message: null,
    };
    console.log(`🔵 ACTION: resetGameForTesting - Updating game table to lobby state.`);
    const { error: updateError } = await supabase.from('games').update(updateData).eq('id', gameId);
    if (updateError) {
      console.error(`🔴 ACTION: resetGameForTesting - CRITICAL: Failed to update game to lobby phase:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
    }

    console.log(`🔵 ACTION: resetGameForTesting - Reset complete. Revalidating paths BEFORE redirect.`);
    revalidatePath('/');
    revalidatePath('/game');
    revalidatePath('/?step=setup');

  } catch (e: any) {
    console.error('🔴 ACTION: resetGameForTesting - Unexpected exception:', e.message, e.stack);
    if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
        // This is expected. We will let the final redirect() call handle it.
    } else {
       console.error("An error occurred during reset, but will attempt to redirect anyway.");
    }
  }

  // The redirect is the very last thing that happens, after all logic and revalidation.
  redirect('/?step=setup');
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  // Limited logging in this utility function to reduce noise
  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('used_responses')
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameData) {
    console.error(`🔴 UTIL: dealCards - Error fetching game data for dealing (game ${gameId}):`, gameFetchError);
    return { dealtCardIds: [], updatedUsedResponses: existingUsedResponses };
  }

  const allKnownUsedResponses = [...new Set([...(gameData.used_responses || []), ...existingUsedResponses])];
  
  let query = supabase.from('response_cards').select('id').eq('is_active', true);
  if (allKnownUsedResponses.length > 0) {
    const validUUIDs = allKnownUsedResponses.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
      query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
  }

  const { data: availableCards, error: fetchError } = await query.limit(count * 50);

  if (fetchError) {
    console.error(`🔴 UTIL: dealCards - Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }
  
  if (!availableCards || availableCards.length === 0) {
    console.error(`🔴 UTIL: dealCards - No available cards found for game ${gameId}.`);
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  const shuffled = [...availableCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const cardsToDeal = shuffled.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  const newlyDealtAndUsedInThisOperation = [...new Set([...allKnownUsedResponses, ...dealtCardIds])]; 
  return { dealtCardIds, updatedUsedResponses: newlyDealtAndUsedInThisOperation };
}

export async function startGame(gameId: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: startGame - Initiated for gameId: ${gameId}`);
  
  await supabase
    .from('games')
    .update({ transition_state: 'starting_game', transition_message: 'Preparing game...' })
    .eq('id', gameId);
  console.log(`🔵 ACTION: startGame - Set transition_state to 'starting_game'.`);

  const { data: game, error: gameFetchError } = await supabase
    .from('games').select('*').eq('id', gameId).single();

  if (gameFetchError || !game) {
    console.error(`🔴 ACTION: startGame - Error fetching game:`, JSON.stringify(gameFetchError, null, 2));
    await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Error fetching game' }).eq('id', gameId);
    throw new Error(`Failed to fetch game for start: ${gameFetchError?.message || 'Game not found'}`);
  }
  console.log(`🔵 ACTION: startGame - Fetched game. Phase: ${game.game_phase}`);

  if (game.game_phase === 'lobby') {
    const { data: players, error: playersFetchError } = await supabase
      .from('players').select('id, name, is_ready, joined_at').eq('game_id', gameId).order('joined_at', { ascending: true });

    if (playersFetchError || !players) {
      console.error(`🔴 ACTION: startGame - Error fetching players:`, JSON.stringify(playersFetchError, null, 2));
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Error fetching players' }).eq('id', gameId);
      throw new Error(`Failed to fetch players for start: ${playersFetchError?.message || 'No players found'}`);
    }
    console.log(`🔵 ACTION: startGame - Fetched ${players.length} players.`);
    
    if (players.length < MIN_PLAYERS_TO_START) {
      console.error(`🔴 ACTION: startGame - Not enough players. Found ${players.length}, need ${MIN_PLAYERS_TO_START}.`);
      await supabase.from('games').update({ transition_state: 'idle', transition_message: `Not enough players (${players.length})` }).eq('id', gameId);
      throw new Error(`Not enough players to start game (found ${players.length}, need at least ${MIN_PLAYERS_TO_START}).`);
    }

    const allPlayersReady = players.every(p => p.is_ready);
    if (!allPlayersReady) {
      console.error(`🔴 ACTION: startGame - Not all players are ready.`);
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Not all players are ready.' }).eq('id', gameId);
      throw new Error(`Not all players are ready. Cannot start the game yet.`);
    }
    console.log(`🔵 ACTION: startGame - All players are ready.`);

    const readyPlayerOrder = game.ready_player_order; 
    if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
        console.error(`🔴 ACTION: startGame - Cannot start. ready_player_order is empty. Value: ${JSON.stringify(readyPlayerOrder)}`);
        await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Player order not established.' }).eq('id', gameId);
        throw new Error("Critical error: Player order not established.");
    }
    console.log(`🔵 ACTION: startGame - Got ready_player_order: ${JSON.stringify(readyPlayerOrder)}`);

    const actualFirstJudgeId = readyPlayerOrder[0];
    if (!players.find(p => p.id === actualFirstJudgeId)) {
        console.error(`🔴 ACTION: startGame - First player in order (${actualFirstJudgeId}) not found in game players.`);
        await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Host player not found.' }).eq('id', gameId);
        throw new Error("Critical error: Host player in ready order not found.");
    }
    console.log(`🔵 ACTION: startGame - First judge will be ${actualFirstJudgeId}.`);

    await supabase.from('games').update({ transition_message: 'Dealing cards...' }).eq('id', gameId);
    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];
    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    for (const player of players) {
      console.log(`🔵 ACTION: startGame - Dealing cards for player ${player.id}`);
      const { dealtCardIds } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);
      if (dealtCardIds.length > 0) {
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({ game_id: gameId, player_id: player.id, response_card_id: cardId, is_new: false });
        });
        accumulatedUsedResponsesForThisGameStart = [...new Set([...accumulatedUsedResponsesForThisGameStart, ...dealtCardIds])];
      }
    }

    if (playerHandInserts.length > 0) {
      console.log(`🔵 ACTION: startGame - Inserting ${playerHandInserts.length} total cards into player_hands.`);
      const { error: allHandsInsertError } = await supabase.from('player_hands').insert(playerHandInserts);
      if (allHandsInsertError) {
        console.error(`🔴 ACTION: startGame - Critical error inserting player hands:`, JSON.stringify(allHandsInsertError, null, 2));
      }
    }

    await supabase.from('games').update({ transition_message: 'Selecting first judge...' }).eq('id', gameId);
    
    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection', current_judge_id: actualFirstJudgeId, current_round: 1,
      updated_at: new Date().toISOString(), used_responses: accumulatedUsedResponsesForThisGameStart,
      transition_state: 'idle', transition_message: null,
    };
    console.log(`🔵 ACTION: startGame - Updating game to 'category_selection'.`);
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);

    if (updateError) {
      console.error(`🔴 ACTION: startGame - Error updating game state to start:`, JSON.stringify(updateError, null, 2));
      await supabase.from('games').update({ transition_state: 'idle', transition_message: 'Failed to update game state.' }).eq('id', gameId);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
    console.log(`🔵 ACTION: startGame - Game successfully started. Revalidating paths.`);
  } else {
    console.warn(`🟡 ACTION: startGame - Called but game phase is '${game.game_phase}', not 'lobby'. No action taken.`);
  }
  
  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); 
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: selectCategory - Initiated for game ${gameId}, category "${category}"`);
  // --- Boondoggle Trigger Logic ---
  const { data: players, error: playersError } = await supabase.from('players').select('id, name').eq('game_id', gameId);
  const { data: gameForJudge, error: gameForJudgeError } = await supabase.from('games').select('current_judge_id, used_scenarios').eq('id', gameId).single();
  if (playersError || !players || gameForJudgeError || !gameForJudge) throw new Error("Could not fetch players or game for Boondoggle check.");
  
  const nonJudgePlayersCount = players.filter(p => p.id !== gameForJudge.current_judge_id).length;
  const isBoondoggle = Math.random() < 0.40 && nonJudgePlayersCount > 1;

  if (isBoondoggle) {
    console.log("🎲 ACTION: selectCategory - Boondoggle triggered!");
    let boondoggleQuery = supabase.from('scenarios').select('id, text, category').eq('category', 'Boondoggles');
    const usedScenarios = gameForJudge.used_scenarios || [];
    if (usedScenarios.length > 0) {
        const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
        if (validUUIDs.length > 0) boondoggleQuery = boondoggleQuery.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
    const { data: boondoggleScenarios, error: boondoggleError } = await boondoggleQuery;
    if (!boondoggleError && boondoggleScenarios && boondoggleScenarios.length > 0) {
      const scenarioToUse = boondoggleScenarios[Math.floor(Math.random() * boondoggleScenarios.length)];
      console.log("🎲 ACTION: selectCategory - Starting Boondoggle round with scenario:", scenarioToUse.id);
      const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])];
      const gameUpdates: TablesUpdate<'games'> = {
        game_phase: 'judging', current_scenario_id: scenarioToUse.id, last_round_winner_player_id: null,
        last_round_winning_card_text: null, used_scenarios: updatedUsedScenarios, updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
      if (updateError) throw new Error(`Failed to start Boondoggle round: ${updateError.message}`);
      revalidatePath('/game');
      return getGame(gameId);
    }
    console.warn("🟡 ACTION: selectCategory - Boondoggle triggered but no unused Boondoggles found. Proceeding with normal round.");
  }
  
  // --- Original selectCategory Logic ---
  const { data: game, error: gameError } = await supabase.from('games').select('used_scenarios').eq('id', gameId).single();
  if (gameError || !game) {
    console.error(`🔴 ACTION: selectCategory - Error fetching game:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  const usedScenarios = game.used_scenarios || [];
  let query = supabase.from('scenarios').select('id, text, category').eq('category', category);
  if (usedScenarios.length > 0) {
    const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
  }
  const { data: scenarios, error: scenarioFetchError } = await query;
  if (scenarioFetchError) {
    console.error(`🔴 ACTION: selectCategory - Error fetching scenarios:`, JSON.stringify(scenarioFetchError, null, 2));
    throw new Error(`Error fetching scenarios for category ${category}: ${scenarioFetchError.message}`);
  }

  let scenarioToUse: { id: string; text: string; category: string | null } | null = null;
  if (!scenarios || scenarios.length === 0) {
    console.warn(`🟡 ACTION: selectCategory - No unused scenarios in category "${category}". Recycling.`);
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase.from('scenarios').select('id, text, category').eq('category', category); 
    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 ACTION: selectCategory - Critical: No scenarios found for category ${category} at all.`);
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
    const gameUpdates: TablesUpdate<'games'> = { current_scenario_id: scenarioToUse.id, game_phase: 'player_submission', updated_at: new Date().toISOString() };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) throw new Error(`Failed to update game (recycle): ${updateError.message}`);
  } else {
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
    console.log(`🔵 ACTION: selectCategory - Selected scenario ${scenarioToUse.id}.`);
    const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])];
    const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id, game_phase: 'player_submission',
      used_scenarios: updatedUsedScenarios, updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) {
      console.error(`🔴 ACTION: selectCategory - Error updating game:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game: ${updateError.message}`);
    }
  }

  revalidatePath('/game');
  return getGame(gameId);
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number, isCustomSubmission: boolean): Promise<null> {
  console.log(`🔵 ACTION: submitResponse - Player ${playerId} submitted for round ${currentRound}. Custom: ${isCustomSubmission}`);
  const { data: gameData, error: gameFetchError } = await supabase.from('games').select('current_judge_id, used_responses, game_phase').eq('id', gameId).single();
  if (gameFetchError || !gameData) {
    console.error(`🔴 ACTION: submitResponse - Error fetching game ${gameId}:`, gameFetchError);
    throw new Error(`Failed to fetch game for submission: ${gameFetchError?.message || 'Game not found'}`);
  }
  if (gameData.game_phase !== 'player_submission') throw new Error(`Submissions not open. Phase: ${gameData.game_phase}.`);
  if (playerId === gameData.current_judge_id) throw new Error("Judges cannot submit cards.");

  const { data: existingSubmission, error: checkSubmissionError } = await supabase.from('responses').select('id').eq('game_id', gameId).eq('player_id', playerId).eq('round_number', currentRound).maybeSingle(); 
  if (checkSubmissionError) throw new Error(`Error verifying submission status: ${checkSubmissionError.message}`);
  if (existingSubmission) throw new Error("You have already submitted a card for this round.");

  let responseCardIdToStore: string | null = null, submittedTextToStore: string | null = null, cardToRemoveFromHandId: string | null = null;
  if (isCustomSubmission) {
    submittedTextToStore = responseCardText;
  } else {
    const { data: handCardEntry, error: handQueryError } = await supabase.from('player_hands').select('response_card_id, response_cards!inner(text)').eq('player_id', playerId).eq('game_id', gameId).eq('response_cards.text', responseCardText).limit(1).single();
    if (handQueryError || !handCardEntry) {
      console.error(`🔴 ACTION: submitResponse - Error finding card with text "${responseCardText}" in hand of player ${playerId}:`, JSON.stringify(handQueryError, null, 2));
      throw new Error(`Could not find card "${responseCardText}" in your hand.`);
    }
    responseCardIdToStore = handCardEntry.response_card_id;
    cardToRemoveFromHandId = handCardEntry.response_card_id; 
  }

  await supabase.from('player_hands').update({ is_new: false }).eq('player_id', playerId).eq('game_id', gameId);
  await supabase.from('responses').insert({ game_id: gameId, player_id: playerId, response_card_id: responseCardIdToStore, submitted_text: submittedTextToStore, round_number: currentRound });
  if (cardToRemoveFromHandId) await supabase.from('player_hands').delete().eq('player_id', playerId).eq('response_card_id', cardToRemoveFromHandId).eq('game_id', gameId);

  let gameUsedResponses = gameData.used_responses || [];
  const usedResponsesBeforeNewDeal = responseCardIdToStore ? [...new Set([...gameUsedResponses, responseCardIdToStore])] : gameUsedResponses;
  const { dealtCardIds: replacementCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, usedResponsesBeforeNewDeal);
  if (replacementCardIds.length > 0) {
    await supabase.from('player_hands').insert({ game_id: gameId, player_id: playerId, response_card_id: replacementCardIds[0], is_new: true });
  }
  await supabase.from('games').update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() }).eq('id', gameId);

  const { data: nonJudgePlayers } = await supabase.from('players').select('id', { count: 'exact' }).eq('game_id', gameId).neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000');
  const totalNonJudgePlayers = nonJudgePlayers?.length || 0;
  const { count: submissionsCount } = await supabase.from('responses').select('player_id', { count: 'exact', head: true }).eq('game_id', gameId).eq('round_number', currentRound);

  if (submissionsCount !== null && totalNonJudgePlayers > 0 && submissionsCount >= totalNonJudgePlayers) {
    console.log(`🔵 ACTION: submitResponse - All players submitted. Updating phase to 'judging'.`);
    await supabase.from('games').update({ game_phase: 'judging', updated_at: new Date().toISOString() }).eq('id', gameId);
  }

  revalidatePath('/game');
  return null;
}


export async function selectWinner(gameId: string, winningCardText: string, boondoggleWinnerId?: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: selectWinner - Initiated for game ${gameId}. Boondoggle winner: ${boondoggleWinnerId || 'N/A'}`);
  const { data: game, error: gameError } = await supabase.from('games').select('current_round, current_judge_id, current_scenario_id').eq('id', gameId).single();
  if (gameError || !game) throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);

  if (boondoggleWinnerId) {
    console.log(`🎲 ACTION: selectWinner - Processing Boondoggle winner: ${boondoggleWinnerId}`);
    const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', boondoggleWinnerId).single();
    if (!winnerPlayerData) throw new Error("Boondoggle winner player record not found.");
    const { data: scenarioData } = await supabase.from('scenarios').select('text').eq('id', game.current_scenario_id!).single();
    if (!scenarioData) throw new Error("Could not retrieve Boondoggle challenge text.");

    const newScore = winnerPlayerData.score + 1;
    await supabase.from('players').update({ score: newScore }).eq('id', boondoggleWinnerId);
    let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
    let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? boondoggleWinnerId : null;
    console.log(`🎲 ACTION: selectWinner - New score ${newScore}. New phase ${newGamePhase}.`);
    await supabase.from('games').update({ game_phase: newGamePhase, last_round_winner_player_id: boondoggleWinnerId, last_round_winning_card_text: scenarioData.text, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);
    revalidatePath('/game');
    return getGame(gameId);
  }

  console.log(`🔵 ACTION: selectWinner - Processing standard winner for card text: "${winningCardText}"`);
  let winningSubmissionData: (Tables<'responses'> & { response_cards: { text: string | null } | null }) | null = null;
  let isCustomWinningCard = false;

  const { data: customSubmission } = await supabase.from('responses').select('*, response_cards(text)').eq('game_id', gameId).eq('round_number', game.current_round).eq('submitted_text', winningCardText).maybeSingle(); 
  if (customSubmission) { 
    winningSubmissionData = customSubmission;
    isCustomWinningCard = true;
  } else {
    const { data: preDealtSubmission } = await supabase.from('responses').select('*, response_cards!inner(text)').eq('game_id', gameId).eq('round_number', game.current_round).eq('response_cards.text', winningCardText).maybeSingle(); 
    if (preDealtSubmission) winningSubmissionData = preDealtSubmission;
    else throw new Error(`Could not find submission matching card "${winningCardText}".`);
  }
  
  if (!winningSubmissionData) throw new Error(`Critical error: No winning submission found for "${winningCardText}".`);
  const winningPlayerId = winningSubmissionData.player_id;
  console.log(`🔵 ACTION: selectWinner - Winning player is ${winningPlayerId}. Custom card: ${isCustomWinningCard}.`);

  if (isCustomWinningCard) {
    await supabase.from('games').update({ game_phase: 'judge_approval_pending', last_round_winner_player_id: winningPlayerId, last_round_winning_card_text: winningCardText, updated_at: new Date().toISOString() }).eq('id', gameId);
  } else { 
    const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', winningPlayerId).single();
    if (!winnerPlayerData) throw new Error("Winning player record not found or error fetching.");
    const newScore = winnerPlayerData.score + 1;
    await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);
    if (winningSubmissionData.response_card_id) await supabase.from('winners').insert({ game_id: gameId, round_number: game.current_round, winner_player_id: winningPlayerId, winning_response_card_id: winningSubmissionData.response_card_id });
    
    let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
    let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? winningPlayerId : null;
    console.log(`🔵 ACTION: selectWinner - New score ${newScore}. New phase ${newGamePhase}.`);
    await supabase.from('games').update({ game_phase: newGamePhase, last_round_winner_player_id: winningPlayerId, last_round_winning_card_text: winningCardText, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);
  }

  revalidatePath('/game');
  return getGame(gameId);
}

export async function handleJudgeApprovalForCustomCard(gameId: string, addToDeck: boolean): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: handleJudgeApproval - Initiated for game ${gameId}. Add to deck: ${addToDeck}`);
  const { data: game } = await supabase.from('games').select('current_round, last_round_winner_player_id, last_round_winning_card_text').eq('id', gameId).single();
  if (!game || !game.last_round_winner_player_id || !game.last_round_winning_card_text) throw new Error(`Failed to fetch game or winner information for approval. Game: ${gameId}`);
  
  const winningPlayerId = game.last_round_winner_player_id;
  const winningCardText = game.last_round_winning_card_text; 

  if (addToDeck) {
    console.log(`🔵 ACTION: handleJudgeApproval - Adding card "${winningCardText}" to deck.`);
    const { data: authorPlayer } = await supabase.from('players').select('name').eq('id', winningPlayerId).single();
    if (!authorPlayer) throw new Error(`Could not find author player ${winningPlayerId}.`);
    const { data: newCard } = await supabase.from('response_cards').insert({ text: winningCardText, author_player_id: winningPlayerId, author_name: authorPlayer.name, is_active: true }).select('id').single();
    if (!newCard) throw new Error("Failed to add custom card to deck.");
    await supabase.from('winners').insert({ game_id: gameId, round_number: game.current_round, winner_player_id: winningPlayerId, winning_response_card_id: newCard.id });
  }

  const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', winningPlayerId).single();
  if (!winnerPlayerData) throw new Error("Winning player record not found or error fetching.");
  const newScore = winnerPlayerData.score + 1;
  await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);

  let newGamePhase: GamePhaseClientState = newScore >= POINTS_TO_WIN ? 'game_over' : 'winner_announcement';
  let overallWinnerPlayerId = newScore >= POINTS_TO_WIN ? winningPlayerId : null;
  console.log(`🔵 ACTION: handleJudgeApproval - New score ${newScore}. New phase ${newGamePhase}.`);
  await supabase.from('games').update({ game_phase: newGamePhase, overall_winner_player_id: overallWinnerPlayerId, updated_at: new Date().toISOString() }).eq('id', gameId);

  revalidatePath('/game');
  return getGame(gameId);
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: nextRound - Initiated for game ${gameId}.`);
  const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (!game) throw new Error(`Failed to fetch game for next round: Game not found`);

  if (game.game_phase === 'game_over') {
    console.log(`🔵 ACTION: nextRound - Game is over, resetting.`);
    try {
      await resetGameForTesting(); 
      return null;
    } catch (e: any) {
      if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
      throw new Error(`Failed to reset game after game over: ${e.message || 'Unknown error'}`);
    }
  }

  if (game.game_phase !== 'winner_announcement' && game.game_phase !== 'judging') {
    console.warn(`🟡 ACTION: nextRound - Called in wrong phase (${game.game_phase}). No action taken.`);
    revalidatePath('/game'); 
    return getGame(gameId);
  }
  
  const readyPlayerOrder = game.ready_player_order;
  if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
    console.error(`🔴 ACTION: nextRound - Error: ready_player_order is empty for game ${gameId}.`);
    throw new Error(`Critical error: Ready player order missing and cannot determine next judge.`);
  }

  let nextJudgeId: string | null = game.current_judge_id; 
  if (readyPlayerOrder && readyPlayerOrder.length > 0) {
    const currentJudgeIndex = game.current_judge_id ? readyPlayerOrder.findIndex(playerId => playerId === game.current_judge_id) : -1;
    nextJudgeId = readyPlayerOrder[(currentJudgeIndex + 1) % readyPlayerOrder.length];
  }
  console.log(`🔵 ACTION: nextRound - Current judge ${game.current_judge_id}, next judge will be ${nextJudgeId}.`);
  
  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection', current_judge_id: nextJudgeId, current_round: game.current_round + 1,
    current_scenario_id: null, last_round_winner_player_id: null, last_round_winning_card_text: null,
    updated_at: new Date().toISOString(),
  };
  await supabase.from('games').update(gameUpdates).eq('id', gameId);
  console.log(`🔵 ACTION: nextRound - Game updated for round ${game.current_round + 1}.`);
  revalidatePath('/game');
  return getGame(gameId);
}

export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  console.log(`🔵 ACTION: getCurrentPlayer - Fetching details for player ${playerId} in game ${gameId}`);
  if (!playerId || !gameId) return undefined;
  
  const { data: playerData } = await supabase.from('players').select('*').eq('id', playerId).eq('game_id', gameId).single();
  if (!playerData) {
      console.warn(`🟡 ACTION: getCurrentPlayer - Player ${playerId} not found in game ${gameId}.`);
      return undefined;
  }
  
  const { data: gameData } = await supabase.from('games').select('current_judge_id').eq('id', gameId).single();
  
  const { data: handData } = await supabase.from('player_hands').select('*, response_cards(id, text)').eq('player_id', playerId).eq('game_id', gameId);
  const handCards: PlayerHandCard[] = (handData as any[])?.map(h => h.response_cards ? { id: h.response_cards.id, text: h.response_cards.text, isNew: h.is_new ?? false } : null).filter(Boolean) || [];

  console.log(`🔵 ACTION: getCurrentPlayer - Found player ${playerData.name} with ${handCards.length} cards.`);
  return {
    id: playerData.id, name: playerData.name, avatar: playerData.avatar || '',
    score: playerData.score, isJudge: gameData ? playerData.id === gameData.current_judge_id : false,
    hand: handCards, isReady: playerData.is_ready,
  };
}

export async function togglePlayerReadyStatus(playerId: string, gameId: string): Promise<GameClientState | null> {
  console.log(`🔵 ACTION: togglePlayerReadyStatus - Initiated for player ${playerId} in game ${gameId}.`);
  const { data: player, error: playerFetchError } = await supabase
    .from('players').select('is_ready').eq('id', playerId).eq('game_id', gameId).single();
  if (playerFetchError || !player) throw new Error(`Failed to fetch player to toggle ready status: ${playerFetchError?.message || 'Player not found'}`);
  
  const newReadyStatus = !player.is_ready;
  console.log(`🔵 ACTION: togglePlayerReadyStatus - Player ${playerId} toggling ready status to ${newReadyStatus}.`);
  
  const { error: playerUpdateError } = await supabase
    .from('players').update({ is_ready: newReadyStatus }).eq('id', playerId).eq('game_id', gameId);
  if (playerUpdateError) throw new Error(`Failed to update player ready status: ${playerUpdateError.message}`);

  const { data: gameForOrderUpdate } = await supabase.from('games').select('ready_player_order, game_phase').eq('id', gameId).single();
  if (!gameForOrderUpdate) {
    console.error(`🔴 ACTION: togglePlayerReadyStatus - Could not fetch game ${gameId} to update ready order.`);
    return getGame(gameId); 
  }

  let currentReadyOrder = Array.isArray(gameForOrderUpdate.ready_player_order) ? gameForOrderUpdate.ready_player_order : [];
  if (newReadyStatus) {
    if (!currentReadyOrder.includes(playerId)) currentReadyOrder.push(playerId);
  } else {
    currentReadyOrder = currentReadyOrder.filter(id => id !== playerId);
  }
  console.log(`🔵 ACTION: togglePlayerReadyStatus - New ready order: [${currentReadyOrder.join(', ')}]`);

  await supabase.from('games').update({ ready_player_order: currentReadyOrder, updated_at: new Date().toISOString() }).eq('id', gameId);

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); 
}
