(() => {
  'use strict';
  const data = window.GeometryGameData;
  if (!data?.levels) return;

  const shapes = data.levels.filter((level) => level.phase === 'shape');
  const gravity = data.levels
    .filter((level) => level.phase === 'gravity')
    .sort((a, b) => (a.id || 0) - (b.id || 0));

  for (const level of shapes) {
    if (level.family === 'Composite Shapes') level.family = 'Mixed Composite Shapes';
    if (level.title === 'Exponential Growth Pair') level.title = 'Exponential Decay Pair';
  }

  data.levels.splice(0, data.levels.length, ...shapes, ...gravity);
  data.levels.forEach((level, index) => {
    level.originalId = level.originalId ?? level.id;
    level.id = index + 1;
  });

  window.GeometryCurriculum = {
    total: data.levels.length,
    shapeCount: shapes.length,
    gravityCount: gravity.length,
    firstGravityIndex: shapes.length
  };
})();
