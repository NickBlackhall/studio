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

The project is currently a **fully functional and polished prototype**. The entire real-time game loop is implemented and operational.

- **Backend & State Management:** The game uses **Supabase** for its backend, with database tables for games, players, cards, and submissions. Real-time updates are handled via Supabase subscriptions, providing a seamless multiplayer experience.
- **Frontend:** The application is built with **Next.js** and **React**.
- **UI & Styling:** The UI is built with **ShadCN UI components**, styled with **Tailwind CSS**, and includes animations from **Framer Motion**. The game features a mobile-first, PWA-style layout with custom poster graphics for all major screens (Welcome, Player Setup, Lobby, Game Over, etc.) to create an immersive, app-like experience.

## Solved Issues & Recent Updates

This section tracks recent improvements and bug fixes that have impacted gameplay, UI, and UX.

- **Enhanced Audio Experience:** Implemented a comprehensive audio system using a React Context.
  - Background music now plays and transitions appropriately between the lobby and in-game states.
  - Sound effects (SFX) have been added for key UI interactions, such as button clicks in the main game menu, providing satisfying auditory feedback.
  - The system includes volume controls and mute functionality, with user preferences saved to `localStorage`.
- **Fixed Font Flickering in Lobby:** Resolved a persistent "Flash of Unstyled Content" (FOUC) where player names in the lobby would flicker between the default system font and the game's stylized `IM Fell` font during state updates. The fix involved ensuring the correct base styles are applied immediately on render.
- **Fixed Critical Navigation and Loading Bugs:** Addressed a series of complex, interconnected bugs related to the lobby-to-game transition. This involved refactoring the navigation logic into its own dedicated `useEffect` hook, making it more reliable and preventing race conditions that caused players to get stuck in the lobby.
- **Implemented Transition State Machine:** Addressed a core architectural issue where game state transitions were fragile. The fix involved implementing a state machine directly in the database, resulting in a smoother, more reliable, and professional user experience with a dedicated loading overlay.
- **Improved UI Responsiveness for Ready Toggle:** Fixed a noticeable delay when players toggled their ready status in the lobby by implementing an "optimistic update" approach.
- **Fixed Real-Time Instability & Flickering:** Resolved a major bug where multiple, rapid database updates would trigger excessive re-renders. Implemented a debouncing mechanism to intelligently bundle these updates into a single, smooth refresh, dramatically improving UI stability.
- **Fixed Spectator Black Screen:** Resolved a critical bug where new users would see a black screen if they tried to join a game that was already in progress.

## Roadmap & Next Steps

This is a living document outlining the future direction of the project.

### Immediate Priorities
Our current focus is on adding new gameplay variations and refining the experience based on playtesting.
- **"Boondoggles":** Introduce random, surprise mini-game rounds to break up the main gameplay loop. This will involve physical challenges, word games, and other impromptu activities where the Judge awards a point to the best performer.
- **Stability & Testing:** Continue to ensure all existing features work flawlessly across different scenarios and user interactions.

### Upcoming Features
These are the next major gameplay mechanics and features on the horizon.
- **AI-Powered Content:** Integrate Genkit to dynamically generate Boondoggle challenges or even create unique scenario and response cards on the fly, adding endless variety to the game.
- **PWA Readiness:** Finalize the necessary architecture and features to make the game a fully installable Progressive Web App.

### Long-Term Vision
These are larger-scale ideas for the future evolution of the game.
- **Multiple Game Modes:** Differentiate between "Remote" and "In-Person" play, potentially with different UI/UX considerations.
- **Custom Rule Sets:** Introduce rule variations like a "Drinking Game Mode" or a "Family Friendly Mode" that filters adult content.
- **Multi-Room Support:** Build the infrastructure to allow for multiple, separate game instances to run concurrently.
- **Community Content:** Create forms for users to submit their own a nd response card ideas, which can then be curated and added to the official game deck.