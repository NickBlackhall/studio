
"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AVATARS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';


interface PlayerSetupFormProps {
  addPlayer: (formData: FormData) => Promise<void>;
}

export default function PlayerSetupForm({ addPlayer }: PlayerSetupFormProps) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATARS[0]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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
      toast({
        title: "Welcome!",
        description: `${name} has joined the game!`,
      });
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
        <div className="grid grid-cols-5 gap-1 p-2 bg-muted rounded-lg border-2">
          {AVATARS.map((avatarPath, index) => (
            <button
              key={avatarPath}
              type="button"
              onClick={() => setSelectedAvatar(avatarPath)}
              className={cn(
                "p-1 rounded-md transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 aspect-square flex items-center justify-center",
                selectedAvatar === avatarPath 
                  ? 'ring-primary ring-offset-2 scale-105' 
                  : 'ring-transparent hover:ring-muted-foreground/50' 
              )}
              aria-label={`Select avatar ${index + 1}`}
            >
              <Image 
                src={avatarPath} 
                alt={`Avatar ${index + 1}`} 
                width={48}
                height={48}
                className="object-contain rounded-sm"
              />
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending || !name.trim()} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3">
        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
        Join Game
      </Button>
    </form>
  );
}

