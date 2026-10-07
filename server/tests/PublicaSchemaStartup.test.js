const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('Publica additive schema startup', () => {
    it('does not ask Sequelize sync to index a production column before it exists', () => {
        const model = source('models/Flipbook.js');
        const service = source('services/FlipbookService.js');

        expect(model).to.include('isPlatformDefault: {');
        expect(model).to.not.include("{ fields: ['isPlatformDefault'] }");
        expect(service.indexOf("await qi.addColumn(table, 'isPlatformDefault'")).to.be.lessThan(
            service.indexOf("await qi.addIndex(table, ['isPlatformDefault']")
        );
    });

    it('finishes the Publica migration before the server accepts traffic', () => {
        const server = source('index.js');
        expect(server).to.include("const { ensureFlipbookSchema } = require('./services/FlipbookService')");
        expect(server).to.include('await ensureFlipbookSchema();');
        expect(server).to.include("logger.info('publica_schema_ready'");
    });
});
