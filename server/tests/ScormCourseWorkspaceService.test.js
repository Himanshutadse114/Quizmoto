const { expect } = require('chai');
const { ScormCourse, ScormPackage } = require('../models/scorm');
const {
    ensureCourseForPackage,
    resolveCourseOrPackageId
} = require('../services/scorm/ScormCourseWorkspaceService');

describe('ScormCourseWorkspaceService', () => {
    const originalCourseFindOne = ScormCourse.findOne;
    const originalCourseCreate = ScormCourse.create;
    const originalPackageFindOne = ScormPackage.findOne;

    afterEach(() => {
        ScormCourse.findOne = originalCourseFindOne;
        ScormCourse.create = originalCourseCreate;
        ScormPackage.findOne = originalPackageFindOne;
    });

    it('creates a deterministic course workspace for a ready AI package', async () => {
        const packageId = '577fc3ae-7081-45b5-91fe-de190a380e39';
        const hostId = 42;
        const createdRows = [];

        ScormCourse.findOne = async ({ where }) => {
            if (where?.inviteCode) return null;
            return null;
        };
        ScormPackage.findOne = async ({ where }) => {
            expect(where).to.deep.equal({ id: packageId, hostId });
            return { id: packageId, title: 'Generated security course', status: 'ready' };
        };
        ScormCourse.create = async (values) => {
            createdRows.push(values);
            return { ...values };
        };

        const course = await ensureCourseForPackage({ packageId, hostId });

        expect(course.id).to.equal(packageId);
        expect(course.packageId).to.equal(packageId);
        expect(course.hostId).to.equal(hostId);
        expect(course.status).to.equal('draft');
        expect(course.title).to.equal('Generated security course');
        expect(createdRows).to.have.length(1);
    });

    it('reuses an existing workspace instead of creating a duplicate', async () => {
        const existing = {
            id: 'course-1',
            packageId: 'package-1',
            hostId: 7,
            status: 'draft'
        };
        let creates = 0;

        ScormCourse.findOne = async ({ where }) => {
            if (where?.packageId === 'package-1') return existing;
            return null;
        };
        ScormPackage.findOne = async () => {
            throw new Error('package lookup should not be needed');
        };
        ScormCourse.create = async () => {
            creates += 1;
            return null;
        };

        const course = await ensureCourseForPackage({ packageId: 'package-1', hostId: 7 });
        expect(course).to.equal(existing);
        expect(creates).to.equal(0);
    });

    it('resolves a package id into a newly materialized workspace', async () => {
        const packageId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
        const hostId = 8;
        let created = null;

        ScormCourse.findOne = async ({ where }) => {
            if (where?.inviteCode) return null;
            if (created && (where?.id === created.id || where?.packageId === created.packageId)) return created;
            return null;
        };
        ScormPackage.findOne = async () => ({ id: packageId, title: 'Recovered course', status: 'ready' });
        ScormCourse.create = async (values) => {
            created = { ...values };
            return created;
        };

        const course = await resolveCourseOrPackageId({ id: packageId, hostId });
        expect(course.id).to.equal(packageId);
        expect(course.packageId).to.equal(packageId);
        expect(course.title).to.equal('Recovered course');
    });

    it('does not create a workspace for a package that is not ready', async () => {
        let creates = 0;
        ScormCourse.findOne = async () => null;
        ScormPackage.findOne = async () => ({ id: 'pkg', title: 'Broken', status: 'error' });
        ScormCourse.create = async () => { creates += 1; };

        const course = await ensureCourseForPackage({ packageId: 'pkg', hostId: 9 });
        expect(course).to.equal(null);
        expect(creates).to.equal(0);
    });
});
