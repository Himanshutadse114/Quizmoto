# Socket Handler Responsibility Map

This map inventories the responsibilities currently conflated within the monolithic `server/services/socketHandlers.js` file, in accordance with **P1-T01**.

## Handlers & Responsibilities

### Connection Handling
* **`connection` (L22):** Sets up event listeners for newly connected socket, assigning basic socket logic.
* **`disconnect` (L669):** Handles cleanup. Checks if it was a host or player. Nullifies player `socketId` for persistence re-entry. Emits `host_disconnected` or `player_joined`.

### Authentication & Authorization
* **`verifyHost` (L26):** Local helper decoding JWTs to verify host identities against `JWT_SECRET`.
* **Host Auth Checks:** Duplicated inline across `join_room`, `start_question`, `end_question`, `set_game_mode`, and `end_game`.
* **Player Auth Checks:** In `join_room`, decodes a player session token to allow re-entry and parses `playerProfileToken` for XP capabilities.

### Lobby & Room Joining
* **`join_room` (L35):** 
    * Handles both host and player joins.
    * Fetches `GameSession`.
    * Creates `Player` records (and handles unique constraint race conditions).
    * Signs and returns new player JWTs.
    * Refreshes and broadcasts `player_joined`.

### Session Recovery
* **Player Recovery (L139):** Rebuilds current game state (`session_info`) if a player reconnects mid-game (calculating timer offsets, previous answers, etc).
* **Host Recovery (L194):** Rebuilds the current `room_info` if the host disconnects and reconnects mid-game.

### Question Lifecycle
* **`start_question` (L229):** Validates host, checks for duplicate starts (`[Guard]`), increments question index, sets timer +3s, resets player answer states, emits `question_started`.
* **`end_question` / `handleEndQuestion` (L298):** Transitions state to `result`, aggregates scores, calculates distributions and team standings, emits `question_ended`.

### Answer Handling & Scoring
* **`submit_answer` (L386):** Validates time limits against server timestamp, calculates `calculateReward`, performs atomic score update on `Player`, logs analytics via `PlayerAnswer`.
* **`calculateReward` (L369):** Core scoring logic with multiplier and streak thresholds. (Pure business logic, easily extractable).

### Leaderboard & Game Completion
* **`end_game` (L521):** Host only. Transitions to `finished`. Aggregates full class, student, and question analytics. Persists to JSON column in `GameSession`. Updates persistent `PlayerProfile` XP records.

### Secondary Features
* **Reactions (`send_reaction` L487):** Implements an in-memory JS Map for rate limiting (2 per second per socket), then broadcasts.
* **Game Mode (`set_game_mode` L501):** Host only. Updates session `gameMode` (classic vs team).

## Identified Risks & Anti-Patterns

1. **Duplicated Logic:** Host JWT validation and session lookups are repeated in almost every socket event.
2. **Hidden Side Effects:** Database operations (e.g., `PlayerAnswer.create`, `PlayerProfile.xp += score`) are deeply nested inside socket transport listeners, making them hard to test in isolation.
3. **Direct Model Access:** The file imports `GameSession`, `Player`, `PlayerAnswer`, `Quiz`, `Question`, and `PlayerProfile` and queries them directly throughout, mixing persistence and transport layers.
4. **Business Rules in Transport Code:** `calculateReward` and analytics aggregation loops are pure business logic trapped in a Socket.IO closure.
5. **Session Recovery Duplication:** Player recovery and Host recovery in `join_room` duplicate large amounts of logic for fetching the active question and formatting the DTO payload.
6. **Error Responses:** Errors are currently emitted as generic strings (`socket.emit('error', '...')`), making structured client-side handling difficult.

## Functions Suitable for Extraction

1. **ScoringService:** `calculateReward` can be fully isolated.
2. **AuthorizationService:** Host and Player JWT validation and role guards.
3. **SessionRecoveryService:** Canonical state reconstruction for rejoining players/hosts.
4. **Validation/Schemas (Joi):** Payloads (e.g., `join_room` data) are currently validated via manual `if (!cleanNickname)` logic and regex.
