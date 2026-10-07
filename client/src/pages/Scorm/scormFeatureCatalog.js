export const SCORM_FEATURES = {
  author: {
    id: 'author', label: 'AI Course Author', route: '/scorm/author', category: 'Create',
    short: 'Create complete learning experiences from a brief or source document.',
    description: 'Turn policies, procedures, presentations and learning briefs into editable, trackable courses with AI-assisted structure, visuals and assessments.',
    capabilities: ['Generate a course from a topic, PDF, Word document or PowerPoint', 'Build learning screens, interactions and knowledge checks', 'Choose a learner theme and revise content without starting over', 'Publish a portable SCORM package and learner-ready course']
  },
  awareness: {
    id: 'awareness', label: 'Awareness Emails', route: '/scorm/awareness-templates', category: 'Create',
    short: 'Build and deliver measurable security-awareness email campaigns.',
    description: 'Create branded awareness messages from reusable templates, manage recipients and review engagement from one campaign workspace.',
    capabilities: ['Create reusable security-awareness email templates', 'Personalise messages for a campaign audience', 'Import recipients and manage delivery from one workspace', 'Review delivery and engagement evidence']
  },
  courses: {
    id: 'courses', label: 'Course Management', route: '/scorm/courses', category: 'Deliver',
    short: 'Publish, invite and manage learner-ready courses.',
    description: 'Manage generated and uploaded learning as operational course workspaces with publishing controls, invitations and reusable delivery links.',
    capabilities: ['Manage generated, uploaded and video-based courses', 'Publish courses or keep drafts private while they are reviewed', 'Generate direct learner links and registration access', 'Open course-level learner and assessment activity']
  },
  roster: {
    id: 'roster', label: 'Learner Roster', route: '/scorm/roster', category: 'Deliver',
    short: 'Maintain the approved learner directory for your workspace.',
    description: 'Create a clean learner directory before assigning training, with individual entry and fast bulk administration for larger teams.',
    capabilities: ['Add or remove individual learners by name and email', 'Import CSV or TXT files with Name and Email columns', 'Append to an existing roster or replace it authoritatively', 'Search the roster and reuse learners across assignments']
  },
  campaigns: {
    id: 'campaigns', label: 'Campaigns & Assignments', route: '/scorm/assignments', category: 'Deliver',
    short: 'Assign learning at scale and manage campaign delivery.',
    description: 'Connect courses to learner audiences, schedule delivery and keep campaign operations separate from direct course sharing.',
    capabilities: ['Assign one or many courses to selected learners', 'Create reusable campaign audiences and delivery links', 'Manage campaign status, learners and due dates', 'Open campaign-specific performance and exports']
  },
  visualStudio: {
    id: 'visualStudio', label: 'Content Editor', route: '/scorm/visual-studio', category: 'Create',
    short: 'Refine course content, visuals, hierarchy and learner presentation.',
    description: 'Edit generated learning and control the visual system so courses stay consistent with the intended audience and brand experience.',
    capabilities: ['Edit generated learning copy and knowledge checks', 'Preview learner-facing visual treatments before publishing', 'Adjust themes, hierarchy and screen composition', 'Keep presentation consistent across learning experiences']
  },
  library: {
    id: 'library', label: 'Course Library', route: '/scorm/library', category: 'Create',
    short: 'Import, validate and manage trackable course packages.',
    description: 'Use LMSGEN as a package operations workspace for AI-generated content and compatible third-party learning packages.',
    capabilities: ['Upload and validate SCORM packages from other authoring tools', 'Keep generated and imported packages in one library', 'Inspect launch metadata and package readiness', 'Reuse packages when creating course workspaces']
  },
  tracking: {
    id: 'tracking', label: 'Learner Tracking', route: '/scorm/tracking', category: 'Measure',
    short: 'See progress, score, resume state and learning activity.',
    description: 'Track learners who use published course links or direct assignments, with campaign activity kept in its own focused analytics view.',
    capabilities: ['Track completion, progress, score and last learning location', 'Inspect attempts and resume state for individual learners', 'Review captured question-level interactions', 'Separate direct-learning and campaign performance cleanly']
  },
  reports: {
    id: 'reports', label: 'Reports & Insights', route: '/scorm/reports', category: 'Measure',
    short: 'Turn learning records into completion and assessment evidence.',
    description: 'Review course, learner and campaign evidence without duplicating data across reporting workspaces.',
    capabilities: ['Review course and learner performance summaries', 'Inspect learner answers and correct-answer evidence', 'Open campaign-specific performance reports', 'Export individual learner reports to PDF and Excel']
  },
  quizmoto: {
    id: 'quizmoto', label: 'Quizmoto Live Quiz', route: '/scorm/quizmoto', category: 'Engage',
    short: 'Run live multiplayer quizzes and interactive learning games.',
    description: 'Create question sets, host real-time sessions and review live engagement results inside the same learning platform.',
    capabilities: ['Create quizzes manually or generate question sets with AI', 'Host real-time sessions with a shareable game PIN', 'Use interactive learning games for live engagement', 'Review session results and participant performance']
  },
  publica: {
    id: 'publica', label: 'Publica', route: '/scorm/publica', category: 'Engage', demoAccess: 'open',
    short: 'Turn documents into shareable, measurable digital publications.',
    description: 'Create polished publications, share them through public links and understand how readers engage with the content.',
    capabilities: ['Upload documents and create reader-friendly publications', 'Share publications through secure public links', 'Organise items in a reusable Publica library', 'Review reader sessions and engagement analytics']
  },
  team: {
    id: 'team', label: 'Team & Roles', route: '/scorm/team', category: 'Administer',
    short: 'Give colleagues the right level of workspace access.',
    description: 'Manage tenant staff and separate day-to-day administration from read-only analytics access.',
    capabilities: ['Invite tenant administrators and co-administrators', 'Provide read-only access for analytics stakeholders', 'Enable, disable and review workspace memberships', 'Keep every user inside the correct tenant boundary']
  },
  sso: {
    id: 'sso', label: 'Authentication & SSO', route: '/scorm/learner-access', category: 'Administer',
    short: 'Control learner and staff authentication for your tenant.',
    description: 'Configure how staff and learners enter the platform, including organisation identity providers and learner access policies.',
    capabilities: ['Configure Google or Microsoft organisation sign-in', 'Require tenant staff to use an approved SSO provider', 'Control learner access and authentication policy', 'Keep authentication settings isolated per tenant']
  }
};

export const SCORM_FEATURE_GROUPS = [
  { label: 'Create', ids: ['author', 'awareness', 'visualStudio', 'library'] },
  { label: 'Deliver', ids: ['courses', 'roster', 'campaigns'] },
  { label: 'Measure', ids: ['tracking', 'reports'] },
  { label: 'Engage', ids: ['quizmoto', 'publica'] },
  { label: 'Administer', ids: ['team', 'sso'] }
];

export const SCORM_FEATURE_ORDER = SCORM_FEATURE_GROUPS.flatMap((group) => group.ids);

export function getScormFeature(id) {
  return SCORM_FEATURES[id] || SCORM_FEATURES.author;
}
