const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createFastifySso  = require('../../../src/factories/fastify/fastify');
const { buildFakeClient2 } = require('../../Helper.test');

const BASE_DEPS = { session: {}, cookie: {}, formbody: {} };

test('fastify échoue si session n\'est pas injecté', () => {
    assert.throws(() => createFastifySso({}, {}), /session/i);
});

test('fastify échoue si cookie n\'est pas injecté', () => {
    assert.throws(() => createFastifySso({ session: {} }, {}), /cookie/i);
});

test('fastify échoue si formbody n\'est pas injecté', () => {
    assert.throws(() => createFastifySso({ session: {}, cookie: {} }, {}), /formbody/i);
});

test('fastify échoue si sessionSecret est absent', () => {
    assert.throws(() => createFastifySso(BASE_DEPS, {}), /sessionSecret/i);
});

test('fastify échoue si issuerUrl est absent', () => {
    assert.throws(() => createFastifySso(BASE_DEPS, { sessionSecret: 's' }), /issuerUrl/i);
});

test('fastify échoue si clientId est absent', () => {
    assert.throws(() => createFastifySso(BASE_DEPS, { sessionSecret: 's', issuerUrl: 'x' }), /clientId/i);
});

test('fastify échoue si clientSecret est absent', () => {
    assert.throws(() => createFastifySso(BASE_DEPS, { sessionSecret: 's', issuerUrl: 'x', clientId: 'y' }), /clientSecret/i);
});

test('fastify échoue si requiredRole est absent', () => {
    assert.throws(() => createFastifySso(BASE_DEPS, { sessionSecret: 's', issuerUrl: 'x', clientId: 'y', clientSecret: 'z' }), /requiredRole/i);
});

test('fastify enregistre cookie/session/formbody, 3 routes et la garde', async () => {
    const noop   = () => {};
    const plugin = createFastifySso(
        { session: noop, cookie: noop, formbody: noop },
        { issuerUrl: 'http://kc/realms/r', clientId: 'c', clientSecret: 's',
          requiredRole: 'role', sessionSecret: 'secret', _client: buildFakeClient2() },
    );
    assert.equal(typeof plugin, 'function');

    const registered = [];
    const routes     = [];
    const hooks      = [];
    const fakeFastify = {
        register: async (p) => registered.push(p),
        get:      (path)    => routes.push(path),
        post:     (path)    => routes.push(path),
        addHook:  (name)    => hooks.push(name),
    };

    await plugin(fakeFastify);

    assert.equal(registered.length, 3);
    assert.deepEqual(routes.sort(), ['/backchannel-logout', '/callback', '/login']);
    assert.deepEqual(hooks, ['onRequest']);
});