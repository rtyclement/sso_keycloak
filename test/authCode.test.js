const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createAuthorizationCode = require('../strategies/authCode');

test('createAuthorizationCode retourne un objet avec une méthode authenticate', () => {
    const strategy = createAuthorizationCode({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});