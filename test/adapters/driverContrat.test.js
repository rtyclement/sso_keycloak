const { test } = require('node:test');
const assert   = require('node:assert/strict');
const DriverContrat      = require('../../src/adapters/DriverContrat');
const { makeFakeDriver } = require('../support/fakeDriver');

test('Driver est une classe', () => {
    assert.equal(typeof DriverContrat, 'function');
});

test('chaque méthode du contrat throw si non implémentée', () => {
    const d = new DriverContrat();
    assert.throws(() => d.getSession({}),       /not implemented/i);
    assert.throws(() => d.getHeaders({}),       /not implemented/i);
    assert.throws(() => d.getBody({}),          /not implemented/i);
    assert.throws(() => d.getUrl({}),           /not implemented/i);
    assert.throws(() => d.getSessionId({}),     /not implemented/i);
    assert.throws(() => d.setPrincipal({}, {}), /not implemented/i);
    assert.throws(() => d.redirect({}, '/'),    /not implemented/i);
    assert.throws(() => d.deny({}, 403),        /not implemented/i);
    assert.throws(() => d.ok({}),               /not implemented/i);
    assert.throws(() => d.wrap(() => {}),       /not implemented/i);
    assert.throws(() => d.install({}, '/', () => {}), /not implemented/i);
    assert.throws(() => d.mountAuthRoutes({}, {}),    /not implemented/i);
    assert.throws(() => d.createStore(),              /not implemented/i);
    assert.throws(() => d.mountSession({}, {}),       /not implemented/i);
});

test('une sous-classe qui implémente ne throw pas', () => {
    const { driver } = makeFakeDriver();
    assert.doesNotThrow(() => driver.getSession({}));
    assert.doesNotThrow(() => driver.wrap(() => {}));
    assert.doesNotThrow(() => driver.install({}, '/', () => {}));
});
