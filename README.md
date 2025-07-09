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

This section tracks recent improvements and bug fixes to help collaborators understand the project's trajectory.

- **Fixed Spectator Black Screen:** Resolved a critical bug where new users would see a black screen if they tried to join a game that was already in a non-lobby state (e.g., 'game_over'). The UI now correctly shows a "Game in Progress" spectator view.
- **Corrected TypeScript Error:** Fixed a type error where the `isCustom` property was not correctly defined on the `PlayerHandCard` interface, improving code quality and type safety.
- **UI Polish - Player Submission:** When a player submits their card, the UI now correctly hides the card stack and displays a clean "Submission Sent" graphic, preventing player confusion.
- **UI Polish - Player Setup:** Adjusted the vertical alignment of the "name" input field on the player setup screen for better visual balance.
- **UI Polish - Font Consistency:** Updated the font on the Judge's waiting screen to match the game's overall `IM Fell` aesthetic.

## Known Issues & Next Steps

This is a living project with opportunities for future improvement.

- **Further UI/UX Polish:** While functional, many screens could benefit from further refinement, sound effects, and more dynamic animations to enhance the "party game" feel.
- **Content Expansion:** The game is driven by its content. Adding more scenarios and response cards is a continuous task to keep the game fresh and replayable.
- **Error Handling:** Robustness can be improved with more comprehensive error handling and user feedback for edge cases (e.g., a player disconnecting mid-game).
