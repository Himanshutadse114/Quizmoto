import { useCallback, useReducer } from 'react';
import {
    initialSessionState,
    sessionReducer,
    newCommandId
} from '../state/sessionReducer';
import { selectExpectedStateVersion, selectNeedsRecovery } from '../state/sessionSelectors';
import { fetchSessionRecovery } from '../api/fetchSessionRecovery';
import { NEW_SESSION_ENGINE } from '../../../config';

/**
 * Opt-in Phase 2 live session state.
 * Does not replace existing page useState unless the caller chooses to use it.
 * When NEW_SESSION_ENGINE is false, helpers no-op recovery/command envelope extras.
 */
export function useLiveSessionState(initial = {}) {
    const [state, dispatch] = useReducer(sessionReducer, {
        ...initialSessionState,
        ...initial
    });

    const reset = useCallback((payload = {}) => {
        dispatch({ type: 'SESSION_RESET', payload });
    }, []);

    const applyEvent = useCallback((envelope) => {
        dispatch({ type: 'SESSION_EVENT', payload: envelope });
    }, []);

    const applyCommandAck = useCallback((ack) => {
        dispatch({ type: 'SESSION_COMMAND_ACK', payload: ack });
    }, []);

    const hydrateFromRecovery = useCallback(async ({ sessionId, role, token }) => {
        if (!NEW_SESSION_ENGINE) {
            return null;
        }
        const body = await fetchSessionRecovery({ sessionId, role, token });
        dispatch({ type: 'SESSION_HYDRATE_FROM_RECOVERY', payload: body });
        return body;
    }, []);

    const markNeedsRecovery = useCallback(() => {
        dispatch({ type: 'SESSION_MARK_NEEDS_RECOVERY' });
    }, []);

    /** Build optional fields for host socket commands when V2 client path is on. */
    const buildCommandEnvelope = useCallback(() => {
        if (!NEW_SESSION_ENGINE) {
            return {};
        }
        return {
            commandId: newCommandId(),
            expectedStateVersion: selectExpectedStateVersion(state)
        };
    }, [state]);

    return {
        state,
        dispatch,
        enabled: NEW_SESSION_ENGINE,
        needsRecovery: selectNeedsRecovery(state),
        reset,
        applyEvent,
        applyCommandAck,
        hydrateFromRecovery,
        markNeedsRecovery,
        buildCommandEnvelope,
        newCommandId
    };
}
