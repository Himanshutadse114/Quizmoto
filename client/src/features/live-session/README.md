# Live session (Phase 2 client)

## Status

- Pure `sessionReducer` + selectors + recovery API helper + `useLiveSessionState` hook.
- **Default OFF** (`VITE_NEW_SESSION_ENGINE` unset).
- Host/Player pages still use their existing `useState` flows so production stays stable.

## Enable (dev / internal only)

```bash
VITE_NEW_SESSION_ENGINE=true
```

Server must also set `NEW_SESSION_ENGINE=true` for command paths.

## Usage sketch

```js
import { useLiveSessionState } from '../features/live-session/hooks/useLiveSessionState';

const { enabled, buildCommandEnvelope, applyCommandAck, hydrateFromRecovery } = useLiveSessionState({
  role: 'host',
  pin
});

// When enabled, attach envelope to host commands:
socket.emit('start_question', { pin, token, ...buildCommandEnvelope() });
socket.on('command_ack', applyCommandAck);

// On conflict / gap:
await hydrateFromRecovery({ sessionId, role: 'host', token });
```

Do not force-enable on production until reliability acceptance (P2-T11) is green.
