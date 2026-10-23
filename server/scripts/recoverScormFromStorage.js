/**
 * Rebuild SCORM package + course records from objects that are still in R2.
 *
 * Use after the database was lost but the object storage bucket survived:
 * every `scorm/packages/<uuid>/` folder is a package whose ZIP, extracted
 * content and meta.json are still stored; only the `scorm_packages` and
 * `scorm_courses` rows are missing, so the platform lists nothing.
 *
 * Dry run by default. Nothing is written until RECOVER_APPLY=1.
 *
 *   RECOVER_HOST_EMAIL=you@example.com node scripts/recoverScormFromStorage.js
 *   RECOVER_HOST_EMAIL=you@example.com RECOVER_APPLY=1 node scripts/recoverScormFromStorage.js
 *
 * Needs the same DB_* and S3_* / AWS_* environment variables as the server.
 * RECOVER_HOST_EMAIL must belong to a user who has already signed in once.
 * Recovered courses are created as drafts, because the original publish state,
 * invite codes, learners and results lived only in the lost database.
 */
require('dotenv').config();

const { sequelize } = require('../config/database');
const User = require('../models/User');
const { ScormPackage, ScormCourse } = require('../models/scorm');
const { getObjectStorage } = require('../storage/ObjectStorage');
const { createInviteCode } = require('../services/scorm/ScormInviteService');
const { packageZipKey, packageContentPrefix, packageMetaKey, packageContentKey } = require('../services/scorm/storageKeys');

const PACKAGE_ID = /^scorm\/packages\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

function decodeXml(value) {
    return String(value || '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function readJson(storage, key) {
    try {
        return JSON.parse((await storage.getObjectBuffer(key)).toString('utf8'));
    } catch (_) {
        return null;
    }
}

async function manifestTitle(storage, packageId, manifestPath) {
    try {
        const xml = (await storage.getObjectBuffer(packageContentKey(packageId, manifestPath || 'imsmanifest.xml'))).toString('utf8');
        const org = xml.match(/<organization\b[\s\S]*?<title>([\s\S]*?)<\/title>/i);
        const any = xml.match(/<title>([\s\S]*?)<\/title>/i);
        return decodeXml((org && org[1]) || (any && any[1]));
    } catch (_) {
        return '';
    }
}

async function main(env = process.env) {
    const email = String(env.RECOVER_HOST_EMAIL || '').trim().toLowerCase();
    if (!email) throw new Error('Set RECOVER_HOST_EMAIL to the account that should own the recovered courses.');
    const apply = env.RECOVER_APPLY === '1';

    await sequelize.authenticate();
    const host = await User.findOne({ where: { email } });
    if (!host) throw new Error(`No user with email ${email}. Sign in to the platform once with that account first.`);

    const storage = getObjectStorage();
    const keys = await storage.listKeys('scorm/packages/', { maxKeys: 500000 });
    const byPackage = new Map();
    for (const key of keys) {
        const match = key.match(PACKAGE_ID);
        if (!match) continue;
        const id = match[1].toLowerCase();
        if (!byPackage.has(id)) byPackage.set(id, []);
        byPackage.get(id).push(key);
    }
    console.log(`Found ${byPackage.size} package folder(s) in storage. Host: ${email} (user id ${host.id}). Mode: ${apply ? 'APPLY' : 'dry run'}.`);

    let created = 0;
    let skipped = 0;
    for (const [id, objects] of byPackage) {
        const hasZip = objects.includes(packageZipKey(id));
        const contentPrefix = packageContentPrefix(id);
        const hasContent = objects.some((key) => key.startsWith(contentPrefix));
        if (!hasZip && !hasContent) { skipped += 1; continue; }

        if (await ScormPackage.findByPk(id)) {
            console.log(`  skip ${id}: already in the database`);
            skipped += 1;
            continue;
        }

        const meta = await readJson(storage, packageMetaKey(id)) || {};
        const analysis = await readJson(storage, packageContentKey(id, 'content.json'));
        const hasAnalysis = Boolean(analysis && analysis.title && Array.isArray(analysis.slides));
        const title = String(
            (hasAnalysis && analysis.title) || await manifestTitle(storage, id, meta.manifestPath) || `Recovered package ${id.slice(0, 8)}`
        ).slice(0, 200);
        let byteSize = 0;
        if (hasZip) {
            try { byteSize = Number((await storage.headObject(packageZipKey(id))).contentLength) || 0; } catch (_) { /* size is optional */ }
        }
        console.log(`  ${apply ? 'create' : 'would create'} ${id}: "${title}"${hasContent ? '' : ' [no extracted content, will not be launchable]'}`);

        if (!apply) { created += 1; continue; }
        await sequelize.transaction(async (transaction) => {
            const pkg = await ScormPackage.create({
                id,
                hostId: host.id,
                title,
                standard: meta.standard || 'scorm_1_2',
                storageKeyZip: hasZip ? packageZipKey(id) : null,
                storagePrefixContent: hasContent ? contentPrefix : null,
                entryHref: meta.entryHref || null,
                manifestHash: meta.manifestHash || null,
                byteSize: Number.isSafeInteger(byteSize) ? byteSize : 0,
                fileCount: Number(meta.fileCount) || objects.length,
                status: hasContent ? 'ready' : 'failed',
                errorMessage: hasContent ? null : 'Recovered from storage without extracted content.',
                source: hasAnalysis ? 'ai_author' : 'upload',
                analysisJson: hasAnalysis ? JSON.stringify(analysis) : null
            }, { transaction });
            if (hasContent) {
                await ScormCourse.create({
                    hostId: host.id,
                    packageId: pkg.id,
                    title,
                    inviteCode: await createInviteCode(),
                    status: 'draft'
                }, { transaction });
            }
        });
        created += 1;
    }
    console.log(`${apply ? 'Recovered' : 'Would recover'} ${created} package(s); skipped ${skipped}.`);
    if (!apply) console.log('Dry run only. Re-run with RECOVER_APPLY=1 to write these records.');
}

if (require.main === module) {
    main()
        .then(() => sequelize.close())
        .catch(async (err) => {
            console.error(`Recovery failed: ${err.message}`);
            await sequelize.close().catch(() => {});
            process.exit(1);
        });
}

module.exports = { main };
