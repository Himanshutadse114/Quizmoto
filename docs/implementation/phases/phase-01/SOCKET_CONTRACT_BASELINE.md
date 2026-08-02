# Socket Contract Baseline

This document captures the verified public Socket.IO contracts prior to the Phase 1 refactoring.

## Incoming Events (Client -> Server)

| Event Name | Role | Payload Fields | Description |
|---|---|---|---|
| `join_room` | Host, Player, Player_check | `pin` (string, req), `nickname` (string, optional for host), `role` (string), `token` (string, opt), `avatar` (string, opt), `teamName` (string, opt), `playerProfileToken` (string, opt) | Connects to a game room |
| `start_question` | Host | `pin` (string, req), `token` (string, req) | Transitions from lobby/result to question state |
| `submit_answer` | Player | `pin` (string, req), `nickname` (string, req), `answerIndex` (number, req), `timeRemaining` (number, deprecated/ignored for scoring) | Submits an answer to the current question |
| `end_question` | Host | `pin` (string, req), `token` (string, req) | Transitions from question to result state |
| `send_reaction` | Any | `pin` (string, req), `emoji` (string, req) | Broadcasts an emoji to the room |
| `set_game_mode` | Host | `pin` (string, req), `mode` (string, req), `token` (string, req) | Toggles 'classic' or 'team' mode |
| `end_game` | Host | `pin` (string, req), `token` (string, req) | Finishes the game and calculates analytics |

## Outgoing Events (Server -> Client)

| Event Name | Receivers | Payload Description | Contains Sensitive Fields? |
|---|---|---|---|
| `error` | Emitter only | String error message | No |
| `player_joined` | Room (Broadcast) | Array of Player objects | No |
| `joined_successfully` | Emitter only | `{ pin, nickname, sessionId, token }` | Yes (`token`) |
| `session_info` | Player (reconnect) | Canonical player state (`status`, `question` w/o correctIndex, `serverTime`, `score`, etc) | No (correctIndex is scrubbed on question state) |
| `room_info` | Host (reconnect) | Canonical host state (full GameSession JSON) | No |
| `host_reconnected` | Room (Broadcast) | Empty | No |
| `host_disconnected` | Room (Broadcast) | Empty | No |
| `question_started` | Room (Broadcast) | `{ questionText, options, timer, image, index, totalQuestions, startTime, serverTime }` | No (excludes `correctIndex`) |
| `question_result` | Individual Player | `{ correct, score, answered }` | No |
| `question_ended` | Room (Broadcast) | `{ leaderboard, teamStandings, correctIndex, distribution }` | No |
| `answer_confirmed` | Individual Player | `{ streak, score, points }` | No |
| `answer_received` | Room (Broadcast) | `{ nickname }` | No |
| `answer_received_host`| Host Only | `{ answerIndex, nickname }` | No |
| `new_reaction` | Room (Broadcast) | `{ emoji, id }` | No |
| `game_finished` | Room (Broadcast) | `{ players, teamStandings, analytics }` | No |

## Error Contract

Currently, errors are emitted via `socket.emit('error', string_message)`.
Example error strings:
- `'Game not found'`
- `'Game is already finished'`
- `'Nickname required'`
- `'That name is already taken'`
- `'Unauthorized Host Entry'`
- `'Unauthorized: Only the host can start questions'`
- `'Answer already submitted'`
- `'Question has not started yet'`
- `'Invalid answer index'`
- `'Unauthorized'`

These must be preserved or cleanly adapted during the refactor.
