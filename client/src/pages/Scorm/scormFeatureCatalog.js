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
    description: 'Manage generated and uploaded learning as operational course workspaces, with learner invitations and reusable delivery links.',
    capabilities: [
      'Create and manage learner-facing course workspaces',
      'Publish or keep courses in draft while content is reviewed',
      'Generate learner invite links and registration access',
      'Open course-level learner and assessment activity'
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
    description: 'Use SCORM AI as a package operations workspace for both AI-generated content and compatible third-party learning packages.',
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
    short: 'See progress, score, resume state and learner activity.',
    description: 'Follow learner progress without digging through raw runtime data, with course and learner views built from captured SCORM state.',
    capabilities: [
      'Track completion, progress, score and last learning location',
      'Inspect attempts and resume state for individual learners',
      'Review captured question-level interactions where available',
      'Search learners and open a detailed learning audit trail'
    ]
  },
  reports: {
    id: 'reports',
    label: 'Reports & Insights',
    short: 'Turn learning records into usable completion and assessment evidence.',
    description: 'Create management-ready reporting from learner progress and assessment evidence, including individual learner detail.',
    capabilities: [
      'Review course and learner performance from one reporting workspace',
      'Inspect question, learner answer and correct-answer evidence when captured',
      'Export individual learner reporting to PDF and Excel',
      'Use assessment evidence to identify learning and remediation needs'
    ]
  }
};

export const SCORM_FEATURE_ORDER = ['author', 'courses', 'visualStudio', 'library', 'tracking', 'reports'];

export function getScormFeature(id) {
  return SCORM_FEATURES[id] || SCORM_FEATURES.author;
}
