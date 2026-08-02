const { expect } = require('chai');
const { validateSocketPayload } = require('../validators/socketSchemas');

describe('socketSchemas', () => {
    it('should validate a correct join_room payload', () => {
        const payload = { pin: '123456', nickname: 'PlayerOne', role: 'player' };
        const { error, value } = validateSocketPayload('join_room', payload);
        expect(error).to.be.undefined;
        expect(value.pin).to.equal('123456');
    });

    it('should allow numeric pins and cast to string if specified by alternatives (though Joi passes through the accepted type)', () => {
        const payload = { pin: 123456, nickname: 'PlayerOne', role: 'player' };
        const { error, value } = validateSocketPayload('join_room', payload);
        expect(error).to.be.undefined;
        // The value is preserved as number because Joi.alternatives allows number
        expect(value.pin).to.equal(123456); 
    });

    it('should reject join_room with invalid role', () => {
        const payload = { pin: '123456', nickname: 'PlayerOne', role: 'hacker' };
        const { error } = validateSocketPayload('join_room', payload);
        expect(error).to.not.be.undefined;
        expect(error.details[0].message).to.include('"role" must be one of');
    });

    it('should strip unknown fields', () => {
        const payload = { pin: '123456', token: 'abc', maliciousField: true };
        const { error, value } = validateSocketPayload('start_question', payload);
        expect(error).to.be.undefined;
        expect(value.maliciousField).to.be.undefined;
    });

    it('should return payload directly if no schema exists', () => {
        const payload = { foo: 'bar' };
        const { error, value } = validateSocketPayload('non_existent_event', payload);
        expect(error).to.be.undefined;
        expect(value).to.deep.equal(payload);
    });

    it('should reject prototype pollution attempts and not mutate Object.prototype', () => {
        const payload = JSON.parse('{"pin":"123456", "token":"abc", "__proto__": {"polluted": "yes"}}');
        const { error, value } = validateSocketPayload('start_question', payload);
        
        // Ensure it doesn't pollute Object.prototype.
        expect({}.polluted).to.be.undefined;
        // Joi strips the __proto__ field
        expect(value.polluted).to.be.undefined;
    });

    it('should reject oversized payloads for strings', () => {
        const hugeNickname = 'A'.repeat(60);
        const payload = { pin: '123456', nickname: hugeNickname, role: 'player' };
        const { error } = validateSocketPayload('join_room', payload);
        expect(error).to.not.be.undefined;
        expect(error.details[0].message).to.include('less than or equal to 50 characters');
    });

    it('should accept valid reactions and reject invalid ones', () => {
        const valid = validateSocketPayload('send_reaction', { pin: '123', emoji: '❤️' });
        expect(valid.error).to.be.undefined;

        const invalid = validateSocketPayload('send_reaction', { pin: '123', emoji: '😈' });
        expect(invalid.error).to.not.be.undefined;
        expect(invalid.error.details[0].message).to.include('"emoji" must be one of');
    });
});
