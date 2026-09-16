import React from 'react';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CountdownDisplay = ({ value, className = '' }) => {
    const reduceMotion = useReducedMotion();
    const number = Math.max(1, Math.min(3, Number(value) || 1));
    const enter = reduceMotion
        ? { opacity: 1 }
        : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' };
    const initial = reduceMotion
        ? false
        : { opacity: 0, scale: 0.58, y: 24, filter: 'blur(8px)' };
    const exit = reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, scale: 1.18, y: -24, filter: 'blur(6px)' };

    return (
        <div
            role="timer"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Starting in ${number}`}
            className={`relative flex h-40 w-40 items-center justify-center sm:h-56 sm:w-56 ${className}`}
        >
            <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90 overflow-visible">
                <circle cx="50" cy="50" r={RADIUS} fill="rgba(255,255,255,0.035)" stroke="rgba(213,239,235,0.2)" strokeWidth="2" />
                <Motion.circle
                    key={`countdown-ring-${number}`}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="#c8ef6b"
                    strokeLinecap="round"
                    strokeWidth="3"
                    strokeDasharray={CIRCUMFERENCE}
                    initial={{ strokeDashoffset: 0, opacity: 0.95 }}
                    animate={{ strokeDashoffset: reduceMotion ? 0 : CIRCUMFERENCE, opacity: reduceMotion ? 0.8 : 0.42 }}
                    transition={{ duration: reduceMotion ? 0 : 0.96, ease: 'linear' }}
                />
            </svg>

            <AnimatePresence mode="sync" initial>
                <Motion.span
                    key={number}
                    initial={initial}
                    animate={enter}
                    exit={exit}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex items-center justify-center text-[6rem] font-black leading-none tabular-nums text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.35)] sm:text-[9rem]"
                >
                    {number}
                </Motion.span>
            </AnimatePresence>
        </div>
    );
};

export default CountdownDisplay;
