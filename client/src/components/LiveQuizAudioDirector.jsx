import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { audio } from '../utils/audioEngine';

const isHostLobby = (pathname) => /\/host\/lobby\//.test(pathname);
const isHostGame = (pathname) => /\/host\/game\//.test(pathname);
const isPlayerLobby = (pathname) => /\/player\/lobby\/?$/.test(pathname);
const isPlayerGame = (pathname) => /\/player\/game\/?$/.test(pathname);
const isLiveGameRoute = (pathname) => (
    isHostLobby(pathname) ||
    isHostGame(pathname) ||
    isPlayerLobby(pathname) ||
    isPlayerGame(pathname)
);

/**
 * Central audio conductor for Live Quiz.
 *
 * Why this lives above the individual screens:
 * - host and player hear the same musical language;
 * - reconnect/recovery events do not lose audio state;
 * - future Live Quiz screens get click SFX automatically;
 * - SCORM World remains silent and completely independent.
 */
const LiveQuizAudioDirector = () => {
    const socket = useSocket();
    const { pathname } = useLocation();
    const previousPlayerCountRef = useRef(0);
    const podiumMusicTimerRef = useRef(null);

    useEffect(() => {
        // Everything outside SCORM World belongs to the Live Quiz product shell,
        // so its buttons get the same subtle tactile click. Background music is
        // only enabled in the lobby/game routes below.
        const liveQuizProduct = !pathname.startsWith('/scorm');
        audio.setEnabled(liveQuizProduct);

        if (!liveQuizProduct) return;

        if (isHostLobby(pathname)) {
            audio.setScene('lobby');
        } else if (isPlayerLobby(pathname)) {
            audio.setScene('waiting');
        } else if (isHostGame(pathname) || isPlayerGame(pathname)) {
            // Safe recovery default. Socket recovery events refine this to
            // question/results/podium as soon as state arrives.
            audio.setScene('question');
        } else {
            audio.stopBg();
        }

        return () => {
            if (podiumMusicTimerRef.current) {
                window.clearTimeout(podiumMusicTimerRef.current);
                podiumMusicTimerRef.current = null;
            }
        };
    }, [pathname]);

    useEffect(() => {
        if (!socket || !isLiveGameRoute(pathname)) return undefined;

        const onQuestionStarted = (data = {}) => {
            audio.beginQuestion(data);
            audio.setScene(null);
            audio.play('start');
        };

        const onCountdownTick = (data = {}) => {
            const value = Number(data.value);
            if (value > 0) {
                audio.playCountdown(value);
                return;
            }
            audio.play('countdownEnd');
            audio.setScene('question');
        };

        const onAnswerConfirmed = () => {
            if (isPlayerGame(pathname)) audio.play('answerLock');
        };

        const onQuestionResult = (data = {}) => {
            if (!isPlayerGame(pathname)) return;
            if (data.answered === false) audio.play('timeout');
            else audio.play(data.correct ? 'correct' : 'wrong');
            audio.setScene('results');
        };

        const onQuestionEnded = () => {
            if (isHostGame(pathname)) audio.play('reveal');
            audio.setScene('results');
        };

        const onGameFinished = () => {
            audio.setScene(null);
            audio.play('podium');
            if (podiumMusicTimerRef.current) window.clearTimeout(podiumMusicTimerRef.current);
            podiumMusicTimerRef.current = window.setTimeout(() => {
                audio.setScene('podium');
            }, 850);
        };

        const onHostDisconnected = () => {
            audio.stopBg();
            audio.play('warning');
        };

        const onHostReconnected = () => {
            audio.play('join');
            if (isPlayerLobby(pathname)) audio.setScene('waiting');
            else if (isPlayerGame(pathname)) audio.setScene('question');
        };

        const onPlayerJoined = (players) => {
            if (!isHostLobby(pathname) || !Array.isArray(players)) return;
            if (players.length > previousPlayerCountRef.current) audio.play('join');
            previousPlayerCountRef.current = players.length;
        };

        const applyRecoveredState = (data = {}) => {
            const status = String(data.status || '').toLowerCase();
            if (data.currentQuestion) {
                audio.beginQuestion({
                    ...data.currentQuestion,
                    serverTime: data.serverTime,
                    startTime: data.currentQuestion.startTime || data.questionOpensAt
                });
            }

            if (status === 'lobby') {
                audio.setScene(isHostLobby(pathname) ? 'lobby' : 'waiting');
            } else if (status === 'question') {
                audio.setScene('question');
            } else if (status === 'result') {
                audio.setScene('results');
            } else if (status === 'finished') {
                audio.setScene('podium');
            }
        };

        socket.on('question_started', onQuestionStarted);
        socket.on('countdown_tick', onCountdownTick);
        socket.on('answer_confirmed', onAnswerConfirmed);
        socket.on('question_result', onQuestionResult);
        socket.on('question_ended', onQuestionEnded);
        socket.on('game_finished', onGameFinished);
        socket.on('game_over', onGameFinished);
        socket.on('host_disconnected', onHostDisconnected);
        socket.on('host_reconnected', onHostReconnected);
        socket.on('player_joined', onPlayerJoined);
        socket.on('session_info', applyRecoveredState);
        socket.on('room_info', applyRecoveredState);

        return () => {
            socket.off('question_started', onQuestionStarted);
            socket.off('countdown_tick', onCountdownTick);
            socket.off('answer_confirmed', onAnswerConfirmed);
            socket.off('question_result', onQuestionResult);
            socket.off('question_ended', onQuestionEnded);
            socket.off('game_finished', onGameFinished);
            socket.off('game_over', onGameFinished);
            socket.off('host_disconnected', onHostDisconnected);
            socket.off('host_reconnected', onHostReconnected);
            socket.off('player_joined', onPlayerJoined);
            socket.off('session_info', applyRecoveredState);
            socket.off('room_info', applyRecoveredState);
        };
    }, [socket, pathname]);

    return null;
};

export default LiveQuizAudioDirector;
