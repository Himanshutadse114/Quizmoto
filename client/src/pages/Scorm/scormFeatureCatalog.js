export const SCORM_FEATURES = {
  author: {
    id: 'author', label: 'AI Course Author', route: '/scorm/author', category: 'Create',
    short: 'Create complete learning experiences from a brief or source document.',
    description: 'Turn policies, procedures, presentations and learning briefs into editable, trackable courses with AI-assisted structure, visuals and assessments.',
    capabilities: ['Generate a course from a topic, PDF, Word document or PowerPoint', 'Build learning screens, interactions and knowledge checks', 'Choose a learner theme and revise content without starting over', 'Publish a portable SCORM package and learner-ready course'],
    workflow: [
      ['Provide the source', 'Start with a topic, learning brief or source document and define the audience, tone and course length.'],
      ['Review the draft', 'Check the proposed structure, edit learner-facing content and refine the generated knowledge checks.'],
      ['Generate and publish', 'Build the trackable package, preview the learner experience and publish or download it for delivery.']
    ],
    outcomes: ['A structured course draft in minutes', 'Editable content instead of a fixed AI output', 'Portable tracking-ready course packages'],
    bestFor: ['L&D teams', 'Policy training', 'Subject-matter experts']
  },
  awareness: {
    id: 'awareness', label: 'Awareness Emails', route: '/scorm/awareness-templates', category: 'Create',
    short: 'Build and deliver measurable security-awareness email campaigns.',
    description: 'Create branded awareness messages from reusable templates, manage recipients and review engagement from one campaign workspace.',
    capabilities: ['Create reusable security-awareness email templates', 'Personalise messages for a campaign audience', 'Import recipients and manage delivery from one workspace', 'Review delivery and engagement evidence'],
    workflow: [
      ['Choose a template', 'Start from the curated awareness library and add an approved design to your tenant workspace.'],
      ['Tailor the campaign', 'Edit the message, branding and audience while keeping the reusable source template unchanged.'],
      ['Deliver and review', 'Send or export the campaign and inspect delivery and engagement evidence from its detail view.']
    ],
    outcomes: ['Consistent security communication', 'Reusable branded campaign assets', 'Measurable delivery evidence'],
    bestFor: ['Security teams', 'Internal communications', 'Awareness programmes']
  },
  courses: {
    id: 'courses', label: 'Course Management', route: '/scorm/courses', category: 'Deliver',
    short: 'Publish, invite and manage learner-ready courses.',
    description: 'Manage generated and uploaded learning as operational course workspaces with publishing controls, invitations and reusable delivery links.',
    capabilities: ['Manage generated, uploaded and video-based courses', 'Publish courses or keep drafts private while they are reviewed', 'Generate direct learner links and registration access', 'Open course-level learner and assessment activity'],
    workflow: [
      ['Add learning content', 'Use an LMSGEN-generated package, upload a compatible package or create a tracked video course.'],
      ['Prepare delivery', 'Review the course, control draft or published status and configure its learner entry point.'],
      ['Share and manage', 'Distribute the invite link, manage registrations and open course-level learning activity.']
    ],
    outcomes: ['One operational home for every course', 'Controlled publishing and learner access', 'Course activity connected to the source content'],
    bestFor: ['Training administrators', 'Compliance delivery', 'Course owners']
  },
  roster: {
    id: 'roster', label: 'Learner Roster', route: '/scorm/roster', category: 'Deliver',
    short: 'Maintain the approved learner directory for your workspace.',
    description: 'Create a clean learner directory before assigning training, with individual entry and fast bulk administration for larger teams.',
    capabilities: ['Add or remove individual learners by name and email', 'Import CSV or TXT files with Name and Email columns', 'Append to an existing roster or replace it authoritatively', 'Search the roster and reuse learners across assignments'],
    workflow: [
      ['Add or import', 'Enter one learner manually or import CSV/TXT data using name and email columns in common arrangements.'],
      ['Clean the directory', 'Normalise email addresses, skip invalid rows, remove duplicates and choose append or replace behaviour.'],
      ['Reuse the audience', 'Search the approved directory and select the same learners when building future assignments.']
    ],
    outcomes: ['Faster bulk learner onboarding', 'A clean reusable learner directory', 'Less repeated data entry for campaigns'],
    bestFor: ['HR operations', 'Training coordinators', 'Large learner groups']
  },
  campaigns: {
    id: 'campaigns', label: 'Campaigns & Assignments', route: '/scorm/assignments', category: 'Deliver',
    short: 'Assign learning at scale and manage campaign delivery.',
    description: 'Connect courses to learner audiences, schedule delivery and keep campaign operations separate from direct course sharing.',
    capabilities: ['Assign one or many courses to selected learners', 'Create reusable campaign audiences and delivery links', 'Manage campaign status, learners and due dates', 'Open campaign-specific performance and exports'],
    workflow: [
      ['Define the campaign', 'Choose the learning, name the initiative and set its delivery window or due-date expectations.'],
      ['Select the audience', 'Use the learner roster to assign one or multiple courses to the right people at once.'],
      ['Launch and follow up', 'Share campaign access, adjust membership and open campaign-specific progress and exports.']
    ],
    outcomes: ['Repeatable training rollouts', 'Clear audience and due-date ownership', 'Campaign-level evidence separated from direct learning'],
    bestFor: ['Mandatory training', 'Cohort programmes', 'Organisation-wide rollouts']
  },
  visualStudio: {
    id: 'visualStudio', label: 'Content Editor', route: '/scorm/visual-studio', category: 'Create',
    short: 'Refine course content, visuals, hierarchy and learner presentation.',
    description: 'Open an existing AI-generated or presentation-based course, revise what learners see and rebuild the same package. Update copy, questions, slides, logos or colour themes while preserving the course identity, delivery links and connected tracking workspace.',
    capabilities: ['Revise generated learning copy, structure and knowledge checks', 'Replace a presentation PDF or update its logo and generated end quiz', 'Apply and preview learner-facing colour themes before rebuilding', 'Rebuild the existing package while preserving its course workspace'],
    workflow: [
      ['Select an existing course', 'Choose a ready AI-generated course or tracked presentation from the content workspace.'],
      ['Make focused revisions', 'Edit learner-visible content and questions, change the theme, or replace presentation slides and branding.'],
      ['Rebuild in place', 'Generate the revised package under the same course so its invite link and tracking context remain stable.']
    ],
    outcomes: ['Brand-consistent learner experiences', 'Faster review and correction cycles', 'No need to recreate delivery after every revision'],
    bestFor: ['Course reviewers', 'Brand teams', 'Learning designers']
  },
  library: {
    id: 'library', label: 'Course Library', route: '/scorm/library', category: 'Create',
    short: 'Import, validate and manage trackable course packages.',
    description: 'Use LMSGEN as a package operations workspace for AI-generated content and compatible third-party learning packages.',
    capabilities: ['Upload and validate SCORM packages from other authoring tools', 'Keep generated and imported packages in one library', 'Inspect launch metadata and package readiness', 'Reuse packages when creating course workspaces'],
    workflow: [
      ['Add a package', 'Upload a compatible SCORM ZIP or receive a package produced by the AI author and presentation workflow.'],
      ['Validate readiness', 'Inspect processing status, launch metadata and validation feedback before using the package.'],
      ['Reuse or export', 'Create course workspaces from approved packages or download portable packages for another compatible LMS.']
    ],
    outcomes: ['One governed package repository', 'Problems found before learner launch', 'Reusable content across delivery contexts'],
    bestFor: ['LMS administrators', 'Content operations', 'SCORM migrations']
  },
  tracking: {
    id: 'tracking', label: 'Learner Tracking', route: '/scorm/tracking', category: 'Measure',
    short: 'See progress, score, resume state and learning activity.',
    description: 'Track learners who use published course links or direct assignments, with campaign activity kept in its own focused analytics view.',
    capabilities: ['Track completion, progress, score and last learning location', 'Inspect attempts and resume state for individual learners', 'Review captured question-level interactions', 'Separate direct-learning and campaign performance cleanly'],
    workflow: [
      ['Capture learning activity', 'Published courses record runtime progress, completion, scores, attempts and resume information.'],
      ['Filter the evidence', 'Move between course, learner, direct-learning and campaign views without mixing delivery contexts.'],
      ['Investigate details', 'Open an individual learner record to review timeline, state and question-level interactions.']
    ],
    outcomes: ['Current completion visibility', 'Defensible learner-level audit trails', 'Clear separation of direct and campaign learning'],
    bestFor: ['Training operations', 'Compliance teams', 'Learner support']
  },
  reports: {
    id: 'reports', label: 'Reports & Insights', route: '/scorm/reports', category: 'Measure',
    short: 'Turn learning records into completion and assessment evidence.',
    description: 'Review course, learner and campaign evidence without duplicating data across reporting workspaces.',
    capabilities: ['Review course and learner performance summaries', 'Inspect learner answers and correct-answer evidence', 'Open campaign-specific performance reports', 'Export individual learner reports to PDF and Excel'],
    workflow: [
      ['Choose the reporting scope', 'Review platform, course, campaign or individual learner performance from the appropriate workspace.'],
      ['Inspect the evidence', 'Compare completion, scores, attempts and captured answers with the correct-answer context.'],
      ['Share the result', 'Export learner-level evidence to PDF or Excel for stakeholders and audit records.']
    ],
    outcomes: ['Decision-ready learning summaries', 'Detailed assessment evidence', 'Portable stakeholder and audit reports'],
    bestFor: ['Compliance reporting', 'Programme managers', 'Business stakeholders']
  },
  quizmoto: {
    id: 'quizmoto', label: 'Quizmoto Live Quiz', route: '/scorm/quizmoto', category: 'Engage',
    short: 'Run live multiplayer quizzes and interactive learning games.',
    description: 'Create question sets, host real-time sessions and review live engagement results inside the same learning platform.',
    capabilities: ['Create quizzes manually or generate question sets with AI', 'Host real-time sessions with a shareable game PIN', 'Use interactive learning games for live engagement', 'Review session results and participant performance'],
    workflow: [
      ['Build the quiz', 'Write questions manually or use AI assistance to turn a topic into an editable question set.'],
      ['Host the session', 'Launch a live lobby and let participants join from their devices with a shareable game PIN.'],
      ['Review engagement', 'Run interactive rounds, show live feedback and inspect participant results after the session.']
    ],
    outcomes: ['Active participation during training', 'Immediate knowledge feedback', 'Session-level engagement evidence'],
    bestFor: ['Instructor-led training', 'Team events', 'Knowledge reinforcement']
  },
  publica: {
    id: 'publica', label: 'Publica', route: '/scorm/publica', category: 'Engage', demoAccess: 'open',
    short: 'Turn documents into shareable, measurable digital publications.',
    description: 'Create polished publications, share them through public links and understand how readers engage with the content.',
    capabilities: ['Upload documents and create reader-friendly publications', 'Share publications through secure public links', 'Organise items in a reusable Publica library', 'Review reader sessions and engagement analytics'],
    workflow: [
      ['Create the publication', 'Upload the source document and prepare a responsive, reader-friendly digital edition.'],
      ['Publish and share', 'Control its public state and distribute the generated reading link to the intended audience.'],
      ['Understand readership', 'Review reader sessions and engagement analytics from the Publica workspace.']
    ],
    outcomes: ['Polished web-based publications', 'Simple link-based distribution', 'Visibility into reader engagement'],
    bestFor: ['Guides and handbooks', 'Customer education', 'Internal publications']
  },
  team: {
    id: 'team', label: 'Team & Roles', route: '/scorm/team', category: 'Administer',
    short: 'Give colleagues the right level of workspace access.',
    description: 'Manage tenant staff and separate day-to-day administration from read-only analytics access.',
    capabilities: ['Invite tenant administrators and co-administrators', 'Provide read-only access for analytics stakeholders', 'Enable, disable and review workspace memberships', 'Keep every user inside the correct tenant boundary'],
    workflow: [
      ['Invite a colleague', 'Add a verified staff identity to the current tenant rather than sharing administrator credentials.'],
      ['Assign the right role', 'Choose tenant administration, co-administration or read-only analytics access.'],
      ['Maintain access', 'Review membership status and disable access when a person no longer needs the workspace.']
    ],
    outcomes: ['Clear separation of responsibilities', 'Safer collaborative administration', 'Tenant-contained staff access'],
    bestFor: ['Tenant owners', 'Distributed admin teams', 'Analytics stakeholders']
  },
  sso: {
    id: 'sso', label: 'Authentication & SSO', route: '/scorm/learner-access', category: 'Administer',
    short: 'Control learner and staff authentication for your tenant.',
    description: 'Configure how staff and learners enter the platform, including organisation identity providers and learner access policies.',
    capabilities: ['Configure Google or Microsoft organisation sign-in', 'Require tenant staff to use an approved SSO provider', 'Control learner access and authentication policy', 'Keep authentication settings isolated per tenant'],
    workflow: [
      ['Connect identity', 'Configure the supported Google or Microsoft organisation provider for the tenant.'],
      ['Set the policy', 'Choose how staff and learners authenticate and whether organisation sign-in is mandatory.'],
      ['Enforce at entry', 'Apply the tenant policy during login while keeping other tenants and public learner flows isolated.']
    ],
    outcomes: ['Organisation-controlled sign-in', 'Consistent staff and learner access rules', 'Authentication isolated by tenant'],
    bestFor: ['IT administrators', 'Enterprise tenants', 'Controlled learner access']
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
