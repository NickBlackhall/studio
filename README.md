# Make It Terrible - A Party Game

This project is a web-based, real-time multiplayer party game called "Make It Terrible," developed in collaboration with an AI assistant in Firebase Studio. The game is inspired by party games like Cards Against Humanity, where the goal is to provide the funniest, most outrageous, or most "terrible" response to a given scenario.

## Game Concept & Flow

The core of the game is simple and designed for hilarity:

1.  **Lobby & Setup:** Players join a game lobby by choosing a name and an avatar.
2.  **The Judge:** In each round, one player is designated as the Judge.
3.  **The Scenario:** The Judge selects a category, and a random scenario card is revealed to all players (e.g., "You have to explain a viral TikTok trend to your grandparents. How do you make it as confusing as possible?").
4.  **Player Submissions:** All other players submit a response card from their hand. They can either use a pre-dealt card or write their own custom response for that round.
5.  **Judging:** The Judge reviews all the anonymous submissions and chooses the one they find the best (or most terrible).
6.  **Scoring:** The player who submitted the winning card gets a point.
7.  **Winning:** The first player to reach the point goal wins the game.

A key feature is that if a custom-written card wins a round, the Judge has the option to add that card to the main deck for future games.

## Development Status

The project is currently a **fully functional prototype**. The entire real-time game loop is implemented and operational.

- **Backend & State Management:** The game uses **Supabase** for its backend, with database tables for games, players, cards, and submissions. Real-time updates are handled via Supabase subscriptions.
- **Frontend:** The application is built with **Next.js** and **React**.
- **UI & Styling:** The UI is built with **ShadCN UI components**, styled with **Tailwind CSS**, and includes animations from **Framer Motion**.

## Solved Issues & Recent Updates

This section tracks recent improvements and bug fixes that have impacted gameplay, UI, and UX.

- **Implemented "Boondoggles" (Surprise Mini-Games):** Successfully integrated a major new gameplay feature. When a Judge selects a category, there is now a random chance for a "Boondoggle" round to occur. Instead of submitting cards, players perform a unique challenge (e.g., a physical task or word game), and the Judge awards a point directly to the best performer. This feature leverages the existing scenario architecture for a clean and efficient integration.
- **Fixed Card Drawing Randomness:** Solved a critical gameplay flaw where players were repeatedly dealt cards from the same small pool of ~60 cards. The logic was updated to fetch a much larger, more random batch of cards from the database and shuffle them server-side, ensuring true variety and significantly improving replayability.
- **Implemented Transition State Machine:** Addressed a core architectural issue where game state transitions (e.g., from lobby to game) were fragile, leading to UI flickering, awkward pauses, and potential race conditions. The fix involved implementing a state machine directly in the database with `transition_state` and `transition_message` columns. Now, the server explicitly communicates when it's busy, and the client displays a dedicated loading overlay, resulting in a smoother, more reliable, and professional user experience.
- **Improved UI Responsiveness for Ready Toggle:** Fixed a noticeable delay when players toggled their ready status in the lobby. Implemented an "optimistic update" approach, where the UI updates instantly upon the user's click, while the actual state change is processed in the background. This provides immediate visual feedback and a much smoother user experience.
- **Fixed Font Flickering in Lobby:** Resolved a persistent "Flash of Unstyled Content" (FOUC) where player names in the lobby would flicker between the default system font and the game's stylized `IM Fell` font during state updates (e.g., when a player toggled their ready status). The fix involved changing the player name element from a generic `<span>` to a semantic `<h2>` tag, ensuring the correct base styles are applied immediately on render.
- **Fixed Real-Time Instability & Flickering:** Resolved a major bug where multiple, rapid database updates from Supabase would trigger excessive re-renders, causing visual flickering and instability. Implemented a debouncing mechanism to intelligently bundle these updates into a single, smooth refresh, dramatically improving UI stability and performance during gameplay. Also fixed a broken image path for the loading screen logo.
- **Fixed Spectator Black Screen:** Resolved a critical bug where new users would see a black screen if they tried to join a game that was already in a non-lobby state (e.g., 'game_over'). The UI now correctly shows a "Game in Progress" spectator view.
- **Corrected TypeScript Error:** Fixed a type error where the `isCustom` property was not correctly defined on the `PlayerHandCard` interface, improving code quality and type safety.
- **UI Polish - Player Submission:** When a player submits their card, the UI now correctly hides the card stack and displays a clean "Submission Sent" graphic, preventing player confusion.
- **UI Polish - Player Setup:** Adjusted the vertical alignment of the "name" input field on the player setup screen for better visual balance.
- **UI Polish - Font Consistency:** Updated the font on the Judge's waiting screen to match the game's overall `IM Fell` aesthetic.
- **Typography Standardization:** Eliminated inconsistent font declarations throughout the codebase. All components now use the standardized `font-im-fell` Tailwind class instead of mixing direct CSS font-family declarations, providing a single source of truth and easier maintenance.
- **Card Swipe Gestures Implementation:** Added comprehensive swipe gesture functionality to player hand cards for mobile-first interaction:
  - **Swipe Detection:** Implemented touch event handlers with distance and velocity thresholds (40px minimum distance OR 0.3px/ms velocity)
  - **Card Shuffling:** Left/right swipes move the top card to bottom of hand stack, allowing players to browse through their cards naturally
  - **Visual Drag Feedback:** Cards follow finger movement during swipe gestures for immediate tactile response
  - **Interaction Restrictions:** Only the top card in the hand is interactive (swipeable/tappable), preventing state sync issues
  - **Scroll Management:** Added global horizontal scroll prevention (`touch-action: pan-y`) while preserving vertical scrolling for different screen sizes
  - **Touch Event Prevention:** All card interactions prevent page scrolling during active dragging to avoid interference
  - **Animation Sequencing:** Implemented smooth 3-step animation: (1) card slides off screen in swipe direction (300ms), (2) remaining cards slide up to fill gap (500ms), (3) swiped card appears at bottom of stack
  - **Direction Correction:** Fixed Y-axis inversion so dragging down moves card down on screen (not up)
  - **Spring Effect Removal:** Eliminated bouncy spring animations during shuffle sequence for cleaner, linear card movement
- **Shuffle Animation Fixes:** Completely resolved the "re-deal" animation artifacts that caused cards to briefly flip back to logo side during shuffle. Fixed by changing React component keys from index-based to ID-based, preserving card identity and flip states during reordering.
- **Mobile Touch Optimization:** Implemented comprehensive touch event handling to prevent page scrolling during card interactions on mobile devices. Added dynamic CSS touch-action properties and proper event propagation control.
- **Animation Performance:** Reduced shuffle animation timing from 400ms to 250ms and simplified transform logic from complex string concatenation to clean object-based properties, eliminating transform conflicts and improving responsiveness.
- **Card Selection Restoration:** Fixed broken card selection and custom card editing functionality that was disrupted during animation improvements. Cards now properly respond to taps and custom card text input works reliably.
- **Selection State Management:** Resolved edge case where selected cards would remain "stuck" in elevated position after being swiped away. Now automatically clears selection when a selected card is shuffled, while preserving any typed custom card content.
- **Critical Card Fetching Fix (July 2025):** Resolved a game-breaking bug where the card dealing logic would request far more cards than existed in the database (e.g., requesting 2,250 cards when only 1,013 available), causing database errors and crashes. Implemented smart multiplier logic that adapts to different deal types:
  - **Initial Deal**: Requests `count × 3` cards (45 × 3 = 135 cards for 9 players) for good randomness
  - **Replacement Cards**: Requests `count × 5` cards (9 × 5 = 45 cards) for variety in single-card deals
  - **Safety Limits**: Never requests more cards than are available in the database
  - **Card Depletion Warning**: Logs warnings when fewer than 100 cards remain for the game
  - **Graceful Degradation**: Handles edge cases where insufficient cards are available without crashing
- **Game Stability Audit & Recovery (July 2025):** After experiencing critical errors during lobby optimization attempts (React hooks violations, webpack module loading errors, complete app failure with 500 server errors), performed emergency recovery:
  - **Emergency Revert**: Used `git restore` to revert all optimization changes back to stable state
  - **Cache Cleanup**: Cleared `.next` and `node_modules/.cache` to resolve webpack chunk corruption
  - **Stability Prioritization**: Made strategic decision to maintain working app for family beta test over pursuing flickering optimizations
  - **Comprehensive Documentation**: Created detailed LOBBY_DEVELOPMENT_GUIDE.md documenting the flickering root cause, optimization attempts, failures, and recovery process for future development
- **Judge's Hand Swipe Mechanics (August 2025):** Solved critical UX issue discovered during 11-player family test where judge's hand became cramped and difficult to use with 10 response cards:
  - **Problem Identified**: Cards stacked at 75px intervals created 750px height, overwhelming mobile screens and making card selection difficult
  - **Solution Implemented**: Ported excellent swipe mechanics from PlayerView to JudgeView, allowing judge to browse cards by swiping left/right
  - **Improved Card Layout**: Reduced stacking to 25px intervals, showing only 2-3 cards at once instead of overwhelming stack
  - **Touch Optimization**: Added comprehensive touch event handling with drag feedback and momentum physics
  - **Preserved Functionality**: Maintained all existing judge features (card selection, crown winner button, flip animations)
  - **Scalable UX**: Now works seamlessly with 11+ players using familiar swipe gestures from player experience

### Known Issues (Resolved)
- ~~**Shuffle Animation Artifacts:** Cards no longer exhibit "re-deal" animation during shuffle sequence. Fixed by preserving component identity through stable React keys.~~
- ~~**Touch Area Coverage:** Touch events now work reliably across entire card surface with proper scroll prevention on mobile devices.~~
- ~~**Swipe-up Submit Feature:** Planned functionality to allow swiping a selected card upward toward the scenario area to submit it (more intuitive than tap-to-reveal-submit-button workflow). Basic detection logic exists but submission behavior not implemented.~~ **IMPLEMENTED**: Swipe-up submission now works with momentum physics and smooth animations.

## Production Deployment Guide

### Ready for Production Deployment
After comprehensive 11-player testing (July 2025), the game is stable and ready for production deployment to Netlify. This section contains detailed deployment instructions for when ready to move from localhost development to live production environment.

#### Current Development Setup Analysis
- ✅ **Next.js 15.2.3** with proper build scripts configured
- ✅ **Supabase backend** fully functional with 1,014+ response cards
- ✅ **Real-time multiplayer** tested and stable for 11+ players
- ⚠️ **Hardcoded database credentials** in `src/lib/supabaseClient.ts` (needs environment variables)
- ⚠️ **Build configuration** ignores TypeScript/ESLint errors (risky for production)

#### Step-by-Step Netlify Deployment Process

**1. Environment Variables Setup**
```bash
# Create .env.local file in project root
NEXT_PUBLIC_SUPABASE_URL=https://fpntcspwvpmrbbiekqsv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnRjc3B3dnBtcmJiaWVrcXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTk1MTMsImV4cCI6MjA2MzY5NTUxM30.OFddzp3_nHvGdQiRvm6z5MttpqS3YABgCqyHNqLpI5s

# Add to .gitignore
echo ".env.local" >> .gitignore
```

**2. Update Database Client Configuration**
Edit `src/lib/supabaseClient.ts`:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```

**3. Production Build Optimization**
Edit `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // Remove these for production:
  // typescript: { ignoreBuildErrors: true },
  // eslint: { ignoreDuringBuilds: true },
  
  // Add production optimizations:
  compress: true,
  poweredByHeader: false,
  
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [/* existing patterns */]
  }
};
```

**4. Netlify Deployment Commands**
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify account
netlify login

# Initial deployment (from project root directory)
netlify deploy --build

# Production deployment after testing
netlify deploy --prod --build
```

**5. Netlify Environment Variables Configuration**
In Netlify dashboard, add environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**6. Build Settings for Netlify**
Create `netlify.toml` in project root:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Performance Considerations for Family Gaming
- **Large asset folder**: 100+ avatar images and backgrounds (~50MB total)
- **Audio files**: Background music and sound effects for mobile browsers  
- **Real-time performance**: 11 concurrent players with poor Wi-Fi connections
- **Mobile optimization**: Touch gestures, responsive design, PWA capabilities

#### Post-Deployment Testing Checklist
- [ ] Test with multiple devices on different networks
- [ ] Verify real-time subscriptions work over internet (not just localhost)
- [ ] Check mobile browser compatibility (especially iOS Safari audio)
- [ ] Test poor connection scenarios
- [ ] Validate 11-player lobby and game performance
- [ ] Confirm Supabase rate limits handle concurrent users

#### Performance Optimizations Completed (July 2025)

**✅ Comprehensive Audio System Implementation (Major UX Enhancement)**
*Completed: July 30, 2025 - Complete game audio experience*

**Impact:** Added immersive sound effects and music controls throughout entire gameplay experience
**Action taken:** Implemented 8 distinct sound effects, compressed audio files (65% size reduction), and granular audio controls

**Audio Features Added:**
- **Music System**: Background music for lobby and game phases (3.6MB vs 10.3MB original)
- **Sound Effects**: 8 comprehensive sound effects covering all major game interactions
- **Audio Controls**: Separate mute controls for all audio, music only, and sound effects only
- **Browser Compatibility**: Proper autoplay policy handling with user interaction detection

**Sound Effects Implemented:**
1. **`'button-click'`** - General UI buttons and avatar selection (`Button Firm 2_01.wav`)
2. **`'card-flip'`** - Card dealing sequence with 6-card audio (`6-card-deal.wav`)
3. **`'boondoggle'`** - Devil laughter for surprise mini-games (`devil-laughter.wav`)
4. **`'category-select'`** - Judge category navigation buttons (`scenario-select-button.wav`)
5. **`'unleash-scenario'`** - Dramatic gong for scenario release (`Gong_01.mp3`)
6. **`'card-submit'`** - Woosh sound for card submission swipes (`quick-woosh_01.wav`)
7. **`'crown-winner'`** - Victory announcement for judge selections (`we-have-a-winner.mp3`)
8. **`'round-winner'`** - Fanfare for winner announcement sequence (`round-winner-announcement.mp3`)

**Files Modified:**
- `src/contexts/AudioContext.tsx` - Enhanced with separate mute controls and 8 sound effects
- `src/components/layout/MusicPlayer.tsx` - Updated with separate music mute functionality
- `src/app/game/page.tsx` - Added granular audio controls to game menu modal
- `src/components/PureMorphingModal.tsx` - Updated modals with white background and black text
- `src/components/game/PlayerView.tsx` - Added card flip and submission sounds
- `src/components/game/JudgeView.tsx` - Added boondoggle and winner selection sounds
- `src/components/game/SwipeableCategorySelector.tsx` - Added category navigation sounds
- `src/components/game/RecapSequenceDisplay.tsx` - Added winner announcement sound
- `src/components/PWAGameLayout.tsx` - Added avatar selection button sounds

**Audio File Optimization:**
- Compressed music tracks from 10.3MB to 3.6MB (65% reduction)
- Organized sound effects in `/public/Sound/sound-effects/` directory
- Maintained high audio quality while optimizing for family test performance

**✅ Genkit AI Framework Removal (Major Performance Win)**
*Completed: July 29, 2025 - Pre-family test optimization*

**Impact:** Removed 339 packages, significantly reduced bundle size and build time
**Action taken:** Temporarily disabled AI features to optimize for 11-player family test

**Files modified:**
- `package.json` - Removed @genkit-ai/googleai, @genkit-ai/next, genkit-cli, genkit dependencies
- `package.json` - Removed genkit:dev and genkit:watch scripts
- `src/ai/` folder moved to `src/ai_disabled_for_family_test/`
- `src/app/page.tsx` - Added Suspense boundary to fix useSearchParams() build error

**Build results after optimization:**
```
Route (app)                     Size  First Load JS
┌ ○ /                        5.59 kB         175 kB
├ ○ /_not-found               978 B         102 kB
└ ○ /game                   58.3 kB         228 kB
+ First Load JS shared by all              101 kB
```

**How to restore Genkit when needed:**
```bash
# Restore AI capabilities after family test
mv src/ai_disabled_for_family_test src/ai

# Reinstall Genkit dependencies
npm install @genkit-ai/googleai @genkit-ai/next genkit-cli genkit

# Add back to package.json scripts:
"genkit:dev": "genkit start -- tsx src/ai/dev.ts",
"genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts"
```

**Remaining optimization opportunities:**
- **Audio compression**: Music files are 5.6MB + 4.7MB (10.3MB total) - compress to ~2MB
- **Image optimization**: Background posters 3-4MB each, avatar winners 3.6MB each
- **Bundle analysis**: Use webpack-bundle-analyzer to identify remaining large dependencies
- **Image preloading**: Preload critical assets during loading screens

#### Future Production Enhancements 
- **PWA Implementation**: Service workers for offline capabilities and better mobile performance
- **CDN Optimization**: Compress and optimize image assets  
- **Room System**: Multi-room architecture for scalability (see LOBBY_DEVELOPMENT_GUIDE.md)

---

## Roadmap & Next Steps

This is a living document outlining the future direction of the project.

### Immediate Priorities
Our current focus is on refining the core experience and preparing the app for a wider audience.
- **UI/UX Polish:** Finalize styling for key game states, including loading screens and the round/game winner announcement sequences to make them more engaging.
- **Stability & Testing:** Ensure all existing features work flawlessly across different scenarios and user interactions.
- **PWA Readiness:** Begin implementing the necessary architecture and features to make the game a fully installable Progressive Web App.

### Upcoming Features
These are the next major gameplay mechanics and features on the horizon.
- **Audio Experience:** Add background music to the welcome, setup, and lobby screens. Implement sound effects for key game actions to enhance the user experience.

### Immediate Priorities (Post-Family Testing)
These are critical features needed based on real-world gameplay testing.
- **Player Removal System:** Currently, the "Exit to Lobby" button doesn't properly remove players from active games, causing confusion and potential game-breaking scenarios when judges leave. This requires implementing proper database cleanup, judge reassignment logic, and real-time state updates for remaining players.

### Long-Term Vision
These are larger-scale ideas for the future evolution of the game.
- **Multiple Game Modes:** Differentiate between "Remote" and "In-Person" play, potentially with different UI/UX considerations.
- **Custom Rule Sets:** Introduce rule variations like a "Drinking Game Mode" or a "Family Friendly Mode" that filters adult content.
- **Multi-Room Support:** Build the infrastructure to allow for multiple, separate game instances to run concurrently.
- **Community Content:** Create forms for users to submit their own scenario and response card ideas, which can then be curated and added to the official game deck.

this line has been changed for the test

Test line added by Claude Code to verify edit capabilities.
