// tests/e2e/global-setup.js
require('../../server/node_modules/dotenv').config({ path: './server/.env.test' }); // load test env
const { seedTestFixtures } = require('../../server/tests/fixtures');

module.exports = async () => {
    // Note: ensure NODE_ENV is set correctly
    process.env.NODE_ENV = 'test';
    console.log('Seeding test fixtures...');
    try {
        await seedTestFixtures();
        console.log('Test fixtures seeded successfully.');
    } catch (err) {
        console.error('Failed to seed fixtures:', err);
        throw err;
    }
};
