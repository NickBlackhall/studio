# **App Name**: Make It Terrible

## Core Features:

- Player Identification: Welcome screen: Players enter their name and choose an avatar.
- Submission Display: Game area: displays the scenario and submissions.
- Anonymous Judging: The judge can pick the best response. It's very important for players to not know each other's answers
- Round Winner Display: The winner earns a point and the UI updates with the winner and points totals
- Judge Logic: Manages the state of who the judge is each round
- Interface Toggle: Different views based on Judge vs Player.
- Judge Assignment: Each round, one player is marked as `is_judge = true`. Judge rotation is sequential based on player order.
- Category Selection & Scenario Draw: The judge selects a category from a dropdown. A random scenario from that category is drawn and displayed to all players.
- Player Submission Phase: Each non-judge player sees the current scenario and a hand of response cards. Players choose 1 card and submit. Submissions are written to the `responses` table.
- Judge Review & Winner Selection: Once all players have submitted, the Judge sees all submissions anonymously. Judge selects the best response, granting the player 1 point.
- Winner Announcement: The winning response is revealed to all players, along with the winner's name and avatar.
- Round Reset & Judge Rotation: After a short delay, the game resets, and the judge role rotates to the next player.
- Win Condition: The game ends when a player reaches a set number of points.

## Style Guidelines:

- Primary color: Black (#000000) for a bold and edgy feel.
- Secondary color: Red (#FF0000) to highlight important elements and add a sense of urgency/danger.
- Accent color: Yellow (#FFFF00) as a contrast to draw attention to interactive elements.
- Background color: White (#FFFFFF) to provide a clean backdrop and ensure readability.
- Clear, readable fonts optimized for both mobile and desktop.
- Intuitive icons for game actions, such as submitting cards or indicating the judge role.
- Responsive layout adapting to different screen sizes, with a focus on mobile usability.
- Smooth transitions and subtle animations to indicate actions and round updates.