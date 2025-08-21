require('whatwg-fetch');
import '@testing-library/jest-dom';

// Mock lucide-react icons for unit tests
jest.mock('lucide-react', () => ({
  Menu: () => 'Menu',
  Home: () => 'Home',
  Play: () => 'Play',
  Settings: () => 'Settings',
  Users: () => 'Users',
  User: () => 'User',
  Edit: () => 'Edit',
  Volume2: () => 'Volume2',
  VolumeX: () => 'VolumeX',
  Music: () => 'Music',
  RefreshCw: () => 'RefreshCw',
  HelpCircle: () => 'HelpCircle',
  Plus: () => 'Plus',
  Hash: () => 'Hash',
  Globe: () => 'Globe',
  Zap: () => 'Zap',
}));

// Mock the audio context for unit tests
jest.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    playSfx: jest.fn(),
    playTrack: jest.fn(),
    stop: jest.fn(),
    state: {
      isMuted: false,
      musicMuted: false,
      sfxMuted: false,
      currentTrack: null,
      isPlaying: false,
    },
    toggleMute: jest.fn(),
    toggleMusicMute: jest.fn(),
    toggleSfxMute: jest.fn(),
  }),
}));