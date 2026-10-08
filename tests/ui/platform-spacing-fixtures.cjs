const identity = { username: 'Spacing audit', email: 'audit@example.com', role: 'super_admin', isSuperAdmin: true, scormAccess: true, platformAccess: true };
const routes = ['/scorm', '/scorm/courses', '/scorm/courses/audit', '/scorm/library', '/scorm/author', '/scorm/visual-studio', '/scorm/presentation/edit/audit', '/scorm/awareness-templates', '/scorm/awareness-templates/campaigns/audit', '/scorm/roster', '/scorm/assignments', '/scorm/campaigns/new', '/scorm/campaigns/audit', '/scorm/campaigns/audit/learners', '/scorm/campaigns/audit/analytics', '/scorm/tracking', '/scorm/reports', '/scorm/quizmoto', '/scorm/quizmoto/create', '/scorm/quizmoto/edit/audit', '/scorm/quizmoto/reports', '/scorm/publica', '/scorm/publica/new', '/scorm/publica/audit/edit', '/scorm/publica/analytics', '/scorm/publica/audit/analytics', '/scorm/settings', '/scorm/team', '/scorm/learner-access', '/scorm/access', '/scorm/access/danger'];
function fixture(path, account = identity) {
  const campaign = { id: 'audit', name: 'Security awareness', status: 'active', learners: [], courses: [], videos: [], publications: [], recipients: [], authMode: 'email_code', portalPath: '/campaign/audit' };
  if (path.endsWith('/auth/scorm/status')) return { ...account, token: 'spacing-fixture' };
  if (path.endsWith('/courses/audit')) return { id: 'audit', title: 'Security essentials', inviteCode: 'audit', packageId: 'audit' };
  if (path.endsWith('/packages/audit/analysis')) return { source: 'presentation_import', analysis: { title: 'Security essentials', courseMode: 'presentation', quiz: { questions: [] } } };
  if (path.endsWith('/quizzes/audit')) return { id: 'audit', title: 'Security quiz', questions: [{ id: 1, questionText: 'Which action is safe?', options: ['Verify', 'Ignore', 'Share', 'Reuse'], correctIndex: 0, timer: 20 }] };
  if (/\/campaigns\/audit\/(summary|manage|analytics)$/.test(path) || path.endsWith('/email-campaigns/audit')) return { campaign, learners: [], courses: [], videos: [], publicationEntries: [] };
  if (path.includes('/flipbooks/library')) return { library: { title: 'Audit publications', books: [], bookCount: 0, enabled: false } };
  if (path.endsWith('/flipbooks/audit')) return { flipbook: { id: 'audit', title: 'Audit publication', pageCount: 0, pages: [] } };
  if (path.endsWith('/flipbooks')) return { flipbooks: [], quota: { max: 2, used: 0 } };
  if (/\/(courses|packages|quizzes)$/.test(path) || path.endsWith('/courses/reports/all')) return [];
  return { users: [], members: [], tenants: [], roster: [], groups: [], courses: [], packages: [], templates: [], campaigns: [], learners: [], sessions: [], reports: [], jobs: [], activeSessions: [], summary: {}, overview: {}, config: {}, features: {}, settings: {}, data: [] };
}
async function workspace(page, theme = 'dark', account = identity) {
  await page.addInitScript(({ account, theme }) => {
    localStorage.setItem('token', 'spacing-fixture');
    localStorage.setItem('user', JSON.stringify(account));
    localStorage.setItem('scormAccessGranted', account.scormAccess ? '1' : '0');
    localStorage.setItem('scormPlatformAccess', '1');
    localStorage.setItem('quizmoto_scorm_platform_theme', theme);
  }, { account, theme });
  await page.route('**/api/**', route => route.fulfill({ json: fixture(new URL(route.request().url()).pathname, account) }));
}
module.exports = { identity, routes, fixture, workspace };
