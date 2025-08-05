"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import { 
  Globe, 
  Users, 
  Clock, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Gamepad2,
  Crown
} from 'lucide-react';
import { getPublicGames } from '@/lib/roomCodes';

interface PublicGame {
  id: string;
  room_code: string;
  room_name: string | null;
  game_phase: string;
  max_players: number;
  created_at: string;
  currentPlayers: number;
  availableSlots: number;
}

interface RoomBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
  isJoining?: boolean;
}

export default function RoomBrowserModal({ 
  isOpen, 
  onClose, 
  onJoinRoom, 
  isJoining = false 
}: RoomBrowserModalProps) {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(null);

  const fetchPublicGames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const publicGames = await getPublicGames();
      setGames(publicGames as PublicGame[]);
    } catch (err) {
      setError('Failed to load public games. Please try again.');
      console.error('Error fetching public games:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPublicGames();
    }
  }, [isOpen]);

  const handleJoinRoom = (roomCode: string) => {
    setSelectedRoomCode(roomCode);
    onJoinRoom(roomCode);
  };

  const getGamePhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'lobby':
        return { text: 'In Lobby', color: 'text-green-600', icon: '⏳' };
      case 'category_selection':
        return { text: 'Starting Soon', color: 'text-yellow-600', icon: '🎯' };
      case 'player_submission':
        return { text: 'Playing', color: 'text-blue-600', icon: '✍️' };
      case 'judging':
        return { text: 'Judging', color: 'text-purple-600', icon: '👨‍⚖️' };
      case 'winner_announcement':
        return { text: 'Round Ending', color: 'text-orange-600', icon: '🏆' };
      default:
        return { text: 'Unknown', color: 'text-gray-600', icon: '❔' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <PureMorphingModal
      isOpen={isOpen}
      onClose={onClose}
      variant="settings"
      icon="🌐"
      title="Browse Public Rooms"
      className="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-black/80 text-sm">
            Join any available public game room
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPublicGames}
            disabled={isLoading}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && games.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-black/50" />
              <p className="text-black/60">Finding public games...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-red-600">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchPublicGames}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* No Games State */}
        {!isLoading && !error && games.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-black/60">
              <Globe className="h-12 w-12 mx-auto mb-4 text-black/30" />
              <h3 className="text-lg font-medium mb-2">No Public Games Available</h3>
              <p className="text-sm mb-4">Be the first to create a public room!</p>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="bg-black/10 hover:bg-black/20 text-black border-black/30"
              >
                Create New Room
              </Button>
            </div>
          </div>
        )}

        {/* Games List */}
        {games.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {games.map((game) => {
              const phaseInfo = getGamePhaseDisplay(game.game_phase);
              const isJoiningThis = isJoining && selectedRoomCode === game.room_code;
              
              return (
                <Card 
                  key={game.id}
                  className="bg-white/95 hover:bg-white transition-all duration-200"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                          <Gamepad2 className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {game.room_name || 'Unnamed Room'}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            Room Code: <span className="font-mono font-bold">{game.room_code}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${phaseInfo.color}`}>
                          {phaseInfo.icon} {phaseInfo.text}
                        </div>
                        <div className="text-xs text-black/50 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeAgo(game.created_at)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-black/70">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{game.currentPlayers}/{game.max_players} players</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div 
                            className={`w-2 h-2 rounded-full ${
                              game.availableSlots > 0 ? 'bg-green-500' : 'bg-red-500'
                            }`} 
                          />
                          <span>
                            {game.availableSlots > 0 
                              ? `${game.availableSlots} spots left`
                              : 'Full'
                            }
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleJoinRoom(game.room_code)}
                        disabled={game.availableSlots === 0 || isJoining}
                        className="bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300"
                        size="sm"
                      >
                        {isJoiningThis ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Joining...</span>
                          </div>
                        ) : (
                          'Join Room'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Close Button */}
        <div className="pt-4 border-t border-black/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full bg-black/10 hover:bg-black/20 text-black border-black/30"
            disabled={isJoining}
          >
            Close Browser
          </Button>
        </div>
      </div>
    </PureMorphingModal>
  );
}