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