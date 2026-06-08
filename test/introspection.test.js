const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createIntrospection = require('../strategies/introspection');

test('createIntrospection retourne un objet avec une méthode authenticate', () => {
    const strategy = createIntrospection({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});