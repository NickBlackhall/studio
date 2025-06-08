
"use client";

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AVATARS } from '@/lib/data';
import { UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AvatarCarousel from './AvatarCarousel';


interface PlayerSetupFormProps {
  addPlayer: (formData: FormData) => Promise<void>;
}

export default function PlayerSetupForm({ addPlayer }: PlayerSetupFormProps) {
  const [name, setName] = useState('');
  // Initialize selectedAvatar with the first avatar, or ensure it's set by the carousel's initial onAvatarSelect call
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Set initial avatar from carousel if not already set
  useEffect(() => {
    if (!selectedAvatar && AVATARS.length > 0) {
      setSelectedAvatar(AVATARS[0]);
    }
  }, [selectedAvatar]);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Oops!",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedAvatar) {
       toast({
        title: "Hey!",
        description: "Please select an avatar.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('avatar', selectedAvatar);

    startTransition(async () => {
      await addPlayer(formData);
      // setName(''); // Optionally reset name for next player
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-lg font-medium text-foreground">Your Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Terrible Terry"
          className="text-base border-2 focus:border-accent"
          maxLength={20}
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-lg font-medium text-foreground">Choose Your Avatar</Label>
        <AvatarCarousel
          avatars={AVATARS}
          initialAvatar={selectedAvatar || (AVATARS.length > 0 ? AVATARS[0] : '')}
          onAvatarSelect={setSelectedAvatar}
          className="py-2"
        />
      </div>

      <Button type="submit" disabled={isPending || !name.trim() || !selectedAvatar} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3">
        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
        Join Game
      </Button>
    </form>
  );
}
