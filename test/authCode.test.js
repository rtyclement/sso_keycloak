const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createAuthorizationCode = require('../strategies/authCode');

test('createAuthorizationCode retourne un objet avec une méthode authenticate', () => {
    const strategy = createAuthorizationCode({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});

test('authenticate redirige vers /login quand la session est vide', async () => {
    const strategy = createAuthorizationCode({});
    const decision = await strategy.authenticate({ session: {} });

    assert.strictEqual(decision.type, 'redirect');
    assert.strictEqual(decision.url,  '/login');
});