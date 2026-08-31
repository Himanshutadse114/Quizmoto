const { normalizeScormRole } = require('./ScormAccessService');

function deny(message = 'This role does not have permission to perform that action.') {
    const err = new Error(message);
    err.status = 403;
    err.code = 'SCORM_ROLE_FORBIDDEN';
    return err;
}

function isAnalyticsReadRoute(url) {
    const path = String(url || '').split('?')[0];
    if (path === '/api/scorm/access/me') return true;
    if (path.startsWith('/api/scorm/tracking')) return true;
    if (path === '/api/scorm/courses/reports/all') return true;
    if (path === '/api/scorm/courses/reports/learner') return true;
    if (/^\/api\/scorm\/courses\/[^/]+\/report$/.test(path)) return true;
    if (path === '/api/scorm/campaigns') return true;
    if (/^\/api\/scorm\/campaigns\/[^/]+\/analytics$/.test(path)) return true;
    return false;
}

function assertScormRouteAllowed({ role, method, url }) {
    const normalizedRole = normalizeScormRole(role);
    if (normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'co_admin') {
        return true;
    }

    if (normalizedRole === 'analytics_viewer') {
        const verb = String(method || 'GET').toUpperCase();
        if ((verb === 'GET' || verb === 'HEAD') && isAnalyticsReadRoute(url)) return true;
        throw deny('Analytics viewers have read-only access to learner tracking and reports.');
    }

    throw deny();
}

module.exports = {
    isAnalyticsReadRoute,
    assertScormRouteAllowed
};
