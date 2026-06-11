const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');
const DRIVERS  = require('../src/adapters/Drivers');
const DriverContrat = require('../src/adapters/DriverContrat');
const VALID_CONFIG = {
    issuerUrl:     'http://kc/realms/r',
    clientId:      'c',
    clientSecret:  's',
    requiredRole:  'role',
    sessionSecret: 'secret',
};
const { compilePattern } = require('../src/Keycloak');
const { matchRule } = require('../src/Keycloak');
const { buildFakeClient } = require('./Helper.test');

test('Keycloak expose une méthode ready() qui retourne une Promise', () => {
    const kc = new Keycloak(DRIVERS.EXPRESS, {
        ...VALID_CONFIG,
        _client: buildFakeClient(),
    });
    assert.ok(kc.ready() instanceof Promise);
});

test('ready() se résout sans erreur avec un client valide', async () => {
    const kc = new Keycloak(DRIVERS.EXPRESS, {
        ...VALID_CONFIG,
        _client: buildFakeClient(),
    });
    await assert.doesNotReject(() => kc.ready());
});