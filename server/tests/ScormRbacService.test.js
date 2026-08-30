const { expect } = require('chai');
const {
    normalizeScormRole
} = require('../services/scorm/ScormAccessService');
const {
    isAnalyticsReadRoute,
    assertScormRouteAllowed
} = require('../services/scorm/ScormRbacService');

describe('SCORM workspace RBAC', () => {
    it('maps legacy approved user role to workspace admin', () => {
        expect(normalizeScormRole('user')).to.equal('admin');
        expect(normalizeScormRole('admin')).to.equal('admin');
        expect(normalizeScormRole('co_admin')).to.equal('co_admin');
        expect(normalizeScormRole('analytics_viewer')).to.equal('analytics_viewer');
    });

    it('allows analytics viewers to read tracking and reporting endpoints', () => {
        const allowed = [
            '/api/scorm/tracking/summary',
            '/api/scorm/tracking/course/abc',
            '/api/scorm/courses/reports/all',
            '/api/scorm/courses/reports/learner?email=a%40b.com',
            '/api/scorm/courses/abc/report?format=pdf',
            '/api/scorm/access/me'
        ];

        for (const url of allowed) {
            expect(isAnalyticsReadRoute(url), url).to.equal(true);
            expect(() => assertScormRouteAllowed({
                role: 'analytics_viewer',
                method: 'GET',
                url
            })).not.to.throw();
        }
    });

    it('blocks analytics viewers from authoring and mutation endpoints', () => {
        const blocked = [
            ['POST', '/api/scorm/author/generate'],
            ['POST', '/api/scorm/roster'],
            ['DELETE', '/api/scorm/registrations/abc'],
            ['GET', '/api/scorm/library'],
            ['GET', '/api/scorm/courses']
        ];

        for (const [method, url] of blocked) {
            expect(() => assertScormRouteAllowed({
                role: 'analytics_viewer',
                method,
                url
            })).to.throw(/Analytics viewers have read-only access/);
        }
    });

    it('allows admins and co-admins to use normal SCORM workspace routes', () => {
        for (const role of ['admin', 'co_admin', 'super_admin']) {
            expect(() => assertScormRouteAllowed({
                role,
                method: 'POST',
                url: '/api/scorm/author/generate'
            })).not.to.throw();
        }
    });
});
