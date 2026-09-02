export const SCORM_FEATURES = {
  author: {
    id: 'author',
    label: 'AI Course Author',
    short: 'Create complete learning experiences from a brief or source document.',
    description: 'Turn policies, procedures, presentations and learning briefs into editable SCORM courses with AI-assisted structure, visuals and assessments.',
    capabilities: [
      'Generate course structure from a topic, description, PDF or PowerPoint',
      'Edit screens, learning copy, visuals, interactions and knowledge checks',
      'Choose learner themes and rebuild the course without starting over',
      'Publish a standards-based SCORM package and course workspace'
    ]
  },
  courses: {
    id: 'courses',
    label: 'My Courses',
    short: 'Publish, invite and manage learner-ready courses.',
    description: 'Manage generated and uploaded learning as operational course workspaces, with direct learner invitations and reusable delivery links.',
    capabilities: [
      'Create and manage learner-facing course workspaces',
      'Publish or keep courses in draft while content is reviewed',
      'Generate direct learner invite links and registration access',
      'Open direct course-level learner and assessment activity'
    ]
  },
  visualStudio: {
    id: 'visualStudio',
    label: 'Visual Studio',
    short: 'Control learner presentation, hierarchy and visual direction.',
    description: 'Refine the visual system used by AI-generated learning so courses stay consistent with the intended audience and brand experience.',
    capabilities: [
      'Preview learner-facing visual treatments before publishing',
      'Select presentation themes and visual direction',
      'Refine content hierarchy and learning-screen composition',
      'Keep the visual system consistent across generated experiences'
    ]
  },
  library: {
    id: 'library',
    label: 'SCORM Library',
    short: 'Import, validate and manage SCORM packages.',
    description: 'Use LMSGEN as a package operations workspace for both AI-generated content and compatible third-party learning packages.',
    capabilities: [
      'Upload and inspect SCORM packages from other authoring tools',
      'Keep generated and uploaded packages in one managed library',
      'Resolve launch metadata and prepare learner-ready delivery',
      'Reuse packages when creating or maintaining course workspaces'
    ]
  },
  tracking: {
    id: 'tracking',
    label: 'Learner Tracking',
    short: 'See direct learner progress, score, resume state and activity.',
    description: 'Track learners who use published course links or direct course assignments. Campaign learner activity stays in Campaign Analytics so the same learner data is not repeated across modules.',
    capabilities: [
      'Track direct-learning completion, progress, score and last learning location',
      'Inspect attempts and resume state for individual direct learners',
      'Review captured question-level interactions where available',
      'Keep campaign tracking isolated in campaign-specific analytics'
    ]
  },
  reports: {
    id: 'reports',
    label: 'Reports & Insights',
    short: 'Turn learning records into usable completion and assessment evidence.',
    description: 'Review direct course and learner evidence alongside a separate campaign reporting section, without duplicating campaign registrations inside general learner reports.',
    capabilities: [
      'Review direct course and learner performance in the general reporting workspace',
      'Open campaign-specific performance from the dedicated campaign reports section',
      'Inspect question, learner answer and correct-answer evidence when captured',
      'Export individual direct learner reporting to PDF and Excel'
    ]
  }
};

export const SCORM_FEATURE_ORDER = ['author', 'courses', 'visualStudio', 'library', 'tracking', 'reports'];

export function getScormFeature(id) {
  return SCORM_FEATURES[id] || SCORM_FEATURES.author;
}
