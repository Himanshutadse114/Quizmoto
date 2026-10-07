const THEMES = {
    1: {
        id: 1,
        slug: 'editorial',
        name: 'Editorial',
        description: 'Neutral paper, charcoal typography and restrained editorial highlights.',
        primary: '#282824',
        primaryDark: '#171715',
        accent: '#CBC5B8',
        accent2: '#FCF2B5',
        bg: '#E7E7E4',
        bg2: '#E5DFD2',
        surface: '#F4F2EC',
        surface2: '#E0DDD4',
        text: '#282824',
        body: '#4A4A45',
        muted: '#77776F',
        line: '#CBC5B8',
        visualBg: '#E5DFD2',
        visualBg2: '#CBC5B8',
        visualCard: '#F4F2EC',
        visualCard2: '#E7E7E4',
        visualText: '#282824',
        visualMuted: '#4A4A45',
        soft: '#FCF2B5',
        glow: '#4FC9BF',
        motif: 'editorial'
    }
};

function normalizeThemeId(value) {
    // Platform uses one learner-course theme.
    return 1;
}

function getTheme(value) {
    return THEMES[1];
}

function listThemes() {
    return Object.values(THEMES).map((theme) => ({ ...theme }));
}

module.exports = {
    THEMES,
    getTheme,
    listThemes,
    normalizeThemeId
};
