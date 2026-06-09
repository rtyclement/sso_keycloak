const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Adapter  = require('../adapters/Adapter');
const {buildFakeDriver, buildReq} = require('./Helper.test');


test('Adapter expose guard, loginRoute, callbackRoute et backchannelRoute', () => {
    const { driver } = buildFakeDriver();
    const adapter    = new Adapter(driver);

    assert.strictEqual(typeof adapter.guard,            'function');
    assert.strictEqual(typeof adapter.loginRoute,       'function');
    assert.strictEqual(typeof adapter.callbackRoute,    'function');
    assert.strictEqual(typeof adapter.backchannelRoute, 'function');
});

test('Adapter.DRIVERS expose EXPRESS et FASTIFY avec les bonnes clés', () => {
    const keys = ['getSession', 'getHeaders', 'getBody', 'getUrl',
                  'getSessionId', 'setPrincipal', 'redirect', 'deny', 'ok', 'continue'];

    for (const key of keys) {
        assert.strictEqual(typeof Adapter.DRIVERS.EXPRESS[key], 'function', `EXPRESS manque : ${key}`);
        assert.strictEqual(typeof Adapter.DRIVERS.FASTIFY[key], 'function', `FASTIFY manque : ${key}`);
    }
});

test('guard appelle continue et attache le principal sur allow', async () => {
    const principal    = { sub: 'user-123', roles: ['admin'] };
    const fakeStrategy = { authenticate: async () => ({ type: 'allow', principal }) };
    const { driver, log } = buildFakeDriver();
    const adapter      = new Adapter(driver);

    const req  = buildReq();
    let nextCalled = false;

    await adapter.guard(fakeStrategy)(req, {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
    assert.strictEqual(log.principal, principal);
});