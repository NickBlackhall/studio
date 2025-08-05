"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import { Hash, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { isValidRoomCodeFormat, normalizeRoomCode } from '@/lib/roomCodes';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
  isJoining?: boolean;
  initialRoomCode?: string;
}

export default function JoinRoomModal({ 
  isOpen, 
  onClose, 
  onJoinRoom, 
  isJoining = false,
  initialRoomCode = ''
}: JoinRoomModalProps) {
  const [roomCode, setRoomCode] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);

  // Set initial room code when modal opens
  useEffect(() => {
    if (isOpen && initialRoomCode) {
      const normalized = normalizeRoomCode(initialRoomCode);
      setRoomCode(normalized);
      setIsValid(isValidRoomCodeFormat(normalized));
    }
  }, [isOpen, initialRoomCode]);

  const handleRoomCodeChange = (value: string) => {
    // Allow only alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Limit to 6 characters
    const limited = cleaned.slice(0, 6);
    setRoomCode(limited);
    
    // Validate format
    if (limited.length === 0) {
      setIsValid(null);
    } else if (limited.length === 6) {
      setIsValid(isValidRoomCodeFormat(limited));
    } else {
      setIsValid(false);
    }
  };

  const handleJoin = () => {
    if (isValid && roomCode.length === 6) {
      onJoinRoom(roomCode);
    }
  };

  const handleClose = () => {
    setRoomCode('');
    setIsValid(null);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && roomCode.length === 6 && !isJoining) {
      handleJoin();
    }
  };

  const formatDisplayCode = (code: string) => {
    if (code.length <= 3) return code;
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  };

  return (
    <PureMorphingModal
      isOpen={isOpen}
      onClose={handleClose}
      variant="settings"
      icon="🔑"
      title="Join Room by Code"
    >
      <div className="space-y-6">
        <div className="text-black/80 text-sm">
          Enter the 6-character room code to join a game
        </div>

        {/* Room Code Input */}
        <div className="space-y-3">
          <Label htmlFor="roomCode" className="text-black font-medium">
            Room Code
          </Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black/40" />
            <Input
              id="roomCode"
              placeholder="PARTY7"
              value={roomCode}
              onChange={(e) => handleRoomCodeChange(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10 bg-white/90 border-black/20 text-center text-lg font-mono tracking-wider"
              maxLength={6}
              autoFocus
            />
            {/* Validation Icon */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isValid === true && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              {isValid === false && roomCode.length > 0 && (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
          </div>
          
          {/* Display formatted code */}
          {roomCode.length > 0 && (
            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-black/70 tracking-wider">
                {formatDisplayCode(roomCode)}
              </span>
            </div>
          )}
          
          {/* Validation Message */}
          <div className="text-sm text-center min-h-[20px]">
            {isValid === false && roomCode.length > 0 && (
              <p className="text-red-600">Invalid room code format</p>
            )}
            {isValid === true && (
              <p className="text-green-600">✓ Valid room code format</p>
            )}
            {roomCode.length === 0 && (
              <p className="text-black/50">Room codes are 6 characters (letters and numbers)</p>
            )}
          </div>
        </div>

        {/* Examples */}
        <div className="bg-black/5 rounded-lg p-3">
          <p className="text-sm font-medium text-black/80 mb-2">Example room codes:</p>
          <div className="flex flex-wrap gap-2">
            {['PARTY7', 'FUN23X', 'GAME42'].map((example) => (
              <button
                key={example}
                onClick={() => handleRoomCodeChange(example)}
                className="px-3 py-1 bg-white/80 hover:bg-white rounded text-sm font-mono font-bold text-black/70 transition-colors"
                disabled={isJoining}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 bg-black/10 hover:bg-black/20 text-black border-black/30"
            disabled={isJoining}
          >
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            disabled={!isValid || roomCode.length !== 6 || isJoining}
          >
            {isJoining ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Joining...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4" />
                <span>Join Room</span>
              </div>
            )}
          </Button>
        </div>

        {/* Tips */}
        <div className="text-xs text-black/60 space-y-1">
          <p>💡 <strong>Tip:</strong> Room codes are not case-sensitive</p>
          <p>🔍 <strong>Can't find the room?</strong> Make sure the code is correct and the room is still active</p>
        </div>
      </div>
    </PureMorphingModal>
  );
}