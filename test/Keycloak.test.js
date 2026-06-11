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

test('Keycloak expose une méthode protect', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.equal(typeof kc.protect, 'function');
});

test('protect échoue si app est absent', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect(null, '/api', 'bearer'), /app/i);
});

test('protect échoue si mode est absent', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect({}, '/api', null), /mode/i);
});

test('protect échoue si mode est diffent de session ou bearer', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect({}, '/api', 'fizhfoiahf'), /mode/i);
    assert.throws(() => kc.protect({}, '/api', ''), /mode/i);
    assert.doesNotThrow(() => kc.protect({}, '/api', 'session'), /mode/i);
    assert.doesNotThrow(() => kc.protect({}, '/api', 'bearer'), /mode/i);
});

test('Le constructeur enregistre bien le framework choisi', () => {
    const kc = new Keycloak({framework: 'express'});
    assert.equal(kc.getFramework(),'express');
})
