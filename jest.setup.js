import '@testing-library/jest-dom'

// Load environment variables for integration tests
require('dotenv').config({ path: '.env.local' })

// Add Node.js polyfills for Next.js server actions
global.TextEncoder = require('util').TextEncoder
global.TextDecoder = require('util').TextDecoder

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  Play: () => <div data-testid="play-icon">Play</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  User: () => <div data-testid="user-icon">User</div>,
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Volume2: () => <div data-testid="volume2-icon">Volume2</div>,
  VolumeX: () => <div data-testid="volumex-icon">VolumeX</div>,
  Music: () => <div data-testid="music-icon">Music</div>,
  RefreshCw: () => <div data-testid="refresh-icon">RefreshCw</div>,
  HelpCircle: () => <div data-testid="help-icon">HelpCircle</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  Hash: () => <div data-testid="hash-icon">Hash</div>,
  Globe: () => <div data-testid="globe-icon">Globe</div>,
  Zap: () => <div data-testid="zap-icon">Zap</div>,
}))

// Mock the audio context
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
}))

// Global test cleanup for integration tests
global.afterEach(async () => {
  // Only cleanup if this is an integration test
  if (expect.getState().currentTestName?.includes('Integration')) {
    const { cleanupTestData } = require('./tests/helpers/testDatabase')
    await cleanupTestData()
  }
})

// Final cleanup after all tests
global.afterAll(async () => {
  const { cleanupTestData } = require('./tests/helpers/testDatabase')
  await cleanupTestData()
})