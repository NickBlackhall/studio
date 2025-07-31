"use client";

import React, { useState } from 'react';
import { PureMorphingModal } from './PureMorphingModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Lock, Unlock } from 'lucide-react';

interface PinCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

const RESET_PIN = "6425"; // Change this to your preferred PIN

export default function PinCodeModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  title = "Enter PIN to Reset Game" 
}: PinCodeModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Small delay to prevent brute force attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    if (pin === RESET_PIN) {
      setPin('');
      setError('');
      setIsSubmitting(false);
      onClose();
      onSuccess();
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    setIsSubmitting(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) { // Max 6 digits
      setPin(value);
      if (error) setError(''); // Clear error when typing
    }
  };

  return (
    <PureMorphingModal
      isOpen={isOpen}
      onClose={handleClose}
      variant="settings"
      icon="🔒"
      title={title}
      isDismissable={!isSubmitting}
    >
      <div className="space-y-6 p-4">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-sm text-gray-600 mb-4">
            This action will reset the entire game and remove all players. 
            Enter the PIN to confirm you want to proceed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter PIN"
              value={pin}
              onChange={handleInputChange}
              className="text-center text-lg tracking-widest"
              maxLength={6}
              autoFocus
              disabled={isSubmitting}
            />
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || !pin.trim()}
            >
              {isSubmitting ? (
                <>
                  <Lock className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Reset Game
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PureMorphingModal>
  );
}