const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createIntrospection = require('../strategies/introspection');

test('createIntrospection retourne un objet avec une méthode authenticate', () => {
    const strategy = createIntrospection({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});

test('authenticate retourne deny quand le header Authorization est absent', async () => {
    const strategy = createIntrospection({});
    const decision = await strategy.authenticate({ headers: {} });

    assert.strictEqual(decision.type,   'deny');
    assert.strictEqual(decision.status, 401);
});