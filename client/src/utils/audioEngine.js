export class AudioEngine {
    constructor() {
        this.sounds = {};
        this.bgMusic = null;
        this.isMuted = false;
        
        if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
            this.sounds = {
                tick: new Audio('/sounds/tick.wav'),
                countdown: new Audio('/sounds/countdown.wav'),
                countdownEnd: new Audio('/sounds/countdown_end.wav'),
                playful: new Audio('/sounds/playful.wav'),
                correct: new Audio('/sounds/correct.wav'),
                wrong: new Audio('/sounds/wrong.wav')
            };

            // Configure background loop
            if (this.sounds.playful) {
                this.sounds.playful.loop = true;
                this.sounds.playful.volume = 0.15; // Softer background
            }
        }
    }

    setMute(mute) {
        this.isMuted = mute;
        if (mute) {
            this.stopAll();
        } else {
            // If they unmute, should we resume bg? Usually UI triggers handle playing.
        }
    }

    play(name) {
        if (this.isMuted || !this.sounds[name]) return;
        
        try {
            // Clone node to allow overlapping sounds (e.g. rapid ticks)
            if (name !== 'playful') {
                const soundClone = this.sounds[name].cloneNode();
                soundClone.volume = name === 'tick' ? 0.3 : 0.6;
                soundClone.play().catch(e => console.warn('Audio play prevented:', e));
            } else {
                this.sounds.playful.play().catch(e => console.warn('Audio play prevented:', e));
            }
        } catch (e) {
            console.warn('Error playing audio:', e);
        }
    }

    stopBg() {
        if (this.sounds.playful) {
            this.sounds.playful.pause();
            this.sounds.playful.currentTime = 0;
        }
    }

    stopAll() {
        Object.values(this.sounds).forEach(audio => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
    }
}

// Export a singleton instance
export const audio = new AudioEngine();
