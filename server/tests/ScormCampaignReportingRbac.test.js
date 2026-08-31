const assert = require('assert');
const {
    isAnalyticsReadRoute,
    assertScormRouteAllowed
} = require('../services/scorm/ScormRbacService');

describe('SCORM campaign reporting RBAC', () => {
    it('allows analytics viewers to list campaigns and read campaign analytics', () => {
        assert.strictEqual(isAnalyticsReadRoute('/api/scorm/campaigns'), true);
        assert.strictEqual(isAnalyticsReadRoute('/api/scorm/campaigns/abc-123/analytics'), true);
        assert.strictEqual(
            assertScormRouteAllowed({ role: 'analytics_viewer', method: 'GET', url: '/api/scorm/campaigns/abc-123/analytics' }),
            true
        );
    });

    it('keeps campaign mutation endpoints blocked for analytics viewers', () => {
        assert.throws(
            () => assertScormRouteAllowed({ role: 'analytics_viewer', method: 'POST', url: '/api/scorm/campaigns/abc-123/start' }),
            (err) => err && err.code === 'SCORM_ROLE_FORBIDDEN'
        );
        assert.throws(
            () => assertScormRouteAllowed({ role: 'analytics_viewer', method: 'DELETE', url: '/api/scorm/campaigns/abc-123' }),
            (err) => err && err.code === 'SCORM_ROLE_FORBIDDEN'
        );
    });
});
