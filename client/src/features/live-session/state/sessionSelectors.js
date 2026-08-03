/** Selectors for Phase 2 live-session state. */

export function selectSessionStatus(state) {
    return state?.status ?? 'lobby';
}

export function selectSessionState(state) {
    return state?.state ?? 'LOBBY';
}

export function selectStateVersion(state) {
    return Number(state?.stateVersion || 0);
}

export function selectNeedsRecovery(state) {
    return !!state?.needsRecovery;
}

export function selectIsQuestionOpen(state) {
    return state?.status === 'question' || state?.state === 'QUESTION_OPEN';
}

export function selectIsResult(state) {
    return state?.status === 'result' || state?.state === 'ANSWER_REVEAL' || state?.state === 'LEADERBOARD';
}

export function selectIsFinished(state) {
    return state?.status === 'finished' || state?.state === 'FINISHED' || state?.state === 'CANCELLED';
}

export function selectExpectedStateVersion(state) {
    return selectStateVersion(state);
}
