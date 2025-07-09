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

- **Fixed Spectator Black Screen:** Resolved a critical bug where new users would see a black screen if they tried to join a game that was already in a non-lobby state (e.g., 'game_over'). The UI now correctly shows a "Game in Progress" spectator view.
- **Corrected TypeScript Error:** Fixed a type error where the `isCustom` property was not correctly defined on the `PlayerHandCard` interface, improving code quality and type safety.
- **UI Polish - Player Submission:** When a player submits their card, the UI now correctly hides the card stack and displays a clean "Submission Sent" graphic, preventing player confusion.
- **UI Polish - Player Setup:** Adjusted the vertical alignment of the "name" input field on the player setup screen for better visual balance.
- **UI Polish - Font Consistency:** Updated the font on the Judge's waiting screen to match the game's overall `IM Fell` aesthetic.

## Roadmap & Next Steps

This is a living document outlining the future direction of the project.

### Immediate Priorities
Our current focus is on refining the core experience and preparing the app for a wider audience.
- **UI/UX Polish:** Finalize styling for key game states, including loading screens and the round/game winner announcement sequences to make them more engaging.
- **Stability & Testing:** Ensure all existing features work flawlessly across different scenarios and user interactions.
- **PWA Readiness:** Begin implementing the necessary architecture and features to make the game a fully installable Progressive Web App.

### Upcoming Features
These are the next major gameplay mechanics and features on the horizon.
- **"Boondoggles":** Introduce mini-games to break up the main gameplay loop and keep the group engaged in new ways.
- **Audio Experience:** Add background music to the welcome, setup, and lobby screens. Implement sound effects for key game actions to enhance the user experience.

### Long-Term Vision
These are larger-scale ideas for the future evolution of the game.
- **Multiple Game Modes:** Differentiate between "Remote" and "In-Person" play, potentially with different UI/UX considerations.
- **Custom Rule Sets:** Introduce rule variations like a "Drinking Game Mode" or a "Family Friendly Mode" that filters adult content.
- **Multi-Room Support:** Build the infrastructure to allow for multiple, separate game instances to run concurrently.
- **Community Content:** Create forms for users to submit their own scenario and response card ideas, which can then be curated and added to the official game deck.
