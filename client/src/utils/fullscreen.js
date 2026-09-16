function fullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

export function requestLiveQuizFullscreen() {
    const target = document.documentElement;
    const request = target.requestFullscreen
        || target.webkitRequestFullscreen
        || target.mozRequestFullScreen
        || target.msRequestFullscreen;

    if (!request) return Promise.resolve(false);
    try {
        const result = request.call(target);
        return Promise.resolve(result).then(() => true).catch(() => false);
    } catch {
        return Promise.resolve(false);
    }
}

export async function exitLiveQuizFullscreen() {
    if (!fullscreenElement()) return false;
    const exit = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;

    if (!exit) return false;
    try {
        await Promise.resolve(exit.call(document));
        return true;
    } catch {
        return false;
    }
}

export { fullscreenElement as getLiveQuizFullscreenElement };
