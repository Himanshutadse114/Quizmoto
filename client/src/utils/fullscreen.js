function fullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

function nextAnimationFrame() {
    return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
        } else {
            window.setTimeout(resolve, 16);
        }
    });
}

async function waitForStableViewport() {
    await nextAnimationFrame();
    await nextAnimationFrame();
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    window.dispatchEvent(new Event('resize'));
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
    if (!fullscreenElement()) {
        await waitForStableViewport();
        return false;
    }
    const exit = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;

    if (!exit) {
        await waitForStableViewport();
        return false;
    }
    try {
        await Promise.resolve(exit.call(document));
        await waitForStableViewport();
        return true;
    } catch {
        await waitForStableViewport();
        return false;
    }
}

export function returnToLmsgenHomepage() {
    const homepage = new URL('/', window.location.origin).toString();
    window.location.replace(homepage);
}

export { fullscreenElement as getLiveQuizFullscreenElement };
