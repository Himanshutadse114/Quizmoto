export const COURSE_INTERACTION_TEMPLATES = [
  {
    id: 'flip_cards_classic',
    name: 'Flip Cards',
    category: 'Explore',
    phase: 1,
    description: 'Reveal short learning points one card at a time.',
    bestFor: ['Key points', 'Definitions', 'Do and do not guidance'],
    completion: 'Visit all cards',
    previewKind: 'flip',
    recommendedItems: '3–6'
  },
  {
    id: 'interactive_tabs',
    name: 'Interactive Tabs',
    category: 'Explore',
    phase: 2,
    description: 'Explore related concepts without crowding the slide.',
    bestFor: ['Categories', 'Features', 'Warning signs'],
    completion: 'Visit all tabs',
    previewKind: 'tabs',
    recommendedItems: '3–6'
  },
  {
    id: 'accordion',
    name: 'Accordion',
    category: 'Explore',
    phase: 2,
    description: 'Chunk longer explanations into compact expandable sections.',
    bestFor: ['FAQs', 'Policies', 'Detailed guidance'],
    completion: 'Visit all sections',
    previewKind: 'accordion',
    recommendedItems: '3–6'
  },
  {
    id: 'process_tabs',
    name: 'Process Tabs',
    category: 'Explain',
    phase: 2,
    description: 'Move through an ordered process with one focused step at a time.',
    bestFor: ['Procedures', 'Workflows', 'Response steps'],
    completion: 'Visit all steps',
    previewKind: 'process',
    recommendedItems: '3–6'
  },
  {
    id: 'interactive_timeline',
    name: 'Interactive Timeline',
    category: 'Explain',
    phase: 2,
    description: 'Explore chronological events, stages or attack progression.',
    bestFor: ['Journeys', 'Attack stages', 'History'],
    completion: 'Visit all milestones',
    previewKind: 'timeline',
    recommendedItems: '3–6'
  },
  {
    id: 'labelled_graphic',
    name: 'Labelled Graphic',
    category: 'Explore',
    phase: 2,
    description: 'Inspect parts of an image through accessible interactive markers.',
    bestFor: ['Phishing emails', 'Interfaces', 'Workplace scenes'],
    completion: 'Visit all markers',
    previewKind: 'hotspot',
    recommendedItems: '3–8'
  },
  {
    id: 'hotspot_explorer',
    name: 'Hotspot Explorer',
    category: 'Explore',
    phase: 2,
    description: 'Discover hidden risks or learning points inside a visual scene.',
    bestFor: ['Threat spotting', 'Visual audits', 'URL inspection'],
    completion: 'Find all hotspots',
    previewKind: 'hotspot',
    recommendedItems: '3–8'
  },
  {
    id: 'scenario_decision',
    name: 'Scenario Decision',
    category: 'Decide',
    phase: 2,
    description: 'Make a judgement and see immediate consequence-based feedback.',
    bestFor: ['Security decisions', 'Policy choices', 'Social engineering'],
    completion: 'Make a decision',
    previewKind: 'scenario',
    recommendedItems: '2–4 choices'
  },
  {
    id: 'branching_scenario',
    name: 'Branching Scenario',
    category: 'Decide',
    phase: 2,
    description: 'Follow different paths based on learner decisions.',
    bestFor: ['Incident response', 'Money mule scams', 'Manager decisions'],
    completion: 'Reach an ending',
    previewKind: 'branch',
    recommendedItems: '2–3 choices per scene'
  },
  {
    id: 'sorting_activity',
    name: 'Sorting Activity',
    category: 'Practise',
    phase: 2,
    description: 'Classify items into meaningful categories with feedback.',
    bestFor: ['Data classification', 'Safe vs unsafe', 'Threat categories'],
    completion: 'Sort all items',
    previewKind: 'sorting',
    recommendedItems: '4–8'
  },
  {
    id: 'sequence_builder',
    name: 'Sequence Builder',
    category: 'Practise',
    phase: 2,
    description: 'Arrange response actions or process steps in the correct order.',
    bestFor: ['Incident response', 'Escalation', 'Operational procedures'],
    completion: 'Complete sequence',
    previewKind: 'sequence',
    recommendedItems: '4–7'
  },
  {
    id: 'advanced_knowledge_check',
    name: 'Advanced Knowledge Check',
    category: 'Assess',
    phase: 2,
    description: 'Use richer checks with feedback and learner retry states.',
    bestFor: ['Application checks', 'Scenario questions', 'Assessment'],
    completion: 'Submit answer',
    previewKind: 'quiz',
    recommendedItems: '2–4 options'
  }
];

export const COURSE_EXPERIENCE_PROFILES = [
  {
    id: 'auto',
    name: 'Auto — Recommended',
    shortName: 'Auto',
    description: 'AI selects the best interaction for each learning objective.',
    templateIds: ['interactive_tabs', 'process_tabs', 'labelled_graphic', 'scenario_decision', 'sorting_activity', 'advanced_knowledge_check'],
    aiInstruction: 'Choose varied interactions by instructional intent. Avoid repeating the same interaction on consecutive slides.'
  },
  {
    id: 'classic',
    name: 'Classic Editorial',
    shortName: 'Classic',
    description: 'Keep the current Editorial course style and familiar flip-card experience.',
    templateIds: ['flip_cards_classic', 'process_tabs', 'interactive_timeline'],
    aiInstruction: 'Prefer the existing Editorial presentation and restrained interactions.'
  },
  {
    id: 'interactive',
    name: 'Highly Interactive',
    shortName: 'Interactive',
    description: 'Prioritise learner exploration, practice and progressive reveals.',
    templateIds: ['interactive_tabs', 'accordion', 'labelled_graphic', 'hotspot_explorer', 'sorting_activity', 'sequence_builder'],
    aiInstruction: 'Prioritise active exploration and practice. Use interaction variety and progressive disclosure.'
  },
  {
    id: 'scenario',
    name: 'Scenario-led',
    shortName: 'Scenario',
    description: 'Build the course around decisions, consequences and realistic situations.',
    templateIds: ['scenario_decision', 'branching_scenario', 'interactive_timeline', 'advanced_knowledge_check'],
    aiInstruction: 'Prefer realistic workplace scenarios, decisions and consequence-based feedback where the source supports them.'
  },
  {
    id: 'visual',
    name: 'Visual Explorer',
    shortName: 'Visual',
    description: 'Use images, hotspots and visual investigation as the main learning pattern.',
    templateIds: ['labelled_graphic', 'hotspot_explorer', 'interactive_tabs', 'interactive_timeline'],
    aiInstruction: 'Prefer visual investigation, labelled graphics and hotspot-style exploration where appropriate.'
  },
  {
    id: 'assessment',
    name: 'Assessment-led',
    shortName: 'Assess',
    description: 'Use frequent practice and knowledge checks to reinforce the course.',
    templateIds: ['advanced_knowledge_check', 'scenario_decision', 'sorting_activity', 'sequence_builder'],
    aiInstruction: 'Prefer frequent application checks, scenarios and practice activities while keeping explanatory slides concise.'
  }
];

export function templateById(id) {
  return COURSE_INTERACTION_TEMPLATES.find((item) => item.id === id) || COURSE_INTERACTION_TEMPLATES[0];
}

export function profileById(id) {
  return COURSE_EXPERIENCE_PROFILES.find((item) => item.id === id) || COURSE_EXPERIENCE_PROFILES[0];
}

export function templatesForProfile(id) {
  const profile = profileById(id);
  return profile.templateIds.map(templateById);
}
