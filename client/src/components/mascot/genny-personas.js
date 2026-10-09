import { topicsForAccess } from './genny-knowledge.js';

// Same verified product, two jobs. Visitors need benefits and discovery;
// signed-in users need role-aware instructions for their current workspace.
export const GENNY_PERSONAS = {
  website: {
    eyebrow: 'YOUR PRODUCT EXPLORER', title: 'Explore with Genny', launcher: 'Explore with Genny',
    intro: 'Tell me what you want to achieve. I’ll connect the features, explain the benefits and help you explore the demo.',
    tour: 'Take a product tour', search: 'Explore a feature', placeholder: 'Try: AI courses, PDFs, live quizzes…',
    greeting: 'Hi, I’m Genny! Tap me to discover what LMSGEN can do for your team.',
    complete: 'That’s the big picture! Open the demo to explore the modules for yourself.',
    body: '#0aa184', eyes: '#111316',
  },
  platform: {
    eyebrow: 'YOUR WORKSPACE COACH', title: 'Work with Genny', launcher: 'Genny workspace guide',
    intro: 'Let’s get the next step right. Explore this page, follow a workflow or check what your demo account can try.',
    tour: 'Start / resume tour', search: 'Find a workflow', placeholder: 'Try: CSV, publish, quizzes, reports…',
    greeting: 'I’m your workspace Genny. Tap me for page-specific steps, demo access and practical examples.',
    complete: 'Tour complete! Pick a module and put your next step into action.',
    body: '#0aa184', eyes: '#111316',
  },
};

const WEBSITE_COPY = {
  overview: ['Less tool-hopping. More learning.', 'LMSGEN connects course creation, learner delivery, live quizzes and digital publications. Explore the product here; the workspace guide will explain the hands-on steps after sign-in.'],
  author: ['Turn your expertise into training.', 'Start from a topic or source document, review the AI draft and shape a trackable learning experience. AI helps with the first draft; your team stays in control of the final course.'],
  library: ['Your existing SCORM content belongs here.', 'Bring a SCORM ZIP into the central library and use it to deliver a course. You can explore the same delivery workflow without recreating your existing training.'],
  courses: ['A course is only the beginning.', 'Connect ready learning to real learners through published course links and assignments. The default demo course lets you experience learner playback when one is configured.'],
  roster: ['Reach the right learners.', 'Organise the approved learner audience individually or with CSV import. Pair the roster with assignments to move from a contact list to a training rollout.'],
  campaigns: ['Make a rollout feel organised.', 'Bring courses, learners and due dates together in a campaign. Campaign-specific progress helps your team understand how that particular rollout is going.'],
  visualStudio: ['AI creates. Your team refines.', 'Edit supported learning copy, knowledge checks and course themes before publishing. Keep the human review step in the creation process.'],
  tracking: ['See what learning actually reports.', 'Follow completion, score, time and resume position when the course sends that information. Tracking gives evidence of activity—not a guarantee that every package reports every metric.'],
  reports: ['Make the learning story visible.', 'Explore reporting across courses, learners and campaigns, then export the evidence your team needs. Start with the question you want the report to answer.'],
  quizmoto: ['Bring the room into the lesson.', 'Quizmoto is the live quiz experience: a host opens a lobby and players join by code or link. It complements self-paced courses; hosting remains locked until the tenant is activated.'],
  publica: ['Give your PDFs a better front door.', 'Publica turns PDFs or images into shareable flipbooks with reader engagement analytics. Individual publication links and a shared library let readers find your published content.'],
  awareness: ['Keep awareness going between courses.', 'Use curated email templates for ongoing awareness communication. Personalise a template, then use the campaign or export workflow rather than rebuilding every message from scratch.'],
  team: ['Bring colleagues in with clear roles.', 'Separate administrative work from read-only analytics using team roles. Workspace permissions determine what each signed-in colleague can see and do.'],
  sso: ['A clear entry for staff and learners.', 'Staff and learners have separate sign-in policies and entry links. Organisations can configure supported Google or Microsoft access for their own workspace.'],
  settings: ['Make the shared experience yours.', 'Your account profile and Publica library title help readers recognise your shared content. Workspace Genny can point you to the settings after sign-in.'],
};

export const GENNY_WEBSITE_TOPICS = topicsForAccess().map((topic) => ({
  ...topic,
  punch: WEBSITE_COPY[topic.id][0], explanation: WEBSITE_COPY[topic.id][1],
  steps: [
    ['Who it helps', topic.bestFor?.join(' · ') || 'Learning teams exploring LMSGEN and its shared learning experiences.'],
    ['What you gain', topic.outcomes?.join(' · ') || 'Connected course creation, delivery, publications and learning evidence.'],
    ['Try it in the demo', 'Sign in and select this module. Workspace Genny explains the hands-on steps and your access. Paid operations stay locked until activation.'],
  ],
}));

export const GENNY_WEBSITE_TOUR = ['overview', 'author', 'library', 'courses', 'publica', 'quizmoto', 'awareness', 'reports']
  .map((id) => GENNY_WEBSITE_TOPICS.find((topic) => topic.id === id));
