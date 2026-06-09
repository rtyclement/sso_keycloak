const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { createSso } = require('../src/index');

test('createSso échoue si aucun framework n\'est reconnu', () => {
    assert.throws(() => createSso({}, {}), /framework/i);
});

test('createSso dispatche vers express (browser) quand express ET session sont présents', () => {
    // express + session → express.js → sessionSecret manquant
    assert.throws(() => createSso({ express: {}, session: {} }, {}), /sessionSecret/i);
});

test('createSso dispatche vers express-bearer quand express est présent sans session', () => {
    // express sans session → express-bearer.js → issuerUrl manquant
    assert.throws(() => createSso({ express: {} }, {}), /issuerUrl/i);
});