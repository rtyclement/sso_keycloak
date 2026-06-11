const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');

test('Keycloak est une classe instanciable', () => {
    assert.equal(typeof Keycloak, 'function');
});

test('Keycloak échoue si framework est absent', () => {
    assert.throws(() => new Keycloak({}), /framework/i);
});

test('Keycloak échoue si framework est invalide', () => {
    assert.throws(() => new Keycloak({ framework: 'django' }), /framework/i);
});

test('Keycloak accepte express', () => {
    assert.doesNotThrow(() => new Keycloak({ framework: 'express' }));
});

test('Keycloak accepte fastify', () => {
    assert.doesNotThrow(() => new Keycloak({ framework: 'fastify' }));
});