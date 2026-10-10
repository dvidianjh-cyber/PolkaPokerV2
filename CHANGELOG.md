# Changelog

<!-- Last Modified: 2026-10-10 (v2.0.0.0) -->

Versioning is four-part: `v2.0.0.0`, then `v2.0.0.1`, ... for patches and features.

## v2.0.0.2 - 2026-10-10

### Changed
- **Spectator Mode:** Removed Name and Avatar requirements from the landing page. Users join or create tables as spectators first.
- **Modal Onboarding:** Clicking an empty "Sit Here" seat opens a centered modal to capture Name and Avatar, avoiding up-front friction. Race conditions are handled gracefully by the Host catching duplicate seat requests.
- **Dynamic Chip Stacks:** Replaced flat pill chip graphics with visual stacked chips capped at a max stack height. The chip stacks fit securely within the responsive CSS grid layout.

## v2.0.0.1 - 2026-10-10

### Changed
- **In-table player UI:** the local player's hole cards and action buttons (Fold, Call/Check, Raise) now render inside the table grid, in the local seat next to the avatar, instead of in a panel below the table.
- **No vertical scrolling:** `html`/`body` are locked to the viewport and the table screen is a `100dvh` flex column; the grid rows (`auto / 1fr / auto`) and the card, avatar and chip sizes are bounded by both viewport width and height so the table fits without a scrollbar. Only the landing form may scroll inside `#app` on very short screens.
- Raise sizing (slider, number box, Min / half-pot / Pot / All-in) opens in place of the action buttons via **Raise** and closes with **Back**, keeping the local seat compact.
- Mobile (up to 720px) uses a 4-column grid with the local seat spanning the full bottom row; header compacted. The 4-colour toggle label is shortened.
- The toast is `position: fixed` so it never takes layout space.
- Layout uses CSS Grid/Flexbox only; the UI changes are confined to `src/ui` and `src/styles` and do not touch networking or engine code.

## v2.0.0.0 - 2026-10-10

Initial release of Polka Poker v2.

### Added
- Vite + ES6 modules project, relative base for GitHub Pages.
- **Game engine (Host only):** cryptographically secure shuffle, 7-card hand evaluator (High Card to Royal Flush), main/side pots with split pots, configurable blinds that double every N hands, max 8 seats.
- **Dealer flow:** dealer, small and big blind rotate clockwise every hand. Each hand ends on a Showdown screen and the game pauses with no timers. Only the next dealer sees **Deal next hand**. 60-second turn timers run from the deal to the end of the hand (auto check, or fold when facing a bet; the player stays seated).
- **Networking:** PeerJS host/client sessions with a 5-character join code; strict host-side message validation and name sanitisation; host drop ends the game.
- **UI:** landing page (Create Table / Join with Code), 8-seat radial table in CSS Grid, oversized SVG cards with an optional four-colour deck, chip stacks with numeric overlays, shrinking timer ring, raise slider and quick sizes, responsive down to 320px.
- **Persistence:** name and emoji avatar remembered in LocalStorage as `{ playerName, avatarUrl }` (`avatarUrl` holds an `emoji:<id>` token in V1).
- Vitest suite for the evaluator, pots, blinds, dealer rotation and game flow.

### Library decisions
- `peerjs` (WebRTC data channels): on the white-list.
- `vite`, `vitest`: dev-only tooling.
- Hand evaluator and card SVGs are implemented in-house (small, fully tested, no dependency): no stable npm card-SVG package was found, and generating the cards in code avoids shipping an external asset set.
