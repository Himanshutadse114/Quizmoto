// Illustrative guidance, grounded in scormFeatureCatalog and the demo route gates.
// Never presented as real tenant activity, and never grants access to a module.
export const GENNY_DEMO_GUIDANCE = {
  overview: {
    detail: 'Think of LMSGEN as three connected jobs: make useful content, get it to the right audience, then understand the evidence. Courses teach and assess; Publica makes documents easy to read; Quizmoto brings live energy to a session. Each has its own delivery and results workflow.',
    available: 'Try the configured demo course, explore Publica within your account allowance, and inspect the other module previews. A demo course or included publication appears only when configured by the platform administrator.',
    example: 'For new-employee onboarding, build a short course, prepare the learner roster, assign it through a campaign, and review completion. Publish the reference handbook separately in Publica so people can revisit it.',
    tip: 'Start with one outcome: learning completion, document readership or live participation. Choose the matching tool instead of treating all three as the same measurement.',
    question: 'Why can I see a module but not use its controls?',
    answer: 'The demo explains the full workflow while protecting operational data. Tenant activation unlocks paid operations, subject to your role and configured allowances; Genny cannot activate access.',
    next: ['courses', 'publica', 'author'],
  },
  author: {
    detail: 'Start from a learning brief, policy PDF, Word document or PowerPoint. Define who the course is for and how much detail they need, review the generated outline and questions, then build the learner experience. AI is the first draft—not the final reviewer.',
    available: 'Explore the authoring workflow in the preview. Course generation and source uploads stay locked until tenant activation.',
    example: 'Turn a phishing-awareness policy into a short course for new employees. Ask for practical examples, check the draft against the source policy, and review every correct answer before publishing.',
    tip: 'Use a specific audience and learning objective. After generation, use Content Editor for supported revisions; use Course Management to prepare delivery.',
    question: 'Can I take the result to another LMS?', answer: 'The workflow can produce a portable SCORM package for a compatible LMS. Preview the package and verify tracking in the destination LMS before rollout.', next: ['visualStudio', 'library', 'courses'],
  },
  library: {
    detail: 'The Course Library holds the content package; Course Management holds the delivery workspace. Import a compatible SCORM ZIP, inspect processing status and launch metadata, then create a course from a ready package. Keeping those jobs separate helps you find problems before learners do.',
    available: 'Inspect the package workflow in the preview. Uploads and package operations require an activated tenant.',
    example: 'You already have a compliance course from another authoring tool. Import its SCORM ZIP, check readiness, create a course and test the learner launch before sharing it.',
    tip: 'A package being present does not mean it is ready. Check validation and the launch file first. Editing arbitrary third-party SCORM source content is not the same as editing supported LMSGEN-generated content.',
    question: 'Library or Courses—which do I use?', answer: 'Use Library to manage the package and its readiness. Use Courses to publish, share access and inspect course-level activity.', next: ['courses', 'tracking'],
  },
  courses: {
    detail: 'This is where content becomes a learner-ready course: review a draft, configure its entry point, publish it and share its invite link. Generated, imported and video-based learning can feed the delivery workflow. Direct course activity and campaign activity are separate contexts.',
    available: 'If a demo course is configured, run it as a learner and return to Your demo learning activity. Your demonstration is private and does not create tenant learner assignments. Publishing and managing tenant courses remain locked.',
    example: 'Open the demo course, complete a few screens and a knowledge check, then return to refresh your results. Compare progress, score, time and last location with what you actually did.',
    tip: 'Progress, completion and score are different signals. A score may be absent until an assessment sends it; resume location helps you continue rather than proving completion.',
    question: 'Why is there no demo course or no score yet?', answer: 'The administrator must configure a usable demo course. Evidence depends on what that course sends; a missing score does not necessarily mean tracking failed.', next: ['tracking', 'reports', 'campaigns'],
  },
  roster: {
    detail: 'Build a reusable directory of approved learner names and email addresses. Add one person or import CSV/TXT, then review invalid rows and duplicates. Append extends the existing directory; Replace treats the imported list as authoritative and can remove existing entries.',
    available: 'Read the learner-import workflow in the preview. Demo accounts cannot import or change tenant learner records.',
    example: 'For an onboarding cohort, prepare Name and Email columns, check the addresses, and use Append to add new starters without replacing the existing roster.',
    tip: 'Use the downloadable template after activation. Choose Replace only when the file represents the whole intended roster—not just the latest intake.',
    question: 'Does importing a roster automatically assign a course?', answer: 'No. The roster prepares the audience; choose courses and learners in Campaigns & Assignments to organise delivery.', next: ['campaigns', 'sso'],
  },
  campaigns: {
    detail: 'A campaign connects selected courses to a defined learner audience and due-date expectations. Name the rollout, choose the learning, select people from the roster, then follow campaign-specific results. This keeps a cohort initiative distinct from people using direct course links.',
    available: 'Explore assignment planning in the preview. Creating campaigns and changing learner membership require activation.',
    example: 'Plan an annual refresher: choose the course, select the intended cohort, set the deadline and review that campaign’s progress for follow-up.',
    tip: 'Decide the audience and reporting scope before launch. Use the campaign’s own performance view when checking the rollout, not an unrelated direct-course total.',
    question: 'How is this different from sharing an invite link?', answer: 'Direct sharing opens an individual course entry point. A campaign organises selected learning and learners into a named initiative with its own delivery context and evidence.', next: ['roster', 'tracking', 'reports'],
  },
  visualStudio: {
    detail: 'Refine a supported AI-generated or presentation-based course without creating a new delivery identity. Review learner copy and questions, adjust themes, or update presentation slides and branding, then rebuild the existing package.',
    available: 'Explore supported editing options in the preview. Editing and rebuilding course packages require activation.',
    example: 'A policy paragraph changes after review. Correct the generated copy and its knowledge check, preview the revision, then rebuild the same course rather than distributing a new invite link.',
    tip: 'Review both the wording and the answer key. This editor is for supported LMSGEN content, not a promise to modify any uploaded third-party SCORM package.',
    question: 'Will a rebuild change my course link?', answer: 'The supported in-place rebuild preserves the course workspace and its delivery links and tracking context. Preview the updated learner experience before rollout.', next: ['author', 'courses'],
  },
  tracking: {
    detail: 'Tracking explains individual learning activity: progress, completion, score, attempts, time, last location and captured question interactions. Those values come from course runtime data; LMSGEN cannot invent assessment evidence the package never reports.',
    available: 'Inspect the tracking capabilities in the preview. Use the demo course’s private activity card for your own demonstration; tenant learner tracking remains locked.',
    example: 'A learner says the course did not finish. After activation, inspect their latest state and resume position, then check whether the package reported completion rather than assuming the score alone proves it.',
    tip: 'Always confirm the learner, course and delivery context. Campaign performance belongs in the campaign view; direct-learning evidence should not be mixed with it.',
    question: 'Does 100% progress always mean passed?', answer: 'No. Progress, completion and success/score can be separate values. Interpret the evidence according to what that course reports.', next: ['courses', 'reports'],
  },
  reports: {
    detail: 'Reports turn course, learner and campaign records into summaries and individual evidence. Inspect completion, scores, attempts and captured answers with their correct-answer context; learner-level reports can be exported to PDF or Excel.',
    available: 'Explore report types in the preview. Real learner reporting and exports require activated access and an appropriate role.',
    example: 'A training coordinator needs evidence for one learner. Select the correct course or campaign context, inspect their assessment record and export the learner report for the authorised stakeholder.',
    tip: 'Learning reports are not Publica reader analytics or Quizmoto session results. Those products have their own evidence views; choose the right workspace first.',
    question: 'Will demo activity appear in my tenant learner reports?', answer: 'The private demo course run is not a tenant learner assignment. Use its demo activity card to inspect the demonstration, not tenant operational reports.', next: ['tracking', 'campaigns'],
  },
  quizmoto: {
    detail: 'Quizmoto is for live participation: prepare an editable question set manually or with AI assistance, host a lobby, let players join with a PIN, and run interactive rounds. Review the session’s participant results afterwards.',
    available: 'Explore the live-quiz workflow in the preview. Quiz creation, hosting and paid operations stay locked for demo accounts.',
    example: 'Finish a workshop with a short knowledge-reinforcement quiz. Review the questions in advance, share the lobby PIN during the session and use the results to decide which ideas need revisiting.',
    tip: 'A live quiz measures participation and answers in that session. It is not a replacement for a tracked course’s completion record.',
    question: 'Can I host a live session from this demo?', answer: 'Not from a demo account. You can understand the workflow here; hosting requires an activated tenant and the appropriate access.', next: ['author', 'courses'],
  },
  publica: {
    detail: 'Publica turns a PDF or image set into a digital publication readers can open through a link. Publish individual editions or share the library link for your published collection, then inspect reader sessions and engagement in Publica’s analytics.',
    available: 'Open Publica and check your displayed allowance. Starter operations are available within your account limits; an included publication appears if configured. Genny never assumes unlimited publishing.',
    example: 'Publish a new-employee handbook as a flipbook, review it on phone and desktop, then share the reading link. Use your library link when you want readers to browse the whole published collection.',
    tip: 'Drafts do not belong in the public library. Publication reader engagement is distinct from SCORM completion, and the library name can be personalised in Account Settings.',
    question: 'One publication link or the library link?', answer: 'The publication link opens one edition. The library link shows your published collection. Review the publication’s public state before sharing either.', next: ['settings', 'courses'],
  },
  awareness: {
    detail: 'Start from a curated awareness-email design, add it to your tenant library, then tailor the message, branding and recipients. Send or export the campaign and inspect delivery and engagement evidence from its detail view.',
    available: 'Explore templates and the campaign workflow in the preview. Editing, sending and operational exports require activation.',
    example: 'Use a phishing-awareness design for a monthly reminder, personalise the guidance for your team, review the recipients and inspect campaign delivery after sending.',
    tip: 'Reusable templates and sent campaigns are different assets. Personalise a library copy while keeping the source design reusable. An email open is not proof of course completion.',
    question: 'Is this the same as a learning campaign?', answer: 'No. Awareness Emails delivers communication; Campaigns & Assignments delivers selected courses to learners. Each has its own audience workflow and evidence.', next: ['campaigns', 'author'],
  },
  team: {
    detail: 'Give colleagues their own tenant-contained staff identities instead of sharing an administrator login. Separate administration from read-only analytics access and review membership status when responsibilities change.',
    available: 'Read about staff roles in the preview. Invitations and membership changes require activation and an authorised administrator.',
    example: 'An L&D colleague needs to manage delivery while a stakeholder only needs results. Choose appropriate staff roles so the stakeholder does not receive editing powers unnecessarily.',
    tip: 'Staff membership is not the learner roster. Staff operate the workspace; learners consume assigned learning. Review tenant identity before changing access.',
    question: 'Does activation give every user admin powers?', answer: 'No. Tenant activation and staff role are separate checks. An analytics viewer remains read-only, and management controls require the appropriate role.', next: ['sso', 'roster'],
  },
  sso: {
    detail: 'Configure staff and learner authentication independently. Supported Google or Microsoft organisation sign-in can be part of tenant policy; the staff login link and learner portal link serve different audiences.',
    available: 'Explore authentication choices in the preview. Connecting providers and changing tenant access policy require activated administrator access.',
    example: 'Your IT team wants staff to use organisation Microsoft sign-in while learners follow a separately configured policy. Review both audiences and their entry links before changing the tenant settings.',
    tip: 'Do not assume the staff login policy automatically applies to learners. Check the tenant, identity provider and intended audience before enforcing sign-in.',
    question: 'Why are there two access links?', answer: 'The staff link opens the tenant’s staff authentication flow. The learner portal is for assigned learner identities and their available courses.', next: ['team', 'roster'],
  },
  settings: {
    detail: 'Personalise your display name and avatar, and set the title readers see on your shared Publica library. These are identity and presentation settings—not tenant activation or staff-permission controls.',
    available: 'Account Settings is available in the demo. Review changes before saving; your account email remains your identity.',
    example: 'Give the shared publication library a recognisable title such as Team Handbook Library, then open its public link to check what readers see.',
    tip: 'Use Tenant Management or Team & Roles for authorised access administration. Changing a library title does not change a publication’s public state.',
    question: 'Can I change my account email here?', answer: 'The account email remains the identity used for access. The supported profile settings cover display name, avatar and the Publica library title.', next: ['publica', 'overview'],
  },
};

export function demoGuidanceFor(topic) { return GENNY_DEMO_GUIDANCE[topic?.id] || null; }

export function demoTopics(topics) {
  return topics.map((topic) => {
    const guidance = demoGuidanceFor(topic);
    return guidance ? { ...topic, searchDetail: [guidance.detail, guidance.example, guidance.tip, guidance.question, guidance.answer].join(' ') } : topic;
  });
}
