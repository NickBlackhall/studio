
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState, PlayerHandCard } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN, MIN_PLAYERS_TO_START } from '@/lib/types';


export async function findOrCreateGame(): Promise<Tables<'games'>> {
  const { data: lobbyGames, error: lobbyError } = await supabase
    .from('games')
    .select('*')
    .eq('game_phase', 'lobby')
    .order('created_at', { ascending: true })
    .limit(1);

  if (lobbyError) {
    // console.error("🔴 GAME (Server): Error fetching lobby games:", JSON.stringify(lobbyError, null, 2));
  }

  if (lobbyGames && lobbyGames.length > 0) {
    return lobbyGames[0];
  }

  const { data: existingGames, error: fetchError } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    // console.error("🔴 GAME (Server): Error fetching any existing games:", JSON.stringify(fetchError, null, 2));
  }

  if (existingGames && existingGames.length > 0) {
    return existingGames[0];
  }

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
    console.error("🔴 GAME (Server): Error creating new game:", errorMessage, JSON.stringify(createError, null, 2));
    if (createError && createError.message.includes('RLS')) {
        throw new Error(`Could not create a new game. Supabase error: ${errorMessage}. Possible RLS issue on 'games' table.`);
    }
    throw new Error(`Could not create a new game. Supabase error: ${errorMessage}`);
  }
  return newGame;
}


export async function getGame(gameIdToFetch?: string): Promise<GameClientState> {
  let gameRow: Tables<'games'> | null = null;

  if (gameIdToFetch) {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameIdToFetch).single();
    if (error) {
      gameRow = await findOrCreateGame();
    } else if (!data) {
        gameRow = await findOrCreateGame();
    } else {
      gameRow = data;
    }
  } else {
    gameRow = await findOrCreateGame();
  }

  if (!gameRow || !gameRow.id) {
    console.error("🔴 GAME (Server): CRITICAL - Failed to find or create a game session in getGame.");
    throw new Error('Failed to find or create a game session in getGame.');
  }
  const gameId = gameRow.id;

  let playersData: Tables<'players'>[] = [];
  const { data: fetchedPlayersData, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersError) {
    playersData = [];
  } else {
    playersData = fetchedPlayersData || [];
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
      // Handle error
    } else {
      allHandsData = (fetchedHandsData as HandDataWithCard[]) || [];
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
            isNew: h.is_new ?? false, // Ensure isNew is always boolean
          };
        }
        return null;
      })
      .filter((card): card is PlayerHandCard => card !== null); // Correctly filter out nulls
      
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
    console.error('Error fetching categories:', JSON.stringify(categoriesError, null, 2));
  } else if (categoriesData) {
    const distinctCategories = [...new Set(
        categoriesData.map(c => c.category)
                      .filter(c => c !== null && typeof c === 'string' && c.trim() !== '') as string[]
    )];
    if (distinctCategories.length > 0) {
      categories = distinctCategories;
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
      // Handle error
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
    ready_player_order: [], 
    ready_player_order_str: JSON.stringify(dbReadyPlayerOrder),
    transitionState: gameRow.transition_state as GameClientState['transitionState'],
    transitionMessage: gameRow.transition_message,
  };

  if (typeof gameClientState.ready_player_order_str !== 'string' || !gameClientState.ready_player_order_str.startsWith('[')) {
    gameClientState.ready_player_order_str = "[]";
  }

  return gameClientState;
}


export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    console.error('🔴 PLAYER (Server): Failed to find or create a game session for adding player.');
    throw new Error('Could not find or create game session to add player.');
  }
  const gameId = gameRow.id;

  if (gameRow.game_phase !== 'lobby') {
    throw new Error(`Game is already in progress (phase: ${gameRow.game_phase}). Cannot join now.`);
  }

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

  revalidatePath('/');
  revalidatePath('/game');
  return newPlayer;
}

export async function resetGameForTesting() {
  let gameToReset: Pick<Tables<'games'>, 'id' | 'game_phase'> | null = null;

  try {
    const { data: existingGames, error: fetchError } = await supabase
      .from('games')
      .select('id, game_phase')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("🔴 RESET (Server): Exception during game fetch for reset:", fetchError.message, JSON.stringify(fetchError, null, 2));
      throw new Error(`Exception during game fetch for reset: ${fetchError.message}`);
    }

    if (!existingGames || existingGames.length === 0) {
      revalidatePath('/');
      revalidatePath('/game');
      revalidatePath('/?step=setup');
      redirect('/?step=setup');
      return;
    }

    gameToReset = existingGames[0];
    const gameId = gameToReset.id;

    const { error: clearPlayerRefsError } = await supabase
      .from('games')
      .update({
        current_judge_id: null,
        last_round_winner_player_id: null,
        overall_winner_player_id: null,
      })
      .eq('id', gameId);

    if (clearPlayerRefsError) {
        console.error(`🔴 RESET (Server): Error clearing player references in game ${gameId}:`, JSON.stringify(clearPlayerRefsError, null, 2));
    }

    const tablesToClear = ['player_hands', 'responses', 'winners'];
    for (const table of tablesToClear) {
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) {
        console.error(`🔴 RESET (Server): Error deleting from ${table} for game_id ${gameId}:`, JSON.stringify(deleteError, null, 2));
      }
    }

    const { error: playersDeleteError } = await supabase
      .from('players')
      .delete()
      .eq('game_id', gameId);

    if (playersDeleteError) {
      console.error(`🔴 RESET (Server): Error deleting players for game_id ${gameId}:`, JSON.stringify(playersDeleteError, null, 2));
    }
    
    const updateData: TablesUpdate<'games'> = {
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

    const { error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to update game ${gameId} to lobby phase:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500)); 

  } catch (e: any) {
    console.error('🔴 RESET (Server): Unexpected exception during reset process:', e.message, e.stack);
    if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e;
    }
    throw new Error(`Reset failed: ${e.message || 'Unknown error'}`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  revalidatePath('/?step=setup');
  redirect('/?step=setup'); 
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
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
  const allKnownUsedResponses = [...new Set([...currentUsedResponsesInGame, ...existingUsedResponses])];

  let query = supabase
    .from('response_cards')
    .select('id')
    .eq('is_active', true);

  if (allKnownUsedResponses.length > 0) {
    const validUUIDs = allKnownUsedResponses.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
        query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
  }

  const { data: availableCards, error: fetchError } = await query.limit(count + 50); 

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  if (!availableCards || availableCards.length === 0) {
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);
  const newlyDealtAndUsedInThisOperation = [...new Set([...existingUsedResponses, ...dealtCardIds])]; 

  return { dealtCardIds, updatedUsedResponses: newlyDealtAndUsedInThisOperation };
}

export async function startGame(gameId: string): Promise<GameClientState | null> {
  await supabase
    .from('games')
    .update({ 
      transition_state: 'starting_game',
      transition_message: 'Preparing game...' 
    })
    .eq('id', gameId);

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
      .select('id, name, is_ready, joined_at')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true });

    if (playersFetchError || !players) {
      console.error(`🔴 START (Server): Error fetching players for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)}`);
      throw new Error(`Failed to fetch players for start: ${playersFetchError?.message || 'No players found'}`);
    }
    if (players.length < MIN_PLAYERS_TO_START) {
      throw new Error(`Not enough players to start game (found ${players.length}, need at least ${MIN_PLAYERS_TO_START}).`);
    }

    const allPlayersReady = players.every(p => p.is_ready);
    if (!allPlayersReady) {
      throw new Error(`Not all players are ready. Cannot start the game yet.`);
    }

    const readyPlayerOrder = game.ready_player_order; 
    if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
        console.error(`🔴 START (Server): Cannot start game ${gameId}. ready_player_order is empty or null. Actual value: ${JSON.stringify(readyPlayerOrder)}`);
        throw new Error("Critical error: Player ready order not established for starting the game.");
    }
    const actualFirstJudgeId = readyPlayerOrder[0];
    if (!players.find(p => p.id === actualFirstJudgeId)) {
        console.error(`🔴 START (Server): First player in ready_player_order (${actualFirstJudgeId}) not found in players list for game ${gameId}.`);
        throw new Error("Critical error: Host player in ready order not found in game players.");
    }

    await supabase.from('games').update({ transition_message: 'Dealing cards...' }).eq('id', gameId);
    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];
    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    for (const player of players) {
      const { dealtCardIds, updatedUsedResponses: tempUsedAfterThisPlayer } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);

      if (dealtCardIds.length > 0) {
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
            is_new: false, 
          });
        });
        accumulatedUsedResponsesForThisGameStart = [...new Set([...accumulatedUsedResponsesForThisGameStart, ...dealtCardIds])];
      }
    }

    if (playerHandInserts.length > 0) {
      const { error: allHandsInsertError } = await supabase.from('player_hands').insert(playerHandInserts);
      if (allHandsInsertError) {
        console.error(`🔴 START (Server) CARDS: Critical error inserting player hands:`, JSON.stringify(allHandsInsertError, null, 2));
      }
    }

    await supabase.from('games').update({ transition_message: 'Selecting first judge...' }).eq('id', gameId);

    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: actualFirstJudgeId, 
      current_round: 1,
      updated_at: new Date().toISOString(),
      used_responses: accumulatedUsedResponsesForThisGameStart,
      transition_state: 'idle',
      transition_message: null,
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`🔴 START (Server): Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
  }

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId); 
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('used_scenarios, current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 CATEGORY (Server): Error fetching game ${gameId} for category selection:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for category selection: ${gameError?.message || 'Game not found'}`);
  }

  const usedScenarios = game.used_scenarios || [];
  let query = supabase
    .from('scenarios')
    .select('id, text, category');
  query = query.eq('category', category);

  if (usedScenarios.length > 0) {
    const validUUIDs = usedScenarios.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    if (validUUIDs.length > 0) {
      query = query.not('id', 'in', `(${validUUIDs.join(',')})`);
    }
  }

  const { data: scenarios, error: scenarioFetchError } = await query;

  if (scenarioFetchError) {
    console.error(`🔴 CATEGORY (Server): Error fetching scenarios for category ${category}:`, JSON.stringify(scenarioFetchError, null, 2));
    throw new Error(`Error fetching scenarios for category ${category}: ${scenarioFetchError.message}`);
  }

  let scenarioToUse: { id: string; text: string; category: string | null } | null = null;

  if (!scenarios || scenarios.length === 0) {
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase
      .from('scenarios')
      .select('id, text, category')
      .eq('category', category); 

    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 CATEGORY (Server): Critical - No scenarios found for category ${category} at all, even for recycling.`, JSON.stringify(anyCategoryError, null, 2));
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
     const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      updated_at: new Date().toISOString(),
    };
     const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
     if (updateError) throw new Error(`Failed to update game after category selection (recycle): ${updateError.message}`);

  } else {
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
    const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])];
    const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      used_scenarios: updatedUsedScenarios,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (updateError) {
      console.error(`🔴 CATEGORY (Server): Error updating game after category selection:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game after category selection: ${updateError.message}`);
    }
  }

  revalidatePath('/game');
  return getGame(gameId);
}


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number, isCustomSubmission: boolean): Promise<null> {
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
    throw new Error(`Submissions are not open. Current game phase: ${gameData.game_phase}.`);
  }

  if (playerId === gameData.current_judge_id) {
    throw new Error("Judges cannot submit response cards.");
  }

  const { data: existingSubmission, error: checkSubmissionError } = await supabase
    .from('responses')
    .select('id')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('round_number', currentRound)
    .maybeSingle(); 

  if (checkSubmissionError) {
    console.error(`🔴 SUBMIT (Server): Error checking for existing submission for player ${playerId}:`, JSON.stringify(checkSubmissionError, null, 2));
    throw new Error(`Error verifying submission status: ${checkSubmissionError.message}`);
  }
  if (existingSubmission) {
    throw new Error("You have already submitted a card for this round.");
  }

  let responseCardIdToStore: string | null = null;
  let submittedTextToStore: string | null = null;
  let cardToRemoveFromHandId: string | null = null;
  
  if (isCustomSubmission) {
    submittedTextToStore = responseCardText;
  } else {
    type HandCardWithText = Pick<Tables<'player_hands'>, 'response_card_id'> & { 
        response_cards: { text: string } | null 
    };

    const { data: handCardEntry, error: handQueryError } = await supabase
      .from('player_hands')
      .select('response_card_id, response_cards!inner(text)')
      .eq('player_id', playerId)
      .eq('game_id', gameId) 
      .eq('response_cards.text', responseCardText) 
      .limit(1)
      .single();

    if (handQueryError || !handCardEntry) {
      console.error(`🔴 SUBMIT (Server): Error finding card with text "${responseCardText}" in hand of player ${playerId} for game ${gameId}:`, JSON.stringify(handQueryError, null, 2));
      throw new Error(`Could not find card "${responseCardText}" in your hand.`);
    }
    responseCardIdToStore = (handCardEntry as HandCardWithText).response_card_id;
    cardToRemoveFromHandId = (handCardEntry as HandCardWithText).response_card_id; 
  }

  const { error: clearOldNewFlagsError } = await supabase
    .from('player_hands')
    .update({ is_new: false })
    .eq('player_id', playerId)
    .eq('game_id', gameId); 
  if (clearOldNewFlagsError) console.error(`🔴 SUBMIT (Server) CARDS: Error clearing is_new flags for player ${playerId}:`, JSON.stringify(clearOldNewFlagsError, null, 2));


  const { error: insertError } = await supabase
    .from('responses')
    .insert({
      game_id: gameId,
      player_id: playerId,
      response_card_id: responseCardIdToStore, 
      submitted_text: submittedTextToStore,   
      round_number: currentRound,
    });

  if (insertError) {
    console.error(`🔴 SUBMIT (Server): Error inserting submission for player ${playerId}:`, JSON.stringify(insertError, null, 2));
    throw new Error(`Failed to insert submission: ${insertError.message}`);
  }

  if (cardToRemoveFromHandId) {
    const { error: deleteHandError } = await supabase
      .from('player_hands')
      .delete()
      .eq('player_id', playerId)
      .eq('response_card_id', cardToRemoveFromHandId)
      .eq('game_id', gameId); 

    if (deleteHandError) {
      console.error(`🔴 SUBMIT (Server): Error deleting card ${cardToRemoveFromHandId} from hand of ${playerId}:`, JSON.stringify(deleteHandError, null, 2));
    }
  }

  let gameUsedResponses = gameData.used_responses || [];
  const usedResponsesBeforeNewDeal = responseCardIdToStore
    ? [...new Set([...gameUsedResponses, responseCardIdToStore])]
    : gameUsedResponses;

  const { dealtCardIds: replacementCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, usedResponsesBeforeNewDeal);

  if (replacementCardIds.length > 0) {
    const newCardId = replacementCardIds[0];
    const { error: newCardInsertError } = await supabase
      .from('player_hands')
      .insert({
        game_id: gameId,
        player_id: playerId,
        response_card_id: newCardId,
        is_new: true, 
      });
    if (newCardInsertError) {
      console.error(`🔴 SUBMIT (Server) CARDS: Error dealing new card to player ${playerId}:`, JSON.stringify(newCardInsertError, null, 2));
    }
  }

  const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() })
      .eq('id', gameId);
  if (gameUpdateError) {
      console.error(`🔴 SUBMIT (Server): Error updating game.used_responses:`, JSON.stringify(gameUpdateError, null, 2));
  }


  const { data: nonJudgePlayers, error: playersError } = await supabase
    .from('players')
    .select('id', { count: 'exact' }) 
    .eq('game_id', gameId)
    .neq('id', gameData.current_judge_id || '00000000-0000-0000-0000-000000000000'); 

  if (playersError || !nonJudgePlayers) {
    console.error('🔴 SUBMIT (Server): Error fetching non-judge players count:', JSON.stringify(playersError, null, 2));
    throw new Error(`Failed to fetch players for submission check: ${playersError?.message || 'No non-judge players found'}`);
  }
  const totalNonJudgePlayers = nonJudgePlayers.length;

  const { count: submissionsCount, error: submissionsError } = await supabase
    .from('responses')
    .select('player_id', { count: 'exact', head: true }) 
    .eq('game_id', gameId)
    .eq('round_number', currentRound);

  if (submissionsError) {
    console.error('🔴 SUBMIT (Server): Error fetching submissions count:', JSON.stringify(submissionsError, null, 2));
    throw new Error(`Failed to fetch submissions count: ${submissionsError.message}`);
  }

  if (submissionsCount !== null && totalNonJudgePlayers > 0 && submissionsCount >= totalNonJudgePlayers) {
    const { error: phaseUpdateError } = await supabase
      .from('games')
      .update({ game_phase: 'judging', updated_at: new Date().toISOString() })
      .eq('id', gameId);
    if (phaseUpdateError) {
      console.error('🔴 SUBMIT (Server): Error updating game phase to judging:', JSON.stringify(phaseUpdateError, null, 2));
    }
  }

  revalidatePath('/game');
  return null;
}


export async function selectWinner(winningCardText: string, gameId: string): Promise<GameClientState | null> {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_round, current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 WINNER (Server): Error fetching game ${gameId}:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);
  }

  type SubmissionWithCard = Tables<'responses'> & {
    response_cards: { text: string | null } | null;
  };
  
  let winningSubmissionData: SubmissionWithCard | null = null;
  let isCustomWinningCard = false;

  const { data: customSubmission, error: customSubmissionError } = await supabase
    .from('responses')
    .select('*, response_cards(text)')
    .eq('game_id', gameId)
    .eq('round_number', game.current_round)
    .eq('submitted_text', winningCardText) 
    .maybeSingle(); 

  if (customSubmission && !customSubmissionError) { 
    winningSubmissionData = customSubmission as SubmissionWithCard;
    isCustomWinningCard = true;
  } else {
    type PreDealtSubmissionWithText = Tables<'responses'> & {
        response_cards: { text: string }
    };
    const { data: preDealtSubmission, error: preDealtSubmissionError } = await supabase
      .from('responses')
      .select('*, response_cards!inner(text)')
      .eq('game_id', gameId)
      .eq('round_number', game.current_round)
      .eq('response_cards.text', winningCardText) 
      .maybeSingle(); 

    if (preDealtSubmission && !preDealtSubmissionError) {
      winningSubmissionData = preDealtSubmission as PreDealtSubmissionWithText;
      isCustomWinningCard = false; 
    } else {
      console.error(`🔴 WINNER (Server): Error finding winning submission for card text "${winningCardText}" in round ${game.current_round}. Custom error: ${JSON.stringify(customSubmissionError, null, 2)}, Pre-dealt error: ${JSON.stringify(preDealtSubmissionError, null, 2)}`);
      throw new Error(`Could not find submission matching card "${winningCardText}".`);
    }
  }
  
  if (!winningSubmissionData) { 
    throw new Error(`Critical error: No winning submission found for "${winningCardText}".`);
  }

  const winningPlayerId = winningSubmissionData.player_id;

  if (isCustomWinningCard) {
    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'judge_approval_pending',
      last_round_winner_player_id: winningPlayerId, 
      last_round_winning_card_text: winningCardText, 
      updated_at: new Date().toISOString(),
    };
    const { error: gameUpdateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (gameUpdateError) {
      console.error(`🔴 WINNER (Server): Error updating game to judge_approval_pending:`, JSON.stringify(gameUpdateError, null, 2));
      throw new Error(`Failed to update game for judge approval: ${gameUpdateError.message}`);
    }
  } else { 
    const { data: winnerPlayerData, error: winnerPlayerFetchError } = await supabase
      .from('players')
      .select('score')
      .eq('id', winningPlayerId)
      .single();

    if (winnerPlayerFetchError || !winnerPlayerData) {
      console.error(`🔴 WINNER (Server): Error fetching winning player ${winningPlayerId} data:`, JSON.stringify(winnerPlayerFetchError, null, 2));
      throw new Error("Winning player record not found or error fetching.");
    }
    const newScore = winnerPlayerData.score + 1;
    const { error: scoreUpdateError } = await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);
    if (scoreUpdateError) console.error(`🔴 WINNER (Server): Error updating score for player ${winningPlayerId}:`, JSON.stringify(scoreUpdateError, null, 2));

    const winningResponseCardIdForWinnersTable = winningSubmissionData.response_card_id;
    if (winningResponseCardIdForWinnersTable) { 
      const { error: winnerInsertError } = await supabase.from('winners').insert({
        game_id: gameId,
        round_number: game.current_round,
        winner_player_id: winningPlayerId,
        winning_response_card_id: winningResponseCardIdForWinnersTable,
      });
      if (winnerInsertError) console.error(`🔴 WINNER (Server): Error inserting into 'winners':`, JSON.stringify(winnerInsertError, null, 2));
    }

    let newGamePhase: GamePhaseClientState = 'winner_announcement';
    let overallWinnerPlayerId: string | null = null;
    if (newScore >= POINTS_TO_WIN) {
      newGamePhase = 'game_over';
      overallWinnerPlayerId = winningPlayerId;
    }

    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: newGamePhase,
      last_round_winner_player_id: winningPlayerId,
      last_round_winning_card_text: winningCardText, 
      overall_winner_player_id: overallWinnerPlayerId,
      updated_at: new Date().toISOString(),
    };
    const { error: gameUpdateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
    if (gameUpdateError) {
      console.error(`🔴 WINNER (Server): Error updating game for winner announcement:`, JSON.stringify(gameUpdateError, null, 2));
      throw new Error(`Failed to update game state after winner selection: ${gameUpdateError.message}`);
    }
  }

  revalidatePath('/game');
  return getGame(gameId);
}

export async function handleJudgeApprovalForCustomCard(gameId: string, addToDeck: boolean): Promise<GameClientState | null> {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_round, last_round_winner_player_id, last_round_winning_card_text')
    .eq('id', gameId)
    .single();

  if (gameError || !game || !game.last_round_winner_player_id || !game.last_round_winning_card_text) {
    console.error(`🔴 APPROVAL (Server): Error fetching game or missing winner info for approval. Game ID: ${gameId}`, JSON.stringify(gameError, null, 2), game);
    throw new Error(`Failed to fetch game or winner information for approval. Game: ${gameId}`);
  }

  const winningPlayerId = game.last_round_winner_player_id;
  const winningCardText = game.last_round_winning_card_text; 

  if (addToDeck) {
    const { data: authorPlayer, error: authorFetchError } = await supabase
      .from('players')
      .select('name')
      .eq('id', winningPlayerId)
      .single();
    if (authorFetchError || !authorPlayer) {
      console.error(`🔴 APPROVAL (Server): Error fetching author player ${winningPlayerId} name.`, JSON.stringify(authorFetchError, null, 2));
      throw new Error(`Could not find author player ${winningPlayerId}.`);
    }

    const { data: newCard, error: newCardInsertError } = await supabase
      .from('response_cards')
      .insert({
        text: winningCardText,
        author_player_id: winningPlayerId,
        author_name: authorPlayer.name, 
        is_active: true, 
      })
      .select('id') 
      .single();

    if (newCardInsertError || !newCard) {
      console.error(`🔴 APPROVAL (Server): Error inserting new custom card into response_cards.`, JSON.stringify(newCardInsertError, null, 2));
      throw new Error("Failed to add custom card to deck.");
    }
    
    const { error: winnerInsertError } = await supabase.from('winners').insert({
      game_id: gameId,
      round_number: game.current_round,
      winner_player_id: winningPlayerId,
      winning_response_card_id: newCard.id, 
    });
    if (winnerInsertError) {
      console.error(`🔴 APPROVAL (Server): Error inserting round winner (for approved custom card) into 'winners'.`, JSON.stringify(winnerInsertError, null, 2));
    }
  }

  const { data: winnerPlayerData, error: winnerPlayerFetchError } = await supabase
    .from('players')
    .select('score')
    .eq('id', winningPlayerId)
    .single();
  if (winnerPlayerFetchError || !winnerPlayerData) {
    console.error(`🔴 APPROVAL (Server): Error fetching winning player ${winningPlayerId} data.`, JSON.stringify(winnerPlayerFetchError, null, 2));
    throw new Error("Winning player record not found or error fetching.");
  }
  const newScore = winnerPlayerData.score + 1;
  const { error: scoreUpdateError } = await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);
  if (scoreUpdateError) console.error(`🔴 APPROVAL (Server): Error updating score for player ${winningPlayerId}.`, JSON.stringify(scoreUpdateError, null, 2));

  let newGamePhase: GamePhaseClientState = 'winner_announcement';
  let overallWinnerPlayerId: string | null = null;
  if (newScore >= POINTS_TO_WIN) {
    newGamePhase = 'game_over';
    overallWinnerPlayerId = winningPlayerId;
  }

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: newGamePhase,
    overall_winner_player_id: overallWinnerPlayerId,
    updated_at: new Date().toISOString(),
  };
  const { error: gameUpdateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
  if (gameUpdateError) {
    console.error(`🔴 APPROVAL (Server): Error updating game state after judge approval.`, JSON.stringify(gameUpdateError, null, 2));
    throw new Error(`Failed to update game state after judge approval: ${gameUpdateError.message}`);
  }

  revalidatePath('/game');
  return getGame(gameId);
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*') 
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 NEXT ROUND (Server): Error fetching game ${gameId} for next round:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for next round: ${gameError?.message || 'Game not found'}`);
  }

  if (game.game_phase === 'game_over') {
    try {
      await resetGameForTesting(); 
      return null; 
    } catch (e: any) {
      console.error(`🔴 NEXT ROUND (Server): Error during resetGameForTesting call:`, e);
       if (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
        throw e; 
      }
      throw new Error(`Failed to reset game after game over: ${e.message || 'Unknown error'}`);
    }
  }

  if (game.game_phase !== 'winner_announcement') {
    revalidatePath('/game'); 
    return getGame(gameId);
  }

  const readyPlayerOrder = game.ready_player_order;
  if (!readyPlayerOrder || readyPlayerOrder.length === 0) {
    console.error(`🔴 NEXT ROUND (Server): Error: ready_player_order is empty or null for game ${gameId}. Cannot determine next judge. RPO: ${JSON.stringify(readyPlayerOrder)}`);
    const { data: playersFallback, error: fallbackError } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', gameId)
        .order('joined_at', { ascending: true });
    if (fallbackError || !playersFallback || playersFallback.length === 0) {
        throw new Error(`Critical error: Ready player order missing and cannot fetch fallback players for game ${gameId}.`);
    }
    const currentJudgeIndexFallback = game.current_judge_id ? playersFallback.findIndex(p => p.id === game.current_judge_id) : -1;
    game.current_judge_id = playersFallback[(currentJudgeIndexFallback + 1) % playersFallback.length].id;
  }


  let nextJudgeId: string | null = game.current_judge_id; 

  if (readyPlayerOrder && readyPlayerOrder.length > 0) {
    if (game.current_judge_id) {
      const currentJudgeIndex = readyPlayerOrder.findIndex(playerId => playerId === game.current_judge_id);
      if (currentJudgeIndex !== -1) {
        nextJudgeId = readyPlayerOrder[(currentJudgeIndex + 1) % readyPlayerOrder.length];
      } else {
        nextJudgeId = readyPlayerOrder[0];
      }
    } else {
      nextJudgeId = readyPlayerOrder[0];
    }
  } else {
      console.error(`🔴 NEXT ROUND (Server): CRITICAL - ready_player_order is empty but attempting judge rotation for game ${gameId}.`);
      if (!nextJudgeId) {
          throw new Error("Cannot determine next judge: ready_player_order is empty and no current judge set.");
      }
  }

  const gameUpdates: TablesUpdate<'games'> = {
    game_phase: 'category_selection',
    current_judge_id: nextJudgeId,
    current_round: game.current_round + 1,
    current_scenario_id: null,
    last_round_winner_player_id: null, 
    last_round_winning_card_text: null,
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

  revalidatePath('/game');
  return getGame(gameId);
}

export async function getCurrentPlayer(playerId: string, gameId: string): Promise<PlayerClientState | undefined> {
  if (!playerId || !gameId) {
    return undefined;
  }
  const { data: playerData, error: playerFetchError } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', gameId)
    .single();

  if (playerFetchError || !playerData) {
    return undefined;
  }

  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameFetchError) {
    // Handle error
  }

  let handCards: PlayerHandCard[] = [];
  
  type HandWithCardText = Tables<'player_hands'> & {
    response_cards: { id: string, text: string } | null
  };

  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('*, response_cards(id, text)')
    .eq('player_id', playerId)
    .eq('game_id', gameId);

  if (handError) {
      // Handle error
  } else if (handData) {
    handCards = (handData as HandWithCardText[])
      .map((h) => { 
        if (h.response_cards && h.response_cards.id && h.response_cards.text) {
          return {
            id: h.response_cards.id,
            text: h.response_cards.text,
            isNew: h.is_new ?? false,
          };
        }
        return null;
      })
      .filter((card): card is PlayerHandCard => card !== null);
  }

  return {
    id: playerData.id,
    name: playerData.name,
    avatar: playerData.avatar || '',
    score: playerData.score,
    isJudge: gameData ? playerData.id === gameData.current_judge_id : false,
    hand: handCards,
    isReady: playerData.is_ready,
  };
}

export async function togglePlayerReadyStatus(playerId: string, gameId: string): Promise<GameClientState | null> {
  const { data: player, error: playerFetchError } = await supabase
    .from('players')
    .select('is_ready')
    .eq('id', playerId)
    .eq('game_id', gameId)
    .single();

  if (playerFetchError || !player) {
    console.error(`🔴 READY (Server): Error fetching player ${playerId} to toggle ready status:`, JSON.stringify(playerFetchError, null, 2));
    throw new Error(`Failed to fetch player to toggle ready status: ${playerFetchError?.message || 'Player not found'}`);
  }
  const currentIsReady = player.is_ready;
  const newReadyStatus = !currentIsReady;

  const { data: updatedPlayer, error: playerUpdateError } = await supabase
    .from('players')
    .update({ is_ready: newReadyStatus })
    .eq('id', playerId)
    .eq('game_id', gameId)
    .select('id, is_ready, name') 
    .single();

  if (playerUpdateError || !updatedPlayer) {
    console.error(`🔴 READY (Server): Error updating player ${playerId} ready status:`, JSON.stringify(playerUpdateError, null, 2));
    throw new Error(`Failed to update player ready status: ${playerUpdateError?.message || 'Player not found or error during update'}`);
  }

  const { data: gameForOrderUpdate, error: gameFetchError } = await supabase
    .from('games')
    .select('ready_player_order, game_phase') 
    .eq('id', gameId)
    .single();

  if (gameFetchError || !gameForOrderUpdate) {
    console.error(`🔴 READY (Server): Error fetching game ${gameId} to get current ready_player_order:`, JSON.stringify(gameFetchError, null, 2));
    return getGame(gameId); 
  }

  let currentReadyOrder = gameForOrderUpdate.ready_player_order || []; 
  
  if (!Array.isArray(currentReadyOrder)) {
    currentReadyOrder = [];
  }

  if (newReadyStatus) {
    if (!currentReadyOrder.includes(playerId)) {
      currentReadyOrder.push(playerId);
    }
  } else {
    currentReadyOrder = currentReadyOrder.filter(id => id !== playerId);
  }

  const { error: gameOrderUpdateError } = await supabase
    .from('games')
    .update({ ready_player_order: currentReadyOrder, updated_at: new Date().toISOString() })
    .eq('id', gameId)
    .select('id, ready_player_order') 
    .single();

  if (gameOrderUpdateError) {
    console.error(`🔴 READY (Server): Error updating ready_player_order for game ${gameId}:`, JSON.stringify(gameOrderUpdateError, null, 2));
  }

  revalidatePath('/');
  revalidatePath('/game');

  return getGame(gameId); 
}
