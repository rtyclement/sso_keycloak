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