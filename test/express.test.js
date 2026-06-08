const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { guard, loginRoute, callbackRoute, backchannelRoute } = require('../adapters/express');

test('express adapter exporte guard, loginRoute, callbackRoute, backchannelRoute', () => {
    assert.strictEqual(typeof guard,            'function');
    assert.strictEqual(typeof loginRoute,       'function');
    assert.strictEqual(typeof callbackRoute,    'function');
    assert.strictEqual(typeof backchannelRoute, 'function');
});