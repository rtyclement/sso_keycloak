const { test } = require('node:test');
const assert   = require('node:assert/strict');

test('index exporte Keycloak et DRIVERS', () => {
    const { Keycloak, DRIVERS } = require('../src/index');
    assert.equal(typeof Keycloak, 'function');
    assert.ok(DRIVERS.EXPRESS);
    assert.ok(DRIVERS.FASTIFY);
});
