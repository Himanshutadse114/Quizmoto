const { ScormCourse, ScormPackage } = require('../../models/scorm');
const { createInviteCode } = require('./ScormInviteService');

async function ensureCourseForPackage({ packageId, hostId, title }) {
    if (!packageId || !hostId) return null;

    let course = await ScormCourse.findOne({
        where: { packageId, hostId },
        order: [['createdAt', 'ASC']]
    });
    if (course && course.status !== 'archived') return course;

    const pkg = await ScormPackage.findOne({ where: { id: packageId, hostId } });
    if (!pkg || pkg.status !== 'ready' || pkg.source !== 'ai_author') return null;

    // AI-authored packages historically navigated to /scorm/courses/:packageId.
    // Reusing the package UUID as the course UUID keeps those existing links
    // recoverable while still preserving the package/course table separation.
    const courseId = String(pkg.id);
    course = await ScormCourse.findOne({ where: { id: courseId, hostId } });
    if (course && course.status !== 'archived') return course;

    const inviteCode = await createInviteCode();
    try {
        return await ScormCourse.create({
            id: courseId,
            hostId,
            packageId: pkg.id,
            title: String(title || pkg.title || 'Untitled course').slice(0, 200),
            description: null,
            inviteCode,
            status: 'draft'
        });
    } catch (err) {
        // Concurrent workspace requests can race immediately after generation.
        // If another request created the deterministic row first, return it.
        const existing = await ScormCourse.findOne({ where: { id: courseId, hostId } });
        if (existing && existing.status !== 'archived') return existing;
        throw err;
    }
}

async function resolveCourseOrPackageId({ id, hostId }) {
    if (!id || !hostId) return null;

    const direct = await ScormCourse.findOne({ where: { id, hostId } });
    if (direct && direct.status !== 'archived') return direct;

    return ensureCourseForPackage({ packageId: id, hostId });
}

module.exports = {
    ensureCourseForPackage,
    resolveCourseOrPackageId
};
