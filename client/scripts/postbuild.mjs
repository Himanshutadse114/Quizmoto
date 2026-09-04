const steps = [
  './prepare-marketing.mjs',
  './prepare-advantage-assets.mjs',
  './wire-contact-form.mjs',
  './remove-contact-image.mjs',
  './remove-home-metrics.mjs',
  './marketing-audit-polish.mjs',
  './stabilize-marketing-ui.mjs',
  './prepare-static-entrypoints.mjs',
  './marketing-seo-guard.mjs',
  './audit-marketing-ui.mjs',
];

const totalStartedAt = performance.now();

for (const step of steps) {
  const startedAt = performance.now();
  const label = step.replace('./', '');
  console.log(`\n[postbuild] Starting ${label}`);

  try {
    await import(step);
  } catch (error) {
    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(2);
    console.error(`[postbuild] Failed ${label} after ${elapsedSeconds}s`);
    throw error;
  }

  const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(2);
  console.log(`[postbuild] Finished ${label} in ${elapsedSeconds}s`);
}

const totalSeconds = ((performance.now() - totalStartedAt) / 1000).toFixed(2);
console.log(`\n[postbuild] All marketing steps completed in ${totalSeconds}s`);
