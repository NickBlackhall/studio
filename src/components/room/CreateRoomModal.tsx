"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import { Users, Globe, Lock, Gamepad2 } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (roomSettings: RoomSettings) => void;
  isCreating?: boolean;
}

export interface RoomSettings {
  roomName: string;
  isPublic: boolean;
  maxPlayers: number;
}

export default function CreateRoomModal({ 
  isOpen, 
  onClose, 
  onCreateRoom, 
  isCreating = false 
}: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState([8]);

  const handleCreate = () => {
    const settings: RoomSettings = {
      roomName: roomName.trim() || 'Unnamed Room',
      isPublic,
      maxPlayers: maxPlayers[0]
    };
    onCreateRoom(settings);
  };

  const handleClose = () => {
    // Reset form when closing
    setRoomName('');
    setIsPublic(true);
    setMaxPlayers([8]);
    onClose();
  };

  return (
    <PureMorphingModal
      isOpen={isOpen}
      onClose={handleClose}
      variant="settings"
      icon="🎮"
      title="Create New Room"
    >
      <div className="space-y-6">
        <div className="text-black/80 text-sm">
          Set up your game room with custom settings
        </div>

        {/* Room Name */}
        <div className="space-y-2">
          <Label htmlFor="roomName" className="text-black font-medium">
            Room Name (Optional)
          </Label>
          <Input
            id="roomName"
            placeholder="e.g., Friday Night Chaos, Office Party"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="bg-white/90 border-black/20"
            maxLength={50}
          />
          <p className="text-xs text-black/60">
            Leave blank for "Unnamed Room"
          </p>
        </div>

        {/* Public/Private Toggle */}
        <div className="space-y-3">
          <Label className="text-black font-medium">Room Visibility</Label>
          <div className="flex items-center justify-between p-3 bg-black/5 rounded-lg">
            <div className="flex items-center space-x-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-green-600" />
              ) : (
                <Lock className="h-5 w-5 text-orange-600" />
              )}
              <div>
                <p className="text-black font-medium">
                  {isPublic ? 'Public Room' : 'Private Room'}
                </p>
                <p className="text-xs text-black/60">
                  {isPublic 
                    ? 'Anyone can find and join this room'
                    : 'Only people with the room code can join'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>

        {/* Max Players */}
        <div className="space-y-3">
          <Label className="text-black font-medium">
            Maximum Players: {maxPlayers[0]}
          </Label>
          <div className="px-3">
            <Slider
              value={maxPlayers}
              onValueChange={setMaxPlayers}
              min={2}
              max={15}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-black/60 mt-1">
              <span>2 players</span>
              <span>15 players</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-black/70">
            <Users className="h-4 w-4" />
            <span>
              {maxPlayers[0] <= 4 && "Intimate group"}
              {maxPlayers[0] > 4 && maxPlayers[0] <= 8 && "Perfect party size"}
              {maxPlayers[0] > 8 && maxPlayers[0] <= 12 && "Large group fun"}
              {maxPlayers[0] > 12 && "Massive chaos!"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 bg-black/10 hover:bg-black/20 text-black border-black/30"
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            disabled={isCreating}
            data-testid="create-game-button"
          >
            {isCreating ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Gamepad2 className="h-4 w-4" />
                <span>Create Room</span>
              </div>
            )}
          </Button>
        </div>

        {/* Preview */}
        <div className="bg-black/5 rounded-lg p-3 text-sm">
          <p className="font-medium text-black/80 mb-1">Room Preview:</p>
          <div className="text-black/70 space-y-1">
            <p>• Name: "{roomName || 'Unnamed Room'}"</p>
            <p>• Visibility: {isPublic ? 'Public (discoverable)' : 'Private (code only)'}</p>
            <p>• Max Players: {maxPlayers[0]}</p>
            <p>• You'll get a room code to share with friends</p>
          </div>
        </div>
      </div>
    </PureMorphingModal>
  );
}