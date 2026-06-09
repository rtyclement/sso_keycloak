const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createExpressBearerSso = require('../../../src/factories/express/express-bearer');

const {buildFakeClient2} = require('../../Helper.test')

test('express-bearer échoue si issuerUrl est absent', () => {
    assert.throws(() => createExpressBearerSso({}, {}), /issuerUrl/i);
});

test('express-bearer échoue si clientId est absent', () => {
    assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x' }), /clientId/i);
});

test('express-bearer échoue si clientSecret est absent', () => {
    assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x', clientId: 'y' }), /clientSecret/i);
});

test('express-bearer échoue si requiredRole est absent', () => {
    assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x', clientId: 'y', clientSecret: 'z' }), /requiredRole/i);
});

test('express-bearer retourne une middleware après init via core.js', async () => {
    const mw = createExpressBearerSso({}, {
        issuerUrl: 'http://kc/realms/r', clientId: 'c', clientSecret: 's', requiredRole: 'role',
        _client: buildFakeClient2(),
    });
    assert.equal(typeof mw, 'function');
    assert.equal(mw.length, 3);
});