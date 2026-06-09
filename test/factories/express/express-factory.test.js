const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createExpressSso = require('../../../src/factories/express/express');

test('createExpressSso échoue si express n\'est pas injecté', () => {
    assert.throws(() => createExpressSso({}, { sessionSecret: 's' }), /express/i);
});

test('createExpressSso échoue si session n\'est pas injecté', () => {
    assert.throws(() => createExpressSso({ express: {} }, { sessionSecret: 's' }), /session/i);
});

test('createExpressSso échoue si sessionSecret est absent', () => {
    assert.throws(() => createExpressSso({ express: {}, session: {} }, {}), /sessionSecret/i);
});