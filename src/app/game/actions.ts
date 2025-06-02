
"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState, ScenarioClientState, GamePhaseClientState, PlayerHandCard } from '@/lib/types';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { CARDS_PER_HAND, POINTS_TO_WIN, MIN_PLAYERS_TO_START } from '@/lib/types';


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

  console.log("🔴 GAME (Server): Creating new game...");
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
  console.log(`🔴 GAME (Server): Created new game with ID: ${newGame.id}`);
  return newGame;
}


export async function getGame(gameIdToFetch?: string): Promise<GameClientState> {
  let gameRow: Tables<'games'> | null = null;

  if (gameIdToFetch) {
    const { data, error } = await supabase.from('games').select('*').eq('id', gameIdToFetch).single();
    if (error) {
      console.error(`🔴 GAME (Server): Error fetching specific game ${gameIdToFetch}:`, JSON.stringify(error, null, 2));
      gameRow = await findOrCreateGame();
    } else if (!data) {
        console.warn(`🔴 GAME (Server): Game ${gameIdToFetch} not found. Falling back to findOrCreateGame.`);
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
    console.error(`DEBUG: getGame - Error fetching players for game ${gameId}:`, JSON.stringify(playersError, null, 2));
    playersData = [];
  } else {
    playersData = fetchedPlayersData || [];
  }

  const playerIds = playersData.map(p => p.id);
  let allHandsData: { player_id: string, response_card_id: string, is_new: boolean, response_cards: { id: string, text: string | null } | null }[] = [];
  if (playerIds.length > 0) {
    const { data: fetchedHandsData, error: handsError } = await supabase
      .from('player_hands')
      .select('player_id, response_card_id, is_new, response_cards (id, text)')
      .in('player_id', playerIds)
      .eq('game_id', gameId);

    if (handsError) {
      console.error(`DEBUG: getGame - Error fetching hands for players in game ${gameId}:`, JSON.stringify(handsError, null, 2));
    } else {
      allHandsData = fetchedHandsData || [];
    }
  }

  // Server-side log to check `is_new` as it's fetched
  console.log(`🔴 GAME (Server) getGame - Raw hands data for game ${gameId} BEFORE player mapping:`, JSON.stringify(allHandsData.map(h => ({ pId: h.player_id, cId: h.response_cards?.id, is_new: h.is_new})), null, 2));


  const players: PlayerClientState[] = playersData.map(p => {
    const playerHandCards: PlayerHandCard[] = allHandsData
      .filter(h => h.player_id === p.id && h.response_cards?.text && h.response_cards?.id)
      .map(h => {
        // Server-side log for each card being mapped
        console.log(`🔴 GAME (Server) getGame - Mapping card for player ${p.id}: cardId ${h.response_cards?.id}, is_new from DB: ${h.is_new}`);
        return {
          id: h.response_cards!.id as string,
          text: h.response_cards!.text as string,
          isNew: h.is_new ?? false, // Default to false if null/undefined
        };
      });
    console.log(`🔴 GAME (Server) getGame - Player ${p.id} constructed hand:`, JSON.stringify(playerHandCards.map(c => ({id: c.id, isNew: c.isNew, text: c.text.substring(0,10)+"..."})), null, 2));
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

  let submissions: GameClientState['submissions'] = [];
  if ((gameStateRow.game_phase === 'judging' || gameStateRow.game_phase === 'player_submission') && gameStateRow.current_round > 0) {
    const { data: submissionData, error: submissionError } = await supabase
      .from('responses')
      .select('player_id, response_card_id, submitted_text, response_cards(id, text)')
      .eq('game_id', gameId)
      .eq('round_number', gameStateRow.current_round);

    if (submissionError) {
      console.error('DEBUG: getGame - Error fetching submissions:', JSON.stringify(submissionError, null, 2));
    } else if (submissionData) {
      submissions = submissionData.map((s: any) => {
        const cardText = s.submitted_text || s.response_cards?.text || 'Error: Card text not found';
        // If it's a custom submission, cardId might be null, but for client state we might want a placeholder or to handle it.
        // For now, if response_card_id is null (custom), we use a generic or specially marked ID for client display if needed,
        // or ensure the client knows it's custom based on submitted_text presence.
        // Here, we prioritize submitted_text. The cardId can be the original card's ID or null if custom.
        const cardId = s.response_card_id || (s.submitted_text ? `custom-${s.player_id}-${gameStateRow.current_round}` : `error-${s.player_id}`);

        return {
          playerId: s.player_id,
          cardId: cardId, // This will be the actual response_card_id or a generated one for custom
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
  return gameClientState;
}


export async function addPlayer(name: string, avatar: string): Promise<Tables<'players'> | null> {
  console.log(`🔴 PLAYER (Server): addPlayer called for player: ${name}`);
  const gameRow = await findOrCreateGame();
  if (!gameRow || !gameRow.id) {
    console.error('🔴 PLAYER (Server): Failed to find or create a game session for adding player.');
    throw new Error('Could not find or create game session to add player.');
  }
  const gameId = gameRow.id;

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
    console.warn(`🔴 PLAYER (Server): Player with name ${name} already exists in game ${gameId}. Re-fetching full details.`);
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
  console.log("🔴 RESET (Server): Simplified resetGameForTesting action called");
  let gameToReset: Tables<'games'> | null = null;

  try {
    console.log("🔴 RESET (Server): Finding the oldest game to reset...");
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
      console.log('🔴 RESET (Server): No existing game found to reset. A new game will be created on next load if needed.');
      revalidatePath('/');
      revalidatePath('/game');
      revalidatePath('/?step=setup');
      redirect('/?step=setup');
      return;
    }

    gameToReset = existingGames[0];
    const gameId = gameToReset.id;
    console.log(`🔴 RESET (Server): Found game to reset: ID ${gameId}, Current Phase: ${gameToReset.game_phase}`);

    console.log(`🔴 RESET (Server): Clearing player references in game ${gameId}...`);
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
    } else {
      console.log(`🔴 RESET (Server): Successfully cleared player references in game ${gameId}.`);
    }

    console.log(`🔴 RESET (Server): Deleting related data for game ${gameId}...`);
    const tablesToClear = ['player_hands', 'responses', 'winners'];
    for (const table of tablesToClear) {
      console.log(`🔴 RESET (Server): Deleting from ${table} for game_id ${gameId}...`);
      const { error: deleteError } = await supabase.from(table as any).delete().eq('game_id', gameId);
      if (deleteError) {
        console.error(`🔴 RESET (Server): Error deleting from ${table} for game_id ${gameId}:`, JSON.stringify(deleteError, null, 2));
      } else {
        console.log(`🔴 RESET (Server): Successfully deleted from ${table} for game_id ${gameId}.`);
      }
    }

    console.log(`🔴 RESET (Server): Deleting players for game_id ${gameId}...`);
    const { error: playersDeleteError } = await supabase
      .from('players')
      .delete()
      .eq('game_id', gameId);

    if (playersDeleteError) {
      console.error(`🔴 RESET (Server): Error deleting players for game_id ${gameId}:`, JSON.stringify(playersDeleteError, null, 2));
    } else {
      console.log(`🔴 RESET (Server): Player deletion attempt for game_id ${gameId} finished.`);
    }

    const { data: stillExistingPlayers, error: checkPlayersError } = await supabase
      .from('players')
      .select('id', { count: 'exact' })
      .eq('game_id', gameId);

    if (checkPlayersError) {
        console.error(`🔴 RESET (Server): Error checking for remaining players after delete for game ${gameId}:`, checkPlayersError);
    } else if (stillExistingPlayers) {
        console.log(`🔴 RESET (Server): After delete attempt, ${stillExistingPlayers.length} players remain for game ${gameId}.`);
        if (stillExistingPlayers.length > 0) {
            console.warn(`🔴 RESET (Server): WARNING - Players were NOT successfully deleted for game ${gameId}. Players found:`, JSON.stringify(stillExistingPlayers.map((p: any) => p.id)));
        }
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
    };
    console.log(`🔴 RESET (Server): Attempting to update game ${gameId} to lobby phase with data:`, JSON.stringify(updateData, null, 2));

    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error(`🔴 RESET (Server): CRITICAL ERROR: Failed to update game ${gameId} to lobby phase:`, JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update game ${gameId} during reset: ${updateError.message}`);
    }
    console.log(`🔴 RESET (Server): Game ${gameId} successfully updated to lobby phase.`);
    console.log("🔴 RESET (Server): Updated game details:", JSON.stringify(updatedGame, null, 2));

    const { data: verifiedGame, error: verifyError } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (verifyError) {
      console.error(`🔴 RESET (Server): Error verifying reset for game ${gameId}:`, JSON.stringify(verifyError, null, 2));
    } else if (verifiedGame) {
      console.log(`🔴 RESET (Server): Verification - Game ${gameId} phase is now: ${verifiedGame.game_phase}, round: ${verifiedGame.current_round}`);
    } else {
      console.warn(`🔴 RESET (Server): Verification - Game ${gameId} not found after update attempt.`);
    }

    console.log('🔴 RESET (Server): Database operations complete. Preparing to revalidate and redirect.');
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay before redirect
    console.log('🔴 RESET (Server): Delay finished, proceeding with revalidation and redirect.');

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
  console.log('🔴 RESET (Server): Paths revalidated, redirecting to /?step=setup');
  redirect('/?step=setup');
}


async function dealCardsFromSupabase(gameId: string, count: number, existingUsedResponses: string[]): Promise<{ dealtCardIds: string[], updatedUsedResponses: string[] }> {
  console.log(`🔴 CARDS (Server): Dealing ${count} cards for game ${gameId}. Current existingUsedResponses count: ${existingUsedResponses.length}`);

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

  const { data: availableCards, error: fetchError } = await query.limit(count + 50); // Fetch more to allow for shuffling

  if (fetchError) {
    console.error(`🔴 CARDS (Server): Error fetching available response cards for game ${gameId}:`, JSON.stringify(fetchError, null, 2));
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  if (!availableCards || availableCards.length === 0) {
    console.warn(`🔴 CARDS (Server): No available response cards to deal for game ${gameId} after filtering. Total known used: ${allKnownUsedResponses.length}. Attempted to deal ${count}.`);
    return { dealtCardIds: [], updatedUsedResponses: allKnownUsedResponses };
  }

  const shuffledAvailableCards = [...availableCards].sort(() => 0.5 - Math.random());
  const cardsToDeal = shuffledAvailableCards.slice(0, count);
  const dealtCardIds = cardsToDeal.map(c => c.id);

  // This should only include responses used in *this specific deal operation* plus what was passed in.
  // The game.used_responses is updated separately by the calling function if needed.
  const newlyDealtAndUsedInThisOperation = [...new Set([...existingUsedResponses, ...dealtCardIds])];

  return { dealtCardIds, updatedUsedResponses: newlyDealtAndUsedInThisOperation };
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
      .select('id, name, is_ready, joined_at')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true });

    if (playersFetchError || !players) {
      console.error(`🔴 START (Server): Error fetching players for game ${gameId}: ${JSON.stringify(playersFetchError, null, 2)}`);
      throw new Error(`Failed to fetch players for start: ${playersFetchError?.message || 'No players found'}`);
    }
    if (players.length < MIN_PLAYERS_TO_START) {
      console.warn(`🔴 START (Server): Not enough players to start game ${gameId}. Found ${players.length}, need ${MIN_PLAYERS_TO_START}.`);
      throw new Error(`Not enough players to start game (found ${players.length}, need at least ${MIN_PLAYERS_TO_START}).`);
    }

    const firstJudgeId = players[0].id;

    let accumulatedUsedResponsesForThisGameStart = game.used_responses || [];

    const playerHandInserts: TablesInsert<'player_hands'>[] = [];

    for (const player of players) {
      // For the initial deal, is_new should be false.
      const { dealtCardIds, updatedUsedResponses: tempUsedAfterThisPlayer } = await dealCardsFromSupabase(gameId, CARDS_PER_HAND, accumulatedUsedResponsesForThisGameStart);

      if (dealtCardIds.length > 0) {
        console.log(`🔴 START (Server) CARDS: Dealing ${dealtCardIds.length} cards to player ${player.name} (ID: ${player.id}). Initial deal, is_new: false.`);
        dealtCardIds.forEach(cardId => {
          playerHandInserts.push({
            game_id: gameId,
            player_id: player.id,
            response_card_id: cardId,
            is_new: false, // Explicitly false for initial deal
          });
        });
        accumulatedUsedResponsesForThisGameStart = [...new Set([...accumulatedUsedResponsesForThisGameStart, ...dealtCardIds])];
      } else {
         console.warn(`🔴 START (Server) CARDS: No cards dealt to player ${player.name} (ID: ${player.id}).`);
      }
    }

    if (playerHandInserts.length > 0) {
      const { error: allHandsInsertError } = await supabase.from('player_hands').insert(playerHandInserts);
      if (allHandsInsertError) {
        console.error(`🔴 START (Server) CARDS: Critical error inserting player hands:`, JSON.stringify(allHandsInsertError, null, 2));
        // Potentially throw or handle this more gracefully
      } else {
        console.log(`🔴 START (Server) CARDS: Successfully inserted ${playerHandInserts.length} cards into player_hands.`);
      }
    }

    const gameUpdates: TablesUpdate<'games'> = {
      game_phase: 'category_selection',
      current_judge_id: firstJudgeId,
      current_round: 1,
      updated_at: new Date().toISOString(),
      used_responses: accumulatedUsedResponsesForThisGameStart, // Save the used responses
    };

    const { error: updateError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', gameId);

    if (updateError) {
      console.error(`🔴 START (Server): Error updating game ${gameId} to start: ${JSON.stringify(updateError, null, 2)}`);
      throw new Error(`Failed to update game state to start: ${updateError.message}`);
    }
  } else {
     console.warn(`🔴 START (Server): startGame called but game ${gameId} is already in phase ${game.game_phase}. Aborting start.`);
  }

  revalidatePath('/');
  revalidatePath('/game');
  return getGame(gameId);
}


export async function selectCategory(gameId: string, category: string): Promise<GameClientState | null> {
  console.log(`🔴 CATEGORY (Server): selectCategory action for game ${gameId}, category ${category}`);

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

  // Always filter by category first
  query = query.eq('category', category);

  // Then, if there are used scenarios, exclude them
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
    // No unused scenarios in this category, try to fetch *any* scenario from this category (recycling)
    console.warn(`🔴 CATEGORY (Server): No unused scenarios for category ${category}. Attempting to fetch ANY scenario from this category (recycling).`);
    const { data: anyCategoryScenarios, error: anyCategoryError } = await supabase
      .from('scenarios')
      .select('id, text, category')
      .eq('category', category); // Only from the selected category

    if (anyCategoryError || !anyCategoryScenarios || anyCategoryScenarios.length === 0) {
      console.error(`🔴 CATEGORY (Server): Critical - No scenarios found for category ${category} at all, even for recycling.`, JSON.stringify(anyCategoryError, null, 2));
      // Fallback: Try to get ANY scenario from ANY category if the chosen one is truly empty. This is a last resort.
      // This case might be better handled by informing the judge to pick another category or seeding more scenarios.
      // For now, we'll throw an error to make it clear.
      throw new Error(`No scenarios available in category "${category}" at all.`);
    }
    // Pick a random one from the available (possibly already used) scenarios in this category
    scenarioToUse = anyCategoryScenarios[Math.floor(Math.random() * anyCategoryScenarios.length)];
     // When recycling, we don't add to used_scenarios again (it might already be there, or we are explicitly allowing reuse)
     const gameUpdates: TablesUpdate<'games'> = {
      current_scenario_id: scenarioToUse.id,
      game_phase: 'player_submission',
      updated_at: new Date().toISOString(),
      // used_scenarios: game.used_scenarios // Keep existing used_scenarios
    };
     const { error: updateError } = await supabase.from('games').update(gameUpdates).eq('id', gameId);
     if (updateError) throw new Error(`Failed to update game after category selection (recycle): ${updateError.message}`);

  } else {
    // We found unused scenarios
    scenarioToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
    const updatedUsedScenarios = [...new Set([...usedScenarios, scenarioToUse.id])]; // Add the newly used one
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


export async function submitResponse(playerId: string, responseCardText: string, gameId: string, currentRound: number, isCustomSubmission: boolean): Promise<GameClientState | null> {
  console.log(`🔴 SUBMIT (Server): Player ${playerId} submitting. Custom: ${isCustomSubmission}. Text: "${responseCardText}" for game ${gameId} round ${currentRound}`);

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

  // Check if player already submitted for this round
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
    console.warn(`🔴 SUBMIT (Server): Player ${playerId} has already submitted a card for round ${currentRound}.`);
    throw new Error("You have already submitted a card for this round.");
  }

  let responseCardIdToStore: string | null = null;
  let submittedTextToStore: string | null = null;
  let cardToRemoveFromHandId: string | null = null; // Only for non-custom cards

  if (isCustomSubmission) {
    console.log(`🔴 SUBMIT (Server): Handling custom submission for player ${playerId}. Text: "${responseCardText}"`);
    submittedTextToStore = responseCardText;
    // No card to remove from hand for custom submissions (as it wasn't "dealt")
    // No responseCardId to store in `responses` as it's custom text.
  } else {
    // Find the card ID from the player's hand based on the text (for pre-dealt cards)
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
    responseCardIdToStore = handCardEntry.response_card_id;
    cardToRemoveFromHandId = handCardEntry.response_card_id; // This is the card to remove from player_hands
    // submitted_text remains null for non-custom submissions
  }
  
  // Clear is_new flag for ALL cards in player's hand for this game (custom or not, this is good practice)
  console.log(`🔴 SUBMIT (Server) CARDS: Setting is_new=false for other cards of player ${playerId} in game ${gameId}.`);
  const { error: clearOldNewFlagsError } = await supabase
    .from('player_hands')
    .update({ is_new: false })
    .eq('player_id', playerId)
    .eq('game_id', gameId);
  if (clearOldNewFlagsError) console.error(`🔴 SUBMIT (Server) CARDS: Error clearing is_new flags for player ${playerId}:`, JSON.stringify(clearOldNewFlagsError, null, 2));


  // Insert the submission
  const { error: insertError } = await supabase
    .from('responses')
    .insert({
      game_id: gameId,
      player_id: playerId,
      response_card_id: responseCardIdToStore, // Will be null if custom
      submitted_text: submittedTextToStore,     // Will be null if not custom
      round_number: currentRound,
    });

  if (insertError) {
    console.error(`🔴 SUBMIT (Server): Error inserting submission for player ${playerId}:`, JSON.stringify(insertError, null, 2));
    throw new Error(`Failed to insert submission: ${insertError.message}`);
  }

  // If it was a pre-dealt card, remove it from the player's hand
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

  // Deal a new card to the player (regardless of custom or pre-dealt submission) and mark it as 'new'
  let gameUsedResponses = gameData.used_responses || [];
  // Add the just-played pre-dealt card's ID to the list of used responses for this deal operation if it was one
  // Custom submissions don't have a response_card_id from the deck to add here.
  const usedResponsesBeforeNewDeal = responseCardIdToStore 
    ? [...new Set([...gameUsedResponses, responseCardIdToStore])] 
    : gameUsedResponses;

  const { dealtCardIds: replacementCardIds, updatedUsedResponses: finalUsedResponsesAfterPlayAndDeal } = await dealCardsFromSupabase(gameId, 1, usedResponsesBeforeNewDeal);

  if (replacementCardIds.length > 0) {
    const newCardId = replacementCardIds[0];
    console.log(`🔴 SUBMIT (Server) CARDS: Dealing replacement card ${newCardId} to player ${playerId} with is_new=true.`);
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
    } else {
      console.log(`🔴 SUBMIT (Server) CARDS: Successfully dealt replacement card ${newCardId} to player ${playerId} with is_new=true.`);
    }
  } else {
    console.warn(`🔴 SUBMIT (Server) CARDS: Could not deal new card to player ${playerId}, no cards available or error in dealCardsFromSupabase.`);
  }
  
  // Update the game's used_responses list (includes the newly dealt card and any pre-dealt card played)
  const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ used_responses: finalUsedResponsesAfterPlayAndDeal, updated_at: new Date().toISOString() })
      .eq('id', gameId);
  if (gameUpdateError) {
      console.error(`🔴 SUBMIT (Server): Error updating game.used_responses:`, JSON.stringify(gameUpdateError, null, 2));
  }

  // Check if all players have submitted
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

  console.log(`🔴 SUBMIT (Server): Submissions count: ${submissionsCount}, Total non-judge players: ${totalNonJudgePlayers}`);
  if (submissionsCount !== null && totalNonJudgePlayers > 0 && submissionsCount >= totalNonJudgePlayers) {
    console.log(`🔴 SUBMIT (Server): All players submitted. Changing game phase to 'judging'.`);
    const { error: phaseUpdateError } = await supabase
      .from('games')
      .update({ game_phase: 'judging', updated_at: new Date().toISOString() })
      .eq('id', gameId);
    if (phaseUpdateError) {
      console.error('🔴 SUBMIT (Server): Error updating game phase to judging:', JSON.stringify(phaseUpdateError, null, 2));
    }
  }

  revalidatePath('/game');
  return getGame(gameId);
}


export async function selectWinner(winningCardText: string, gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 WINNER (Server): Judge selecting winner with card text "${winningCardText}" for game ${gameId}`);

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('current_round, current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error(`🔴 WINNER (Server): Error fetching game ${gameId}:`, JSON.stringify(gameError, null, 2));
    throw new Error(`Failed to fetch game for winner selection: ${gameError?.message || 'Game not found'}`);
  }

  // Find the submission based on the card text. This text could be from response_cards.text OR responses.submitted_text
  // This query needs to be flexible.
  let winningSubmissionData: { player_id: string; response_card_id: string | null; submitted_text: string | null; response_cards: { text: string | null } | null } | null = null;
  
  // Try finding by submitted_text first (custom cards)
  const { data: customSubmission, error: customSubmissionError } = await supabase
    .from('responses')
    .select('player_id, response_card_id, submitted_text, response_cards (text)') // response_cards might be null here
    .eq('game_id', gameId)
    .eq('round_number', game.current_round)
    .eq('submitted_text', winningCardText)
    .single();

  if (customSubmission && !customSubmissionError) {
    winningSubmissionData = customSubmission;
    console.log(`🔴 WINNER (Server): Matched winning card as custom submission (submitted_text). Player: ${winningSubmissionData.player_id}`);
  } else {
    // If not found as custom, try finding by response_cards.text (pre-dealt cards)
    const { data: preDealtSubmission, error: preDealtSubmissionError } = await supabase
      .from('responses')
      .select('player_id, response_card_id, submitted_text, response_cards!inner(text)') // !inner ensures response_cards exists
      .eq('game_id', gameId)
      .eq('round_number', game.current_round)
      .eq('response_cards.text', winningCardText)
      .single();

    if (preDealtSubmission && !preDealtSubmissionError) {
      winningSubmissionData = preDealtSubmission;
      console.log(`🔴 WINNER (Server): Matched winning card as pre-dealt card (response_cards.text). Card ID: ${winningSubmissionData.response_card_id}, Player: ${winningSubmissionData.player_id}`);
    } else {
      console.error(`🔴 WINNER (Server): Error finding winning submission for card text "${winningCardText}" in round ${game.current_round}. Custom error: ${JSON.stringify(customSubmissionError, null, 2)}, Pre-dealt error: ${JSON.stringify(preDealtSubmissionError, null, 2)}`);
      throw new Error(`Could not find submission matching card "${winningCardText}".`);
    }
  }

  if (!winningSubmissionData) { // Should be caught by the else above, but as a safeguard
    throw new Error(`Critical error: No winning submission found for "${winningCardText}".`);
  }

  const winningPlayerId = winningSubmissionData.player_id;
  // winningResponseCardId will be null if it was a custom card (submitted_text)
  const winningResponseCardIdForWinnersTable = winningSubmissionData.response_card_id; 


  // Increment winner's score
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

  const { error: scoreUpdateError } = await supabase
    .from('players')
    .update({ score: newScore })
    .eq('id', winningPlayerId);

  if (scoreUpdateError) {
    console.error(`🔴 WINNER (Server): Error updating score for player ${winningPlayerId}:`, JSON.stringify(scoreUpdateError, null, 2));
  }

  // Record the winner for the round
  // If it was a custom card, winning_response_card_id will be NULL.
  // We might want to create a new response_card entry here if a custom card wins and should be added to the deck (Phase 2 of feature)
  // For now, we just record what we have.
  const winnerInsertPayload: TablesInsert<'winners'> = {
    game_id: gameId,
    round_number: game.current_round,
    winner_player_id: winningPlayerId,
    // This is tricky: if it's a custom card, response_card_id from `responses` table is null.
    // The `winners` table expects a `winning_response_card_id`.
    // For now, if it's a custom card (winningSubmissionData.response_card_id is null),
    // we cannot satisfy the NOT NULL constraint on winners.winning_response_card_id if it exists.
    // Assuming winners.winning_response_card_id can be NULL for now, or we need a placeholder/new card creation step.
    // Let's assume `winning_response_card_id` in `winners` table is NOT NULL for now.
    // This part requires a decision: if custom card wins, do we immediately add it to response_cards and get an ID?
    // For current implementation, we'll skip inserting into `winners` if it's a custom card without an ID
    // This means the `winners` table might only track winners of pre-dealt cards for now.
    // This is a simplification until Phase 2 (judge approval of custom cards to deck).
  };
  
  // Only insert into 'winners' if there's an actual card ID (i.e., not a custom, unapproved write-in)
  if (winningResponseCardIdForWinnersTable) {
    winnerInsertPayload.winning_response_card_id = winningResponseCardIdForWinnersTable;
    const { error: winnerInsertError } = await supabase
      .from('winners')
      .insert(winnerInsertPayload);

    if (winnerInsertError) {
      console.error(`🔴 WINNER (Server): Error inserting round winner into 'winners' table:`, JSON.stringify(winnerInsertError, null, 2));
    }
  } else {
     console.log(`🔴 WINNER (Server): Winning card was custom text ("${winningCardText}"). Not inserting into 'winners' table as there's no persisted response_card_id yet.`);
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
    last_round_winning_card_text: winningCardText, // Storing actual winning text for display
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

  revalidatePath('/game');
  return getGame(gameId);
}


export async function nextRound(gameId: string): Promise<GameClientState | null> {
  console.log(`🔴 NEXT ROUND (Server): nextRound action called for game ${gameId}`);

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
    console.log(`🔴 NEXT ROUND (Server): Game ${gameId} is over. Calling resetGameForTesting to prepare for new game.`);
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
    console.warn(`🔴 NEXT ROUND (Server): nextRound called but game ${gameId} is in phase ${game.game_phase}, not 'winner_announcement'. Re-fetching state.`);
    revalidatePath('/game');
    return getGame(gameId); 
  }

  const { data: players, error: playersFetchError } = await supabase
    .from('players')
    .select('id, joined_at, name') 
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true }); 

  if (playersFetchError || !players || players.length < 1) { 
    console.error(`🔴 NEXT ROUND (Server): Error fetching players or not enough players for game ${gameId}:`, JSON.stringify(playersFetchError, null, 2));
    throw new Error(`Not enough players for next round (found ${players?.length || 0}). Or ${playersFetchError?.message}`);
  }

  let nextJudgeId: string | null = game.current_judge_id; 
  const previousJudgeId: string | null = game.current_judge_id; 

  if (players.length > 0) { 
    if (game.current_judge_id) {
      const currentJudgeIndex = players.findIndex(p => p.id === game.current_judge_id);
      if (currentJudgeIndex !== -1) { 
        nextJudgeId = players[(currentJudgeIndex + 1) % players.length].id;
      } else { 
        nextJudgeId = players[0].id;
      }
    } else { 
      nextJudgeId = players[0].id;
    }
  } else if (nextJudgeId === null) { 
      console.error(`🔴 NEXT ROUND (Server): CRITICAL - No players and no current judge to assign from for game ${gameId}.`);
      throw new Error("No players available to assign a judge.");
  }
  
  const nextJudgePlayer = players.find(p => p.id === nextJudgeId);
  console.log(`🔴 NEXT ROUND (Server): Assigning player ${nextJudgePlayer?.name} (ID: ${nextJudgeId}) as the next judge for game ${gameId}. Previous judge was ${previousJudgeId}.`);


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
    console.error(`DEBUG: getCurrentPlayer - Error fetching player ${playerId} for game ${gameId}:`, JSON.stringify(playerFetchError, null, 2));
    return undefined;
  }

  const { data: gameData, error: gameFetchError } = await supabase
    .from('games')
    .select('current_judge_id')
    .eq('id', gameId)
    .single();

  if (gameFetchError) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching game data for judge check (player ${playerId}, game ${gameId}):`, JSON.stringify(gameFetchError, null, 2));
  }

  let handCards: PlayerHandCard[] = [];
  const { data: handData, error: handError } = await supabase
    .from('player_hands')
    .select('response_card_id, is_new, response_cards (id, text)') 
    .eq('player_id', playerId)
    .eq('game_id', gameId);

  if (handError) {
    console.error(`DEBUG: getCurrentPlayer - Error fetching hand for player ${playerId} game ${gameId}:`, JSON.stringify(handError, null, 2));
  } else if (handData) {
    console.log(`🔴 GET_CUR_PLAYER (Server) CARDS: Raw hand for player ${playerId}:`, JSON.stringify(handData.map(h => ({cardId: h.response_cards?.id, is_new: h.is_new})), null, 2));
    handCards = handData
      .map((h: any) => { 
        if (h.response_cards && h.response_cards.id && h.response_cards.text) {
          console.log(`🔴 GET_CUR_PLAYER (Server) CARDS: Card ${h.response_cards.id} for player ${playerId} has is_new: ${h.is_new}`);
          return {
            id: h.response_cards.id,
            text: h.response_cards.text,
            isNew: h.is_new ?? false, 
          };
        }
        return null;
      })
      .filter(card => card !== null) as PlayerHandCard[];
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
  console.log(`🔴 READY (Server): Player ${updatedPlayer.name} (ID: ${playerId}) readiness changed to ${newReadyStatus}`);

  const { data: game, error: gameFetchError } = await supabase
    .from('games')
    .select('ready_player_order, game_phase') 
    .eq('id', gameId)
    .single();

  if (gameFetchError || !game) {
    console.error(`🔴 READY (Server): Error fetching game ${gameId} to update ready_player_order:`, JSON.stringify(gameFetchError, null, 2));
  } else {
    let currentReadyOrder = game.ready_player_order || [];
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
      .eq('id', gameId);

    if (gameOrderUpdateError) {
      console.error(`🔴 READY (Server): Error updating ready_player_order for game ${gameId}:`, JSON.stringify(gameOrderUpdateError, null, 2));
    } else {
      console.log(`🔴 READY (Server): Game ${gameId} ready_player_order updated: [${currentReadyOrder.join(', ')}]`);
      if (game.game_phase === 'lobby' && newReadyStatus) {
        const { data: allPlayers, error: allPlayersError } = await supabase
          .from('players')
          .select('id, is_ready')
          .eq('game_id', gameId);

        if (allPlayersError) {
          console.error(`🔴 READY (Server): Error fetching all players for auto-start check:`, JSON.stringify(allPlayersError, null, 2));
        } else if (allPlayers && allPlayers.length >= MIN_PLAYERS_TO_START) {
          const allActuallyReady = allPlayers.every(p => p.is_ready);
          if (allActuallyReady) {
            console.log(`🔴 READY (Server): All ${allPlayers.length} players are ready. Attempting to auto-start game ${gameId}.`);
            try {
              await startGame(gameId); 
            } catch (startError: any) {
              console.error(`🔴 READY (Server): Error auto-starting game ${gameId}:`, startError.message, JSON.stringify(startError, null, 2));
            }
          } else {
            const readyCount = allPlayers.filter(p => p.is_ready).length;
            console.log(`🔴 READY (Server): Game ${gameId} not auto-starting. ${readyCount}/${allPlayers.length} players ready. Need ${MIN_PLAYERS_TO_START} and all to be ready.`);
          }
        }
      }
    }
  }

  revalidatePath('/'); 
  revalidatePath('/game'); 
  
  return getGame(gameId); 
}
