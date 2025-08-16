"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Hash, 
  Globe, 
  Zap, 
  User, 
  Settings, 
  HelpCircle, 
  Edit,
  Volume2,
  VolumeX,
  Music,
  RefreshCw
} from 'lucide-react';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import { useAudio } from '@/contexts/AudioContext';

interface MainMenuProps {
  onCreateRoom: () => void;
  onJoinByCode: () => void;
  onBrowseRooms: () => void;
  onQuickJoin: () => void;
  onResetGame?: () => void;
}

export default function MainMenu({ 
  onCreateRoom, 
  onJoinByCode, 
  onBrowseRooms, 
  onQuickJoin,
  onResetGame
}: MainMenuProps) {
  const [isJoinCreateModalOpen, setIsJoinCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const { state: audioState, toggleMute, toggleMusicMute, toggleSfxMute, playSfx } = useAudio();

  // Main menu options (2 primary cards)
  const mainMenuOptions = [
    {
      title: "Join or Create Game",
      description: "Start playing or join friends",
      icon: <Plus className="h-8 w-8" />,
      onClick: () => {
        playSfx('/Sound/sound-effects/Button Firm 2_01.wav');
        setIsJoinCreateModalOpen(true);
      },
      primary: true
    },
    {
      title: "Settings & More",
      description: "Audio, rules, and other options",
      icon: <Settings className="h-8 w-8" />,
      onClick: () => {
        playSfx('/Sound/sound-effects/Button Firm 2_01.wav');
        setIsSettingsModalOpen(true);
      }
    }
  ];

  // Sub-menu: Join/Create Game options
  const roomOptions = [
    {
      title: "Create New Room",
      description: "Start a new game with custom settings",
      icon: <Plus className="h-6 w-6" />,
      onClick: onCreateRoom,
      primary: true
    },
    {
      title: "Join by Code",
      description: "Enter a room code to join friends",
      icon: <Hash className="h-6 w-6" />,
      onClick: onJoinByCode
    },
    {
      title: "Browse Public Rooms",
      description: "Join any available public game",
      icon: <Globe className="h-6 w-6" />,
      onClick: onBrowseRooms
    },
    {
      title: "Quick Join",
      description: "Jump into any room instantly",
      icon: <Zap className="h-6 w-6" />,
      onClick: onQuickJoin
    }
  ];

  // Settings modal options
  const settingsOptions = [
    {
      title: "Audio Settings",
      description: "Manage music and sound effects",
      icon: audioState.isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />,
      onClick: () => {
        setIsSettingsModalOpen(false);
        setIsAudioSettingsOpen(true);
      }
    },
    {
      title: "How to Play",
      description: "Learn the game rules",
      icon: <HelpCircle className="h-6 w-6" />,
      onClick: () => {
        setIsSettingsModalOpen(false);
        setIsHowToPlayOpen(true);
      }
    },
    {
      title: "Submit Cards",
      description: "Add your own response cards",
      icon: <Edit className="h-6 w-6" />,
      onClick: () => {
        setIsSettingsModalOpen(false);
        window.open('https://forms.gle/vj3Z9NnyGrQ1yf737', '_blank');
      }
    },
    {
      title: "Player Accounts",
      description: "Coming soon! Track stats & achievements",
      icon: <User className="h-6 w-6" />,
      onClick: () => {},
      comingSoon: true
    },
    ...(onResetGame ? [{
      title: "Reset Game (Testing)",
      description: "PIN protected game reset",
      icon: <RefreshCw className="h-6 w-6" />,
      onClick: () => {
        setIsSettingsModalOpen(false);
        onResetGame();
      },
      destructive: true
    }] : [])
  ];

  return (
    <div className="w-full h-screen animate-in fade-in duration-700 ease-out" data-testid="main-menu">
      <div className="relative w-full h-full">
        {/* Background Image */}
        <Image 
          src="/backgrounds/main-menu-background.jpg" 
          alt="Main Menu background" 
          fill 
          className="poster-image" 
          data-ai-hint="main menu background" 
        />
        
        
        {/* Main Content */}
        <div className="relative z-10 flex flex-col h-full p-6 justify-end">
          {/* Main Menu Options */}
          <div className="pb-8">
            <div className="animate-in slide-in-from-bottom duration-700 delay-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 scale-65 transform-gpu">
                {mainMenuOptions.map((option) => (
                  <Card 
                    key={option.title}
                    className="relative overflow-hidden bg-transparent cursor-pointer shadow-lg w-96"
                    onClick={option.onClick}
                    data-testid={option.title === "Join or Create Game" ? "join-create-card" : "settings-card"}
                    style={{
                      height: '150px',
                      backgroundImage: option.title === "Join or Create Game" 
                        ? 'url(/ui/join-create-game-button-main-menu.jpg)'
                        : option.title === "Settings & More"
                        ? 'url(/ui/settings-more-button.jpg)'
                        : 'url(/ui/mit-card-front.png)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    <CardHeader className="pb-4">
                      <div className="h-16"></div> {/* Spacer to maintain card height */}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-8"></div> {/* Spacer to maintain card height */}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join/Create Game Modal */}
      <PureMorphingModal
        isOpen={isJoinCreateModalOpen}
        onClose={() => setIsJoinCreateModalOpen(false)}
        variant="settings"
        icon="🎮"
        title="Join or Create Game"
      >
        <div className="text-black/90 mb-5">
          Choose how you want to start playing
        </div>
        <div className="grid grid-cols-1 gap-3">
          {roomOptions.map((option) => (
            <Card 
              key={option.title}
              className={`bg-white hover:bg-gray-50 transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                option.primary ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-sm'
              }`}
              onClick={() => {
                setIsJoinCreateModalOpen(false);
                option.onClick();
              }}
              data-testid={`menu-${option.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    option.primary ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {option.icon}
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-gray-600">
                  {option.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </PureMorphingModal>

      {/* Settings & More Modal */}
      <PureMorphingModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        variant="settings"
        icon="⚙️"
        title="Settings & More"
      >
        <div className="text-black/90 mb-3">
          Game settings, help, and additional options
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3">
            {settingsOptions.map((option) => (
              <Card 
                key={option.title}
                className={`transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                  (option as any).destructive ? 'bg-red-50 hover:bg-red-100 ring-2 ring-red-500' : 
                  (option as any).comingSoon ? 'bg-purple-50 hover:bg-purple-100 ring-2 ring-purple-400' : 
                  'bg-white hover:bg-gray-50 shadow-sm'
                }`}
                onClick={option.onClick}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      (option as any).destructive ? 'bg-red-500 text-white' : 
                      (option as any).comingSoon ? 'bg-purple-500 text-white' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {option.icon}
                    </div>
                    <CardTitle className={`text-base ${
                      (option as any).destructive ? 'text-red-700' : 
                      (option as any).comingSoon ? 'text-purple-700' : ''
                    }`}>{option.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className={`text-sm ${
                    (option as any).destructive ? 'text-red-600' : 
                    (option as any).comingSoon ? 'text-purple-600' :
                    'text-gray-600'
                  }`}>
                    {option.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PureMorphingModal>

      {/* How to Play Modal */}
      <PureMorphingModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
        variant="settings"
        icon="❓"
        title="How to Play"
      >
        <HowToPlayModalContent />
      </PureMorphingModal>

      {/* Audio Settings Modal */}
      <PureMorphingModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
        variant="settings"
        icon="🎵"
        title="Audio Settings"
      >
        <div className="text-black/90 mb-5">
          Control your audio experience
        </div>
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={toggleMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.isMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {audioState.isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleMusicMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.musicMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Music className="mr-2 h-4 w-4" />}
            {audioState.musicMuted ? 'Unmute Music' : 'Mute Music'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleSfxMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.sfxMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Settings className="mr-2 h-4 w-4" />}
            {audioState.sfxMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          </Button>
        </div>
      </PureMorphingModal>
    </div>
  );
}