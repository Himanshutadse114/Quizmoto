class AudioService {
    constructor() {
        this.sounds = {};
        this.isMuted = true;
        this.activeLoops = new Set();
    }

    play(soundName, loop = false) {
        // Music removed totally by user request
    }

    resume() {
        // No-op
    }

    stopAll() {
        // No-op
    }

    stop(soundName) {
        // No-op
    }

    toggleMute() {
        // No-op
    }
}

const audioInstance = new AudioService();
export default audioInstance;
