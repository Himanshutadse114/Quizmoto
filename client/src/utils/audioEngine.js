const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const MUSIC_SCENES = {
    lobby: {
        bpm: 104,
        sequence: [48, 55, 60, 63, 55, 60, 67, 63],
        bass: [36, 36, 39, 39],
        wave: 'triangle',
        gain: 0.055
    },
    waiting: {
        bpm: 92,
        sequence: [53, 60, 65, 60, 55, 62, 67, 62],
        bass: [41, 41, 43, 43],
        wave: 'sine',
        gain: 0.042
    },
    question: {
        bpm: 118,
        sequence: [48, 55, 60, 55, 51, 58, 63, 58],
        bass: [36, 36, 39, 39],
        wave: 'triangle',
        gain: 0.038
    },
    results: {
        bpm: 108,
        sequence: [51, 58, 63, 67, 58, 63, 70, 67],
        bass: [39, 39, 43, 43],
        wave: 'sine',
        gain: 0.04
    },
    podium: {
        bpm: 112,
        sequence: [60, 64, 67, 72, 64, 67, 72, 76],
        bass: [48, 48, 53, 55],
        wave: 'triangle',
        gain: 0.045
    }
};

export class AudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.compressor = null;
        this.musicTimer = null;
        this.musicStep = 0;
        this.musicVoices = new Set();
        this.desiredScene = null;
        this.activeScene = null;
        this.questionEndsAt = 0;
        this.enabled = false;
        this.unlocked = false;
        this.lastPlayedAt = new Map();
        this.isMuted = false;

        try {
            this.isMuted = localStorage.getItem('quizmoto_audio_muted') === '1';
        } catch (_) {}

        if (typeof window !== 'undefined') {
            const unlock = () => {
                this.unlock();
            };
            window.addEventListener('pointerdown', unlock, { passive: true });
            window.addEventListener('keydown', unlock, { passive: true });

            // A quiet tactile click on every actionable control gives the whole
            // Live Quiz product one consistent sound language. The director
            // enables this only on Live Quiz routes, never inside SCORM World.
            window.addEventListener('pointerdown', (event) => {
                if (!this.enabled || this.isMuted) return;
                const target = event.target;
                if (!target || typeof target.closest !== 'function') return;
                const actionable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');
                if (actionable && !actionable.disabled) {
                    this.play('click', { cooldown: 35 });
                }
            }, { passive: true });
        }
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        if (!this.enabled) {
            this.desiredScene = null;
            this.stopBg();
        }
    }

    ensureContext() {
        if (this.context || typeof window === 'undefined') return this.context;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;

        const context = new AudioContextCtor();
        const master = context.createGain();
        const music = context.createGain();
        const sfx = context.createGain();
        const compressor = context.createDynamicsCompressor();

        master.gain.value = this.isMuted ? 0 : 0.9;
        music.gain.value = 0.72;
        sfx.gain.value = 0.9;

        compressor.threshold.value = -12;
        compressor.knee.value = 18;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.2;

        music.connect(master);
        sfx.connect(master);
        master.connect(compressor);
        compressor.connect(context.destination);

        this.context = context;
        this.masterGain = master;
        this.musicGain = music;
        this.sfxGain = sfx;
        this.compressor = compressor;
        return context;
    }

    async unlock() {
        const context = this.ensureContext();
        if (!context) return false;
        try {
            if (context.state === 'suspended') await context.resume();
            this.unlocked = context.state === 'running';
            if (this.unlocked && this.enabled && !this.isMuted && this.desiredScene && !this.activeScene) {
                this._startMusic(this.desiredScene);
            }
            return this.unlocked;
        } catch (_) {
            return false;
        }
    }

    setMute(mute) {
        this.isMuted = Boolean(mute);
        try {
            localStorage.setItem('quizmoto_audio_muted', this.isMuted ? '1' : '0');
        } catch (_) {}

        if (this.masterGain && this.context) {
            const now = this.context.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.9, now, 0.02);
        }

        if (this.isMuted) {
            this.stopBg();
        } else if (this.enabled && this.desiredScene) {
            this.unlock().then(() => this._startMusic(this.desiredScene));
        }
    }

    toggleMute() {
        this.setMute(!this.isMuted);
        return this.isMuted;
    }

    getMuted() {
        return this.isMuted;
    }

    setScene(scene) {
        const normalized = MUSIC_SCENES[scene] ? scene : null;
        this.desiredScene = normalized;
        if (!normalized || !this.enabled || this.isMuted) {
            this.stopBg();
            return;
        }
        if (!this.unlocked) return;
        if (this.activeScene !== normalized) this._startMusic(normalized);
    }

    beginQuestion(data = {}) {
        const timerSeconds = Number(data.timer || 20);
        let localStart = Date.now();
        if (Number.isFinite(Number(data.startTime))) {
            const serverTime = Number(data.serverTime);
            const offset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
            localStart = Number(data.startTime) - offset;
        }
        this.questionEndsAt = localStart + timerSeconds * 1000;
    }

    playCountdown(value) {
        if (!this.enabled || this.isMuted) return;
        const n = clamp(Number(value) || 1, 1, 3);
        const frequencies = { 3: 392, 2: 440, 1: 523.25 };
        this._pulse(frequencies[n], 0.22, 0.18, 'square');
        this._tone(frequencies[n] / 2, 0.24, {
            gain: 0.055,
            type: 'sine',
            destination: 'sfx'
        });
    }

    play(name, options = {}) {
        if (!this.enabled || this.isMuted) return;

        // Backward-compatible scene names used by the existing Live Quiz pages.
        if (name === 'playful') {
            this.setScene('lobby');
            return;
        }
        if (name === 'waiting') {
            this.setScene('waiting');
            return;
        }
        if (name === 'leaderboard') {
            const now = Date.now();
            if (now - (this.lastPlayedAt.get('leaderboardCue') || 0) > 900) {
                this.lastPlayedAt.set('leaderboardCue', now);
                this._stinger([392, 523.25, 659.25], 0.08, 0.32);
            }
            this.setScene('results');
            return;
        }

        const cooldown = Number(options.cooldown || this._defaultCooldown(name));
        const nowMs = Date.now();
        if (nowMs - (this.lastPlayedAt.get(name) || 0) < cooldown) return;
        this.lastPlayedAt.set(name, nowMs);

        this.unlock().then((ready) => {
            if (!ready || this.isMuted || !this.enabled) return;
            switch (name) {
                case 'click':
                    this._sweep(720, 520, 0.045, 0.03, 'sine');
                    break;
                case 'join':
                    this._tone(659.25, 0.12, { gain: 0.08, type: 'sine' });
                    this._tone(880, 0.18, { gain: 0.065, type: 'sine', delay: 0.07 });
                    break;
                case 'start':
                    this.stopBg();
                    this._sweep(130, 520, 0.52, 0.11, 'sawtooth');
                    this._noise(0.34, 0.05, 1400, 0.04);
                    break;
                case 'countdown':
                    this._pulse(440, 0.2, 0.14, 'square');
                    break;
                case 'countdownEnd':
                    this._stinger([523.25, 659.25, 783.99], 0.025, 0.34);
                    this._noise(0.12, 0.035, 2800, 0.01);
                    break;
                case 'answerLock':
                    this._sweep(360, 640, 0.09, 0.07, 'triangle');
                    this._tone(880, 0.08, { gain: 0.035, type: 'sine', delay: 0.055 });
                    break;
                case 'correct':
                    this._stinger([523.25, 659.25, 783.99, 1046.5], 0.065, 0.42);
                    this._sparkle(0.15);
                    break;
                case 'wrong':
                    this._tone(329.63, 0.18, { gain: 0.09, type: 'triangle' });
                    this._tone(277.18, 0.2, { gain: 0.075, type: 'triangle', delay: 0.13 });
                    this._tone(220, 0.26, { gain: 0.06, type: 'sine', delay: 0.26 });
                    break;
                case 'reveal':
                    this._sweep(260, 520, 0.2, 0.06, 'sine');
                    this._tone(659.25, 0.18, { gain: 0.05, type: 'triangle', delay: 0.12 });
                    break;
                case 'tick':
                    this._timerTick();
                    break;
                case 'timeout':
                    this._tone(196, 0.28, { gain: 0.09, type: 'triangle' });
                    this._tone(146.83, 0.34, { gain: 0.055, type: 'sine', delay: 0.12 });
                    break;
                case 'podium':
                    this.stopBg();
                    this._stinger([392, 523.25, 659.25, 783.99], 0.08, 0.5);
                    this._tone(1046.5, 0.42, { gain: 0.09, type: 'triangle', delay: 0.32 });
                    this._sparkle(0.28);
                    break;
                case 'warning':
                    this._tone(392, 0.16, { gain: 0.055, type: 'triangle' });
                    this._tone(349.23, 0.18, { gain: 0.05, type: 'triangle', delay: 0.16 });
                    break;
                default:
                    break;
            }
        });
    }

    _defaultCooldown(name) {
        if (name === 'tick') return 500;
        if (name === 'click') return 35;
        if (name === 'join') return 180;
        if (name === 'correct' || name === 'wrong') return 700;
        if (name === 'podium') return 1400;
        return 100;
    }

    _timerTick() {
        const remainingMs = this.questionEndsAt ? this.questionEndsAt - Date.now() : 5000;
        // Keep early question time clean. Introduce a subtle pulse at 10 seconds,
        // then progressively brighter urgency for the final five seconds.
        if (remainingMs > 10500) return;
        const remaining = Math.max(0, remainingMs / 1000);
        const urgent = remaining <= 5.5;
        const freq = urgent ? 760 + (5 - clamp(remaining, 0, 5)) * 55 : 620;
        this._tone(freq, urgent ? 0.065 : 0.045, {
            gain: urgent ? 0.065 : 0.026,
            type: urgent ? 'square' : 'sine'
        });
        if (remaining <= 1.1) {
            this._tone(196, 0.12, { gain: 0.045, type: 'sine' });
        }
    }

    _startMusic(sceneName) {
        if (!this.enabled || this.isMuted || !this.unlocked) return;
        const scene = MUSIC_SCENES[sceneName];
        if (!scene) return;

        this.stopBg(false);
        this.activeScene = sceneName;
        this.desiredScene = sceneName;
        this.musicStep = 0;

        const beatMs = (60 / scene.bpm) * 1000 / 2;
        const playStep = () => {
            if (!this.context || this.activeScene !== sceneName || this.isMuted || !this.enabled) return;
            const step = this.musicStep++;
            const note = scene.sequence[step % scene.sequence.length];
            this._tone(midiToHz(note), Math.min(0.24, beatMs / 1000 * 0.72), {
                gain: scene.gain,
                type: scene.wave,
                destination: 'music',
                attack: 0.008,
                release: 0.09
            });

            if (step % 4 === 0) {
                const bassNote = scene.bass[Math.floor(step / 4) % scene.bass.length];
                this._tone(midiToHz(bassNote), Math.min(0.42, beatMs / 1000 * 1.5), {
                    gain: scene.gain * 0.58,
                    type: 'sine',
                    destination: 'music',
                    attack: 0.02,
                    release: 0.14
                });
            }
        };

        playStep();
        this.musicTimer = window.setInterval(playStep, beatMs);
    }

    stopBg(clearDesired = true) {
        if (this.musicTimer) {
            window.clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
        this.musicVoices.forEach((voice) => {
            try { voice.stop(); } catch (_) {}
        });
        this.musicVoices.clear();
        this.activeScene = null;
        if (clearDesired) this.desiredScene = null;
    }

    stopAll() {
        this.stopBg();
        if (!this.context || !this.masterGain) return;
        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.9, now);
    }

    _destination(kind) {
        return kind === 'music' ? this.musicGain : this.sfxGain;
    }

    _tone(frequency, duration, options = {}) {
        const context = this.ensureContext();
        if (!context || !this.unlocked || this.isMuted) return;

        const destinationKind = options.destination || 'sfx';
        const destination = this._destination(destinationKind);
        if (!destination) return;

        const delay = Number(options.delay || 0);
        const start = context.currentTime + delay;
        const end = start + duration;
        const attack = clamp(Number(options.attack ?? 0.006), 0.002, duration * 0.45);
        const release = clamp(Number(options.release ?? 0.06), 0.01, duration * 0.7);
        const peak = clamp(Number(options.gain ?? 0.07), 0.001, 0.25);

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = options.type || 'sine';
        oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + attack);
        gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);

        if (destinationKind === 'music') {
            this.musicVoices.add(oscillator);
            oscillator.onended = () => this.musicVoices.delete(oscillator);
        }
    }

    _pulse(frequency, duration, gain, type = 'square') {
        this._tone(frequency, duration, {
            gain,
            type,
            attack: 0.004,
            release: duration * 0.55
        });
    }

    _sweep(from, to, duration, gain = 0.07, type = 'sine') {
        const context = this.ensureContext();
        if (!context || !this.unlocked || this.isMuted || !this.sfxGain) return;
        const start = context.currentTime;
        const end = start + duration;
        const oscillator = context.createOscillator();
        const amp = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(20, from), start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
        amp.gain.setValueAtTime(0.0001, start);
        amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration * 0.25));
        amp.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(amp);
        amp.connect(this.sfxGain);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
    }

    _stinger(frequencies, spacing = 0.06, duration = 0.32) {
        frequencies.forEach((frequency, index) => {
            this._tone(frequency, duration, {
                gain: 0.075 - index * 0.006,
                type: index % 2 === 0 ? 'triangle' : 'sine',
                delay: index * spacing,
                attack: 0.008,
                release: duration * 0.55
            });
        });
    }

    _sparkle(delay = 0) {
        [1174.66, 1318.51, 1567.98].forEach((frequency, index) => {
            this._tone(frequency, 0.12 + index * 0.025, {
                gain: 0.025,
                type: 'sine',
                delay: delay + index * 0.055,
                attack: 0.003,
                release: 0.08
            });
        });
    }

    _noise(duration = 0.15, gain = 0.03, highpass = 1200, delay = 0) {
        const context = this.ensureContext();
        if (!context || !this.unlocked || this.isMuted || !this.sfxGain) return;
        const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
        const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i += 1) {
            channel[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
        }

        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const amp = context.createGain();
        const start = context.currentTime + delay;
        filter.type = 'highpass';
        filter.frequency.value = highpass;
        amp.gain.setValueAtTime(gain, start);
        amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(amp);
        amp.connect(this.sfxGain);
        source.start(start);
    }
}

export const audio = new AudioEngine();
