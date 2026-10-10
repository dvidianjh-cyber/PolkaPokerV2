# WebRTC_Texas_Holdem_SPECIFICATION.md

# Coding Agent Instructions

## 1. Professional Persona
* **Role:** Senior Frontend Architect. You favor robust, modular, and DRY (Don't Repeat Yourself) code.[cite: 1]
* **Focus:** Privacy-first, performant, local-web architecture.[cite: 1]

## 2. Versioning & Change Management
* **Changelog:** After every feature completion, update `CHANGELOG.md` with version (v0.x.x), date, and changes.[cite: 1]
* **Headers:** Every modified file must have a "Last Modified" comment at the top.[cite: 1]

## 3. Implementation Workflow (Plan-First)
* **The 'Think' Phase:** Before writing code, provide a "Plan of Action" for user approval.[cite: 1]
* **Verification:** Explain how you verified the code against the Technical Guardrails in Doc 1.[cite: 1]

## 4. Quality Guardrails
* **No Shortcuts:** Never use hard-coded pixel offsets for centering. Use Flex/Grid.[cite: 1]
* **Modularity:** Separate DOM manipulation from business logic.[cite: 1]
* **Cleanup:** Ensure all event listeners are named functions for proper cleanup.[cite: 1]

## 5. Definition of Done (DoD)
*Before declaring a task finished, verify:*[cite: 1]
1. [ ] No placeholder comments (e.g., `// logic here`) remain.[cite: 1]
2. [ ] All new functions are documented with JSDoc.[cite: 1]
3. [ ] `CHANGELOG.md` is updated.[cite: 1]
4. [ ] The UI remains responsive and functional down to 320px width.[cite: 1]

# Environment & Tech Stack

## 1. The Tech Stack
* **HTML/CSS/JS:** HTML5, CSS3 (Modern features only, variables for theming), ES6+ Modules.
* **Build Tools:** Vite (Recommended for easy module bundling and local dev server) targeting direct browser execution on GitHub Pages.

## 2. Persistence Layer
* **Primary Storage:** Browser LocalStorage.
* **Data Format:** Strict JSON for storing `{ playerName: string, avatarUrl: string }`.
* **Backup:** None specified for V1.

## 3. Data Communication Contract
* **Protocol:** WebRTC Data Channels facilitated via PeerJS. All peer components communicate via a strict JSON message schema (Event Bus pattern) broadcasting to and from the Host (Table Creator).

## 4. Library White-list
* **PeerJS:** For WebRTC signaling and peer-to-peer data channel management.
* **Standard Playing Card SVGs:** Open-source, high-legibility SVG deck (e.g., vector playing cards).

# WebRTC Texas Hold'em - Project Instance

## 1. Project Summary
* **Name:** WebRTC Texas Hold'em
* **Description:** A serverless, fully client-side Texas Hold'em poker game hosted on GitHub Pages. Players connect directly to each other via WebRTC using a simple join code mechanism, with one player acting as the authoritative host.
* **Key Features:** 
    * **Serverless Multiplayer:** WebRTC/PeerJS integration eliminates the need for backend hosting.
    * **Accessible UI:** Nostalgic, clean 2D interface featuring high-contrast, oversized cards optimized for TV screens and users with poor eyesight.
    * **Session Memory:** Remembers player name and chosen avatar via LocalStorage for frictionless return visits.

## 2. Feature Modules
* **Module A (Networking & Signaling Engine):** Handles PeerJS connection, join code generation, connection error handling, and routing messages between Peers and the Host.
* **Module B (Game Logic Engine - Host Only):** The authoritative state machine. Handles deck shuffling (cryptographically secure randomizer if possible), hand evaluation/ranking, blind progression, pot calculation, and bet validations.
* **Module C (UI/DOM Controller):** Subscribes to state updates from the Host. Renders the table, handles local player inputs (bet, fold, check), manages the 60-second countdown timer UI, and animates chips.

## 3. User Stories
* **Story 1:** As a host, I want to create a table and set a buy-in chip value, so that I can establish the stakes for my friends.
* **Story 2:** As a player, I want to enter a short join code on the landing page, so that I can easily connect to my friend's table without navigating complex lobbies.
* **Story 3:** As a returning player, I want the system to auto-fill my previous name and avatar, so that I can join games faster.
* **Story 4:** As a player watching a TV screen from a distance, I want the community cards and my hole cards to be exceptionally large and legible, so I don't misread my hand.

## 4. UI/UX Design
* **Theme & Styling:** Classic Facebook Poker vibe. Clean green felt background, 2D flat-design chips, and crisp, oversized SVG playing cards. No complex 3D graphics.
* **Page Layout:** Central grid for the Pot and Community Cards. Players arranged radially (using CSS positioning or Grid) around the central table.
* **Component Specifics:** 
    * A prominent 60-second visual countdown timer (e.g., a shrinking ring or progress bar) around the active player's avatar.
    * Chip stacks display a numerical value overlay for instant readability.

## 5. Technical Specifics & Guardrails
* **Layout & Positioning:** CSS Grid/Flexbox only. No absolute 'magic numbers'.[cite: 1] 
* **Data Integrity:** Strict validation of WebRTC messages by the Host to prevent forged bets.
* **A11y (Accessibility):** High contrast colors for card suits (e.g., four-color deck option or highly distinct red/black).
* **State Management:** Single source of truth. UI must re-sync to State object broadcasted by the Host.[cite: 1] The host calculates the entire state and pushes it to peers.

## 6. Boundary Conditions & Edge Cases
* **Empty States:** Landing page shows only "Create Table" or "Join Table with Code". Empty seats at a table show a distinct "Sit Here" button.
* **Input Limits:** Player names capped at 12 characters. Buy-in amounts must be positive integers.
* **Security:** Sanitize inputs to prevent XSS even in local contexts (especially player names via DataChannels).[cite: 1]
* **Host Disconnect:** If the Table Creator (Host) drops connection, the game terminates immediately. (Migration is out of scope for V1).
* **Player Timeout:** If a player fails to act within the 60-second timer, the Host automatically enforces a "Check" (if no outstanding bet) or "Fold" (if facing a bet). The player is *not* removed or set to "sit out"; they will simply time out again in the next round if still unresponsive.

## 7. Project-Specific Logic or Data Structures
* **Logic A (Poker Hand Evaluator):** A robust algorithm on the Host side to determine winning hands (High Card to Royal Flush) and handle split pots for tied hands or uneven side pots (due to all-ins).
* **Dataset A (Network Message Schema):** 
  `{ type: 'STATE_UPDATE', payload: { ...gameState } }` (Host -> Peer)
  `{ type: 'PLAYER_ACTION', payload: { action: 'RAISE', amount: 50 } }` (Peer -> Host)