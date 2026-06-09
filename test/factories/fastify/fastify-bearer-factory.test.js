const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createFastifyBearerSso = require('../../../src/factories/fastify/fastify-bearer');

const {buildFakeClient2} = require('../../Helper.test')

test('fastify-bearer échoue si issuerUrl est absent', () => {
    assert.throws(() => createFastifyBearerSso({}, {}), /issuerUrl/i);
});

test('fastify-bearer échoue si clientId est absent', () => {
    assert.throws(() => createFastifyBearerSso({}, { issuerUrl: 'x' }), /clientId/i);
});

test('fastify-bearer échoue si clientSecret est absent', () => {
    assert.throws(() => createFastifyBearerSso({}, { issuerUrl: 'x', clientId: 'y' }), /clientSecret/i);
});

test('fastify-bearer échoue si requiredRole est absent', () => {
    assert.throws(() => createFastifyBearerSso({}, { issuerUrl: 'x', clientId: 'y', clientSecret: 'z' }), /requiredRole/i);
});

test('fastify-bearer retourne un plugin qui enregistre une hook onRequest', async () => {
    const plugin = createFastifyBearerSso({}, {
        issuerUrl: 'http://kc/realms/r', clientId: 'c', clientSecret: 's', requiredRole: 'role',
        _client: buildFakeClient2(),
    });
    assert.equal(typeof plugin, 'function'); 

    const hooks = [];
    const fakeFastify = { addHook: (name, fn) => hooks.push({ name, fn }) };
    await plugin(fakeFastify);

    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].name, 'onRequest');
    assert.equal(typeof hooks[0].fn, 'function');
});