const { expect } = require('chai');
const {
    accountStatus,
    assertActiveAccount,
    cleanAvatar,
    cleanDisplayName,
    cleanLibraryTitle
} = require('../services/AccountProfileService');

describe('AccountProfileService', () => {
    it('normalizes names used by account and Publica settings', () => {
        expect(cleanDisplayName('  Mahesh   Hattimare ')).to.equal('Mahesh Hattimare');
        expect(cleanLibraryTitle('  Mahesh   Publications ')).to.equal('Mahesh Publications');
    });

    it('accepts secure avatar URLs and supported uploaded image data', () => {
        expect(cleanAvatar('https://cdn.example.com/avatar.png')).to.equal('https://cdn.example.com/avatar.png');
        expect(cleanAvatar('data:image/png;base64,AAAA')).to.equal('data:image/png;base64,AAAA');
        expect(cleanAvatar('')).to.equal(null);
    });

    it('rejects unsafe avatar schemes', () => {
        expect(() => cleanAvatar('javascript:alert(1)')).to.throw('secure image URL');
        expect(() => cleanAvatar('http://example.com/avatar.png')).to.throw('secure image URL');
    });

    it('defaults legacy accounts to active and blocks removed identities', () => {
        expect(accountStatus({})).to.equal('active');
        expect(() => assertActiveAccount({ accountStatus: 'removed' })).to.throw('removed');
        expect(() => assertActiveAccount({ accountStatus: 'blocked' })).to.throw('blocked');
        expect(assertActiveAccount({ accountStatus: 'active', id: 4 }).id).to.equal(4);
    });
});
