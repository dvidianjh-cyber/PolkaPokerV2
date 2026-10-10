# Changelog

<!-- Last Modified: 2026-10-10 (v2.0.0.0) -->

Versioning is four-part: `v2.0.0.0`, then `v2.0.0.1`, ... for patches and features.

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
