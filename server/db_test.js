const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    'sys',
    '3rsKTVhUD9KujyQ.root',
    'N4gsZ7ZqOlxKYjnT',
    {
        host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
        dialect: 'mysql',
        port: 4000,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: true
            }
        }
    }
);

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');
        
        // Let's create a real database
        await sequelize.query('CREATE DATABASE IF NOT EXISTS kahoot_awareness;');
        console.log('Database kahoot_awareness created!');
        
        const [results] = await sequelize.query('SHOW DATABASES;');
        console.log('Databases:', results);
    } catch(e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}

check();
