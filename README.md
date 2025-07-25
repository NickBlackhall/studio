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

### Known Issues (In Progress)
- **Shuffle Animation Artifacts:** Cards still exhibit a brief "re-deal" animation during shuffle sequence where the stack moves down, cards briefly show their backs, then spring back up. Root cause is conflict between index-based visibility system and card reordering. Attempted fix using card ID-based visibility tracking broke the initial dealing animation and was reverted.
- **Touch Area Coverage:** Touch events for card swiping only work when dragging from the center of cards. Dragging from edges/corners still allows page scrolling to occur, indicating incomplete touch area coverage or event propagation issues.
- **Swipe-up Submit Feature:** Planned functionality to allow swiping a selected card upward toward the scenario area to submit it (more intuitive than tap-to-reveal-submit-button workflow). Basic detection logic exists but submission behavior not implemented.

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

### Long-Term Vision
These are larger-scale ideas for the future evolution of the game.
- **Multiple Game Modes:** Differentiate between "Remote" and "In-Person" play, potentially with different UI/UX considerations.
- **Custom Rule Sets:** Introduce rule variations like a "Drinking Game Mode" or a "Family Friendly Mode" that filters adult content.
- **Multi-Room Support:** Build the infrastructure to allow for multiple, separate game instances to run concurrently.
- **Community Content:** Create forms for users to submit their own scenario and response card ideas, which can then be curated and added to the official game deck.

this line has been changed for the test

Test line added by Claude Code to verify edit capabilities.
