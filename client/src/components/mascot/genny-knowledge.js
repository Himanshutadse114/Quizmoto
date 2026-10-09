import { SCORM_FEATURES } from '../../pages/Scorm/scormFeatureCatalog.js';

// Grounded in the route gates, module screens and canonical feature catalog.
// No model calls, tenant records, input values or learner data are collected.
const COPY = {
  author: ['From blank page to learning journey.', 'Give AI a topic or document. Review the draft, then build your trackable course.', ['create a course', 'ai course studio', 'ai course author', 'trackable course author', 'ai authoring', 'aiauthoring', 'ai course authoring', 'ai + human control', 'create training faster with ai', 'faster course creation', 'create with ai in minutes', 'clear the course creation backlog']],
  awareness: ['Small emails. Big awareness.', 'Choose a template, personalise it, then deliver or export your awareness campaign.', ['awareness emails', 'template gallery', 'my library', 'email campaigns', 'central library manager']],
  courses: ['Ready content meets real learners.', 'Publish a course, share its invite link and see how learners progress.', ['my courses', 'demo course', 'course management', 'learner progress', 'admin preview results', 'your demo learning activity', 'trackable courses', 'trackable delivery', 'ready totrack']],
  roster: ['A clean audience is a strong start.', 'Add one learner or import a CSV. Append adds people; Replace makes your list authoritative.', ['learner roster', 'approved learner roster', 'add one learner', 'import learner csv', 'learner management']],
  campaigns: ['One rollout. Everyone on track.', 'Choose courses, select learners, set due dates and follow campaign-specific progress.', ['campaigns', 'campaign workspace', 'campaigns & assignments', 'campaign learners', 'run learning campaigns without spreadsheet admin']],
  visualStudio: ['Polish the course, keep the connection.', 'Revise supported course copy, questions or themes, then rebuild the existing package.', ['content editor', 'course content editor', 'choose a colour theme']],
  library: ['Upload once. Deliver with confidence.', 'Import a SCORM ZIP, check its readiness, then create a course from the package.', ['course library', 'available packages', 'package inventory', 'upload scorm', 'central learning library']],
  tracking: ['Progress is more than a tick.', 'Inspect completion, score, time and resume state. Evidence depends on what the course reports.', ['learner tracking', 'direct progress', 'last location', 'course state']],
  reports: ['Turn activity into evidence.', 'Compare course, learner and campaign results. Export the evidence you need.', ['reports & insights', 'reports & analytics', 'platform reports', 'learner analytics', 'course analytics', 'campaign performance', 'learning analytics', 'track progress with clear analytics']],
  quizmoto: ['Make learning a live moment.', 'Create a quiz, host a lobby and let players join with a PIN or link.', ['quizmoto', 'quizmoto live quiz', 'quiz library', 'active sessions', 'live quizmoto', 'quizmoto, built in.', 'quizmoto engagement', 'engage learners with quizmoto', 'quizmoto is lmsgen’s live quiz engine']],
  publica: ['Your document deserves an audience.', 'Turn a PDF or images into a flipbook. Publish, share and understand reader engagement.', ['publica', 'lmsgen publica', 'create publication', 'shared publica library', 'library analytics', 'publish beautifully. build an audience. know what keeps them reading.']],
  team: ['The right people. The right powers.', 'Invite staff and choose their roles. Keep administration separate from read-only analytics.', ['team & roles', 'team and roles', 'admin & access', 'admin & access controls']],
  sso: ['One workspace. Clear entry rules.', 'Configure staff and learner sign-in separately, including organisation Google or Microsoft access.', ['authentication & sso', 'workspace access links', 'staff / admin login link', 'learner portal link', 'admin & team sign-in', 'learner sign-in']],
};

export const GENNY_TOPICS = [
  { id: 'overview', label: 'Platform Overview', route: '/scorm', punch: 'Create. Deliver. Measure.', explanation: 'Your workspace connects courses, publications, live quizzes, learners and evidence. Start with a tour or jump to a module.', aliases: ['overview', 'platform overview', 'explore the lmsgen platform', 'everything you need to run modern learning'], steps: [['Create', 'Generate a course, import SCORM or prepare a publication.'], ['Deliver', 'Share learning directly or organise a campaign.'], ['Measure', 'Review the evidence captured by each learning experience.']] },
  ...Object.values(SCORM_FEATURES).map((feature) => ({
    ...feature, ...Object.fromEntries(['punch', 'explanation', 'aliases'].map((key, index) => [key, COPY[feature.id][index]])),
    steps: feature.workflow,
  })),
  { id: 'settings', label: 'Account Settings', route: '/scorm/settings', punch: 'Make your workspace feel like you.', explanation: 'Update your display name, avatar and shared Publica library title. Your account email remains your identity.', aliases: ['settings', 'your account', 'profile', 'personal settings', 'library name'], steps: [['Profile', 'Choose your display name and avatar.'], ['Library', 'Set the title readers see on your shared Publica library.'], ['Save', 'Review changes before saving your account settings.']] },
  { id: 'tenants', label: 'Tenant Management', route: '/scorm/access', punch: 'One platform. Separate workspaces.', explanation: 'Super admins manage tenant access, staff and allowances. Changes can affect other accounts: review the target tenant first.', aliases: ['tenant management', 'tenants', 'user publica limits'], adminOnly: true, steps: [['Choose a tenant', 'Verify the account or workspace you intend to manage.'], ['Review access', 'Inspect its staff, status and configured allowances.'], ['Change deliberately', 'Save only the tenant settings you intend to update.']] },
  { id: 'danger', label: 'Danger Zone', route: '/scorm/access/danger', punch: 'Pause. Verify. Then decide.', explanation: 'Platform-wide deletion can remove content and stored files across tenants. Genny never runs it. Read the scope and confirmation carefully.', aliases: ['danger zone', 'platform content purge'], adminOnly: true, excludeFromTour: true, steps: [['Check scope', 'Understand exactly which records and files the operation targets.'], ['Protect your data', 'Verify backups and any retention requirements first.'], ['Explicit confirmation', 'Only the authorised super admin can decide to proceed.']] },
];

const TOUR_ORDER = ['overview', 'author', 'library', 'courses', 'roster', 'campaigns', 'quizmoto', 'publica', 'awareness', 'visualStudio', 'tracking', 'reports', 'team', 'sso', 'settings', 'tenants'];
const MARKETING_ANCHORS = { 'ai-course-authoring': 'author', 'quizmoto-engagement': 'quizmoto', 'scorm-ready-delivery': 'courses', 'learner-management': 'roster', 'learning-analytics': 'reports', 'central-learning-library': 'library', 'ai-human-control': 'author', 'admin-access': 'team' };
export function normaliseTopicText(value = '') { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

export function topicForPath(pathname = '') {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (path.startsWith('/scorm/campaigns')) return GENNY_TOPICS.find((topic) => topic.id === 'campaigns');
  if (path.startsWith('/scorm/presentation/') || path === '/scorm/videos') return GENNY_TOPICS.find((topic) => topic.id === 'author');
  return [...GENNY_TOPICS].sort((a, b) => b.route.length - a.route.length).find((topic) => path === topic.route || (topic.route !== '/scorm' && path.startsWith(`${topic.route}/`)));
}

export function topicsForAccess({ allowedRoutes, isSuperAdmin = false } = {}) {
  return GENNY_TOPICS.filter((topic) => (!topic.adminOnly || isSuperAdmin) && (!allowedRoutes || allowedRoutes.includes(topic.route)));
}
export function tourForAccess(context) {
  const available = topicsForAccess(context);
  return TOUR_ORDER.map((id) => available.find((topic) => topic.id === id)).filter(Boolean);
}
export function searchTopics(query, topics = GENNY_TOPICS) {
  const words = normaliseTopicText(query).split(' ').filter(Boolean);
  if (!words.length) return topics;
  return topics.map((topic) => {
    const title = normaliseTopicText(`${topic.label} ${topic.aliases.join(' ')}`);
    const body = normaliseTopicText(`${topic.explanation} ${(topic.capabilities || []).join(' ')} ${topic.steps.flat().join(' ')} ${topic.searchDetail || ''}`);
    return { topic, score: words.reduce((sum, word) => sum + (title.includes(word) ? 3 : body.includes(word) ? 1 : 0), 0) };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ topic }) => topic);
}

// Only public, explicit UI labels are matched; do not turn arbitrary course,
// publication or learner text into supposed feature documentation.
export function topicForElement(element, topics = GENNY_TOPICS) {
  const target = element?.closest?.('[data-genny-topic], a[href], h1, h2, h3');
  if (!target || target.closest('.lmsgen-mascot, .genny-guide')) return null;
  const explicit = target.getAttribute('data-genny-topic');
  if (explicit) return topics.find((topic) => topic.id === explicit) || null;
  const href = target.getAttribute('href');
  if (href?.startsWith('/solutions#')) return topics.find((topic) => topic.id === MARKETING_ANCHORS[href.split('#')[1]]) || null;
  if (href?.startsWith('/scorm')) {
    const topic = topicForPath(href);
    return topics.find((item) => item.id === topic?.id) || null;
  }
  const label = normaliseTopicText(target.textContent || '');
  return topics.find((topic) => [topic.label, ...topic.aliases].some((alias) => normaliseTopicText(alias) === label)) || null;
}

export const GENNY_ACTION_TIPS = {
  'roster:replace': 'Replace means this import becomes the roster. Review the file first—existing entries may be removed.',
  'roster:append': 'Keep your existing roster and add the new learners from this import.',
  'roster:download template': 'Start with the supported CSV columns. Fill in your learners, then import the file.',
  'publica:copy library link': 'One link shares your published library. Unpublished items stay out of the public collection.',
  'library:create course': 'Turn this ready package into a course workspace you can publish and share.',
  'courses:publish': 'Publishing makes the course available through its learner entry point. Preview and review first.',
  'reports:export': 'Choose the reporting scope before exporting. Genny does not generate or send reports for you.',
};

export function actionTipForElement(element, currentTopic) {
  const target = element?.closest?.('button, [data-genny-tip]');
  if (!target || target.closest('.lmsgen-mascot, .genny-guide')) return null;
  const key = `${currentTopic?.id}:${normaliseTopicText(target.getAttribute('data-genny-tip') || target.textContent || '')}`;
  return GENNY_ACTION_TIPS[key] || null;
}
