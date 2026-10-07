// Mocha root setup — loaded via --require (see .mocharc.json) BEFORE any test
// file, so modules that read environment variables once at load time see a
// configured test identity. Individual test files must not rely on load order.
if (!process.env.SCORM_SUPER_ADMIN_EMAIL) {
    process.env.SCORM_SUPER_ADMIN_EMAIL = 'superadmin@example.com';
}
