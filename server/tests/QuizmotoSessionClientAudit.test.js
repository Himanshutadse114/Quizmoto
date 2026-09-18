const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const clientRoot = path.join(__dirname, '..', '..', 'client', 'src');

function source(relativePath) {
    return fs.readFileSync(path.join(clientRoot, relativePath), 'utf8');
}

describe('Quizmoto live-session client safeguards', () => {
    it('does not start a question implicitly while the host recovers a lobby snapshot', () => {
        const gameView = source(path.join('pages', 'Host', 'GameView.jsx'));
        expect(gameView).not.to.include("if (!hasPending) socket.emit('start_question'");
        expect(gameView).to.include("navigate(`/host/lobby/${pin}`, { replace: true })");
    });

    it('restores the host answer snapshot without counting recovery events twice', () => {
        const gameView = source(path.join('pages', 'Host', 'GameView.jsx'));
        expect(gameView).to.include('setAnswersCount(Number(sessionData.answersCount || 0))');
        expect(gameView).to.include('if (recovery) return');
    });

    it('removes only listeners owned by each screen', () => {
        const files = [
            path.join('pages', 'Host', 'GameView.jsx'),
            path.join('pages', 'Host', 'Lobby.jsx'),
            path.join('pages', 'Player', 'PlayerGame.jsx'),
            'components/ReactionCanvas.jsx'
        ];
        files.forEach((file) => {
            expect(source(file), file).not.to.match(/socket\.off\('[^']+'\)\s*;?/);
        });
    });

    it('exits fullscreen before terminated players return to the LMSGEN site', () => {
        const game = source(path.join('pages', 'Player', 'PlayerGame.jsx'));
        const lobby = source(path.join('pages', 'Player', 'PlayerLobby.jsx'));
        const fullscreen = source(path.join('utils', 'fullscreen.js'));
        expect(game).to.include('await exitLiveQuizFullscreen()');
        expect(lobby).to.include('await exitLiveQuizFullscreen()');
        expect(fullscreen).to.include('document.exitFullscreen');
        expect(fullscreen).to.include('document.webkitExitFullscreen');
        expect(fullscreen).to.include('waitForStableViewport');
        expect(fullscreen).to.include("window.dispatchEvent(new Event('resize'))");
        expect(fullscreen).to.include('window.location.replace(homepage)');
        expect(game).to.include('returnToLmsgenHomepage()');
    });

    it('resynchronizes the marketing frame after mobile fullscreen exits', () => {
        const marketing = source(path.join('pages', 'Marketing', 'MarketingSite.jsx'));
        const homeTheme = fs.readFileSync(path.join(clientRoot, '..', 'public', 'landing', 'css', 'atelora-home-refresh.css'), 'utf8');
        expect(marketing).to.include('window.visualViewport');
        expect(marketing).to.include('syncMarketingFrameViewport');
        expect(marketing).to.include('Math.min(...widthCandidates)');
        expect(marketing).to.include("height: '100dvh'");
        expect(homeTheme).to.include('font-size: clamp(3rem, 8.4vw, 3.55rem) !important');
    });

    it('handles host control conflicts and suppresses game-screen background shapes', () => {
        const gameView = source(path.join('pages', 'Host', 'GameView.jsx'));
        const lobby = source(path.join('pages', 'Host', 'Lobby.jsx'));
        const app = source('App.jsx');
        expect(gameView).to.include("socket.on('host_control_denied'");
        expect(gameView).to.include("socket.on('host_control_lost'");
        expect(lobby).to.include("socket.on('host_control_denied'");
        expect(app).to.include("pathname !== '/player/game'");
    });

    it('uses one synchronized, reduced-motion-safe countdown on host and player screens', () => {
        const gameView = source(path.join('pages', 'Host', 'GameView.jsx'));
        const playerGame = source(path.join('pages', 'Player', 'PlayerGame.jsx'));
        const countdown = source(path.join('components', 'CountdownDisplay.jsx'));
        expect(gameView).to.include('<CountdownDisplay value={countdown} />');
        expect(playerGame).to.include('<CountdownDisplay value={countdown} />');
        expect(countdown).to.include('useReducedMotion');
        expect(countdown).to.include('duration: reduceMotion ? 0 : 0.96');
        expect(countdown).to.include('aria-live="polite"');
    });
});
