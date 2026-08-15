const { expect } = require('chai');
const {
    normalizeEntryHref,
    manifestEntryHref,
    recoverEntryHref,
    ensurePackageLaunchMetadata
} = require('../services/scorm/ScormLaunchMetadataService');
const { packageContentKey, packageMetaKey } = require('../services/scorm/storageKeys');

function fakeStorage(entries = {}) {
    const objects = new Map(Object.entries(entries).map(([key, value]) => [key, Buffer.isBuffer(value) ? value : Buffer.from(String(value))]));
    return {
        async exists(key) { return objects.has(key); },
        async getObjectBuffer(key) {
            if (!objects.has(key)) {
                const err = new Error('Object not found');
                err.code = 'OBJECT_NOT_FOUND';
                throw err;
            }
            return objects.get(key);
        }
    };
}

describe('ScormLaunchMetadataService', () => {
    it('normalizes safe local entry hrefs and rejects traversal/external URLs', () => {
        expect(normalizeEntryHref('/course/index.html?x=1#top')).to.equal('course/index.html');
        expect(normalizeEntryHref('folder\\launch.html')).to.equal('folder/launch.html');
        expect(normalizeEntryHref('../secret.html')).to.equal(null);
        expect(normalizeEntryHref('%2e%2e/secret.html')).to.equal(null);
        expect(normalizeEntryHref('https://example.com/course.html')).to.equal(null);
        expect(normalizeEntryHref('//example.com/course.html')).to.equal(null);
    });

    it('prefers the SCO resource href from a SCORM manifest', () => {
        const xml = `<?xml version="1.0"?>
          <manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
            <resources>
              <resource identifier="asset" type="webcontent" href="assets/help.html" />
              <resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="course/start.html" />
            </resources>
          </manifest>`;
        expect(manifestEntryHref(xml)).to.equal('course/start.html');
    });

    it('recovers entryHref from stored package metadata', async () => {
        const pkg = { id: 'pkg-meta', status: 'ready', entryHref: null };
        const storage = fakeStorage({
            [packageMetaKey(pkg.id)]: JSON.stringify({ entryHref: 'nested/start.html' }),
            [packageContentKey(pkg.id, 'nested/start.html')]: '<html></html>'
        });
        expect(await recoverEntryHref(pkg, { storage })).to.equal('nested/start.html');
    });

    it('recovers entryHref from imsmanifest.xml when metadata is incomplete', async () => {
        const pkg = { id: 'pkg-manifest', status: 'ready', entryHref: null };
        const manifest = '<manifest><resources><resource identifier="r" adlcp:scormtype="sco" href="lesson/player.html" /></resources></manifest>';
        const storage = fakeStorage({
            [packageContentKey(pkg.id, 'imsmanifest.xml')]: manifest,
            [packageContentKey(pkg.id, 'lesson/player.html')]: '<html></html>'
        });
        expect(await recoverEntryHref(pkg, { storage })).to.equal('lesson/player.html');
    });

    it('recovers legacy AI packages from index.html and persists the repair', async () => {
        let saved = 0;
        const pkg = {
            id: 'pkg-ai',
            status: 'ready',
            source: 'ai_author',
            entryHref: null,
            async save() { saved += 1; }
        };
        const storage = fakeStorage({
            [packageContentKey(pkg.id, 'index.html')]: '<html></html>'
        });
        const href = await ensurePackageLaunchMetadata(pkg, { storage });
        expect(href).to.equal('index.html');
        expect(pkg.entryHref).to.equal('index.html');
        expect(saved).to.equal(1);
    });

    it('rejects ready packages that have no launchable content', async () => {
        const pkg = { id: 'pkg-empty', status: 'ready', entryHref: null };
        let caught = null;
        try {
            await ensurePackageLaunchMetadata(pkg, { storage: fakeStorage() });
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('PACKAGE_LAUNCH_MISSING');
    });
});